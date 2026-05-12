import 'dotenv/config';

export type Backend = 'firebase' | 'rest' | 'mock';

export interface AppConfig {
  backend: Backend;
  // Firebase
  email: string;
  password: string;
  firebaseApiKey: string;
  firebaseProjectId: string;
  // REST
  restBaseUrl: string;
  restToken: string;
}

function requireEnv(...names: string[]): void {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}\n` +
        'Copy .env.example to .env and fill in the values.'
    );
  }
}

export function getConfig(): AppConfig {
  const backend = (process.env['API_BACKEND'] ?? 'firebase') as Backend;

  if (backend === 'firebase') {
    requireEnv(
      'MACROFACTOR_EMAIL',
      'MACROFACTOR_PASSWORD',
      'FIREBASE_API_KEY',
      'FIREBASE_PROJECT_ID'
    );
  } else if (backend === 'rest') {
    requireEnv('REST_API_BASE_URL', 'REST_API_TOKEN');
  } else if (backend !== 'mock') {
    throw new Error(`Unknown API_BACKEND value: "${backend}". Must be "firebase", "rest", or "mock".`);
  }

  return {
    backend,
    email: process.env['MACROFACTOR_EMAIL'] ?? '',
    password: process.env['MACROFACTOR_PASSWORD'] ?? '',
    firebaseApiKey: process.env['FIREBASE_API_KEY'] ?? '',
    firebaseProjectId: process.env['FIREBASE_PROJECT_ID'] ?? 'sbs-diet-app',
    restBaseUrl: process.env['REST_API_BASE_URL'] ?? '',
    restToken: process.env['REST_API_TOKEN'] ?? '',
  };
}
