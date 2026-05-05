# 🗄️ Reglas de Base de Datos (Supabase)

Estrategia orientada a iteración rápida (MVP) sin sacrificar seguridad.

## 1. Tablas Principales
- `profiles`: Vinculado a `auth.users` (Manejo de usuarios).
- `projects`: Almacena las instancias de cálculo.

## 2. Estructura de Proyectos (Esquema Híbrido)
Para evitar migraciones constantes en el MVP, las etapas del proyecto se guardan como JSONB:
- `drawing_data` (JSONB): Trazos, líneas y dimensiones en 2D.
- `simplified_model` (JSONB): El modelo de 4 columnas, 4 vigas y 1 losa generado.
- `calculations` (JSONB): Cargas y solicitaciones.
- `dimensioning` (JSONB): Armaduras y cantidades según CIRSOC 201.
- `status` (ENUM): 'draft', 'drawn', 'calculated', 'dimensioned'.

## 3. Seguridad Obligatoria
- **UUID:** Usar UUIDs para todas las PK y FK.
- **RLS (Row Level Security):** TODA tabla debe tener políticas RLS activas donde `auth.uid() = user_id`. Ningún usuario debe poder leer/escribir proyectos ajenos.