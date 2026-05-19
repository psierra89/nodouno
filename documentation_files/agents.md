# 🤖 Sistema de Agentes (OpenCode)

Este proyecto utiliza una arquitectura basada en agentes especializados. Antes de ejecutar cualquier tarea, identifica qué rol debes asumir y lee los archivos correspondientes en la carpeta `./opencode`.

## 🏗️ Agente Frontend (AstroAgent)
- **Rol:** Crear la UI/UX usando Astro y TailwindCSS v4.
- **Reglas:**
  - **CRÍTICO:** Lee siempre `design.md` antes de crear o modificar estilos.
  - Mantener los componentes de Astro ligeros. Usar Nano Stores para el estado global (ej. paso actual del proyecto).
  - Usar Supabase SSR para proteger rutas (Dashboard, Editor).

## 🗄️ Agente de Base de Datos (DBAgent)
- **Rol:** Estructurar y gestionar Supabase (PostgreSQL).
- **Reglas:**
  - **CRÍTICO:** Lee siempre `database.md` antes de proponer esquemas o consultas SQL.
  - Priorizar el uso de columnas `JSONB` para iterar rápido en el MVP.

## 📐 Agente 3D (ThreeJSAgent)
- **Rol:** Renderizar la estructura espacial y despiece de armaduras.
- **Reglas:**
  - Aislar código de Three.js en componentes de UI framework (`client:load` en Astro).
  - Limpiar memoria al desmontar (`dispose` de geometrías/materiales).

## 🧠 Agente Estructural (BackendAgent)
- **Rol:** Procesar la física y matemáticas.
- **Reglas:**
  - **CRÍTICO:** Lee siempre `backend-calculo.md` para respetar la normativa argentina.
  - Crear funciones puras en Node/TS que retornen JSON estructurados.

## 🚀 Playbook de Deploy (evitar bloqueos)

Esta sección resume problemas reales que ya ocurrieron y la forma correcta de evitarlos.

### 1) Railway Free
- Puede bloquear deploys por franja horaria o límite de recursos (`Free plan resource provision limit exceeded`).
- Si se usa Railway, validar primero:
  - cuota disponible,
  - región permitida,
  - que el servicio esté vinculado al repo correcto.
- Si hay fricción repetida, priorizar Azure for Students (ver punto 2).

### 2) Azure App Service (Students / Free)
- La suscripción puede aplicar políticas de regiones. No asumir `westeurope`; probar región permitida.
- Región validada en este proyecto: `swedencentral`.
- Web app activa: `nodouno-api-psierra89`.
- **Importante:** App Service Windows puede comportarse como IIS estático si no se empaqueta correctamente la app Node.

### 3) Backend en Azure: formato de despliegue estable
- Para este repo, el despliegue estable es:
  - bundle de `apps/api/src/server.ts` con `esbuild` a `server.js`,
  - `web.config` con `iisnode` + rewrite a `server.js`,
  - zip de artefacto mínimo para deploy.
- El workflow de referencia es `.github/workflows/deploy-api-azure.yml`.

### 4) Variables obligatorias (API)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGIN` (ej: `https://nodouno.vercel.app`)
- `HOST` (si aplica)
- No persistir secretos en repo ni en chats. Si se expone una key, rotarla.

### 5) Vercel (frontend) y acoplamiento con API
- El frontend requiere `PUBLIC_API_URL` para usar backend dedicado.
- Si falta, cae en fallback a cliente Supabase (comportamiento parcial).
- Tras cambiar env vars en Vercel: redeploy inmediato.

### 6) Verificación mínima post-deploy
- API:
  - `GET /healthz` -> 200 y `{"ok":true}`
  - `GET /trpc/health` -> 200
- Frontend:
  - abrir `/login`, `/dashboard`, `/editor`
  - revisar red/console por CORS o 401/500.
- Login de prueba: ver [credenciales-prueba.md](./credenciales-prueba.md) (email y contraseña solo en `.env`, gitignored).