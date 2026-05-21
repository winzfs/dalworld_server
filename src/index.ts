import type { Env } from './env';
import { GameRoom } from './rooms/GameRoom';
import { handleHttpRoutes } from './httpRoutes';

export { GameRoom };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, X-Dalworld-Payload-Bytes',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

const MAP_ENDPOINT_PREFIX = '/maps/default';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const httpRouteResponse = await handleHttpRoutes(request, env);
    if (httpRouteResponse) return withCors(httpRouteResponse);

    if (url.pathname === MAP_ENDPOINT_PREFIX || url.pathname.startsWith(`${MAP_ENDPOINT_PREFIX}/`)) {
      const id = env.GAME_ROOM.idFromName('main-world');
      const room = env.GAME_ROOM.get(id);

      if (request.method === 'GET' || request.method === 'PUT') {
        const internalUrl = new URL(request.url);
        internalUrl.protocol = 'https:';
        internalUrl.hostname = 'internal';
        internalUrl.port = '';
        return withCors(await room.fetch(new Request(internalUrl.toString(), {
          method: request.method,
          body: request.method === 'PUT' ? request.body : null,
          headers: request.headers,
        })));
      }

      return withCors(Response.json({ ok: false, reason: 'Method not allowed' }, { status: 405 }));
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
