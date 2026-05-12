import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { IWorkoutClient } from '../client/IWorkoutClient.js';
import type { Workout, Plan } from '../types.js';
import { registerWorkoutTools } from '../tools/workouts.js';
import { FirebaseAuthError, FirebaseNotFoundError } from '../client/firebase.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const sampleWorkout: Workout = {
  id: 'wk-1',
  date: '2026-04-13',
  name: 'Push Day A',
  exercises: [{ name: 'Bench Press', sets: [{ weight: 80, reps: 8 }] }],
};

const createInput = {
  date: '2026-04-13',
  name: 'Push Day A',
  exercises: [{ name: 'Bench Press', sets: [{ weight: 80, reps: 8 }] }],
};

// ── Mock client factory ───────────────────────────────────────────────────────

function makeMockClient(overrides: Partial<IWorkoutClient> = {}): IWorkoutClient {
  return {
    listWorkouts: vi.fn(async () => [sampleWorkout]),
    getWorkout: vi.fn(async () => sampleWorkout),
    createWorkout: vi.fn(async () => sampleWorkout),
    updateWorkout: vi.fn(async () => ({ ...sampleWorkout, name: 'Updated' })),
    deleteWorkout: vi.fn(async () => undefined),
    listPlans: vi.fn(async () => []),
    getPlan: vi.fn(async () => ({ id: 'p1', name: 'Plan', weeks: [] } as Plan)),
    createPlan: vi.fn(async () => ({ id: 'p1', name: 'Plan', weeks: [] } as Plan)),
    updatePlan: vi.fn(async () => ({ id: 'p1', name: 'Plan', weeks: [] } as Plan)),
    deletePlan: vi.fn(async () => undefined),
    ...overrides,
  };
}

// ── Test harness: connect MCP server↔client over in-memory transport ──────────

async function setupServer(client: IWorkoutClient) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerWorkoutTools(server, client);

  const mcpClient = new Client({ name: 'test-client', version: '0.0.0' });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await mcpClient.connect(clientTransport);
  return mcpClient;
}

// ── create-workout ────────────────────────────────────────────────────────────

describe('create-workout tool', () => {
  it('calls createWorkout and returns success text with the workout JSON', async () => {
    const mockClient = makeMockClient();
    const mcp = await setupServer(mockClient);

    const result = await mcp.callTool({ name: 'create-workout', arguments: createInput });

    expect(mockClient.createWorkout).toHaveBeenCalledWith(createInput);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('created successfully');
    expect(text).toContain('"id": "wk-1"');
  });

  it('returns isError on FirebaseAuthError', async () => {
    const mockClient = makeMockClient({
      createWorkout: vi.fn(async () => { throw new FirebaseAuthError('bad creds'); }),
    });
    const mcp = await setupServer(mockClient);

    const result = await mcp.callTool({ name: 'create-workout', arguments: createInput });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('Authentication failed');
  });

  it('returns isError on generic error', async () => {
    const mockClient = makeMockClient({
      createWorkout: vi.fn(async () => { throw new Error('network timeout'); }),
    });
    const mcp = await setupServer(mockClient);

    const result = await mcp.callTool({ name: 'create-workout', arguments: createInput });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('network timeout');
  });
});

// ── update-workout ────────────────────────────────────────────────────────────

describe('update-workout tool', () => {
  it('calls updateWorkout with id and changed fields only', async () => {
    const mockClient = makeMockClient();
    const mcp = await setupServer(mockClient);

    await mcp.callTool({ name: 'update-workout', arguments: { id: 'wk-1', name: 'New Name' } });

    expect(mockClient.updateWorkout).toHaveBeenCalledWith('wk-1', { name: 'New Name' });
  });

  it('returns success text with updated workout JSON', async () => {
    const mockClient = makeMockClient();
    const mcp = await setupServer(mockClient);

    const result = await mcp.callTool({ name: 'update-workout', arguments: { id: 'wk-1', name: 'New Name' } });

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('updated successfully');
    expect(text).toContain('"name": "Updated"');
  });

  it('returns isError on FirebaseNotFoundError', async () => {
    const mockClient = makeMockClient({
      updateWorkout: vi.fn(async () => { throw new FirebaseNotFoundError('wk-99'); }),
    });
    const mcp = await setupServer(mockClient);

    const result = await mcp.callTool({ name: 'update-workout', arguments: { id: 'wk-99', name: 'X' } });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('not found');
  });

  it('does not pass undefined fields to updateWorkout', async () => {
    const mockClient = makeMockClient();
    const mcp = await setupServer(mockClient);

    // Only 'name' provided — 'date' and 'exercises' should not appear in the call
    await mcp.callTool({ name: 'update-workout', arguments: { id: 'wk-1', name: 'Only Name' } });

    const callArg = (mockClient.updateWorkout as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(callArg).not.toHaveProperty('date');
    expect(callArg).not.toHaveProperty('exercises');
  });
});

// ── delete-workout ────────────────────────────────────────────────────────────

describe('delete-workout tool', () => {
  it('calls deleteWorkout with the correct id', async () => {
    const mockClient = makeMockClient();
    const mcp = await setupServer(mockClient);

    await mcp.callTool({ name: 'delete-workout', arguments: { id: 'wk-1' } });

    expect(mockClient.deleteWorkout).toHaveBeenCalledWith('wk-1');
  });

  it('returns confirmation text on success', async () => {
    const mockClient = makeMockClient();
    const mcp = await setupServer(mockClient);

    const result = await mcp.callTool({ name: 'delete-workout', arguments: { id: 'wk-1' } });

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('wk-1');
    expect(text).toContain('deleted successfully');
  });

  it('returns isError on FirebaseAuthError', async () => {
    const mockClient = makeMockClient({
      deleteWorkout: vi.fn(async () => { throw new FirebaseAuthError('expired'); }),
    });
    const mcp = await setupServer(mockClient);

    const result = await mcp.callTool({ name: 'delete-workout', arguments: { id: 'wk-1' } });

    expect(result.isError).toBe(true);
  });
});

// ── tool list ─────────────────────────────────────────────────────────────────

describe('registered workout tools', () => {
  it('exposes create-workout, update-workout, and delete-workout', async () => {
    const mcp = await setupServer(makeMockClient());
    const { tools } = await mcp.listTools();
    const names = tools.map((t) => t.name);

    expect(names).toContain('create-workout');
    expect(names).toContain('update-workout');
    expect(names).toContain('delete-workout');
  });
});
