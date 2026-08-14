# Sistema visual – Landing y páginas complementarias (Confia)

> Documentación de referencia del diseño actual de la sección Hero, para poder retomar el desarrollo sin tener que releer el HTML completo. Fuente de verdad: [`Hero Section.dc.html`](./Hero%20Section.dc.html).

> **Regla global:** todas las páginas complementarias nuevas deben seguir las secciones 4.1 a 4.6 de este documento. Incluyen el fondo, la tipografía, los títulos, la navegación, las superficies y el comportamiento responsive aprobados. Las únicas excepciones audiovisuales aprobadas son la landing principal y la página Nosotros.

## 1. Qué es este proyecto

Landing hero para **Confia**, negocio de **seguros de auto** ("Encuentra el seguro ideal para tu auto"). El archivo `.dc.html` está actualmente maquetado con branding y copy **placeholder** ("PulseIQ", "panel de analítica"), tomado de una plantilla de referencia (ver `uploads/_.jpeg`). El mockup de celular original (`uploads/pasted-1786333312326-0.png`) sí muestra el producto real: pantalla roja/blanca de cotización de seguros con foto de un auto y un CTA "Cotiza ahora".

**Pendiente de reemplazar antes de producción:**
- Nombre de marca "PulseIQ" → "Confia" (o el nombre final).
- Copy resuelto: la landing comunica planes mensuales de seguro vehicular y dirige a `/planes`.
- El video de fondo actual (`kling_20260810_Image_to_Video_Hand_holdi_2841_0.mp4`, en Cloudinary) muestra una mano sosteniendo un celular — hay que confirmar si el contenido del celular en el video coincide con la pantalla de cotización de seguros o si es genérico.
- Navegación resuelta: los enlaces genéricos de SaaS fueron reemplazados por `Nosotros / Planes / Login`.

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

### 4.1. Fondo estándar para páginas internas

Este es el **fondo oficial y obligatorio** para las páginas internas de la plataforma (por ejemplo: Planes, Nosotros, Contacto y futuras páginas públicas). Su objetivo es que cada ruta se sienta como una continuación directa de la landing.

#### Apariencia

- Degradado horizontal de gris medio a gris casi blanco.
- Comienza con gris medio en el lado izquierdo.
- Se aclara progresivamente hacia la derecha.
- Incluye una iluminación radial suave en la zona superior derecha.
- **No debe llevar video, fotografía, ilustración ni textura de fondo.**
- Debe ocupar todo el viewport y continuar durante todo el scroll de la página.

#### Variable CSS canónica

La implementación debe usar una variable semántica compartida; no se debe reconstruir el degradado con colores distintos en cada página.

```css
:root {
  --page-surface-fallback: #767679;
  --page-surface-gradient:
    radial-gradient(
      circle at 78% 34%,
      rgba(255, 255, 255, 0.34) 0%,
      rgba(255, 255, 255, 0) 36%
    ),
    linear-gradient(
      90deg,
      #747477 0%,
      #858588 30%,
      #acacae 58%,
      #d6d6d8 80%,
      #f0f0f1 100%
    );
}
```

Los tokens están definidos globalmente en `app/globals.css`. Todas las páginas internas deben consumirlos directamente y no declarar variantes locales.

#### Uso recomendado

```css
.internal-page {
  min-height: 100dvh;
  background-color: var(--page-surface-fallback);
  background-image: var(--page-surface-gradient);
  background-attachment: fixed;
}
```

#### Contraste sobre el fondo

- Los títulos de páginas complementarias usan grafito oscuro, no blanco.
- Los subtítulos usan gris carbón para mantener contraste en toda la transición del fondo.
- Los botones transparentes usan texto y borde oscuros.
- Las tarjetas de contenido usan superficies claras con texto oscuro.
- El rojo brillante `#c4382d` no se usa en títulos ni fondos extensos; se reserva para pequeños acentos cuando sean necesarios.
- Verificar un contraste mínimo WCAG AA en textos y controles antes de dar una página por terminada.

#### Excepciones audiovisuales: landing principal y Nosotros

La landing conserva su video y overlay diagonal actuales. La página `/nosotros` replica la misma composición audiovisual con este video específico:

`https://res.cloudinary.com/urml6fcu/video/upload/v1786571912/kling_20260813_Image_to_Video_de_la_imag_1485_0.mp4`

En ambas páginas el video debe usar `autoplay`, `loop`, `muted` y `playsInline`, cubrir el viewport completo y quedar debajo del overlay oscuro. El resto de páginas internas utiliza el fondo gris estático sin contenido audiovisual.

### 4.2. Tipografía y encabezados de páginas complementarias

Todas las páginas complementarias usan **Inter**, igual que la landing. No se debe cargar ni mezclar otra familia tipográfica.

#### Jerarquía aprobada

| Elemento | Tamaño | Peso | Interlineado | Tracking | Color |
|---|---:|---:|---:|---:|---|
| Kicker / antetítulo | `11px` | `700` | normal | `0.2em` | `#8f332d` |
| H1 escritorio | `48px` | `700` | `1.08` | `-0.02em` | `#242427` |
| H1 móvil | `42px` | `700` | `1.08` | `-0.02em` | `#242427` |
| Introducción | `15.5px` | `400` | `1.5` | normal | `#505055` |

Reglas:

- Un solo `h1` por página.
- El kicker va en mayúsculas, centrado, con separación amplia entre letras.
- El título debe usar `text-wrap: balance` y un ancho controlado para evitar líneas descompensadas.
- La introducción debe usar `text-wrap: pretty` y un ancho máximo cercano a `610px`.
- No usar blanco para títulos o introducciones sobre el fondo estándar.
- No usar el rojo brillante de marca para el kicker; el tono aprobado es terracota profunda `#8f332d`.

#### Tokens canónicos

```css
:root {
  --page-heading: #242427;
  --page-kicker: #8f332d;
  --page-intro: #505055;
}
```

Estos tokens están definidos en `app/globals.css` y ya son utilizados por la página de Planes. Las páginas nuevas deben consumirlos directamente.

### 4.3. Cabecera sincronizada entre páginas

La landing, Nosotros, Planes y las futuras páginas públicas comparten la misma arquitectura de cabecera para evitar que la navegación cambie entre rutas:

```text
logo a la izquierda · navegación centrada · botón Contacto a la derecha
```

Reglas aprobadas:

- El acceso de la izquierda muestra un punto + `Inicio` y enlaza siempre a `/`.
- Navegación en este orden: `Nosotros · Planes · Login`.
- La ruta actual se identifica con un subrayado fino bajo su enlace y `aria-current="page"`.
- Los enlaces usan `14.5px / 500` y separación horizontal de `32px`.
- El botón `Contacto` usa fondo blanco, texto `#0a0a0a`, `14px / 600`, forma de píldora y altura táctil mínima de `44px`; enlaza siempre a `/contacto`.
- En `/contacto`, el mismo botón se marca como activo con `aria-current="page"` y un anillo blanco sutil.
- La cabecera usa `56px` de padding lateral en escritorio y `20px` en móvil.
- Logo, enlaces y subrayado son blancos en todas las páginas públicas, incluida Planes, para conservar exactamente la misma identidad de cabecera.
- En anchos de `860px` o menos se oculta temporalmente el bloque central de navegación y permanecen visibles logo y Contacto, igual que en la landing actual.
- La entrada usa `navDrop 0.8s cubic-bezier(0.16,1,0.3,1)`.

### 4.4. Tarjetas claras para páginas complementarias

Cuando una página use tarjetas de selección o comparación, debe seguir la estructura visual aprobada en Planes y en la referencia `Pricing Plan Section.jpeg`:

```text
Tarjeta blanca
 ├─ panel superior gris claro (o gris cálido si está destacada)
 │   ├─ etiqueta en píldora
 │   └─ valor o dato principal
 └─ cuerpo blanco
     ├─ descripción breve
     ├─ CTA negro en píldora
     └─ lista de beneficios o detalles
```

Paleta aprobada:

| Uso | Valor |
|---|---|
| Fondo de tarjeta | `rgba(255,255,255,0.94)` |
| Fondo de tarjeta destacada | `rgba(255,255,255,0.96)` |
| Panel superior normal | `#eeeeee` |
| Panel superior destacado | `#e6d8d6` (gris cálido con matiz rojo) |
| Texto principal | `#171717` |
| Texto secundario | `#4b4b4b` |
| CTA | fondo `#181818`, texto `#ffffff` |
| Sombra CTA | `rgba(0,0,0,0.22)` |
| Indicadores/checks | `#c9c9c9` |
| Aviso legal | `rgba(20,20,22,0.72)` |

Reglas:

- No usar celeste, azul, morado ni gradientes de color en las tarjetas.
- La tarjeta destacada se diferencia únicamente con el panel gris cálido `#e6d8d6`.
- El botón se ubica después de la descripción y antes de los beneficios.
- Las tarjetas usan esquinas de aproximadamente `24px`, borde blanco sutil y sombra suave.
- El texto legal final siempre usa gris oscuro; nunca blanco sobre la zona clara del fondo.

### 4.5. Layout y comportamiento responsive de páginas complementarias

- El contenido usa un ancho máximo aproximado de `1180px`.
- La página ocupa al menos `100dvh`.
- En escritorio se muestran hasta tres tarjetas en columnas.
- Las tarjetas deben aprovechar la altura disponible, con un mínimo aproximado de `384px` en escritorio.
- Si la altura disponible es insuficiente, se permite scroll vertical; el contenido nunca debe quedar recortado.
- El scroll vertical usa una barra delgada y discreta, no la barra gruesa por defecto.
- En móvil, las tarjetas cambian a carrusel horizontal con aproximadamente `86vw` de ancho por tarjeta.
- El carrusel móvil usa `scroll-snap-type: x mandatory` y cada tarjeta `scroll-snap-align: center`.
- El scroll horizontal puede ocultar su barra visual, pero debe seguir funcionando con gesto, trackpad y teclado.
- Mantener controles táctiles de al menos `44 × 44px`.

### 4.6. Movimiento en páginas complementarias

- Encabezado: entrada `fadeUp` de `0.8s`.
- Tarjetas: entrada escalonada `planReveal` de `0.8s` con incrementos cercanos a `0.12s`.
- Easing compartido: `cubic-bezier(0.16,1,0.3,1)`.
- Hover de botones: movimiento máximo de `-2px`; evitar animaciones exageradas.
- Respetar `prefers-reduced-motion` reduciendo las animaciones prácticamente a cero.

## 5. Tipografía de la landing principal

> Esta sección aplica únicamente al hero audiovisual. Para páginas complementarias usar la sección 4.2.

- Familia: **Inter** (Google Fonts, pesos 400/500/600/700/800), con fallback `-apple-system, BlinkMacSystemFont, sans-serif`.
- H1 (headline): `48px` / `line-height 1.08` / `font-weight 700` / `letter-spacing -0.02em`. En mobile (`≤860px`) baja a `42px`.
- Subtítulo: `15.5px` / `line-height 1.5` / `rgba(255,255,255,0.75)`, `max-width 480px`.
- Nav links: `14.5px` / `font-weight 500`.
- Botones: `14px` / `font-weight 600`.
- Estadísticas (número): `24px` / `700` (mobile `26px`, curiosamente el mobile es más grande que el número base del grid `auto`).
- Estadísticas (label): `12.5px` / `500`.
- Logo: `17px` / `700` / `letter-spacing -0.01em`.

## 6. Layout y espaciado de la landing principal

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

## 9. Contenido vigente de la landing

- Acceso izquierdo vigente: punto + `Inicio`
- Nav vigente: `Nosotros · Planes · Login` + botón `Contacto`
- H1 (3 líneas): `Protección para tu auto` / `simple, flexible` / `y mensual`
- Subtítulo: `Compara planes mensuales de seguro vehicular y encuentra una alternativa acorde con tu auto, tus necesidades y tu perfil de riesgo.`
- CTA único: `Conocer los planes` → `/planes`
- Señal informativa: `Opciones de distintas aseguradoras en un solo lugar`
- Beneficios: `Mensual · Flexible · Claro`
- No se utiliza botón secundario ni CTA de demo.

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

1. Definir el nombre y logotipo final de la marca.
2. Definir si se incorpora el rojo de marca en la landing o se mantiene monocromática.
3. Confirmar que el video final representa correctamente el producto.
4. Implementar menú mobile (actualmente los nav links simplemente desaparecen en `≤860px` sin alternativa).
# Pantallas internas autenticadas

El diseño del login conserva su video y composición actuales. Todas las rutas
que se muestran después de iniciar sesión deben usar como fondo global el asset
real `public/images/internal-app-background.png`; no se debe recrear mediante
CSS ni sustituir por un degradado generado.

Reglas obligatorias:

- La marca visible en el encabezado compartido de todas las pantallas internas
  autenticadas es **Arkad**, acompañada por el ícono de escudo aprobado. No se
  debe mostrar “Confia” en esta posición. Esta regla se limita al encabezado
  interno y no implica reemplazar automáticamente otros textos comerciales,
  legales o metadatos de la aplicación.
- El fondo cubre el viewport (`cover`), mantiene proporción, no se repite y se
  centra en escritorio.
- En móvil se reposiciona para priorizar el contenido y evitar que el vehículo
  interfiera con formularios, tablas o navegación.
- Tarjetas, formularios, tablas y paneles usan glassmorphism moderado: superficie
  oscura semitransparente, blur contenido, borde claro sutil, sombra suave y
  contraste suficiente.
- No se reduce simplemente la interfaz de escritorio: las grillas se convierten
  en una columna cuando corresponde, los paneles ocupan casi todo el ancho útil,
  no existe scroll horizontal y los controles táctiles miden al menos 44 px.
- La legibilidad y el flujo de trabajo siempre tienen prioridad sobre los
  elementos decorativos del fondo.
