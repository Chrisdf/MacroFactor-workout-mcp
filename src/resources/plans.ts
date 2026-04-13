import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IWorkoutClient } from '../client/IWorkoutClient.js';

export function registerPlanResources(server: McpServer, client: IWorkoutClient): void {
  // ── plan-list (list) ──────────────────────────────────────────────────────
  server.resource(
    'plan-list',
    'macrofactor://plans',
    {
      title: 'Training Plans',
      description: 'All training plans stored in MacroFactor',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const plans = await client.listPlans();
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(plans, null, 2),
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

  // ── plan/{id} (single) ────────────────────────────────────────────────────
  server.resource(
    'plan',
    new ResourceTemplate('macrofactor://plans/{id}', {
      list: async () => {
        const plans = await client.listPlans();
        return {
          resources: plans.map((p) => ({
            uri: `macrofactor://plans/${p.id}`,
            name: p.name ?? p.id,
            description: `${p.weeks?.length ?? 0} week(s)`,
            mimeType: 'application/json',
          })),
        };
      },
    }),
    {
      title: 'Training Plan',
      description: 'A single training plan by ID',
      mimeType: 'application/json',
    },
    async (uri, { id }) => {
      try {
        const plan = await client.getPlan(String(id));
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(plan, null, 2),
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
