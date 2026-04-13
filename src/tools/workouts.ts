import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IWorkoutClient } from '../client/IWorkoutClient.js';
import { FirebaseAuthError, FirebaseNotFoundError } from '../client/firebase.js';

const WorkoutSetSchema = z.object({
  weight: z.number().nonnegative().describe('Weight lifted (in your preferred unit, e.g. kg or lbs)'),
  reps: z.number().int().positive().describe('Number of repetitions'),
  rir: z.number().int().min(0).optional().describe('Reps in reserve (optional)'),
});

const WorkoutExerciseSchema = z.object({
  name: z.string().min(1).describe('Exercise name, e.g. "Bench Press"'),
  sets: z.array(WorkoutSetSchema).min(1).describe('One entry per set performed'),
});

const ExercisesField = z
  .array(WorkoutExerciseSchema)
  .min(1)
  .describe('List of exercises performed');

function handleError(err: unknown): { isError: true; content: [{ type: 'text'; text: string }] } {
  let message: string;
  if (err instanceof FirebaseAuthError) {
    message = 'Authentication failed. Check your MACROFACTOR_EMAIL and MACROFACTOR_PASSWORD.';
  } else if (err instanceof FirebaseNotFoundError) {
    message = err.message;
  } else if (err instanceof Error) {
    message = `Operation failed: ${err.message}`;
  } else {
    message = `Operation failed: ${String(err)}`;
  }
  return { isError: true, content: [{ type: 'text', text: message }] };
}

export function registerWorkoutTools(server: McpServer, client: IWorkoutClient): void {
  // ── create-workout ────────────────────────────────────────────────────────
  server.tool(
    'create-workout',
    'Log a new workout session to MacroFactor',
    {
      date: z.string().describe('Workout date in ISO 8601 format, e.g. "2026-04-13"'),
      name: z.string().min(1).describe('Workout name, e.g. "Push Day A"'),
      exercises: ExercisesField,
    },
    async (input) => {
      try {
        const workout = await client.createWorkout(input);
        return {
          content: [
            {
              type: 'text',
              text: `Workout created successfully.\n\n${JSON.stringify(workout, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return handleError(err);
      }
    }
  );

  // ── update-workout ────────────────────────────────────────────────────────
  server.tool(
    'update-workout',
    'Update an existing workout session by ID. Only the fields you provide will be changed.',
    {
      id: z.string().min(1).describe('Workout document ID (from create-workout or workout history)'),
      date: z
        .string()
        .optional()
        .describe('New date in ISO 8601 format'),
      name: z.string().min(1).optional().describe('New workout name'),
      exercises: ExercisesField.optional().describe(
        'Replacement exercise list (replaces all exercises when provided)'
      ),
    },
    async ({ id, ...rest }) => {
      // Strip undefined fields
      const data = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      );
      try {
        const workout = await client.updateWorkout(id, data);
        return {
          content: [
            {
              type: 'text',
              text: `Workout updated successfully.\n\n${JSON.stringify(workout, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return handleError(err);
      }
    }
  );

  // ── delete-workout ────────────────────────────────────────────────────────
  server.tool(
    'delete-workout',
    'Permanently delete a workout by ID',
    {
      id: z.string().min(1).describe('Workout document ID to delete'),
    },
    async ({ id }) => {
      try {
        await client.deleteWorkout(id);
        return {
          content: [{ type: 'text', text: `Workout "${id}" deleted successfully.` }],
        };
      } catch (err) {
        return handleError(err);
      }
    }
  );
}
