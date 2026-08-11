# Scaffold del proyecto Node (Confia / Mensualizado) — Diseño

## Contexto

Actualmente esta carpeta contiene solo el diseño estático de la landing page (Hero Section), exportado en formato `.dc.html` (ver [`DISENO.md`](../../../DISENO.md)). El objetivo de este spec es definir el scaffold del proyecto Node con el que se va a continuar el desarrollo: una aplicación completa (frontend + API + base de datos), construida incrementalmente a partir de este Hero.

El alcance funcional más allá del Hero (formularios, cotizador, login) **se define feature por feature más adelante**; este spec cubre únicamente el scaffold del proyecto y la migración del Hero Section existente.

## Stack

- **Frontend**: Next.js (App Router, TypeScript) + Tailwind CSS + shadcn/ui.
  - shadcn/ui se elige específicamente porque el usuario quiere poder instalar componentes de [21st.dev](https://21st.dev/), que se distribuyen como componentes shadcn (Tailwind + Radix) vía `npx shadcn add <url>`.
- **Backend**: Route Handlers de Next.js (`app/api/...`), en el mismo proyecto (no hay backend Express separado).
- **Base de datos**: Supabase (Postgres), acceso vía `@supabase/supabase-js`.
  - **No se usa Supabase Auth.** El login se implementará más adelante contra una tabla propia (custom), no contra el sistema de Auth gestionado de Supabase. El scaffold solo deja el cliente de Supabase listo para hacer queries, sin helpers de sesión/Auth de Supabase.
- **Gestor de paquetes**: npm.
- **Deploy**: Vercel (un solo proyecto, frontend + API juntos).
- **Tests**: no se configuran en este scaffold inicial; se añaden cuando haya lógica que lo amerite.

## Estructura de carpetas

El proyecto Next.js se crea **en esta misma carpeta** (`Mensualizado/`), no en una subcarpeta separada. Los archivos de diseño existentes se mueven a `design/`.

```
Mensualizado/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    → landing page, renderiza <Hero />
│   ├── globals.css                 → Tailwind base + keyframes de animación del Hero
│   └── api/                        → Route Handlers (vacío por ahora)
├── components/
│   ├── ui/                         → componentes shadcn/ui (generados por su CLI)
│   └── sections/
│       └── hero.tsx                → Hero Section migrado desde design/Hero Section.dc.html
├── lib/
│   └── supabase/
│       └── client.ts               → cliente de supabase-js (sin Auth helpers)
├── public/                         → assets estáticos si aplica
├── design/                         → documentación y export original del diseño
│   ├── DISENO.md
│   ├── Hero Section.dc.html
│   ├── Hero Section (standalone).html
│   ├── support.js
│   ├── .thumbnail
│   └── uploads/
├── docs/superpowers/specs/         → specs de diseño (este archivo y futuros)
├── .env.local                      → SUPABASE_URL / SUPABASE_ANON_KEY (gitignored)
├── .env.example
├── components.json                 → config de shadcn/ui
├── tailwind.config.ts
├── tsconfig.json
├── next.config.ts
└── package.json
```

## Migración del Hero Section

El componente actual (`design/Hero Section.dc.html`) genera todos sus estilos vía JS inline (`renderVals()` devolviendo objetos de estilo) y anima con `@keyframes` definidos en un `<style>` embebido. Al migrar:

- Se convierte en `components/sections/hero.tsx`: componente React funcional, con **clases Tailwind** en vez de estilos inline generados por JS.
- Las animaciones (`fadeUp`, `zoomFade`, `navDrop`, `fadeIn`) se recrean como keyframes CSS en `app/globals.css` (o vía `tailwindcss-animate`), con los mismos delays escalonados documentados en `DISENO.md` §7.
- El breakpoint mobile único (`≤860px`) se traduce al breakpoint `md:` de Tailwind (equivalente más cercano).
- El video de fondo (URL de Cloudinary) y el copy actual ("PulseIQ", textos en español genéricos de analítica) se mantienen sin cambios en esta migración — son placeholder y se reemplazarán en una iteración posterior, cuando se defina el copy real de Confia.
- No se agrega el menú mobile faltante (nav links ocultos en `≤860px` sin alternativa) en este scaffold; queda como mejora futura ya anotada en `DISENO.md` §12.

## Supabase

- Cliente único en `lib/supabase/client.ts`, inicializado con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (variables de entorno, no hardcodeadas).
- No se crea ninguna tabla ni lógica de login todavía — eso se define en un spec aparte cuando se aborde esa feature.
- `.env.local` se agrega a `.gitignore`; se deja `.env.example` con las claves esperadas sin valores reales.

## Fuera de alcance (explícitamente, para este spec)

- Formularios, cotizador de seguros, lógica de negocio.
- Login / tabla de autenticación custom.
- Reemplazo del copy/branding placeholder por el contenido real de Confia.
- Menú de navegación mobile.
- Tests automatizados.

Estos se abordarán en specs/planes separados cuando el usuario los solicite.
