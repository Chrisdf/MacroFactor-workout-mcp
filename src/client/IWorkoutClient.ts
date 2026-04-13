import type {
  Workout,
  WorkoutCreateInput,
  WorkoutUpdateInput,
  Plan,
  PlanCreateInput,
  PlanUpdateInput,
  ListOptions,
} from '../types.js';

export interface IWorkoutClient {
  // ── Workouts ──────────────────────────────────────────────────────────────
  listWorkouts(options?: ListOptions): Promise<Workout[]>;
  getWorkout(id: string): Promise<Workout>;
  createWorkout(data: WorkoutCreateInput): Promise<Workout>;
  updateWorkout(id: string, data: WorkoutUpdateInput): Promise<Workout>;
  deleteWorkout(id: string): Promise<void>;

  // ── Plans ─────────────────────────────────────────────────────────────────
  listPlans(options?: ListOptions): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan>;
  createPlan(data: PlanCreateInput): Promise<Plan>;
  updatePlan(id: string, data: PlanUpdateInput): Promise<Plan>;
  deletePlan(id: string): Promise<void>;
}
