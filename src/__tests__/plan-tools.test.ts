import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { IWorkoutClient } from '../client/IWorkoutClient.js';
import type { Workout, Plan } from '../types.js';
import { registerPlanTools } from '../tools/plans.js';
import { FirebaseAuthError, FirebaseNotFoundError } from '../client/firebase.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const samplePlan: Plan = {
  id: 'plan-1',
  name: '5/3/1',
  weeks: [
    { days: [{ exercises: [{ name: 'Squat', sets: 3, reps: 5 }] }] },
  ],
};

const createInput = {
  name: '5/3/1',
  weeks: [{ days: [{ exercises: [{ name: 'Squat', sets: 3, reps: 5 }] }] }],
};

// ── Mock client factory ───────────────────────────────────────────────────────

function makeMockClient(overrides: Partial<IWorkoutClient> = {}): IWorkoutClient {
  return {
    listWorkouts: vi.fn(async () => []),
    getWorkout: vi.fn(async () => ({ id: 'w1', date: '2026-04-13', name: 'x', exercises: [] } as Workout)),
    createWorkout: vi.fn(async () => ({ id: 'w1', date: '2026-04-13', name: 'x', exercises: [] } as Workout)),
    updateWorkout: vi.fn(async () => ({ id: 'w1', date: '2026-04-13', name: 'x', exercises: [] } as Workout)),
    deleteWorkout: vi.fn(async () => undefined),
    listPlans: vi.fn(async () => [samplePlan]),
    getPlan: vi.fn(async () => samplePlan),
    createPlan: vi.fn(async () => samplePlan),
    updatePlan: vi.fn(async () => ({ ...samplePlan, name: 'Updated Plan' })),
    deletePlan: vi.fn(async () => undefined),
    ...overrides,
  };
}

async function setupServer(client: IWorkoutClient) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerPlanTools(server, client);

  const mcpClient = new Client({ name: 'test-client', version: '0.0.0' });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await mcpClient.connect(clientTransport);
  return mcpClient;
}

// ── create-plan ───────────────────────────────────────────────────────────────

describe('create-plan tool', () => {
  it('calls createPlan and returns success text with JSON', async () => {
    const mockClient = makeMockClient();
    const mcp = await setupServer(mockClient);

    const result = await mcp.callTool({ name: 'create-plan', arguments: createInput });

    expect(mockClient.createPlan).toHaveBeenCalledWith(createInput);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('created successfully');
    expect(text).toContain('"id": "plan-1"');
  });

  it('returns isError on FirebaseAuthError', async () => {
    const mockClient = makeMockClient({
      createPlan: vi.fn(async () => { throw new FirebaseAuthError('no token'); }),
    });
    const mcp = await setupServer(mockClient);

    const result = await mcp.callTool({ name: 'create-plan', arguments: createInput });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('Authentication failed');
  });
});

// ── update-plan ───────────────────────────────────────────────────────────────

describe('update-plan tool', () => {
  it('calls updatePlan with id and new name only', async () => {
    const mockClient = makeMockClient();
    const mcp = await setupServer(mockClient);

    await mcp.callTool({ name: 'update-plan', arguments: { id: 'plan-1', name: 'New Name' } });

    expect(mockClient.updatePlan).toHaveBeenCalledWith('plan-1', { name: 'New Name' });
  });

  it('returns success text with updated plan JSON', async () => {
    const mockClient = makeMockClient();
    const mcp = await setupServer(mockClient);

    const result = await mcp.callTool({ name: 'update-plan', arguments: { id: 'plan-1', name: 'New Name' } });

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('updated successfully');
    expect(text).toContain('"name": "Updated Plan"');
  });

  it('returns isError on FirebaseNotFoundError', async () => {
    const mockClient = makeMockClient({
      updatePlan: vi.fn(async () => { throw new FirebaseNotFoundError('plan-99'); }),
    });
    const mcp = await setupServer(mockClient);

    const result = await mcp.callTool({ name: 'update-plan', arguments: { id: 'plan-99', name: 'X' } });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('not found');
  });

  it('does not forward undefined optional fields', async () => {
    const mockClient = makeMockClient();
    const mcp = await setupServer(mockClient);

    await mcp.callTool({ name: 'update-plan', arguments: { id: 'plan-1', name: 'Only Name' } });

    const callArg = (mockClient.updatePlan as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(callArg).not.toHaveProperty('weeks');
  });
});

// ── delete-plan ───────────────────────────────────────────────────────────────

describe('delete-plan tool', () => {
  it('calls deletePlan with the correct id', async () => {
    const mockClient = makeMockClient();
    const mcp = await setupServer(mockClient);

    await mcp.callTool({ name: 'delete-plan', arguments: { id: 'plan-1' } });

    expect(mockClient.deletePlan).toHaveBeenCalledWith('plan-1');
  });

  it('returns confirmation text', async () => {
    const mockClient = makeMockClient();
    const mcp = await setupServer(mockClient);

    const result = await mcp.callTool({ name: 'delete-plan', arguments: { id: 'plan-1' } });

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('plan-1');
    expect(text).toContain('deleted successfully');
  });
});

// ── tool list ─────────────────────────────────────────────────────────────────

describe('registered plan tools', () => {
  it('exposes create-plan, update-plan, and delete-plan', async () => {
    const mcp = await setupServer(makeMockClient());
    const { tools } = await mcp.listTools();
    const names = tools.map((t) => t.name);

    expect(names).toContain('create-plan');
    expect(names).toContain('update-plan');
    expect(names).toContain('delete-plan');
  });
});
