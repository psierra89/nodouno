# 🎨 Sistema de Diseño y UI Constraints

Estilo visual: "Lujo Monocromático / Alta Tecnología". Alto contraste, limpieza extrema y formas geométricas definidas.

## 1. Tokens de Color (Tailwind v4)
Prohibido usar colores por defecto de Tailwind. Usar estrictamente:
- `--color-obsidian` (`#000d10`): Texto principal, fondos oscuros, botones secundarios.
- `--color-canvas-white` (`#ffffff`): Fondo base de la app y tarjetas.
- `--color-slate-mist` (`#8e8e95`): Textos secundarios (helpers), bordes sutiles y divisores. NUNCA usar para texto principal.
- `--color-desert-sienna` (`#bc7155`): ÚNICO COLOR DE ACENTO. Exclusivo para Botones CTA principales (Ej: "Calcular").

## 2. Tipografía
- **Fuente:** `HelveticaNowDisplay`, `ui-sans-serif`, `system-ui`.
- **Headings:** Tamaño masivo (`text-5xl`+), negrita (`font-bold`) y tracking negativo (`tracking-tighter`).
- **Body:** Tamaño mínimo `17px`.

## 3. Formas (Shapes)
Prohibido `rounded-md` o `rounded-lg`. Usar extremos:
- **Tarjetas/Paneles:** `--radius-card: 45px`. Padding interno generoso (mínimo `p-6`).
- **Botones/Inputs:** `--radius-pill: 1000px`. Forma de píldora estricta.

## 4. Restricciones
- **CERO Sombras:** Diseño 100% flat. Sin `shadow`.
- **CERO Gradientes:** Solo colores sólidos.
- **Aireado:** Usar `gap` y `padding` grandes.