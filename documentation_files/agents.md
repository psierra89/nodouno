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