import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@nodouno/api/router';

/** URL base de `@nodouno/api` (ej. http://localhost:4000). Sin trailing slash. */
export function getPublicApiUrl(): string | undefined {
  const raw = import.meta.env.PUBLIC_API_URL as string | undefined;
  return raw?.replace(/\/$/, '') || undefined;
}

export function createTrpcClient(getAccessToken: () => Promise<string | null>) {
  const base = getPublicApiUrl();
  if (!base) return null;
  return createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: `${base}/trpc`,
        async headers() {
          const token = await getAccessToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        }
      })
    ]
  });
}
