import type { Env } from '../../env';
import { AuthService } from './AuthService';

export async function handleAuthRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const auth = new AuthService(env.DB);

  try {
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

    if (url.pathname === '/auth/logout' && request.method === 'POST') {
      const body = await readJsonBody<{ sessionToken?: unknown }>(request);
      await auth.logout(String(body.sessionToken ?? ''));
      return Response.json({ ok: true });
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
  } catch (error) {
    console.warn('[AuthRoutes] request failed', error);
    return Response.json({
      ok: false,
      reason: getSafeAuthErrorReason(error),
    }, { status: 500 });
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

function getSafeAuthErrorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('no such table')) {
    return '인증 데이터베이스 테이블이 아직 준비되지 않았습니다. 서버 D1 마이그레이션을 적용해주세요.';
  }

  if (message.includes('readonly') || message.includes('not authorized') || message.includes('permission')) {
    return '서버 데이터베이스에 쓰기 권한이 없습니다. D1 바인딩과 배포 환경을 확인해주세요.';
  }

  return '계정 처리 중 서버 오류가 발생했습니다.';
}
