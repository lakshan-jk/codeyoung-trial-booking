import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../domain/errors.js';

/**
 * Translate thrown errors into consistent JSON:
 *   { error: { code, message, details? } }
 * Domain errors (AppError) map to their status/code; everything else is a 500.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }

    // Honour client errors raised by Fastify itself (e.g. malformed JSON,
    // schema/content-type issues) instead of masking them as a 500.
    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      reply.code(error.statusCode).send({
        error: {
          code: error.code ?? 'BAD_REQUEST',
          message: error.message,
          details: error.validation,
        },
      });
      return;
    }

    request.log.error(error);
    reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    });
  });
}
