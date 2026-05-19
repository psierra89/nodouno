import { createTRPCProxyClient, httpLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@nodouno/api/router';

/** URL base de `@nodouno/api` (ej. http://localhost:4000). Sin trailing slash. */
export function getPublicApiUrl(): string | undefined {
  const raw = import.meta.env.PUBLIC_API_URL as string | undefined;
  const normalized = raw?.trim().replace(/\/$/, '');
  if (!normalized) return undefined;

  // Acepta valores mal configurados como:
  // - https://api.example.com/trpc
  // - https://api.example.com/trpc/health
  // y los normaliza a https://api.example.com
  const withoutTrpcSuffix = normalized.replace(/\/trpc(?:\/health)?\/?$/i, '');
  return withoutTrpcSuffix || undefined;
}

export function createTrpcClient(getAccessToken: () => Promise<string | null>) {
  const base = getPublicApiUrl();
  if (!base) return null;
  return createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      // httpLink: queries GET, mutations POST (compatible con IIS/Azure; httpBatchLink solo POST).
      httpLink({
        url: `${base}/trpc`,
        async headers() {
          const token = await getAccessToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        }
      })
    ]
  });
}
