<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Reglas de negocio del proyecto

Antes de implementar o modificar cualquier cosa relacionada con el modelo de datos, cotizaciones, pólizas, aseguradoras, productos, coberturas, deducibles, tarifas, riesgos o cualquier otra lógica de negocio de seguros, **revisar primero**:

`supabase/PLATAFORMA_SEGUROS_MODELO_ER.md`

Ese documento es la fuente de verdad del modelo de datos y las reglas de negocio de la plataforma (del cual se generó `supabase/migrations/20260811033315_schema.sql`). Cualquier cambio de esquema o de lógica de negocio debe ser consistente con lo ahí definido; si hay una discrepancia, se actualiza ese documento primero y luego el código/esquema.
