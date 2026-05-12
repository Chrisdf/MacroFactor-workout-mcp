import type { IWorkoutClient } from './IWorkoutClient.js';
import type {
  Workout,
  WorkoutCreateInput,
  WorkoutUpdateInput,
  Plan,
  PlanCreateInput,
  PlanUpdateInput,
  ListOptions,
} from '../types.js';

// ── Firebase-specific errors ──────────────────────────────────────────────────

export class FirebaseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirebaseAuthError';
  }
}

export class FirebaseNotFoundError extends Error {
  constructor(id: string) {
    super(`Document not found: ${id}`);
    this.name = 'FirebaseNotFoundError';
  }
}

export class FirebaseError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'FirebaseError';
  }
}

// ── Firestore REST type helpers ───────────────────────────────────────────────

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreFields = Record<string, FirestoreValue>;

interface FirestoreDocument {
  name?: string;
  fields?: FirestoreFields;
  createTime?: string;
  updateTime?: string;
}

interface FirestoreListResponse {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
}

export function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    const fields: FirestoreFields = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export function fromFirestoreValue(value: FirestoreValue): unknown {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return value.doubleValue;
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map(fromFirestoreValue);
  }
  if ('mapValue' in value) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

function toFirestoreFields(data: Record<string, unknown>): FirestoreFields {
  const fields: FirestoreFields = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function fromFirestoreFields(fields: FirestoreFields): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = fromFirestoreValue(v);
  }
  return obj;
}

function extractId(name: string): string {
  // Firestore resource name: projects/{p}/databases/(default)/documents/{col}/{id}
  return name.split('/').pop() ?? name;
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface FirebaseConfig {
  email: string;
  password: string;
  apiKey: string;
  projectId: string;
}

// ── Client implementation ─────────────────────────────────────────────────────

export class FirebaseWorkoutClient implements IWorkoutClient {
  private idToken: string | null = null;
  private tokenExpiry = 0; // Unix ms

  constructor(private readonly cfg: FirebaseConfig) {}

  // ── Auth ──────────────────────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    if (this.idToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.idToken;
    }
    return this.refreshToken();
  }

  private async refreshToken(): Promise<string> {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.cfg.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.cfg.email,
        password: this.cfg.password,
        returnSecureToken: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new FirebaseAuthError(`Authentication failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as { idToken: string; expiresIn: string };
    this.idToken = data.idToken;
    this.tokenExpiry = Date.now() + parseInt(data.expiresIn, 10) * 1000;
    return this.idToken;
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  private baseUrl(collection: string): string {
    return `https://firestore.googleapis.com/v1/projects/${this.cfg.projectId}/databases/(default)/documents/${collection}`;
  }

  private async request<T>(url: string, opts: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(opts.headers as Record<string, string> | undefined),
      },
    });

    if (res.status === 404) {
      throw new FirebaseNotFoundError(url);
    }
    if (res.status === 401 || res.status === 403) {
      const body = await res.text();
      throw new FirebaseAuthError(`Auth error (${res.status}): ${body}`);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new FirebaseError(res.status, body);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  // ── Generic CRUD ──────────────────────────────────────────────────────────

  private async listCollection(
    collection: string,
    options?: ListOptions
  ): Promise<Array<Record<string, unknown> & { id: string }>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('pageSize', String(options.limit));
    if (options?.startAfter) params.set('pageToken', options.startAfter);

    const url = `${this.baseUrl(collection)}?${params.toString()}`;
    const data = await this.request<FirestoreListResponse>(url);

    return (data.documents ?? []).map((doc) => ({
      id: extractId(doc.name ?? ''),
      ...fromFirestoreFields(doc.fields ?? {}),
    }));
  }

  private async getDocument(
    collection: string,
    id: string
  ): Promise<Record<string, unknown> & { id: string }> {
    const doc = await this.request<FirestoreDocument>(`${this.baseUrl(collection)}/${id}`);
    return { id: extractId(doc.name ?? id), ...fromFirestoreFields(doc.fields ?? {}) };
  }

  private async createDocument(
    collection: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown> & { id: string }> {
    const docId = crypto.randomUUID();
    const url = `${this.baseUrl(collection)}?documentId=${docId}`;
    const body = JSON.stringify({ fields: toFirestoreFields(data) });
    const doc = await this.request<FirestoreDocument>(url, { method: 'POST', body });
    return { id: extractId(doc.name ?? docId), ...fromFirestoreFields(doc.fields ?? {}) };
  }

  private async updateDocument(
    collection: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown> & { id: string }> {
    const fields = toFirestoreFields(data);
    const fieldPaths = Object.keys(fields)
      .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
      .join('&');
    const url = `${this.baseUrl(collection)}/${id}?${fieldPaths}`;
    const body = JSON.stringify({ fields });
    const doc = await this.request<FirestoreDocument>(url, { method: 'PATCH', body });
    return { id: extractId(doc.name ?? id), ...fromFirestoreFields(doc.fields ?? {}) };
  }

  private async deleteDocument(collection: string, id: string): Promise<void> {
    await this.request<void>(`${this.baseUrl(collection)}/${id}`, { method: 'DELETE' });
  }

  // ── Workouts ──────────────────────────────────────────────────────────────

  async listWorkouts(options?: ListOptions): Promise<Workout[]> {
    const docs = await this.listCollection('workouts', options);
    return docs as unknown as Workout[];
  }

  async getWorkout(id: string): Promise<Workout> {
    const doc = await this.getDocument('workouts', id);
    return doc as unknown as Workout;
  }

  async createWorkout(data: WorkoutCreateInput): Promise<Workout> {
    const doc = await this.createDocument('workouts', data as Record<string, unknown>);
    return doc as unknown as Workout;
  }

  async updateWorkout(id: string, data: WorkoutUpdateInput): Promise<Workout> {
    const doc = await this.updateDocument('workouts', id, data as Record<string, unknown>);
    return doc as unknown as Workout;
  }

  async deleteWorkout(id: string): Promise<void> {
    await this.deleteDocument('workouts', id);
  }

  // ── Plans ─────────────────────────────────────────────────────────────────

  async listPlans(options?: ListOptions): Promise<Plan[]> {
    const docs = await this.listCollection('plans', options);
    return docs as unknown as Plan[];
  }

  async getPlan(id: string): Promise<Plan> {
    const doc = await this.getDocument('plans', id);
    return doc as unknown as Plan;
  }

  async createPlan(data: PlanCreateInput): Promise<Plan> {
    const doc = await this.createDocument('plans', data as Record<string, unknown>);
    return doc as unknown as Plan;
  }

  async updatePlan(id: string, data: PlanUpdateInput): Promise<Plan> {
    const doc = await this.updateDocument('plans', id, data as Record<string, unknown>);
    return doc as unknown as Plan;
  }

  async deletePlan(id: string): Promise<void> {
    await this.deleteDocument('plans', id);
  }
}
