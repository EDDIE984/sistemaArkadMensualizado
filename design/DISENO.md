# Diseño – Hero Section "Mensualizado" (Confia)

> Documentación de referencia del diseño actual de la sección Hero, para poder retomar el desarrollo sin tener que releer el HTML completo. Fuente de verdad: [`Hero Section.dc.html`](./Hero%20Section.dc.html).

## 1. Qué es este proyecto

Landing hero para **Confia**, negocio de **seguros de auto** ("Encuentra el seguro ideal para tu auto"). El archivo `.dc.html` está actualmente maquetado con branding y copy **placeholder** ("PulseIQ", "panel de analítica"), tomado de una plantilla de referencia (ver `uploads/_.jpeg`). El mockup de celular original (`uploads/pasted-1786333312326-0.png`) sí muestra el producto real: pantalla roja/blanca de cotización de seguros con foto de un auto y un CTA "Cotiza ahora".

**Pendiente de reemplazar antes de producción:**
- Nombre de marca "PulseIQ" → "Confia" (o el nombre final).
- Copy de analítica/dashboard → copy de seguros ("Encuentra el seguro ideal para tu auto", "Cotiza en minutos", etc.).
- El video de fondo actual (`kling_20260810_Image_to_Video_Hand_holdi_2841_0.mp4`, en Cloudinary) muestra una mano sosteniendo un celular — hay que confirmar si el contenido del celular en el video coincide con la pantalla de cotización de seguros o si es genérico.
- Enlaces de nav (`Nosotros / Insights / Reportes / Integraciones / Precios`) son genéricos de SaaS, no de seguros.

## 2. Formato de archivo / stack

- Formato **`.dc.html`** (dynamic component): un archivo HTML con:
  - `<template id="__bundler_thumbnail">`: SVG usado como miniatura/preview.
  - `<x-dc><helmet>...</helmet><section>...</section></x-dc>`: el markup, con estilos inyectados vía `style="{{ variableStyle }}"`.
  - `<script type="text/x-dc" data-dc-script">`: una clase `Component extends DCLogic` con un método `renderVals()` que devuelve un objeto JS con todos los estilos (in-JS, no CSS externo salvo el `<style>` del `<helmet>` para keyframes y media queries).
- Runtime: `support.js`, generado desde `dc-runtime/src/*.ts` (no editar a mano, se reconstruye con `bun run build`). Usa `window.React` / `window.ReactDOM`.
- `Hero Section (standalone).html` es el **bundle exportado** (mismo componente, runtime inlineado) — no editar directamente, se regenera a partir del `.dc.html`.
- `.thumbnail`: captura PNG del render actual (dark, en español) — útil como snapshot visual rápido.

## 3. Estructura de la sección (orden en el DOM)

```
<section>                          fondo full-viewport (100vh)
 ├─ video de fondo (absolute, cover, autoplay/loop/muted)
 ├─ overlay con gradiente oscuro (diagonal, izquierda más opaca)
 ├─ <nav>
 │   ├─ logo (punto + texto)
 │   ├─ links de navegación (se ocultan en mobile)
 │   └─ botón "Contacto" (pill blanco)
 └─ contenido principal (max-width 600px, alineado a la izquierda)
     ├─ H1 en 3 líneas (cada línea anima por separado)
     ├─ subtítulo/descripción
     ├─ fila de 2 CTAs (primario relleno + secundario outline)
     ├─ fila de rating (estrellas + texto)
     └─ fila de 3 estadísticas (número grande + label)
```

## 4. Paleta de colores

| Uso | Valor |
|---|---|
| Fondo base | `#0a0a0a` |
| Overlay sobre video (gradiente diagonal 100deg) | `rgba(6,6,8,0.82)` → `0.62` → `0.28` → `0.15` → `0.35` |
| Texto principal | `#fff` |
| Texto secundario (subtítulo, nav links) | `rgba(255,255,255,0.85)` / `0.75` / `0.70` / `0.65` |
| Botón primario | fondo `#fff`, texto `#0a0a0a` |
| Botón secundario | fondo `rgba(255,255,255,0.08)`, texto `#fff`, borde `1px solid rgba(255,255,255,0.35)` |
| Botón "Contacto" (nav) | fondo `#fff`, texto `#0a0a0a` |

Todo el diseño actual es **dark / monocromático (blanco sobre negro)**. La referencia de marca real (`uploads/pasted-1786333312326-0.png`) usa **rojo** como color de marca (`#c0392b`-ish, tono seguro/Confia) — a definir si el hero final debe incorporar ese rojo o mantenerse monocromático con acentos rojos puntuales.

## 5. Tipografía

- Familia: **Inter** (Google Fonts, pesos 400/500/600/700/800), con fallback `-apple-system, BlinkMacSystemFont, sans-serif`.
- H1 (headline): `48px` / `line-height 1.08` / `font-weight 700` / `letter-spacing -0.02em`. En mobile (`≤860px`) baja a `42px`.
- Subtítulo: `15.5px` / `line-height 1.5` / `rgba(255,255,255,0.75)`, `max-width 480px`.
- Nav links: `14.5px` / `font-weight 500`.
- Botones: `14px` / `font-weight 600`.
- Estadísticas (número): `24px` / `700` (mobile `26px`, curiosamente el mobile es más grande que el número base del grid `auto`).
- Estadísticas (label): `12.5px` / `500`.
- Logo: `17px` / `700` / `letter-spacing -0.01em`.

## 6. Layout y espaciado

- Sección: `100vw × 100vh`, `overflow: hidden`, `display: flex; flex-direction: column`.
- Padding horizontal general: `56px` (clase `.heroPad` lo baja a `20px` en mobile).
- Nav: `padding: 20px 56px 0`, `justify-content: space-between`, `flex-shrink: 0`.
- Contenido: `flex: 1`, `justify-content: center` (centrado verticalmente en el alto restante), `max-width: 600px`, `gap: 18px`.
- Fila de CTAs: `gap: 14px`.
- Fila de estadísticas: `display: grid; grid-template-columns: repeat(3, auto); gap: 32px` (en mobile pasa a `repeat(3, 1fr)` con `gap: 18px` para ocupar todo el ancho).

## 7. Animaciones

Definidas como `@keyframes` en el `<helmet><style>` y aplicadas por elemento con `animation` individual (efecto de entrada escalonado, "staggered fade-up"):

| Elemento | Keyframe | Duración / delay |
|---|---|---|
| Video (wrapper) | `zoomFade` (scale 1.08 → 1, opacity 0 → 1) | 1.6s ease-out |
| Overlay | `fadeIn` | 1.2s ease-out |
| Nav | `navDrop` (translateY -16px → 0) | 0.8s cubic-bezier(0.16,1,0.3,1) |
| Línea 1 del H1 | `fadeUp` (translateY 28px → 0) | 0.9s, delay 0.15s |
| Línea 2 del H1 | `fadeUp` | 0.9s, delay 0.28s |
| Línea 3 del H1 | `fadeUp` | 0.9s, delay 0.41s |
| Subtítulo | `fadeUp` | 0.9s, delay 0.55s |
| CTAs | `fadeUp` | 0.9s, delay 0.68s |
| Rating | `fadeUp` | 0.9s, delay 0.80s |
| Estadísticas | `fadeUp` | 0.9s, delay 0.92s |

Todas usan el mismo easing `cubic-bezier(0.16,1,0.3,1)` (curva tipo "ease-out-expo" suave), creando una secuencia de entrada de ~0.15s a ~0.92s de delay total.

## 8. Responsive (`@media max-width: 860px`)

- `.navLinks` → `display: none` (nav queda solo logo + botón contacto; falta un menú hamburguesa/mobile menu, no está implementado).
- `.heroHeadline` → `font-size: 42px`.
- `.statsRow` → `grid-template-columns: repeat(3, 1fr)`, `gap: 18px` (ocupa ancho completo en vez de columnas `auto`).
- `.statNum` → `font-size: 26px`.
- `.heroPad` → `padding: 0 20px`.
- `.ctaRow` → `flex-wrap: wrap`.

No hay breakpoint intermedio para tablet; salta directo de desktop a este único breakpoint mobile.

## 9. Contenido actual (copy placeholder, en español)

- Logo: `PulseIQ`
- Nav: `Nosotros · Insights · Reportes · Integraciones · Precios` + botón `Contacto`
- H1 (3 líneas): `Insights más inteligentes` / `Para un mejor` / `rendimiento`
- Subtítulo: `Rastrea ingresos, clics, interacción y conversiones en un panel potente y fácil de usar, hecho para creadores y emprendedores.`
- CTA primario: `Empezar a analizar`
- CTA secundario: `Ver demo`
- Rating: `★★★★★ 5.0 | Nuevas calificaciones de usuarios`
- Estadísticas: `83% Toman decisiones más rápido` · `52% Monitorean conversiones` · `41% Exportan reportes`

## 10. Assets multimedia

- **Video de fondo:** `https://res.cloudinary.com/urml6fcu/video/upload/kling_20260810_Image_to_Video_Hand_holdi_2841_0.mp4` — autoplay, loop, muted, `object-fit: cover`, con zoom-in sutil de entrada (`zoomFade`).
- `uploads/_.jpeg`: referencia de diseño original (tema claro, inglés) usada como base de layout/copy — no es el diseño final.
- `uploads/pasted-1786333312326-0.png`: mockup real del producto Confia (pantalla de cotización de seguro de auto), pegado como referencia de contenido/marca real que debería reflejarse en el hero.
- `.thumbnail`: snapshot PNG del render actual (dark).

## 11. Archivos del proyecto

| Archivo | Rol |
|---|---|
| `Hero Section.dc.html` | **Fuente editable** del componente (markup + estilos in-JS). Editar aquí. |
| `Hero Section (standalone).html` | Bundle exportado/standalone (runtime inlineado). No editar a mano. |
| `support.js` | Runtime del formato `.dc.html` (generado, no editar). |
| `.thumbnail` | Captura de preview del render actual. |
| `uploads/_.jpeg` | Referencia visual de la plantilla original (placeholder). |
| `uploads/pasted-1786333312326-0.png` | Referencia del producto/marca real (Confia, seguros de auto). |

## 12. Próximos pasos sugeridos

1. Reemplazar branding "PulseIQ" → marca real de Confia (nombre, logo).
2. Reescribir copy (headline, subtítulo, CTAs, nav, estadísticas) al dominio de seguros de auto.
3. Definir si se incorpora el rojo de marca (visible en el mockup de producto) o se mantiene monocromático.
4. Confirmar/reemplazar el video de fondo para que sea coherente con el producto (cotización de seguro en el celular).
5. Implementar menú mobile (actualmente los nav links simplemente desaparecen en `≤860px` sin alternativa).
