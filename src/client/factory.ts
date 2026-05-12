import { getConfig } from '../config.js';
import type { IWorkoutClient } from './IWorkoutClient.js';
import { FirebaseWorkoutClient } from './firebase.js';
import { RestWorkoutClient } from './rest.js';
import { MockWorkoutClient } from './mock.js';

export function createClient(): IWorkoutClient {
  const cfg = getConfig();

  if (cfg.backend === 'mock') {
    return new MockWorkoutClient();
  }

  if (cfg.backend === 'firebase') {
    return new FirebaseWorkoutClient({
      email: cfg.email,
      password: cfg.password,
      apiKey: cfg.firebaseApiKey,
      projectId: cfg.firebaseProjectId,
    });
  }

  return new RestWorkoutClient({
    baseUrl: cfg.restBaseUrl,
    token: cfg.restToken,
  });
}
