import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { loadEnv } from './env';
import { createContext } from './context';
import { appRouter } from './router';

async function main() {
  // Azure httpPlatformHandler expone el puerto en HTTP_PLATFORM_PORT.
  if (!process.env.PORT?.trim() && process.env.HTTP_PLATFORM_PORT?.trim()) {
    process.env.PORT = process.env.HTTP_PLATFORM_PORT.trim();
  }

  const env = loadEnv();

  const server = Fastify({
    logger: true,
    maxParamLength: 5000
  });

  await server.register(cors, {
    origin: env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true
  });

  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: (opts: CreateFastifyContextOptions) => createContext(opts, env)
    }
  });

  server.get('/healthz', async () => ({ ok: true }));

  const portValue = env.PORT.trim();
  const isNumericPort = /^\d+$/.test(portValue);
  const address = isNumericPort
    ? await server.listen({ port: Number(portValue), host: env.HOST })
    : await server.listen({ path: portValue });
  server.log.info(`API nodouno en ${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
