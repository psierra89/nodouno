# ⚙️ Motor de Cálculo (CIRSOC 201 / CIRSOC 101)

El backend debe procesar el módulo simplificado (1 Losa, 4 Vigas, 4 Columnas). Todo es hormigón armado.

## 1. Cargas (CIRSOC 101 / 201)
- **Peso Propio (D):** Espesor losa $\times 24 \, kN/m^3$ + cargas muertas.
- **Sobrecarga (L):** Según destino.
- **Carga Última:** $q_u = 1.2D + 1.6L$.
- Distribuir carga de losa a vigas (áreas tributarias) y descender reacción de vigas + peso propio a las columnas por cantidad de pisos ($n$).

## 2. Solicitaciones (MVP Simplificado)
- **Losa:** Momento $M_u = \frac{q_u \cdot l^2}{8}$
- **Vigas:** Flector $M_u$ (tramo) y Corte $V_u$ (apoyos).
- **Columnas:** Esfuerzo Axial $P_u$. (Ignorar momento en MVP, añadir TODO en comentarios).

## 3. Dimensionamiento (CIRSOC 201)
- **Flexión (Vigas/Losas):** Calcular cuantía de acero $\rho$.
  - Mínimo: $\rho_{min} = \max(\frac{1.4}{f_y}, \frac{0.25 \cdot \sqrt{f'_c}}{f_y})$.
  - Verificación dúctil: $\epsilon_t \ge 0.005$.
- **Corte (Vigas):** Si $V_u > \phi \cdot V_c / 2$, requerir estribos.
  - Separación máxima: $s_{max} = \min(\frac{d}{2}, 600 \, mm)$.
- **Axial (Columnas):** 
  - Cuantía geométrica: $0.01 \le \rho_g \le 0.08$. Mínimo 4 barras.

## 4. Output
Devolver JSON inmutable con: Geometría final, despiece de armadura longitudinal y transversal, y cómputo métrico (Volumen Hº en $m^3$ y Acero en $kg$).