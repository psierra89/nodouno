# 📝 Tareas Simples: Fase 1 - Frontend (Astro)

Este documento desglosa la Fase 1 en tareas atómicas, ideal para ser ejecutadas paso a paso por un agente básico.

## 1. Inicialización y Dependencias
- [ ] **Tarea 1.1:** Ejecutar `npm create astro@latest ./ -- --template minimal` (o en una carpeta específica) para crear un proyecto Astro vacío.
- [ ] **Tarea 1.2:** Ejecutar `npx astro add tailwind` para instalar y configurar la integración de TailwindCSS.
- [ ] **Tarea 1.3:** Instalar dependencias adicionales ejecutando `npm install nanostores @supabase/supabase-js`.

## 2. Tokens y Sistema de Diseño Global
- [ ] **Tarea 2.1:** Crear/Modificar `src/styles/global.css`. Definir las siguientes variables CSS en `:root`:
  - `--color-obsidian`: `#000d10`
  - `--color-canvas-white`: `#ffffff`
  - `--color-slate-mist`: `#8e8e95`
  - `--color-desert-sienna`: `#bc7155`
  - `--radius-card`: `45px`
  - `--radius-pill`: `1000px`
- [ ] **Tarea 2.2:** En `src/styles/global.css`, configurar el `body` para usar fuente `HelveticaNowDisplay`, `ui-sans-serif` o `system-ui`. Fondo `--color-canvas-white` y texto `--color-obsidian`.
- [ ] **Tarea 2.3:** En `src/styles/global.css`, resetear encabezados (`h1`, `h2`, `h3`) para que tengan font-weight bold (`font-bold`) y tracking negativo extremo (`tracking-tighter`).

## 3. Componentes UI Base (Sin sombras, flat)
- [ ] **Tarea 3.1:** Crear `src/components/Button.astro`. Debe usar la variable `--radius-pill`, tener color de fondo `--color-desert-sienna`, y texto claro/blanco. Sin gradientes ni sombras (`shadow-none`).
- [ ] **Tarea 3.2:** Crear `src/components/Card.astro`. Debe usar la variable `--radius-card`, tener un padding interno de al menos `p-6` o `p-8`. Fondo sólido.

## 4. Estado Global (Nano Stores)
- [ ] **Tarea 4.1:** Crear carpeta `src/store/`.
- [ ] **Tarea 4.2:** Crear archivo `src/store/projectStore.ts`.
- [ ] **Tarea 4.3:** Dentro de `projectStore.ts`, exportar un átomo de Nano Stores (ej: `export const currentStep = atom('draft')`).

## 5. Páginas y Autenticación Base (Supabase)
- [ ] **Tarea 5.1:** Crear archivo `src/lib/supabase.ts` que inicialice el cliente de Supabase usando `import.meta.env.PUBLIC_SUPABASE_URL` y la anon key.
- [ ] **Tarea 5.2:** Crear layout principal `src/layouts/Layout.astro` que importe `global.css`.
- [ ] **Tarea 5.3:** Crear página `src/pages/index.astro` (Landing/Login) usando el `Layout`.
- [ ] **Tarea 5.4:** Crear página `src/pages/dashboard.astro`. Añadir lógica básica en el frontmatter de Astro (`---`) para chequear la sesión de Supabase; si no hay usuario, redirigir a `/`.
- [ ] **Tarea 5.5:** Crear página `src/pages/editor.astro`. Aplicar la misma protección de ruta que en el dashboard.