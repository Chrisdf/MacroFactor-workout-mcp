#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from './client/factory.js';
import { registerWorkoutTools } from './tools/workouts.js';
import { registerPlanTools } from './tools/plans.js';
import { registerWorkoutResources } from './resources/workouts.js';
import { registerPlanResources } from './resources/plans.js';

async function main(): Promise<void> {
  // Validate config and create the API client (throws early on missing env vars)
  const client = createClient();

  const server = new McpServer({
    name: 'macrofactor-workout-mcp',
    version: '0.1.0',
  });

  // Register tools (mutations: create, update, delete)
  registerWorkoutTools(server, client);
  registerPlanTools(server, client);

  // Register resources (reads: list + get by ID)
  registerWorkoutResources(server, client);
  registerPlanResources(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal error starting MCP server: ${message}\n`);
  process.exit(1);
});
