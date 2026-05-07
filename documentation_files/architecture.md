# Arquitectura Nodouno

## Componentes

| Paquete / app | Rol |
|---------------|-----|
| `apps/web` | UI Astro estática: login, dashboard, editor 2D + Three.js |
| `apps/api` | Backend Fastify + tRPC: mutaciones auditables, catálogos, exportaciones, motor de cálculo en servidor |
| `packages/calc` | Motor de cargas / solicitaciones / dimensionamiento (funciones puras) |
| `packages/editor2d` | Canvas CAD 2D (grilla 0,1 m, snap, undo/redo, migración `drawing_data`) |
| `packages/shared` | Tipos compartidos, Zod, normalización de `status` y `specs` |
| `packages/db` | Esquema Drizzle (Postgres) — uso opcional desde jobs o futuras extensiones |

## Flujo de datos

1. **Auth**: Supabase Auth en el navegador (sesión + JWT).
2. **Persistencia primaria**: Postgres en Supabase (`projects` y tablas nuevas en `supabase/migrations/`).
3. **API opcional**: si `PUBLIC_API_URL` apunta a `apps/api`, el dashboard usa **tRPC** para listar/crear/eliminar proyectos; si no, **fallback** directo con `@supabase/supabase-js` y clave anon + RLS.
4. **Export JSON**: botón en editor descarga snapshot; si la API está disponible, intenta `exports.requestJson` y cae a export local.

## Variables de entorno

Ver [.env.example](../.env.example) en la raíz del repo.

## Despliegue sugerido

- **Web**: Vercel / similar — build `pnpm --filter @nodouno/web build`, salida `apps/web/dist`.
- **API**: Fly.io / Render / Railway — `pnpm --filter @nodouno/api build && node apps/api/dist/server.js`, env `SUPABASE_*`.
- **DB**: migraciones aplicadas en Supabase SQL Editor o CLI enlazado al proyecto.

## Evolución

- Revisiones inmutables (`project_revisions`) y catálogos (`regulations`, `concrete_classes`, `steel_classes`) preparan historial y multi-reglamento sin romper filas existentes.
- PDF/DXF: endpoints esbozados (`exports.requestPdf` → no implementado hasta worker dedicado).
