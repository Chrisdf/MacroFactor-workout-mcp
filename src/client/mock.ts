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

// In-memory store — data lives only for the duration of the process.
// Use API_BACKEND=mock to run the server without any credentials.
export class MockWorkoutClient implements IWorkoutClient {
  private workouts = new Map<string, Workout>();
  private plans = new Map<string, Plan>();
  private nextId = 1;

  constructor() {
    // Seed with a couple of realistic entries so the inspector isn't empty.
    const w1 = this.seed<Workout>({
      date: '2026-05-10',
      name: 'Push Day A',
      exercises: [
        { name: 'Bench Press', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 7 }] },
        { name: 'Overhead Press', sets: [{ weight: 50, reps: 8 }] },
      ],
    });
    this.workouts.set(w1.id, w1);

    const w2 = this.seed<Workout>({
      date: '2026-05-12',
      name: 'Pull Day A',
      exercises: [
        { name: 'Deadlift', sets: [{ weight: 120, reps: 5 }, { weight: 120, reps: 5 }] },
        { name: 'Barbell Row', sets: [{ weight: 70, reps: 8 }] },
      ],
    });
    this.workouts.set(w2.id, w2);

    const p1 = this.seed<Plan>({
      name: 'Push/Pull/Legs 3-day',
      weeks: [
        {
          days: [
            { exercises: [{ name: 'Bench Press', sets: 3, reps: 8 }, { name: 'Overhead Press', sets: 3, reps: 8 }] },
            { exercises: [{ name: 'Deadlift', sets: 3, reps: 5 }, { name: 'Barbell Row', sets: 3, reps: 8 }] },
            { exercises: [{ name: 'Squat', sets: 4, reps: 6 }, { name: 'Leg Press', sets: 3, reps: 10 }] },
          ],
        },
      ],
    });
    this.plans.set(p1.id, p1);
  }

  private seed<T>(data: Omit<T, 'id'>): T {
    return { id: `mock-${this.nextId++}`, ...data } as T;
  }

  private notFound(id: string): never {
    const err = new Error(`Document not found: ${id}`);
    err.name = 'FirebaseNotFoundError'; // same name so error handling in tools still matches
    throw err;
  }

  // ── Workouts ──────────────────────────────────────────────────────────────

  async listWorkouts(options?: ListOptions): Promise<Workout[]> {
    let all = [...this.workouts.values()].sort((a, b) => b.date.localeCompare(a.date));
    if (options?.startAfter) {
      const idx = all.findIndex((w) => w.id === options.startAfter);
      if (idx !== -1) all = all.slice(idx + 1);
    }
    if (options?.limit) all = all.slice(0, options.limit);
    return all;
  }

  async getWorkout(id: string): Promise<Workout> {
    return this.workouts.get(id) ?? this.notFound(id);
  }

  async createWorkout(data: WorkoutCreateInput): Promise<Workout> {
    const workout: Workout = { id: `mock-${this.nextId++}`, ...data };
    this.workouts.set(workout.id, workout);
    return workout;
  }

  async updateWorkout(id: string, data: WorkoutUpdateInput): Promise<Workout> {
    const existing = this.workouts.get(id) ?? this.notFound(id);
    const updated: Workout = { ...existing, ...data };
    this.workouts.set(id, updated);
    return updated;
  }

  async deleteWorkout(id: string): Promise<void> {
    if (!this.workouts.has(id)) this.notFound(id);
    this.workouts.delete(id);
  }

  // ── Plans ─────────────────────────────────────────────────────────────────

  async listPlans(options?: ListOptions): Promise<Plan[]> {
    let all = [...this.plans.values()];
    if (options?.startAfter) {
      const idx = all.findIndex((p) => p.id === options.startAfter);
      if (idx !== -1) all = all.slice(idx + 1);
    }
    if (options?.limit) all = all.slice(0, options.limit);
    return all;
  }

  async getPlan(id: string): Promise<Plan> {
    return this.plans.get(id) ?? this.notFound(id);
  }

  async createPlan(data: PlanCreateInput): Promise<Plan> {
    const plan: Plan = { id: `mock-${this.nextId++}`, ...data };
    this.plans.set(plan.id, plan);
    return plan;
  }

  async updatePlan(id: string, data: PlanUpdateInput): Promise<Plan> {
    const existing = this.plans.get(id) ?? this.notFound(id);
    const updated: Plan = { ...existing, ...data };
    this.plans.set(id, updated);
    return updated;
  }

  async deletePlan(id: string): Promise<void> {
    if (!this.plans.has(id)) this.notFound(id);
    this.plans.delete(id);
  }
}
