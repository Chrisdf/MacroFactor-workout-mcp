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

export class RestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(`HTTP ${statusCode}: ${message}`);
    this.name = 'RestError';
  }
}

export interface RestConfig {
  baseUrl: string;
  token: string;
}

export class RestWorkoutClient implements IWorkoutClient {
  constructor(private readonly cfg: RestConfig) {}

  private async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${this.cfg.token}`,
        'Content-Type': 'application/json',
        ...(opts.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new RestError(res.status, body);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  private buildQuery(options?: ListOptions): string {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.startAfter) params.set('startAfter', options.startAfter);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  // ── Workouts ──────────────────────────────────────────────────────────────

  async listWorkouts(options?: ListOptions): Promise<Workout[]> {
    return this.request<Workout[]>(`/workouts${this.buildQuery(options)}`);
  }

  async getWorkout(id: string): Promise<Workout> {
    return this.request<Workout>(`/workouts/${id}`);
  }

  async createWorkout(data: WorkoutCreateInput): Promise<Workout> {
    return this.request<Workout>('/workouts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkout(id: string, data: WorkoutUpdateInput): Promise<Workout> {
    return this.request<Workout>(`/workouts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkout(id: string): Promise<void> {
    await this.request<void>(`/workouts/${id}`, { method: 'DELETE' });
  }

  // ── Plans ─────────────────────────────────────────────────────────────────

  async listPlans(options?: ListOptions): Promise<Plan[]> {
    return this.request<Plan[]>(`/plans${this.buildQuery(options)}`);
  }

  async getPlan(id: string): Promise<Plan> {
    return this.request<Plan>(`/plans/${id}`);
  }

  async createPlan(data: PlanCreateInput): Promise<Plan> {
    return this.request<Plan>('/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePlan(id: string, data: PlanUpdateInput): Promise<Plan> {
    return this.request<Plan>(`/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePlan(id: string): Promise<void> {
    await this.request<void>(`/plans/${id}`, { method: 'DELETE' });
  }
}
