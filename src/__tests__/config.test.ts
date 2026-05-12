import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIREBASE_VARS = {
  MACROFACTOR_EMAIL: 'test@example.com',
  MACROFACTOR_PASSWORD: 'secret',
  FIREBASE_API_KEY: 'AIzaTest',
  FIREBASE_PROJECT_ID: 'test-project',
};

const REST_VARS = {
  REST_API_BASE_URL: 'https://api.example.com/v1',
  REST_API_TOKEN: 'bearer-token',
};

const ALL_KEYS = [
  'API_BACKEND',
  'MACROFACTOR_EMAIL',
  'MACROFACTOR_PASSWORD',
  'FIREBASE_API_KEY',
  'FIREBASE_PROJECT_ID',
  'REST_API_BASE_URL',
  'REST_API_TOKEN',
];

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
}

function clearAll() {
  for (const k of ALL_KEYS) delete process.env[k];
}

// vi.resetModules() clears Vitest's module cache so each import() re-evaluates
// the module with the current process.env — the correct approach for modules
// that read env vars at call-time rather than at import-time.
beforeEach(() => {
  vi.resetModules();
  clearAll();
});

// ── Firebase backend ──────────────────────────────────────────────────────────

describe('getConfig — firebase backend', () => {
  it('returns firebase config when all vars are present', async () => {
    setEnv(FIREBASE_VARS);
    const { getConfig } = await import('../config.js');
    const cfg = getConfig();
    expect(cfg.backend).toBe('firebase');
    expect(cfg.email).toBe('test@example.com');
    expect(cfg.firebaseApiKey).toBe('AIzaTest');
    expect(cfg.firebaseProjectId).toBe('test-project');
  });

  it('defaults to "firebase" backend when API_BACKEND is not set', async () => {
    setEnv(FIREBASE_VARS);
    const { getConfig } = await import('../config.js');
    expect(getConfig().backend).toBe('firebase');
  });

  it('throws when MACROFACTOR_EMAIL is missing', async () => {
    setEnv({ ...FIREBASE_VARS });
    delete process.env['MACROFACTOR_EMAIL'];
    const { getConfig } = await import('../config.js');
    expect(() => getConfig()).toThrow('MACROFACTOR_EMAIL');
  });

  it('throws when MACROFACTOR_PASSWORD is missing', async () => {
    setEnv({ ...FIREBASE_VARS });
    delete process.env['MACROFACTOR_PASSWORD'];
    const { getConfig } = await import('../config.js');
    expect(() => getConfig()).toThrow('MACROFACTOR_PASSWORD');
  });

  it('throws when FIREBASE_API_KEY is missing', async () => {
    setEnv({ ...FIREBASE_VARS });
    delete process.env['FIREBASE_API_KEY'];
    const { getConfig } = await import('../config.js');
    expect(() => getConfig()).toThrow('FIREBASE_API_KEY');
  });

  it('throws when FIREBASE_PROJECT_ID is missing', async () => {
    setEnv({ ...FIREBASE_VARS });
    delete process.env['FIREBASE_PROJECT_ID'];
    const { getConfig } = await import('../config.js');
    expect(() => getConfig()).toThrow('FIREBASE_PROJECT_ID');
  });
});

// ── REST backend ──────────────────────────────────────────────────────────────

describe('getConfig — rest backend', () => {
  beforeEach(() => {
    process.env['API_BACKEND'] = 'rest';
  });

  it('returns rest config when all vars are present', async () => {
    setEnv(REST_VARS);
    const { getConfig } = await import('../config.js');
    const cfg = getConfig();
    expect(cfg.backend).toBe('rest');
    expect(cfg.restBaseUrl).toBe('https://api.example.com/v1');
    expect(cfg.restToken).toBe('bearer-token');
  });

  it('throws when REST_API_BASE_URL is missing', async () => {
    setEnv(REST_VARS);
    delete process.env['REST_API_BASE_URL'];
    const { getConfig } = await import('../config.js');
    expect(() => getConfig()).toThrow('REST_API_BASE_URL');
  });

  it('throws when REST_API_TOKEN is missing', async () => {
    setEnv(REST_VARS);
    delete process.env['REST_API_TOKEN'];
    const { getConfig } = await import('../config.js');
    expect(() => getConfig()).toThrow('REST_API_TOKEN');
  });
});

// ── Invalid backend ───────────────────────────────────────────────────────────

describe('getConfig — invalid backend', () => {
  it('throws on an unknown API_BACKEND value', async () => {
    process.env['API_BACKEND'] = 'mysql';
    const { getConfig } = await import('../config.js');
    expect(() => getConfig()).toThrow('mysql');
  });
});
