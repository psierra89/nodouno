# 📋 Plan de Proyecto: Nodouno (MVP Simplificado)

Este plan de desarrollo estructura el trabajo para el MVP basándose en los agentes y responsabilidades definidas.

## 1. 🏗️ Frontend & UI (Responsabilidad: AstroAgent)
*   **Inicialización:** Crear el proyecto base con Astro y configurar Tailwind CSS v4.
*   **Sistema de Diseño (Lujo Monocromático):**
    *   Configurar tokens estrictos de Tailwind: `--color-obsidian`, `--color-canvas-white`, `--color-slate-mist`, y `--color-desert-sienna` (único CTA).
    *   Implementar restricciones visuales: 0 sombras, 0 gradientes, tipografía masiva (`HelveticaNowDisplay`) con tracking negativo para títulos.
    *   Establecer bordes extremos: `45px` para tarjetas/paneles y `1000px` (píldora) para botones/inputs.
*   **Gestión de Estado:** Integrar Nano Stores para manejar el estado global de la aplicación (pasos actuales del usuario, datos en memoria del proyecto).
*   **Autenticación y Rutas:** Configurar Supabase SSR en Astro para proteger las rutas privadas (`/dashboard`, `/editor`).

## 2. 🗄️ Base de Datos (Responsabilidad: DBAgent)
*   **Esquema Supabase (PostgreSQL):**
    *   Crear tabla `profiles` vinculada mediante triggers/hooks a `auth.users`.
    *   Crear tabla `projects` con claves primarias y foráneas utilizando UUIDs.
*   **Estructura Híbrida (JSONB):** Configurar las columnas de iteración rápida para el modelo simplificado: `drawing_data`, `simplified_model`, `calculations`, y `dimensioning`.
*   **Estados del Proyecto:** Crear el ENUM `status` ('draft', 'drawn', 'calculated', 'dimensioned').
*   **Seguridad:** Implementar obligatoriamente políticas RLS (Row Level Security) para garantizar que los usuarios (`user_id = auth.uid()`) solo tengan acceso de lectura y escritura a sus propios proyectos.

## 3. 🧠 Motor de Cálculo / Backend (Responsabilidad: BackendAgent)
*   **Núcleo Matemático (Node/TS):** Desarrollar funciones puras que modelen la estructura simplificada (1 Losa, 4 Vigas, 4 Columnas) de hormigón armado.
*   **Procesamiento de Cargas (CIRSOC 101/201):**
    *   Calcular Carga Muerta (D) y Sobrecarga (L).
    *   Calcular Carga Última ($q_u = 1.2D + 1.6L$) y distribuir cargas por áreas tributarias hacia vigas y columnas.
*   **Cálculo de Solicitaciones:** Determinar Momento ($M_u$) en losas/vigas, Corte ($V_u$) en vigas y Esfuerzo Axial ($P_u$) en columnas. Agregar comentarios TODO para momentos en columnas post-MVP.
*   **Dimensionamiento (CIRSOC 201):**
    *   Calcular cuantías de acero ($\rho$), verificaciones dúctiles, y separación de estribos por corte.
    *   Dimensionar columnas con cuantía geométrica permitida.
*   **Salida (Output):** Estructurar el retorno como un objeto JSON inmutable conteniendo la geometría final, el despiece de la armadura (longitudinal y transversal) y el cómputo métrico ($m^3$ de hormigón y $kg$ de acero).

## 4. 📐 Visualización 3D (Responsabilidad: ThreeJSAgent)
*   **Componentes 3D:** Desarrollar scripts de Three.js para renderizar la estructura espacial generada y el despiece de armaduras.
*   **Integración Frontend:** Aislar y montar el código de Three.js en componentes UI dentro de Astro usando directivas de hidratación (`client:load`).
*   **Optimización de Memoria:** Implementar funciones de limpieza (`dispose`) para liberar geometrías y materiales del GPU al desmontar el componente.
