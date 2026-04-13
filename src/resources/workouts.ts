import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IWorkoutClient } from '../client/IWorkoutClient.js';

export function registerWorkoutResources(server: McpServer, client: IWorkoutClient): void {
  // ── workout-history (list) ────────────────────────────────────────────────
  server.resource(
    'workout-history',
    'macrofactor://workouts',
    {
      title: 'Workout History',
      description: 'All logged workout sessions from MacroFactor',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const workouts = await client.listWorkouts();
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(workouts, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
        };
      }
    }
  );

  // ── workout/{id} (single) ─────────────────────────────────────────────────
  server.resource(
    'workout',
    new ResourceTemplate('macrofactor://workouts/{id}', {
      list: async () => {
        const workouts = await client.listWorkouts();
        return {
          resources: workouts.map((w) => ({
            uri: `macrofactor://workouts/${w.id}`,
            name: w.name ?? w.id,
            description: `Workout on ${w.date}`,
            mimeType: 'application/json',
          })),
        };
      },
    }),
    {
      title: 'Workout',
      description: 'A single workout session by ID',
      mimeType: 'application/json',
    },
    async (uri, { id }) => {
      try {
        const workout = await client.getWorkout(String(id));
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(workout, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
        };
      }
    }
  );
}
