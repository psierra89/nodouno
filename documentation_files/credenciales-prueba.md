# Credenciales de prueba

Usuario de prueba en **Supabase Auth** para login manual, E2E y comprobaciones en local o producción.

| Campo | Dónde |
|-------|--------|
| Email | `.env` → `TEST_USER_EMAIL` |
| Contraseña | `.env` → `TEST_USER_PASSWORD` (no versionar en el repo) |

Plantilla en [`.env.example`](../.env.example) (valores comentados, sin secretos).

## Login web

- Producción: [https://nodouno.vercel.app/login](https://nodouno.vercel.app/login)
- Local: `http://localhost:4321/login`

## Uso en local

1. Copiar `.env.example` a `.env` y rellenar `TEST_USER_*` más `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY`.
2. Opcional: `PUBLIC_API_URL=http://localhost:4000` para probar el dashboard contra la API local.

## Verificación rápida

- Login con credenciales incorrectas → mensaje tipo `Invalid login credentials`.
- Login correcto → redirección a `/dashboard`.

## Seguridad

- No commitear `.env` (ya está en `.gitignore`).
- No poner contraseñas en markdown ni en `.env.example`.
- Son credenciales de **prueba**; rotar en Supabase si se filtran.
