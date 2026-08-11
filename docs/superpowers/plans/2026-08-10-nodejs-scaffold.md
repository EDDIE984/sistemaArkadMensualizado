# Scaffold del proyecto Node (Confia / Mensualizado) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn this folder (currently only a static `.dc.html` design export) into a working Next.js + Tailwind + shadcn/ui + Supabase project, with the existing Hero Section migrated to a real React component, ready for incremental feature work.

**Architecture:** Single Next.js (App Router, TypeScript) project living at the repo root, deployed as one Vercel project. Route Handlers under `app/api` provide the API layer (none needed yet). Supabase (`@supabase/supabase-js`) is the database client, with no Supabase Auth — login will be built later against a custom table. shadcn/ui is installed so components from 21st.dev can be added via its CLI.

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui, `@supabase/supabase-js`, npm, deployed to Vercel.

## Global Constraints

- Package manager: npm (not pnpm/yarn).
- No Supabase Auth — Supabase is used only as a Postgres client; login will use a custom table defined in a future spec.
- No automated tests are configured in this scaffold (explicitly out of scope per spec).
- The Hero Section's copy/branding ("PulseIQ", analytics-dashboard text) stays unchanged in this migration — it's a known placeholder to be replaced later.
- No mobile nav menu is added — nav links simply hide under 860px, matching the original design (known gap, tracked in `design/DISENO.md` §12).
- The Next.js project is created at the repo root (`Mensualizado/`), not in a subfolder. Existing design assets move into `design/`.
- Source spec: `docs/superpowers/specs/2026-08-10-nodejs-scaffold-design.md`.

---

### Task 1: Initialize git repo and move design assets into `design/`

**Files:**
- Move: `DISENO.md` → `design/DISENO.md`
- Move: `Hero Section.dc.html` → `design/Hero Section.dc.html`
- Move: `Hero Section (standalone).html` → `design/Hero Section (standalone).html`
- Move: `support.js` → `design/support.js`
- Move: `.thumbnail` → `design/.thumbnail`
- Move: `uploads/` → `design/uploads/`

**Interfaces:**
- Produces: a git repository at the project root, and a `design/` folder containing all pre-existing design assets, so Task 2 can scaffold Next.js into a directory create-next-app won't flag as conflicting.

- [ ] **Step 1: Initialize the git repository**

Run in the project root (`/Users/eddiesosa/Documents/OneWayEc/Confia/Mensualizado`):

```bash
git init
```

- [ ] **Step 2: Move the design assets into `design/`**

```bash
mkdir -p design
mv "DISENO.md" design/
mv "Hero Section.dc.html" design/
mv "Hero Section (standalone).html" design/
mv "support.js" design/
mv ".thumbnail" design/
mv "uploads" design/
```

- [ ] **Step 3: Verify the move**

```bash
ls design
```

Expected output includes: `DISENO.md`, `Hero Section.dc.html`, `Hero Section (standalone).html`, `support.js`, `.thumbnail`, `uploads`.

```bash
ls
```

Expected: only `design/` and `docs/` remain at the root (no stray design files left behind).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: initialize repo and move design assets to design/"
```

---

### Task 2: Scaffold the Next.js project

**Files:**
- Create: everything `create-next-app` generates (`package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`, `eslint.config.mjs`, `postcss.config.mjs`, `public/*`, `README.md`), merged into the project root.

**Interfaces:**
- Consumes: a git repo with `design/` already separated out (Task 1), so create-next-app doesn't see conflicting files.
- Produces: a runnable Next.js app at the project root (`npm run dev` / `npm run build` work), which Task 3, 4, and 5 build on top of.

- [ ] **Step 1: Scaffold Next.js into a temp directory**

Scaffolding into a temp directory first (instead of directly into the project root) avoids `create-next-app`'s "directory not empty" check, since the root already contains `design/` and `docs/`.

```bash
SCRATCH=$(mktemp -d)
cd "$SCRATCH"
npx create-next-app@latest confia-scaffold \
  --typescript --tailwind --eslint --app --no-src-dir \
  --import-alias "@/*" --use-npm --yes
```

If it prompts interactively despite the flags, answer: TypeScript = Yes, Tailwind CSS = Yes, ESLint = Yes, App Router = Yes, `src/` directory = No, import alias = Yes, use `@/*`.

- [ ] **Step 2: Strip the temp project's own git repo and dependencies**

```bash
rm -rf "$SCRATCH/confia-scaffold/.git" "$SCRATCH/confia-scaffold/node_modules"
```

- [ ] **Step 3: Merge the generated files into the project root**

```bash
PROJECT="/Users/eddiesosa/Documents/OneWayEc/Confia/Mensualizado"
shopt -s dotglob nullglob
mv "$SCRATCH"/confia-scaffold/* "$PROJECT"/
shopt -u dotglob nullglob
rm -rf "$SCRATCH"
cd "$PROJECT"
```

- [ ] **Step 4: Install dependencies and verify the build**

```bash
npm install
npm run build
```

Expected: build completes with no errors (default `create-next-app` starter page compiles).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with TypeScript and Tailwind"
```

---

### Task 3: Install and initialize shadcn/ui

**Files:**
- Create: `components.json`
- Create: `lib/utils.ts`
- Create: `components/ui/button.tsx`
- Modify: `app/globals.css` (shadcn adds its CSS variables/theme block)
- Modify: `package.json` (new dependencies: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, etc.)

**Interfaces:**
- Consumes: the Next.js + Tailwind project from Task 2.
- Produces: a working shadcn/ui pipeline (`components/ui/`, `components.json`) so future components — including ones copied from 21st.dev — can be added with `npx shadcn add <url-or-name>`. Not consumed by Task 5 (Hero keeps plain Tailwind markup to match the original design exactly); this task only proves the pipeline works.

- [ ] **Step 1: Initialize shadcn/ui with defaults**

```bash
npx shadcn@latest init -d -y
```

If it prompts interactively, answer: base color = Neutral, CSS variables = Yes.

- [ ] **Step 2: Add the Button component as a smoke test**

```bash
npx shadcn@latest add button
```

- [ ] **Step 3: Verify**

```bash
ls components/ui
```

Expected: `button.tsx` is present.

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: initialize shadcn/ui"
```

---

### Task 4: Set up the Supabase client

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `.env.example`
- Create: `.env.local` (not committed — gitignored)
- Modify: `.gitignore` (un-ignore `.env.example`)

**Interfaces:**
- Consumes: the Next.js project from Task 2.
- Produces: `supabase` (a `SupabaseClient` instance) exported from `@/lib/supabase/client`, for future tasks/features to import and query the (future) login table and any other tables.

- [ ] **Step 1: Install the Supabase client library**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Create the Supabase client**

Create `lib/supabase/client.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 3: Create the env files**

Create `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Create `.env.local` with the same two keys, left blank (fill in with the real Supabase project URL/anon key from the Supabase dashboard before using any feature that queries Supabase):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 4: Un-ignore `.env.example` in `.gitignore`**

`create-next-app`'s generated `.gitignore` contains a blanket `.env*` rule, which would also hide `.env.example`. Open `.gitignore` and add this line directly after the `.env*` line:

```
!.env.example
```

- [ ] **Step 5: Verify**

```bash
npm run build
```

Expected: build completes with no errors (the `!` non-null assertions are fine at build time; they only throw at runtime if the env vars are actually read without being set).

```bash
git status --short
```

Expected: `.env.local` does NOT appear in the output (it's gitignored); `.env.example`, `lib/supabase/client.ts`, and the `.gitignore` change do appear.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Supabase client"
```

---

### Task 5: Migrate the Hero Section to React + Tailwind

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/page.tsx`
- Create: `components/sections/hero.tsx`

**Interfaces:**
- Consumes: the Next.js + Tailwind project from Task 2. Does not depend on Task 3 or 4.
- Produces: `Hero` (default-exportless named export) from `@/components/sections/hero`, rendered by `app/page.tsx`.

The source of truth for every value below is `design/DISENO.md` (colors, type scale, spacing, animation timings) and `design/Hero Section.dc.html` (original inline-style implementation).

- [ ] **Step 1: Replace `app/layout.tsx`**

Swap the default Geist fonts for Inter (matching the original design's font), and update the page metadata:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Confia",
  description: "Confia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `app/globals.css`**

Point the Tailwind theme's `--font-sans` at Inter instead of Geist, and add the four keyframes the Hero uses for its staggered entrance animation:

```css
@import "tailwindcss";

:root {
  --background: #0a0a0a;
  --foreground: #ededed;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);
}

body {
  background: var(--background);
  color: var(--foreground);
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(28px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes navDrop {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes zoomFade {
  from { opacity: 0; transform: scale(1.08); }
  to { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 3: Create `components/sections/hero.tsx`**

This is a Server Component (no `"use client"` needed — pure CSS animations, no interactivity). Every Tailwind class below was chosen to exactly match `design/DISENO.md`: spacing values map 1:1 to Tailwind's default scale (e.g. `56px` = `px-14`, `10px` = `gap-2.5`, `24px` = `text-2xl`), and the single `860px` breakpoint uses Tailwind's arbitrary `max-[860px]:` variant since it doesn't match any default breakpoint.

```tsx
export function Hero() {
  return (
    <section className="relative w-full h-screen overflow-hidden flex flex-col bg-[#0a0a0a]">
      <div className="absolute inset-0 w-full h-full overflow-hidden animate-[zoomFade_1.6s_ease-out_both]">
        <video
          src="https://res.cloudinary.com/urml6fcu/video/upload/kling_20260810_Image_to_Video_Hand_holdi_2841_0.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-1/2 left-1/2 w-full h-full min-w-full min-h-full -translate-x-1/2 -translate-y-1/2 object-cover object-center pointer-events-none bg-[#0a0a0a]"
        />
      </div>

      <div className="absolute inset-0 animate-[fadeIn_1.2s_ease-out_both] bg-[linear-gradient(100deg,rgba(6,6,8,0.82)_0%,rgba(6,6,8,0.62)_32%,rgba(6,6,8,0.28)_55%,rgba(6,6,8,0.15)_75%,rgba(6,6,8,0.35)_100%)]" />

      <nav className="relative z-[2] flex items-center justify-between px-14 max-[860px]:px-5 pt-5 shrink-0 animate-[navDrop_0.8s_cubic-bezier(0.16,1,0.3,1)_both]">
        <div className="flex items-center gap-2.5">
          <span className="w-[9px] h-[9px] rounded-full bg-white" />
          <span className="text-[17px] font-bold text-white tracking-[-0.01em]">PulseIQ</span>
        </div>
        <div className="flex items-center gap-8 max-[860px]:hidden">
          <a href="#" className="text-[14.5px] font-medium text-white/85 hover:opacity-75">Nosotros</a>
          <a href="#" className="text-[14.5px] font-medium text-white/85 hover:opacity-75">Insights</a>
          <a href="#" className="text-[14.5px] font-medium text-white/85 hover:opacity-75">Reportes</a>
          <a href="#" className="text-[14.5px] font-medium text-white/85 hover:opacity-75">Integraciones</a>
          <a href="#" className="text-[14.5px] font-medium text-white/85 hover:opacity-75">Precios</a>
        </div>
        <a href="#" className="bg-white text-[#0a0a0a] text-sm font-semibold px-[22px] py-2.5 rounded-full hover:opacity-75">
          Contacto
        </a>
      </nav>

      <div className="relative z-[2] flex-1 flex flex-col justify-center px-14 max-[860px]:px-5 max-w-[600px] gap-[18px] min-h-0 overflow-hidden">
        <h1 className="m-0 flex flex-col text-[48px] max-[860px]:text-[42px] leading-[1.08] font-bold tracking-[-0.02em] text-white">
          <span className="animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.15s_both]">Insights más inteligentes</span>
          <span className="animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.28s_both]">Para un mejor</span>
          <span className="animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.41s_both]">rendimiento</span>
        </h1>

        <p className="m-0 text-[15.5px] leading-[1.5] text-white/75 max-w-[480px] font-normal animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.55s_both]">
          Rastrea ingresos, clics, interacción y conversiones en un panel potente y fácil de usar, hecho para creadores y emprendedores.
        </p>

        <div className="flex items-center gap-3.5 max-[860px]:flex-wrap animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.68s_both]">
          <a href="#" className="bg-white text-[#0a0a0a] text-sm font-semibold px-6 py-3 rounded-full inline-block hover:opacity-75">
            Empezar a analizar
          </a>
          <a href="#" className="bg-white/8 text-white text-sm font-semibold px-6 py-3 rounded-full border border-white/35 inline-block hover:opacity-75">
            Ver demo
          </a>
        </div>

        <div className="flex items-center gap-2.5 animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.8s_both]">
          <span className="text-white text-[15px] tracking-[2px]">★★★★★</span>
          <span className="text-sm text-white/70 font-medium">5.0 &nbsp;|&nbsp; Nuevas calificaciones de usuarios</span>
        </div>

        <div className="grid grid-cols-[repeat(3,auto)] gap-8 max-[860px]:grid-cols-[repeat(3,1fr)] max-[860px]:gap-[18px] animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.92s_both]">
          <div className="flex flex-col gap-0.5">
            <div className="text-2xl max-[860px]:text-[26px] font-bold text-white tracking-[-0.01em]">83%</div>
            <div className="text-[12.5px] text-white/65 font-medium">Toman decisiones más rápido</div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-2xl max-[860px]:text-[26px] font-bold text-white tracking-[-0.01em]">52%</div>
            <div className="text-[12.5px] text-white/65 font-medium">Monitorean conversiones</div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-2xl max-[860px]:text-[26px] font-bold text-white tracking-[-0.01em]">41%</div>
            <div className="text-[12.5px] text-white/65 font-medium">Exportan reportes</div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Replace `app/page.tsx`**

```tsx
import { Hero } from "@/components/sections/hero";

export default function Home() {
  return <Hero />;
}
```

- [ ] **Step 5: Verify the build**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 6: Verify the rendered page**

```bash
npm run dev &
DEV_PID=$!
sleep 3
curl -s http://localhost:3000 | grep -q "rendimiento" && echo "PAGE_OK"
kill $DEV_PID
```

Expected: prints `PAGE_OK`.

- [ ] **Step 7: Manual visual check**

Open `http://localhost:3000` in a browser (`npm run dev`) and compare it side-by-side with `design/.thumbnail`: same dark hero with video background, nav, three-line headline, subtext, two CTA buttons, star rating, and three stat blocks, with the staggered fade-up entrance animation on load. Resize the window below 860px and confirm the nav links hide and the stats grid becomes equal-width columns.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: migrate Hero Section to React + Tailwind"
```
