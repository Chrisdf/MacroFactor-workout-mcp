export interface WorkoutSet {
  weight: number;
  reps: number;
  rir?: number; // reps in reserve
}

export interface WorkoutExercise {
  name: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  date: string; // ISO 8601, e.g. "2026-04-13"
  name: string;
  exercises: WorkoutExercise[];
}

export type WorkoutCreateInput = Omit<Workout, 'id'>;
export type WorkoutUpdateInput = Partial<WorkoutCreateInput>;

export interface PlanExercise {
  name: string;
  sets?: number;
  reps?: number;
}

export interface PlanDay {
  exercises: PlanExercise[];
}

export interface PlanWeek {
  days: PlanDay[];
}

export interface Plan {
  id: string;
  name: string;
  weeks: PlanWeek[];
}

export type PlanCreateInput = Omit<Plan, 'id'>;
export type PlanUpdateInput = Partial<PlanCreateInput>;

export interface ListOptions {
  limit?: number;
  startAfter?: string; // pagination cursor / last document ID
}
