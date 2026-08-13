import type { Env } from './env';
import { handlePixel } from './pixel';
import { handleCron, handleRetention } from './cron';

const PIXEL_PATH_RE = /^\/p\/([23456789abcdefghjkmnpqrstuvwxyz]{10})\.gif$/;

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response {
    if (request.method !== 'GET') {
      return new Response(null, { status: 405 });
    }

    const { pathname } = new URL(request.url);
    const match = PIXEL_PATH_RE.exec(pathname);
    if (!match) {
      return new Response(null, { status: 404 });
    }

    return handlePixel(request, env, ctx, match[1]);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (controller.cron === '0 3 * * *') {
      ctx.waitUntil(handleRetention(env));
    } else {
      ctx.waitUntil(handleCron(env));
    }
  },
} satisfies ExportedHandler<Env>;
