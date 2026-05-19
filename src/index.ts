import type { Env } from './env';
import { GameRoom } from './rooms/GameRoom';

export { GameRoom };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/maps/default') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      const id = env.GAME_ROOM.idFromName('main-world');
      const room = env.GAME_ROOM.get(id);

      if (request.method === 'GET') {
        return withCors(await room.fetch(new Request('https://internal/maps/default')));
      }

      if (request.method === 'PUT') {
        return withCors(await room.fetch(new Request('https://internal/maps/default', {
          method: 'PUT',
          body: request.body,
          headers: request.headers,
        })));
      }
    }

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const id = env.GAME_ROOM.idFromName('main-world');
      return env.GAME_ROOM.get(id).fetch(request);
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'dalworld-server' }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
      });
    }

    return new Response('dalworld server is running', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS_HEADERS },
    });
  },
} satisfies ExportedHandler<Env>;

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
