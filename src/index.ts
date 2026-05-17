import type { Env } from './env';
import { GameRoom } from './rooms/GameRoom';

export { GameRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const id = env.GAME_ROOM.idFromName('main-world');
      return env.GAME_ROOM.get(id).fetch(request);
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'dalworld-server' }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    return new Response('dalworld server is running', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
} satisfies ExportedHandler<Env>;
