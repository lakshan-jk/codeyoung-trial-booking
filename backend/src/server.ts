import { buildApp } from './app.js';
import { connectDb, disconnectDb } from './plugins/db.js';
import { env } from './config/env.js';

async function main(): Promise<void> {
  await connectDb(env.mongoUri);
  const app = await buildApp({ corsOrigins: env.corsOrigins });

  await app.listen({ port: env.port, host: '0.0.0.0' });
  app.log.info(`API ready on http://localhost:${env.port}`);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`${signal} received, shutting down…`);
    // Don't hang forever if close() stalls.
    const watchdog = setTimeout(() => process.exit(1), 10_000).unref();
    try {
      await app.close();
      await disconnectDb();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => app.log.error(reason, 'Unhandled promise rejection'));
  process.on('uncaughtException', (err) => {
    app.log.error(err, 'Uncaught exception');
    void shutdown('uncaughtException');
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
