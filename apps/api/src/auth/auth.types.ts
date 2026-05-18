import type { AuthSession } from './auth';

export interface AuthedRequestExtensions {
  auth?: AuthSession | null;
  tenant?: { id: string; slug: string; role: string } | null;
}
