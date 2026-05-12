import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { FirebaseWorkoutClient, FirebaseAuthError, FirebaseNotFoundError, FirebaseError } from '../client/firebase.js';
import type { FirebaseConfig } from '../client/firebase.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const cfg: FirebaseConfig = {
  email: 'test@example.com',
  password: 'password',
  apiKey: 'test-api-key',
  projectId: 'test-project',
};

function makeAuthResponse(expiresIn = 3600) {
  return {
    idToken: 'test-id-token',
    expiresIn: String(expiresIn),
  };
}

/** Build a minimal Firestore document response */
function makeFirestoreDoc(id: string, fields: Record<string, unknown>) {
  const firestoreFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') firestoreFields[k] = { stringValue: v };
    else if (typeof v === 'number' && Number.isInteger(v))
      firestoreFields[k] = { integerValue: String(v) };
    else if (typeof v === 'number')
      firestoreFields[k] = { doubleValue: v };
    else if (Array.isArray(v))
      firestoreFields[k] = { arrayValue: { values: [] } };
  }
  return {
    name: `projects/test-project/databases/(default)/documents/workouts/${id}`,
    fields: firestoreFields,
  };
}

function makeListResponse(docs: ReturnType<typeof makeFirestoreDoc>[]) {
  return { documents: docs };
}

/** Create a mock fetch that returns the given responses in sequence */
function mockFetchSequence(responses: Array<{ ok: boolean; status: number; body: unknown }>) {
  let call = 0;
  return vi.fn(async () => {
    const r = responses[call++] ?? { ok: false, status: 500, body: 'no more responses' };
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    };
  });
}

function authOk() {
  return { ok: true, status: 200, body: makeAuthResponse() };
}
function firestoreOk(body: unknown) {
  return { ok: true, status: 200, body };
}
function noContent() {
  return { ok: true, status: 204, body: null };
}
function notFound() {
  return { ok: false, status: 404, body: { error: { code: 404, message: 'Not found' } } };
}
function authFail() {
  return { ok: false, status: 401, body: { error: { code: 401, message: 'Unauthorized' } } };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FirebaseWorkoutClient — auth', () => {
  it('fetches a token on the first request', async () => {
    const fetchMock = mockFetchSequence([
      authOk(),
      firestoreOk(makeListResponse([])),
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    await client.listWorkouts();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [authUrl] = (fetchMock as MockedFunction<typeof fetch>).mock.calls[0] as [string];
    expect(authUrl).toContain('signInWithPassword');
    expect(authUrl).toContain('test-api-key');
  });

  it('reuses the token on subsequent requests without re-authenticating', async () => {
    const fetchMock = mockFetchSequence([
      authOk(),
      firestoreOk(makeListResponse([])),
      firestoreOk(makeListResponse([])),
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    await client.listWorkouts();
    await client.listWorkouts();

    // 1 auth + 2 Firestore calls = 3 total
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws FirebaseAuthError when credentials are wrong', async () => {
    const fetchMock = mockFetchSequence([
      { ok: false, status: 400, body: { error: { message: 'INVALID_PASSWORD' } } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    await expect(client.listWorkouts()).rejects.toBeInstanceOf(FirebaseAuthError);
  });

  it('throws FirebaseAuthError on 401 from Firestore', async () => {
    const fetchMock = mockFetchSequence([authOk(), authFail()]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    await expect(client.listWorkouts()).rejects.toBeInstanceOf(FirebaseAuthError);
  });
});

describe('FirebaseWorkoutClient — listWorkouts', () => {
  it('returns an empty array when there are no documents', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([authOk(), firestoreOk(makeListResponse([]))]));
    const client = new FirebaseWorkoutClient(cfg);
    const result = await client.listWorkouts();
    expect(result).toEqual([]);
  });

  it('maps Firestore documents to Workout objects with id', async () => {
    const doc = makeFirestoreDoc('abc123', { date: '2026-04-13', name: 'Push Day' });
    vi.stubGlobal('fetch', mockFetchSequence([authOk(), firestoreOk(makeListResponse([doc]))]));

    const client = new FirebaseWorkoutClient(cfg);
    const [workout] = await client.listWorkouts();

    expect(workout.id).toBe('abc123');
    expect(workout.date).toBe('2026-04-13');
    expect(workout.name).toBe('Push Day');
  });

  it('passes limit as pageSize query param', async () => {
    const fetchMock = mockFetchSequence([authOk(), firestoreOk(makeListResponse([]))]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    await client.listWorkouts({ limit: 5 });

    const [, firestoreUrl] = (fetchMock as MockedFunction<typeof fetch>).mock.calls.map(
      ([url]) => url as string
    );
    expect(firestoreUrl).toContain('pageSize=5');
  });

  it('passes startAfter as pageToken query param', async () => {
    const fetchMock = mockFetchSequence([authOk(), firestoreOk(makeListResponse([]))]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    await client.listWorkouts({ startAfter: 'cursor-token' });

    const [, firestoreUrl] = (fetchMock as MockedFunction<typeof fetch>).mock.calls.map(
      ([url]) => url as string
    );
    expect(firestoreUrl).toContain('pageToken=cursor-token');
  });
});

describe('FirebaseWorkoutClient — getWorkout', () => {
  it('requests the correct document URL', async () => {
    const fetchMock = mockFetchSequence([
      authOk(),
      firestoreOk(makeFirestoreDoc('wk1', { name: 'Leg Day', date: '2026-04-10' })),
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    const workout = await client.getWorkout('wk1');

    expect(workout.id).toBe('wk1');
    const [, firestoreUrl] = (fetchMock as MockedFunction<typeof fetch>).mock.calls.map(
      ([url]) => url as string
    );
    expect(firestoreUrl).toContain('/workouts/wk1');
  });

  it('throws FirebaseNotFoundError on 404', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([authOk(), notFound()]));
    const client = new FirebaseWorkoutClient(cfg);
    await expect(client.getWorkout('missing')).rejects.toBeInstanceOf(FirebaseNotFoundError);
  });
});

describe('FirebaseWorkoutClient — createWorkout', () => {
  it('POSTs to the workouts collection with a documentId', async () => {
    const created = makeFirestoreDoc('new-uuid', { name: 'Pull Day', date: '2026-04-14' });
    const fetchMock = mockFetchSequence([authOk(), firestoreOk(created)]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    const workout = await client.createWorkout({
      date: '2026-04-14',
      name: 'Pull Day',
      exercises: [],
    });

    expect(workout.id).toBe('new-uuid');
    const [, [firestoreUrl, opts]] = (fetchMock as MockedFunction<typeof fetch>).mock.calls;
    expect(String(firestoreUrl)).toContain('/workouts?documentId=');
    expect((opts as RequestInit).method).toBe('POST');
  });
});

describe('FirebaseWorkoutClient — updateWorkout', () => {
  it('PATCHes the correct document with a field mask', async () => {
    const updated = makeFirestoreDoc('wk1', { name: 'Updated Name', date: '2026-04-13' });
    const fetchMock = mockFetchSequence([authOk(), firestoreOk(updated)]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    await client.updateWorkout('wk1', { name: 'Updated Name' });

    const [, [firestoreUrl, opts]] = (fetchMock as MockedFunction<typeof fetch>).mock.calls;
    expect(String(firestoreUrl)).toContain('/workouts/wk1');
    expect(String(firestoreUrl)).toContain('updateMask.fieldPaths=name');
    expect((opts as RequestInit).method).toBe('PATCH');
  });
});

describe('FirebaseWorkoutClient — deleteWorkout', () => {
  it('sends DELETE to the correct document URL', async () => {
    const fetchMock = mockFetchSequence([authOk(), noContent()]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    await expect(client.deleteWorkout('wk1')).resolves.toBeUndefined();

    const [, [firestoreUrl, opts]] = (fetchMock as MockedFunction<typeof fetch>).mock.calls;
    expect(String(firestoreUrl)).toContain('/workouts/wk1');
    expect((opts as RequestInit).method).toBe('DELETE');
  });
});

describe('FirebaseWorkoutClient — plans', () => {
  it('listPlans hits the plans collection', async () => {
    const fetchMock = mockFetchSequence([authOk(), firestoreOk(makeListResponse([]))]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    await client.listPlans();

    const [, firestoreUrl] = (fetchMock as MockedFunction<typeof fetch>).mock.calls.map(
      ([url]) => url as string
    );
    expect(firestoreUrl).toContain('/plans');
  });

  it('createPlan returns a plan with id', async () => {
    const doc = {
      name: `projects/test-project/databases/(default)/documents/plans/plan-123`,
      fields: { name: { stringValue: 'My Plan' } },
    };
    vi.stubGlobal('fetch', mockFetchSequence([authOk(), firestoreOk(doc)]));

    const client = new FirebaseWorkoutClient(cfg);
    const plan = await client.createPlan({ name: 'My Plan', weeks: [] });
    expect(plan.id).toBe('plan-123');
  });

  it('deletePlan sends DELETE to plans collection', async () => {
    const fetchMock = mockFetchSequence([authOk(), noContent()]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    await client.deletePlan('plan-1');

    const [, [firestoreUrl, opts]] = (fetchMock as MockedFunction<typeof fetch>).mock.calls;
    expect(String(firestoreUrl)).toContain('/plans/plan-1');
    expect((opts as RequestInit).method).toBe('DELETE');
  });
});

describe('FirebaseWorkoutClient — generic errors', () => {
  it('throws FirebaseError for unexpected 5xx responses', async () => {
    const fetchMock = mockFetchSequence([
      authOk(),
      { ok: false, status: 503, body: 'Service Unavailable' },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FirebaseWorkoutClient(cfg);
    const err = await client.listWorkouts().catch((e) => e);
    expect(err).toBeInstanceOf(FirebaseError);
    expect((err as FirebaseError).statusCode).toBe(503);
  });
});
