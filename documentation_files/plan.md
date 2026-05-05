# Plan de Proyecto Nodouno (MVP) - Estado Actual

Este documento refleja el estado real del trabajo al cierre de la iteracion actual y marca los pendientes inmediatos.

## Fase 1 - Base de producto y flujo protegido

- [x] Proyecto Astro + Tailwind operativo.
- [x] Sistema visual base monocromatico aplicado (tokens, radios, tipografia y botones).
- [x] Login y rutas protegidas para `/dashboard` y `/editor` con Supabase.
- [x] Dashboard con creacion de proyecto inline (sin `prompt`/`alert` para el nombre), carga/listado y apertura de proyecto.
- [ ] Mejorar UX de eliminacion de proyecto (confirmacion inline no destructiva).

## Fase 2 - Editor 2D + modelo + calculo

- [x] Editor 2D MVP con parametros y boceto sobre canvas.
- [x] Guardado de `drawing_data` en `projects`.
- [x] Generacion y guardado de `simplified_model`.
- [x] Integracion con motor de calculo existente (`loads`, `demands`, `design`).
- [x] Persistencia de `calculations` y `dimensioning` en `projects`.
- [x] Recuperacion en editor del ultimo `drawing_data`/`simplified_model`/resultados cuando existen.
- [ ] TODO: habilitar edicion geometrica libre (arrastre/edicion de nodos) en vez de solo flujo parametrico.
- [ ] TODO: pasar a estado `dimensioned` cuando se cierre el pipeline completo de armado final.

## Fase 3 - Visualizacion 3D MVP

- [x] Integracion base de Three.js en la UI del editor.
- [x] Render MVP de losa, vigas y columnas desde `simplified_model`.
- [x] Limpieza de recursos al desmontar (`dispose` de geometria/material y `renderer.dispose`).
- [ ] TODO: controles de camara (orbita/zoom) y etiquetas de elementos.
- [ ] TODO: mostrar armaduras/dimensionado detallado en 3D (post-MVP).

## Fase 4 - Calidad y cierre de iteracion

- [ ] Correr validaciones completas (`npm run build` y `npm run test`) y mantener verde.
- [ ] Revisar riesgos de datos legacy en `projects` (modelos previos sin campos nuevos).
- [ ] Definir el siguiente corte: mejoras UX editor + salida de armado mas rica.
