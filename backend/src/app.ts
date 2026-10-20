import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes/index.js';
import { registerErrorHandler } from './plugins/errorHandler.js';

/**
 * Build a configured Fastify instance. Kept separate from server start-up so
 * tests can build the app without binding a port.
 */
export async function buildApp(opts: { corsOrigins: string[] } = { corsOrigins: [] }): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    // Small JSON payloads only — this API never accepts large bodies.
    bodyLimit: 16 * 1024,
  });

  // Only allow the explicitly configured origins. If none are configured we
  // disallow cross-origin requests rather than reflecting any origin.
  await app.register(cors, {
    origin: opts.corsOrigins.length > 0 ? opts.corsOrigins : false,
  });

  registerErrorHandler(app);

  // Unknown routes return the same error envelope as everything else.
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` },
    });
  });

  await registerRoutes(app);

  return app;
}
