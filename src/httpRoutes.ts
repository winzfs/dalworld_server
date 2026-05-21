import type { Env } from './env';
import { handleAuthRequest } from './systems/auth/AuthRoutes';

export async function handleHttpRoutes(request: Request, env: Env): Promise<Response | null> {
  return await handleAuthRequest(request, env);
}
