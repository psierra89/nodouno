# Nodouno

Monorepo **pnpm + Turbo**: frontend Astro (`apps/web`), API Fastify + tRPC (`apps/api`), motor de cálculo y editor 2D en `packages/*`.

## Requisitos

- Node.js ≥ 22
- [pnpm](https://pnpm.io) 9

## Instalación

```bash
pnpm install
```

## Desarrollo

- Solo UI (puerto 4321):

  ```bash
  pnpm --filter @nodouno/web dev
  ```

- API (puerto 4000; define `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`):

  ```bash
  pnpm --filter @nodouno/api dev
  ```

- Dashboard con API: en `apps/web` configura `PUBLIC_API_URL=http://localhost:4000` (ver [.env.example](.env.example)).

## Scripts útiles (raíz)

| Comando        | Descripción                    |
|----------------|--------------------------------|
| `pnpm test`    | Vitest en `packages/*`         |
| `pnpm lint`    | ESLint                         |
| `pnpm build`   | Turbo build (web + api)        |

## Documentación

- [Arquitectura](documentation_files/architecture.md)
- [Base de datos](documentation_files/database.md)
- [Supabase SQL](supabase/migrations/)
