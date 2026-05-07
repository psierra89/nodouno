# Editor 2D (CAD basico) — Nodouno

> Rediseno radical del editor 2D, inspirado en AutoCAD basico y `react-planner`.
> Implementado sobre Canvas 2D (nativo) en Astro + TypeScript, sin dependencias adicionales.

## 1. UX y atajos

### Herramientas
| Tecla | Herramienta | Descripcion |
| --- | --- | --- |
| `V` | Select | Selecciona/multiselecciona y mueve elementos. |
| `H` | Pan | Desplazamiento de la vista. |
| `L` | Viga / Linea | Click 1 = inicio · Click 2 = fin. La herramienta queda activa para encadenar. |
| `R` | Columna / Rectangulo | Click coloca columna con la seccion default. `Shift+Click+Click` define columna por rectangulo. |
| `P` | Losa / Poligono | Cada click anade un vertice. `Doble click` o `Enter` cierra la losa. `Click derecho` cierra. |

### Atajos
| Atajo | Accion |
| --- | --- |
| `Espacio` (sostenido) | Pan temporal con boton izquierdo. |
| `Boton medio` | Pan permanente. |
| `Rueda` | Zoom anclado al cursor. |
| `+` / `-` | Zoom in/out al centro. |
| `0` | Reset de vista. |
| `Shift+0` | Encajar contenido al viewport. |
| `F8` | Toggle ortho. |
| `F9` | Toggle snap a grilla. |
| `Ctrl+Z` | Deshacer. |
| `Ctrl+Shift+Z` o `Ctrl+Y` | Rehacer. |
| `Ctrl+A` | Seleccionar todo. |
| `Supr` / `Backspace` | Borrar seleccion. |
| `Esc` | Cancelar dibujo / limpiar seleccion. |

### Snap
- Por defecto a `0.1 m` (rejilla menor).
- Tambien a `endpoints` y `midpoints` de vigas, columnas (centro) y vertices/aristas de losas.
- El marcador visual cambia segun el tipo (cuadrado: endpoint, rombo: midpoint, circulo: grilla, anillo: ortho).
- Ortho fija el segundo punto en linea horizontal o vertical respecto del primero.

### HUD
- Coordenadas del cursor en metros (3 decimales).
- Escala actual en `px/m`.
- Estado de tool, snap y ortho.
- Medida en vivo del elemento que se esta dibujando (`L`, `W`, `H`, `A`, `n vertices`).

## 2. Modelo de datos (`drawing_data` v4)

```jsonc
{
  "version": 4,
  "createdAt": "2026-05-07T10:42:00.000Z",
  "grid": { "sizeM": 0.1, "snapEnabled": true, "orthoEnabled": false },
  "entities": {
    "columns": [
      {
        "id": "col_xxxxx",
        "type": "column",
        "cx": 1.2,           // centro X (m)
        "cy": 0.8,           // centro Y (m)
        "widthM": 0.35,
        "depthM": 0.35,
        "rotation": 0,        // radianes
        "props": { }          // material/clase opcional
      }
    ],
    "beams": [
      {
        "id": "beam_xxxxx",
        "type": "beam",
        "x1": 0, "y1": 0,
        "x2": 6, "y2": 0,
        "widthM": 0.25,
        "depthM": 0.5,
        "props": { }
      }
    ],
    "slabs": [
      {
        "id": "slab_xxxxx",
        "type": "slab",
        "points": [
          { "x": 0, "y": 0 }, { "x": 6, "y": 0 },
          { "x": 6, "y": 4 }, { "x": 0, "y": 4 }
        ],
        "thicknessM": 0.2,
        "props": { }
      }
    ]
  },
  "freeDrawing": {
    /* Representacion legacy en pixeles (1 m = 20 px). Se sigue escribiendo
       para compatibilidad con lectores antiguos. */
  }
}
```

- Todas las coordenadas estan en **metros**, eje Y hacia abajo (estandar canvas).
- IDs estables generados con `crypto.randomUUID` cuando esta disponible.
- `props` queda libre para futuras extensiones (material, clase, comentarios).

### Migracion automatica desde versiones <= 3

`migrateDrawingData(raw)` en `src/lib/editor2d/migration.ts`:

- Detecta `version`. Si es `>= 4`, normaliza y devuelve.
- Si es legacy (1-3), interpreta `entities`/`freeDrawing` en pixeles del canvas viejo (`grid.size px = 1 m`, fallback `20 px = 1 m`).
- Convierte cada figura a metros y al esquema v4.
- Tolera ambas formas: `{ shape: 'rect' | 'polygon' }` (entidades v3) y `{ type: 'rect' | 'polygon' }` (freeDrawing).

`toLegacyFreeDrawing(state)` genera la rep. legacy (`1 m = 20 px`) que se sigue persistiendo bajo `freeDrawing`.

## 3. Modelo simplificado y motor de calculo

`deriveSimplifiedModel(state, fallback)` en `src/lib/editor2d/derivedModel.ts`:

- Si hay losas dibujadas, usa el bbox de la mas grande para luces (`spanX`, `spanY`) y su espesor para `thicknessM`. Marca `source: 'derived_from_drawing'`.
- Si no hay losas, devuelve un modelo equivalente al fijo previo usando los inputs manuales (luz X/Y, espesor, cargas). Marca `source: 'fixed_mvp_rectangular'`.
- Mantiene la firma de salida (`slab`, `beams[]`, `columns[]`, `materials`, `source`) compatible con `calculateLoads/Demands/Design`.

> El motor (`src/calc/*`) **no se modifico**. Solo se agrega derivacion sobre `drawing_data`.

## 4. Arquitectura del codigo

```
src/lib/editor2d/
├── types.ts          # Tipos compartidos (Entity, DrawingState, CameraState, ...)
├── ids.ts            # nextId() con randomUUID + fallback
├── camera.ts         # world<->screen, zoom-anclado-cursor, pan, viewport bounds
├── grid.ts           # Render multi-resolucion (mayor 1 m / menor 0.1 m con culling)
├── geometry.ts       # bbox, hit test, polygonArea, translate, find/remove
├── snap.ts           # snapToGrid, computeSnap (entidades), applyOrtho
├── history.ts        # Stack de snapshots, max=60
├── derivedModel.ts   # drawing_data -> simplified_model
├── migration.ts      # Lectura tolerante v1-3 -> v4 + freeDrawing legacy
├── render.ts         # Pintor unificado del canvas (grid + entidades + preview + snap)
├── index.ts          # mountEditor2d(canvas, options): Editor2DHandle
└── editor2d.test.ts  # Suite vitest (camera, snap, migration, derivedModel, geometry, history)
```

### Lazo de render
- Un solo `<canvas>` con DPR scaling (clamp a 2x).
- `requestAnimationFrame` se agenda solo cuando `needsRender = true`.
- Estado persistente (`state.entities`) separado de estado efimero (`cam`, `cursorWorld`, `snapResult`, `preview`, `dragMove`, `panActive`, `hoverId`, `selection`).
- Culling por viewport: cada entidad descarta render si su bbox no intersecta el viewport.
- Las lineas de grilla se acumulan en un solo `beginPath` por nivel para minimizar `stroke()` calls.

### Loop de eventos
- `pointerdown` / `pointermove` / `pointerup` / `pointercancel` / `pointerleave` / `wheel` (passive: false) / `dblclick` / `contextmenu`.
- `keydown`/`keyup` a nivel `window`, ignorando inputs/textareas/contenteditable.
- Pan con boton medio o `Espacio + boton izquierdo`.

### Undo / Redo
- `History` mantiene snapshots de `DrawingState` (deep clone via `structuredClone`).
- Push solo en commits (creacion, eliminacion, fin de drag, edicion de propiedades).
- Snapshots durante drag se aplican sobre clone temporal sin tocar history.

## 5. Decisiones tecnicas relevantes

1. **Sin dependencias nuevas**: ni `nanoid`, ni librerias de canvas. Se usa `crypto.randomUUID` con fallback nativo y `structuredClone`.
2. **Coordenadas en metros**: simplifica la integracion con motor de calculo y el panel de propiedades.
3. **Camara separada de entidades**: las operaciones de paneo/zoom son `O(1)` en el render, sin recalcular geometria.
4. **Snap "lazy"**: solo cuando hay pointer movement; no hay loops adicionales.
5. **Compatibilidad hacia atras**: lectura tolerante (`v1-3`) y escritura dual (`v4` + `freeDrawing` legacy en pixeles).
6. **Tests con vitest** sobre camara, snap, migracion, history, geometria y derivacion del modelo simplificado.

## 6. Limitaciones conocidas / Trabajo futuro

- No hay snap a **intersecciones** verdaderas entre vigas/losas (solo endpoints/midpoints + grilla). El tipo `intersection` ya esta en el modelo y la tabla de marcadores; queda pendiente la deteccion geometrica.
- Las columnas estan parametrizadas por `cx, cy, widthM, depthM, rotation`, pero la UI solo expone rotacion en grados; no hay rotacion por arrastre.
- La losa solo soporta poligonos simples (sin agujeros).
- La simbologia en planta es minima (sin etiquetas de elementos ni cotas). Se podria agregar overlay de cotas en una capa adicional.
- El selector multiple por arrastre (rubber band) no esta implementado; solo `Shift+click`.
- El ancho visual de la viga responde al zoom, pero la columna se muestra siempre solida; sin sombras/hatch.
- Si `drawing_data` no tiene losas, el modelo simplificado cae al fallback manual del Paso 2 (compatible con el motor actual).

## 7. Persistencia

Al guardar (`Guardar dibujo`, boton **Siguiente** del paso 1, o boton de **Generar modelo simplificado** del paso 2), se persiste en `projects` (Supabase):

- `drawing_data`: estado v4 + `freeDrawing` (legacy, pixeles).
- `simplified_model`: salida de `deriveSimplifiedModel`.
- `calculations`, `dimensioning`: motor existente sin cambios.
- `status`: `drawn` | `loads_defined` | `dimensioned` segun la etapa.

## 8. QA manual sugerido

1. Cargar `/editor` con un proyecto activo. Confirmar que la grilla se ve siempre y que los marcadores 1 m son mas oscuros que los 0.1 m.
2. Hacer zoom out fuerte: las lineas menores deben ocultarse al estar a < 6 px en pantalla; las mayores siguen visibles.
3. Hacer zoom in con la rueda; el punto bajo el cursor debe quedar bajo el cursor (zoom anclado).
4. Mantener `Espacio` y arrastrar: pan; soltar regresa al tool previo.
5. Probar `L`: dos clicks crean viga; con ortho (`F8`) la viga queda H/V.
6. Probar `R`: click coloca columna 0.35 x 0.35; cambiar defaults en panel derecho y volver a clickear; con `Shift` arrastrar dos clicks define rect.
7. Probar `P`: tres clicks + `Enter` cierran losa; doble click cierra; `Esc` cancela.
8. Seleccionar varios con `Shift+click`, mover con drag y comprobar snap.
9. `Ctrl+Z` / `Ctrl+Shift+Z` deshacen/rehacen creaciones, movimientos y eliminaciones.
10. Guardar, recargar la pagina y verificar que las entidades reaparecen en metros.
11. Generar modelo simplificado: si hay losa, debe reflejar las luces dibujadas; si no, usa los inputs manuales.
12. Ejecutar calculo: el output debe coincidir con el motor existente (sin regresiones).
