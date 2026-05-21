import type { Env } from '../../env';
import { AuthService } from './AuthService';

export async function handleAuthRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const auth = new AuthService(env.DB);

  if (url.pathname === '/auth/register' && request.method === 'POST') {
    const body = await readJsonBody<{ username?: unknown; password?: unknown }>(request);
    const result = await auth.register(String(body.username ?? ''), String(body.password ?? ''));
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  if (url.pathname === '/auth/login' && request.method === 'POST') {
    const body = await readJsonBody<{ username?: unknown; password?: unknown }>(request);
    const result = await auth.login(String(body.username ?? ''), String(body.password ?? ''));
    return Response.json(result, { status: result.ok ? 200 : 401 });
  }

  if (url.pathname === '/auth/me' && request.method === 'POST') {
    const body = await readJsonBody<{ sessionToken?: unknown }>(request);
    const profile = await auth.getProfile(String(body.sessionToken ?? ''));
    if (!profile) return Response.json({ ok: false, reason: '로그인이 필요합니다.' }, { status: 401 });
    return Response.json({ ok: true, profile });
  }

  if (url.pathname === '/characters' && request.method === 'POST') {
    const body = await readJsonBody<{ sessionToken?: unknown; name?: unknown }>(request);
    const result = await auth.createCharacter(String(body.sessionToken ?? ''), String(body.name ?? ''));
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  if (url.pathname.startsWith('/auth/') || url.pathname === '/characters') {
    return Response.json({ ok: false, reason: 'Not found' }, { status: 404 });
  }

  return null;
}

async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    return {} as T;
  }
}
