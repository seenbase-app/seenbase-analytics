import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { verifySession, createCsrfToken, verifyCsrfToken } from './lib/auth';
import type { DashboardEnv } from './env';

const PUBLIC_PATHS: Record<string, true> = {
  '/login': true,
  '/logout': true,
};

export const onRequest = defineMiddleware(async (context, next) => {
  const envRecord = env as unknown as DashboardEnv;
  const secret = envRecord.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    return new Response('Authentication configuration error: SESSION_SECRET is missing or too short', {
      status: 500,
    });
  }

  const { pathname } = context.url;
  if (PUBLIC_PATHS[pathname]) {
    return next();
  }

  const token = context.cookies.get('seenbase_session')?.value;
  if (!token) {
    return context.redirect('/login');
  }

  const isValid = await verifySession(token, secret);
  if (!isValid) {
    return context.redirect('/login');
  }

  const csrfToken = await createCsrfToken(token, secret);
  context.locals.csrfToken = csrfToken;

  if (context.request.method === 'POST') {
    try {
      const clonedReq = context.request.clone();
      const formData = await clonedReq.formData();
      const submittedCsrf = formData.get('_csrf')?.toString() ?? '';

      const csrfValid = await verifyCsrfToken(submittedCsrf, token, secret);
      if (!csrfValid) {
        return new Response('Forbidden: CSRF token verification failed', { status: 403 });
      }
    } catch {
      return new Response('Forbidden: CSRF verification failed', { status: 403 });
    }
  }

  const response = await next();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
});
