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
  - `package.json` mínimo con `scripts.start = "node server.js"`,
  - sin `web.config` custom; App Service Windows genera/usa su integración Node estable,
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
  - `GET /trpc/projects.list` (con JWT) -> 200 y array JSON
  - `POST /trpc/projects.create` (con JWT) -> 200 (no 405 HTML de IIS)
- Frontend:
  - abrir `/login`, `/dashboard`, `/editor`
  - revisar red/console por CORS o 401/500.
- Login de prueba: ver [credenciales-prueba.md](./credenciales-prueba.md) (email y contraseña solo en `.env`, gitignored).

### 7) Deploy manual de API (si falla GitHub Actions)

El workflow `.github/workflows/deploy-api-azure.yml` puede fallar si el secret `AZUREAPPSERVICE_PUBLISHPROFILE_NODOUNO_API` está caducado o mal copiado (`Publish profile is invalid...`). En ese caso, desplegar desde local con Azure CLI:

**Requisitos:** `az login`, `pnpm install`, `esbuild` en devDependencies de la raíz.

```bash
# 1) Bundle + artefacto Node para App Service Windows
mkdir -p .azure-deploy/runtime
pnpm exec esbuild apps/api/src/server.ts \
  --bundle --platform=node --target=node22 --format=cjs \
  --outfile=.azure-deploy/runtime/server.js
cat > .azure-deploy/runtime/package.json <<'EOF'
{
  "name": "nodouno-api-runtime",
  "private": true,
  "version": "1.0.0",
  "type": "commonjs",
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "engines": { "node": ">=22" }
}
EOF

# 2) Zip mínimo
cd .azure-deploy/runtime
zip -r ../api-node-runtime.zip server.js package.json
cd ../..

# 3) Deploy
az webapp deploy \
  --resource-group nodouno-rg-swedencentral \
  --name nodouno-api-psierra89 \
  --src-path .azure-deploy/api-node-runtime.zip \
  --type zip
```

**PowerShell (Windows):** sustituir el paso 2 por `Compress-Archive -Path server.js,package.json -DestinationPath ../api-node-runtime.zip -Force` desde `.azure-deploy/runtime`.

**Problemas conocidos ya resueltos en este proyecto:**
- `web.config` custom con **httpPlatformHandler** no está soportado en este App Service Windows y provoca IIS `500.19` (`0x8007000d`). Solución estable: desplegar solo `server.js` + `package.json` con `start`; App Service enruta POST a Node y tRPC responde JSON.
- Faltaba columna `projects.specs` en Supabase → migración `supabase/migrations/20260519100000_add_project_specs.sql`.
- Cliente web tRPC v11: `transformer: superjson` va en `httpLink`, no en la raíz de `createTRPCProxyClient`; usar `httpLink` (no `httpBatchLink`) en Azure.

**Arreglar CI (publish profile):**

Si el portal muestra *"La autenticación básica está deshabilitada"* al descargar el perfil:

1. Azure Portal → **nodouno-api-psierra89** → **Configuration** → **General settings**
2. Activar **SCM Basic Auth Publishing Credentials** = **On** (y guardar)
3. Volver a **Overview** → **Download publish profile** (`.PublishSettings`)
4. GitHub → repo → **Settings** → **Secrets** → `AZUREAPPSERVICE_PUBLISHPROFILE_NODOUNO_API` → pegar **todo** el XML del archivo

> Por seguridad, Azure desactiva la auth básica por defecto en apps nuevas. Solo hace falta activarla si usas el secret de publish profile en GitHub Actions. El deploy manual con `az webapp deploy` (arriba) **no** requiere el perfil.

**Alternativa más segura (sin auth básica):** migrar el workflow a **OIDC** con `azure/login@v2` + App Registration en Entra ID (ver [Deploy to Azure App Service](https://learn.microsoft.com/azure/app-service/deploy-github-actions)). Mientras tanto, `az webapp deploy` desde tu máquina con `az login` sigue siendo válido.