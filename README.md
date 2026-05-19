# Nodouno

Nodouno es una plataforma para modelado 2D estructural, generación de modelo simplificado, cálculo y dimensionamiento, con frontend web y backend tipado.

Arquitectura actual (monorepo):
- `apps/web`: frontend Astro + Tailwind.
- `apps/api`: backend Fastify + tRPC.
- `packages/calc`: motor de cálculo estructural.
- `packages/editor2d`: editor CAD 2D.
- `packages/shared`: tipos/schemas compartidos.
- `packages/db`: esquema Drizzle para Postgres/Supabase.

## Requisitos

- Node.js >= 22
- pnpm >= 9

## Instalación

```bash
pnpm install
```

## Ejecutar en local

### Frontend
```bash
pnpm --filter @nodouno/web dev
```
URL: `http://localhost:4321`

### Backend API
Configurar antes:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- opcional `CORS_ORIGIN`, `PORT`, `HOST`

```bash
pnpm --filter @nodouno/api dev
```

### Conectar frontend -> backend
En `apps/web` configurar:
- `PUBLIC_API_URL=http://localhost:4000`

Si `PUBLIC_API_URL` no existe, el frontend usa fallback parcial a Supabase cliente.

## Scripts útiles (raíz)

| Comando | Qué hace |
|---|---|
| `pnpm test` | Ejecuta tests de `packages/*` (Vitest) |
| `pnpm lint` | Ejecuta ESLint |
| `pnpm build` | Build de `@nodouno/web` y `@nodouno/api` con Turbo |

## Deploy actual

### Ramas

| Rama | Uso | Frontend (Vercel) | API (Azure) |
|------|-----|-------------------|-------------|
| `develop` | Integración y pruebas | Preview (`nodouno-git-develop-…`) | No despliega |
| `master` | Producción estable | `https://nodouno.vercel.app` | `nodouno-api-psierra89.azurewebsites.net` |

Flujo recomendado: desarrollar en `develop` → validar en preview → merge a `master` → deploy automático de web y API.

### Frontend
- Vercel
- URL productiva: `https://nodouno.vercel.app` (rama `master`)
- Variable obligatoria en Vercel: `PUBLIC_API_URL`

### API
- Azure App Service (F1) en `swedencentral`
- App: `nodouno-api-psierra89`
- Healthcheck:
  - `https://nodouno-api-psierra89.azurewebsites.net/healthz`
  - `https://nodouno-api-psierra89.azurewebsites.net/trpc/health`
- CI/CD: `.github/workflows/deploy-api-azure.yml` (deploy en push a `master`)

## Variables de entorno

Ver `.env.example` en la raíz.

## Documentación

- Arquitectura: `documentation_files/architecture.md`
- Base de datos: `documentation_files/database.md`
- Cálculo: `documentation_files/backend-calculo.md`
- Agentes/playbooks: `documentation_files/agents.md`
- Migraciones SQL: `supabase/migrations/`
