import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IWorkoutClient } from '../client/IWorkoutClient.js';
import { FirebaseAuthError, FirebaseNotFoundError } from '../client/firebase.js';

const PlanExerciseSchema = z.object({
  name: z.string().min(1).describe('Exercise name, e.g. "Squat"'),
  sets: z.number().int().positive().optional().describe('Planned number of sets'),
  reps: z.number().int().positive().optional().describe('Planned reps per set'),
});

const PlanDaySchema = z.object({
  exercises: z.array(PlanExerciseSchema).describe('Exercises for this training day'),
});

const PlanWeeksField = z
  .array(
    z.object({
      days: z.array(PlanDaySchema).min(1).describe('Days in this training week'),
    })
  )
  .min(1)
  .describe('Weekly breakdown of the training plan');

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

export function registerPlanTools(server: McpServer, client: IWorkoutClient): void {
  // ── create-plan ───────────────────────────────────────────────────────────
  server.tool(
    'create-plan',
    'Create a new structured training plan with weeks and days',
    {
      name: z.string().min(1).describe('Plan name, e.g. "5/3/1 Program Week 1"'),
      weeks: PlanWeeksField,
    },
    async (input) => {
      try {
        const plan = await client.createPlan(input);
        return {
          content: [
            {
              type: 'text',
              text: `Training plan created successfully.\n\n${JSON.stringify(plan, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return handleError(err);
      }
    }
  );

  // ── update-plan ───────────────────────────────────────────────────────────
  server.tool(
    'update-plan',
    'Update an existing training plan by ID. Only the fields you provide will be changed.',
    {
      id: z.string().min(1).describe('Plan document ID (from create-plan or plan list)'),
      name: z.string().min(1).optional().describe('New plan name'),
      weeks: PlanWeeksField.optional().describe(
        'Replacement weekly structure (replaces all weeks when provided)'
      ),
    },
    async ({ id, ...rest }) => {
      const data = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      );
      try {
        const plan = await client.updatePlan(id, data);
        return {
          content: [
            {
              type: 'text',
              text: `Training plan updated successfully.\n\n${JSON.stringify(plan, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return handleError(err);
      }
    }
  );

  // ── delete-plan ───────────────────────────────────────────────────────────
  server.tool(
    'delete-plan',
    'Permanently delete a training plan by ID',
    {
      id: z.string().min(1).describe('Plan document ID to delete'),
    },
    async ({ id }) => {
      try {
        await client.deletePlan(id);
        return {
          content: [{ type: 'text', text: `Training plan "${id}" deleted successfully.` }],
        };
      } catch (err) {
        return handleError(err);
      }
    }
  );
}
