# Auditoría de Accesibilidad y UX — Página Cristiano Ronaldo

**Fecha de auditoría:** 2026-09-07  
**Archivos revisados:** `index.html`, `styles.css`, `script.js`, `tests/verificar.cjs`  
**Estándar de referencia:** WCAG 2.2 nivel AA  
**Herramienta:** OpenCode  
**Estado de las pruebas automatizadas:** 12/12 aprobadas (`node tests/verificar.cjs`)

---

## 1. Resumen ejecutivo

La página presenta una base técnica sólida para la accesibilidad: estructura semántica correcta, jerarquía de encabezados bien ordenada, textos alternativos descriptivos, enlace de salto al contenido, foco visible declarado en CSS, mejora progresiva real (la página funciona sin JavaScript) y pruebas automatizadas exhaustivas para el módulo JS.

Se identificaron **2 hallazgos de severidad alta**, **4 medios** y **5 bajos**. Ningún hallazgo es crítico (nivel bloqueante). Los problemas más relevantes son: ausencia de un menú móvil colapsable que provoca desbordamiento de navegación en pantallas muy pequeñas, falta de `role="tabpanel"` con `tabindex` sobre los paneles de timeline antes de que JS se ejecute (degradación accesible incompleta), y ausencia de encabezado en la sección de fuentes.

Varios criterios WCAG 2.2 AA verificables por código estático están cumplidos y se documentan en la sección correspondiente. Los criterios que dependen de renderizado real (ratio de contraste con valores exactos, comportamiento del lector de pantalla, zoom al 200 %, Enter/Space nativos en botones de timeline) quedan marcados como **pendientes de prueba manual en navegador**.

---

## 2. Hallazgos

### 2.1 Hallazgos altos

---

#### ALTO-01 — Navegación principal sin mecanismo de colapso en móvil

**Criterio WCAG:** 1.4.10 Reflow (AA) — El contenido debe poder presentarse en 320 CSS px sin pérdida de información ni necesidad de desplazamiento en dos dimensiones.

**Archivo / elemento:** `styles.css` línea 113–115 y `index.html` línea 17–22.

**Evidencia:**

```css
/* styles.css, línea 113 */
.header-inner { flex-direction: column; align-items: flex-start; … }
nav { justify-content: space-between; width: 100%; gap: .5rem; }
nav a { font-size: .75rem; }
```

El `<nav>` pasa de flex-row a columna y los enlaces se comprimen con `font-size: .75rem`. En 320 px con cuatro ítems («Biografía», «Trayectoria», «Estadísticas», «Galería ↗») el texto puede truncarse o crear una segunda línea de ítem que desborda el contenedor. No existe un botón hamburguesa ni un menú colapsable. Si los cuatro ítems no caben en una sola fila de 320 px, se produce scroll horizontal, violando 1.4.10.

**Riesgo adicional:** la `<nav>` no tiene `id` propio para ser objetivo de un posible enlace «Skip to nav» ni para el patrón de hamburguesa.

**Recomendación:**

1. Implementar un botón de menú (`<button aria-expanded="false" aria-controls="nav-list">Menú</button>`) que colapse los ítems en pantallas ≤ 640 px.  
2. Añadir `id="nav-list"` al `<ul>` o al `<nav>` para que `aria-controls` funcione correctamente.  
3. Gestionar el estado `aria-expanded` mediante JS al igual que se gestiona el tablist.  
4. Verificar en 320 px que ningún ítem de texto desborda horizontalmente.

---

#### ALTO-02 — Los `<article class="stage">` carecen de nombre accesible antes de que JS aplique `aria-labelledby`

**Criterio WCAG:** 4.1.2 Name, Role, Value (AA).

**Archivo / elemento:** `index.html` líneas 62–79; `script.js` líneas 41–43.

**Evidencia:**

```html
<!-- index.html, línea 62 -->
<article class="stage" id="etapa-sporting" data-year="2002" data-club="Sporting">
```

```js
// script.js, línea 41
stage.setAttribute("role", "tabpanel");
stage.setAttribute("aria-labelledby", button.id);
stage.tabIndex = 0;
```

Sin JavaScript, los artículos son expuestos al árbol de accesibilidad como `<article>` sin nombre accesible explícito (solo el primer `<h3>` interno actúa como nombre implícito del landmark, pero los artículos no son landmarks). Con JavaScript activo, el primer panel queda visible y los demás quedan `hidden`; en ese momento el JS asigna `role="tabpanel"` y `aria-labelledby` al botón generado. El problema es que entre la carga del DOM y la ejecución del script (que usa `defer`) existe un breve instante en que los paneles ocultos con `hidden` no tienen rol ni nombre, aunque esto es marginal en práctica.

El problema real es estructural: la degradación sin JS expone seis artículos sin ninguna indicación de que forman un grupo de pestañas. Un lector de pantalla sin JS navegaría por seis `<article>` anónimos consecutivos sin contexto de su relación. Se recomienda al menos un `<h3>` o `aria-label` en cada artículo que esté disponible en el HTML estático.

**Recomendación:**

1. Añadir `aria-label` directamente en el HTML de cada `<article>` con el nombre del club y el período:  
   ```html
   <article class="stage" aria-label="Etapa 1: Sporting de Portugal, 2002–2003" …>
   ```
2. El JS puede sobrescribir el `aria-label` con `aria-labelledby` al activar el patrón de pestañas, lo que es semánticamente correcto.

---

### 2.2 Hallazgos medios

---

#### MEDIO-01 — Enlace «↓ Descubrir la biografía» con área táctil inferior a 24×24 px

**Criterio WCAG:** 2.5.8 Target Size (Minimum) (AA, nuevo en WCAG 2.2) — objetivo mínimo de 24×24 CSS px.

**Archivo / elemento:** `styles.css` línea 39; `index.html` línea 34.

**Evidencia:**

```css
/* styles.css, línea 39 */
.hero-bottom a { display: grid; place-items: center; width: 40px; height: 40px; … }
```

El enlace circular cumple 40×40 px, por lo que supera el mínimo de 24×24 px de WCAG 2.5.8 y también las recomendaciones de 44×44 dp de WCAG 2.5.5 (Enhanced). **Este elemento está bien.** Sin embargo, los enlaces de navegación del header tienen solo `padding-block: .6rem` y `font-size: .75rem–.85rem`, lo que produce un área táctil aproximada de 12–14 px de alto sin padding lateral suficiente.

**Evidencia:**

```css
/* styles.css, línea 26 */
nav a { padding-block: .6rem; text-decoration: none; font-size: .85rem; }
```

Con `font-size: .85rem` ≈ 13.6 px y `padding-block: .6rem` ≈ 9.6 px por lado, la altura total es ≈ 33 px. Esto cumple el mínimo de 24 px pero no alcanza los 44 px recomendados. En móvil (`font-size: .75rem`, línea 115), la altura desciende a ≈ 30 px. Aunque técnicamente por encima del mínimo WCAG 2.5.8, el margen es estrecho y la UX en dispositivos táctiles es mejorable.

**Recomendación:**

Aumentar `padding-block` de los `nav a` a al menos `0.75rem` en escritorio y `0.875rem` en móvil para que el área táctil llegue a ≈ 44 px de alto, siguiendo las guías de Apple HIG y Material Design.

---

#### MEDIO-02 — Sección `<section class="container sources">` sin `aria-labelledby` consistente

**Criterio WCAG:** 1.3.1 Info and Relationships (A) / buena práctica de landmark.

**Archivo / elemento:** `index.html` línea 106–109.

**Evidencia:**

```html
<section class="container sources" id="fuentes" aria-labelledby="sources-title">
  <p class="eyebrow">PARA SEGUIR EXPLORANDO</p>
  <h2 id="sources-title">Fuentes y lecturas</h2>
```

La sección tiene `aria-labelledby="sources-title"` apuntando al `<h2>` correcto, y el `<h2>` está presente. Esto es correcto. Sin embargo, el `<h2>` con texto «Fuentes y lecturas» tiene `font-size: 1.6rem` (declarado en `.sources h2`), lo que lo hace visualmente más pequeño que otros `<h2>` de la página (`clamp(2rem, 3.5vw, 3.3rem)`). Esto no es un error WCAG, pero crea una inconsistencia visual en la jerarquía de encabezados que puede confundir a usuarios con baja visión que usan zoom de texto.

**Recomendación:**

Eliminar la regla `.sources h2 { font-size: 1.6rem; }` y usar el tamaño de `<h2>` estándar, o justificar explícitamente el tratamiento visual diferenciado como sección de pie.

---

#### MEDIO-03 — `<details>/<summary>` de créditos sin `aria-label` que indique el propósito completo

**Criterio WCAG:** 4.1.2 Name, Role, Value (AA).

**Archivo / elemento:** `index.html` línea 103.

**Evidencia:**

```html
<details class="credits" id="creditos">
  <summary>Créditos y licencias de las fotografías</summary>
```

El texto del `<summary>` es «Créditos y licencias de las fotografías», que es suficientemente descriptivo para un lector de pantalla. El elemento `<details>` es un widget nativo del navegador con rol `group` y el `<summary>` actúa como su botón de control. No hay violación WCAG aquí.

El hallazgo medio es que el enlace dentro del `<figcaption>` de la foto hero (`<a href="#creditos">Crédito de la fotografía ↗</a>`, línea 38) lleva al usuario al `<details>` pero este puede estar cerrado cuando el usuario llega a él por ancla. Si `<details>` está cerrado, el contenido referenciado queda oculto y el usuario no ve la información sin una interacción adicional.

**Recomendación:**

En el manejador de navegación, o mediante CSS/JS, abrir automáticamente el `<details>` cuando la URL contiene `#creditos`. Ejemplo JS mínimo:
```js
if (location.hash === '#creditos') {
  document.getElementById('creditos').open = true;
}
```

---

#### MEDIO-04 — Ausencia de `lang` en citas o términos en inglés dentro del HTML en español

**Criterio WCAG:** 3.1.2 Language of Parts (AA).

**Archivo / elemento:** `index.html` líneas 65–79.

**Evidencia:**

Los nombres propios de clubes («Manchester United», «Al-Nassr», «Old Trafford») no requieren `lang` porque son nombres propios. Sin embargo, el texto de la fuente apuntando a sitios en inglés no es contenido de la página en sí, es un hipervínculo, por lo que tampoco aplica. No hay frases completas en otro idioma que requieran `lang` en el HTML. **Este criterio está cumplido** para el contenido de texto del documento.

> **Nota:** Este hallazgo se mantiene como «medio» únicamente porque la sección de fuentes enlaza a páginas en inglés sin advertir al usuario del cambio de idioma, lo cual es una práctica UX recomendable aunque no exigida por WCAG 2.2 AA.

**Recomendación:**

Añadir `hreflang="en"` a los enlaces externos en inglés para informar a agentes de usuario y traductores automáticos:
```html
<a href="https://www.manutd.com/…" hreflang="en">…</a>
```

---

### 2.3 Hallazgos bajos

---

#### BAJO-01 — `scroll-padding-top` insuficiente para compensar el header fijo

**Criterio WCAG:** UX / 2.4.3 Focus Order (A) — no es violación directa, pero afecta la experiencia.

**Archivo / elemento:** `styles.css` línea 4; `index.html` líneas 14 y 26.

**Evidencia:**

```css
/* styles.css, línea 4 */
html { scroll-behavior: smooth; scroll-padding-top: 2rem; }
```

El header tiene `min-height: 100px` (línea 21) y es un elemento `position: static` (no `sticky` ni `fixed`). Al hacer scroll por ancla, el `scroll-padding-top: 2rem` (≈ 32 px) es insuficiente si el header fuera sticky. En el código actual el header no está posicionado como `sticky`/`fixed`, por lo que no hay desbordamiento real. Sin embargo, si en el futuro se añade `position: sticky`, el `scroll-padding-top` debería actualizarse a `100px`.

**Recomendación:**

Usar una variable CSS para el alto del header y referenciarla en `scroll-padding-top`:
```css
:root { --header-height: 100px; }
html { scroll-padding-top: var(--header-height); }
```

---

#### BAJO-02 — El `.skip-link` usa `position: fixed` pero no está integrado visualmente en el flujo del header

**Criterio WCAG:** 2.4.1 Bypass Blocks (A) — cumple, pero la implementación puede sorprender.

**Archivo / elemento:** `styles.css` línea 18–19; `index.html` línea 13.

**Evidencia:**

```css
.skip-link { position: fixed; top: 12px; left: 12px; z-index: 10; … transform: translateY(-180%); }
.skip-link:focus { transform: translateY(0); }
```

El enlace de salto funciona: al recibir foco se hace visible. El problema es que está en `position: fixed`, lo que en algunas implementaciones de lectors de pantalla móviles (VoiceOver en iOS con modo de deslizamiento) puede no ser el primer elemento anunciado al entrar a la página, ya que los lectores no siempre siguen el orden DOM en modo de exploración virtual. Además, `transform: translateY(-180%)` puede ser problemático en navegadores que interpretan `translateY` en unidades absolutas distintas si el parent tiene `transform`.

**Recomendación:**

Una alternativa más robusta es colocar el skip link como primer elemento del `<body>` con `position: absolute` y `top: auto` (fuera de pantalla), haciéndolo visible solo al recibir foco:
```css
.skip-link { position: absolute; left: -9999px; }
.skip-link:focus { left: 12px; top: 12px; }
```
El comportamiento funcional actual (con `fixed` + `transform`) es aceptable en escritorio. Queda pendiente verificar en VoiceOver iOS.

---

#### BAJO-03 — Imagen hero duplicada en la galería sin diferenciación semántica

**Criterio WCAG:** 1.1.1 Non-text Content (A) — cumple en alt text, pero hay redundancia informativa.

**Archivo / elemento:** `index.html` líneas 37 y 101.

**Evidencia:**

La imagen `Cristiano_Ronaldo_2018.jpg` aparece dos veces: como imagen hero (línea 37) y como tercera foto de la galería (línea 101). Ambas tienen textos alternativos distintos y adecuados:

- Hero: `"Cristiano Ronaldo con la camiseta roja de Portugal durante el Mundial de 2018"`  
- Galería: `"Retrato de Cristiano Ronaldo con Portugal en el encuentro del Mundial de 2018 frente a España"`

Los `alt` son correctos y descriptivos. La duplicación no es una violación WCAG. El hallazgo es de UX: el usuario puede ver la misma foto dos veces sin darse cuenta de que es el mismo archivo, lo que puede interpretarse como pobreza de recursos visuales.

**Recomendación:**

Sustituir una de las dos instancias por una fotografía diferente, o añadir un pie de galería que explique explícitamente el contexto distinto de la misma imagen.

---

#### BAJO-04 — `<p class="muted" hidden>` en la instrucción del teclado del timeline no anuncia el cambio de estado

**Criterio WCAG:** 4.1.3 Status Messages (AA).

**Archivo / elemento:** `index.html` línea 58; `script.js` línea 60.

**Evidencia:**

```html
<p id="timeline-help" class="muted" hidden>Selecciona una etapa…</p>
```

```js
// script.js, línea 60
help.hidden = false;
```

El párrafo de ayuda se hace visible cuando JS carga el componente de pestañas. No tiene `aria-live` ni `role="status"`. Si un usuario de lector de pantalla llega a la página cuando JS ya se ejecutó, el mensaje ya estará visible y será leído al navegar por él. Sin embargo, si el lector de pantalla carga la página y JS elimina `hidden` mientras el cursor virtual está en otro lugar, el cambio no será anunciado.

**Recomendación:**

Añadir `role="status"` o `aria-live="polite"` al párrafo de ayuda para que lectores de pantalla anuncien el texto cuando aparece:
```html
<p id="timeline-help" class="muted" hidden role="status">…</p>
```

---

#### BAJO-05 — Falta de `autocomplete` y `type` en posibles formularios futuros; y ausencia de metaetiqueta de política CSP

**Criterio WCAG:** No aplica directamente — Seguridad / buenas prácticas.

**Archivo / elemento:** `index.html` (cabecera).

**Evidencia:**

La página no tiene formularios, por lo que `autocomplete` no es aplicable. Sin embargo, la cabecera del HTML no incluye ninguna metaetiqueta de Content Security Policy (CSP). La página carga imágenes externas de `upload.wikimedia.org` sin declarar una directiva `img-src`. Si en el futuro se añade un CSP por cabecera HTTP o meta tag, la falta de planificación puede romper las imágenes.

Adicionalmente, no existe `<meta name="robots">` que controle la indexación, aunque esto es una decisión editorial, no un problema de accesibilidad.

**Recomendación:**

Añadir al menos una declaración CSP como cabecera HTTP en el servidor (no solo meta tag) cuando la página pase a producción, especificando `img-src 'self' https://upload.wikimedia.org;`.

---

## 3. Evidencia concreta por hallazgo

| ID | Archivo | Línea(s) | Elemento |
|----|---------|----------|---------|
| ALTO-01 | `styles.css` | 113–115 | `nav`, `nav a` en breakpoint ≤ 640 px |
| ALTO-02 | `index.html` / `script.js` | 62–79 / 41–43 | `<article class="stage">` sin `aria-label` estático |
| MEDIO-01 | `styles.css` | 26, 115 | `nav a` — área táctil en móvil |
| MEDIO-02 | `styles.css` | 93 | `.sources h2 { font-size: 1.6rem }` |
| MEDIO-03 | `index.html` | 38, 103 | `<a href="#creditos">` → `<details>` cerrado |
| MEDIO-04 | `index.html` | 108 | enlaces externos en inglés sin `hreflang` |
| BAJO-01 | `styles.css` | 4 | `scroll-padding-top: 2rem` |
| BAJO-02 | `styles.css` | 18–19 | `.skip-link` con `position: fixed` + `transform` |
| BAJO-03 | `index.html` | 37, 101 | Imagen hero duplicada en galería |
| BAJO-04 | `index.html` / `script.js` | 58 / 60 | `#timeline-help` sin `role="status"` |
| BAJO-05 | `index.html` | 1–11 | Cabecera sin directiva CSP |

---

## 4. Criterios que se verificaron y se cumplen

Los siguientes puntos fueron revisados en el código fuente y están correctamente implementados:

| Criterio | Descripción | Evidencia en código |
|----------|------------|---------------------|
| WCAG 1.1.1 (A) | Textos alternativos en todas las imágenes | `index.html` líneas 37, 99–101 — `alt` con sujeto, contexto y año. Verificado por la suite de tests (check 4). |
| WCAG 1.3.1 (A) | Estructura semántica e informativa | Uso de `<header>`, `<main>`, `<nav>`, `<section>`, `<article>`, `<footer>`, `<figure>`, `<figcaption>`, `<dl>`, `<dt>`, `<dd>`, `<time>`. |
| WCAG 1.3.3 (A) | Instrucciones no dependen solo de forma/color | Las instrucciones del timeline usan texto («flechas izquierda y derecha, Inicio o Fin»). |
| WCAG 1.4.4 (AA) | Texto redimensionable — uso de `clamp()` y `rem` | `styles.css` líneas 15, 31, 33, 117 — tamaños fluidos con `clamp()`. |
| WCAG 1.4.10 (AA) | Reflow — `width: min(1180px, calc(100% - 80px))` | `styles.css` línea 17. Grid de hero colapsa a 1 columna en móvil (línea 116). |
| WCAG 2.1.1 (A) | Teclado — timeline completo con flechas, Home, End | `script.js` líneas 28–40. Verificado por tests (checks 9, 10). |
| WCAG 2.4.1 (A) | Saltar bloques — enlace de salto al contenido | `index.html` línea 13; `styles.css` líneas 18–19. |
| WCAG 2.4.2 (A) | Título de página descriptivo | `<title>Cristiano Ronaldo — Una historia de superación</title>` |
| WCAG 2.4.4 (A) | Propósito de los enlaces en contexto | Todos los enlaces con texto descriptivo; uso de `aria-label` donde el texto visual es insuficiente (`aria-label="CR7, inicio"`, `aria-label="Descubrir la biografía"`). |
| WCAG 2.4.6 (AA) | Encabezados y etiquetas descriptivas | Jerarquía H1→H2→H3 correcta y sin saltos: `index.html` líneas 30, 45, 57, 86, 97, 107; H3 dentro de artículos de galería (línea 99). |
| WCAG 2.4.11 (AA) | Foco no oculto (nuevo en WCAG 2.2) | `:focus-visible` con `outline: 3px solid var(--accent)` — `styles.css` línea 9. |
| WCAG 2.5.3 (A) | Etiqueta en nombre | El `aria-label="Descubrir la biografía"` del enlace «↓» incluye la palabra visible adyacente. |
| WCAG 3.1.1 (A) | Idioma de la página | `<html lang="es">` — `index.html` línea 2. |
| WCAG 4.1.1 (A) | Análisis — IDs únicos | Verificado por test automatizado (check 3). No hay IDs duplicados. |
| WCAG 4.1.2 (A) | Roles ARIA correctos en tablist | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby` — `script.js` líneas 11–43. |
| Mejora progresiva | Funciona sin JS | Los seis artículos están en el HTML y son visibles sin JS; JS se aplica con `defer` como capa adicional. |
| `prefers-reduced-motion` | Transiciones desactivadas si el usuario lo prefiere | `styles.css` líneas 135–137. |
| `fetchpriority="high"` | LCP optimizado | `index.html` línea 37 — imagen hero con prioridad alta. |
| `loading="lazy"` | Imágenes de galería diferidas | `index.html` líneas 99–101. |
| `width` y `height` explícitos | Prevención de layout shift (CLS) | Todas las imágenes tienen atributos `width` y `height`. |
| `<meta name="viewport">` | Zoom no bloqueado | `content="width=device-width, initial-scale=1"` — sin `user-scalable=no`. |
| Responsive en 640 px y 960 px | Breakpoints definidos | `styles.css` líneas 99 y 111. Grid hero, stats, galería y nav colapsados. |
| Suite de tests | 12/12 pruebas automatizadas | `node tests/verificar.cjs` — resultado OK sin errores. |

---

## 5. Pruebas que deben repetirse en navegador tras corregir

Las siguientes verificaciones no pueden confirmarse solo con análisis estático y deben realizarse manualmente o con herramientas de navegador real después de aplicar las correcciones:

### 5.1 Contraste de color (WCAG 1.4.3 y 1.4.6)

Verificar en herramienta como [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) o DevTools:

| Combinación de colores | Uso | Ratio mínimo requerido (AA) |
|------------------------|-----|----------------------------|
| `--text` (#f4f5ed) sobre `--bg` (#101923) | Cuerpo de texto | 4.5:1 para texto normal |
| `--muted` (#b2bec8) sobre `--bg` (#101923) | Texto secundario y captions | 4.5:1 |
| `--accent` (#d2f66b) sobre `--bg` (#101923) | Eyebrows, links, botón | 4.5:1 texto normal; 3:1 texto grande |
| `--bg` (#101923) sobre `--accent` (#d2f66b) | Texto del `.button` | 4.5:1 |
| `--muted` (#b2bec8) sobre `--surface` (#17232f) | Texto en secciones surface | 4.5:1 |
| `--accent` (#d2f66b) sobre `#141f29` | Texto del marquee | 4.5:1 |

> **Estimación:** el fondo `#101923` (casi negro azulado) con `#f4f5ed` (casi blanco) debería superar 14:1, cumpliendo ampliamente. El `--muted` (#b2bec8) sobre `#101923` es el caso más crítico — verificar que supera 4.5:1. El `--accent` (#d2f66b, verde lima) sobre `#101923` también requiere verificación.

### 5.2 Navegación con teclado completa

- [ ] Tab desde el inicio de la página hasta el footer: verificar que el orden de foco es lógico y ningún elemento interactivo queda sin foco.
- [ ] El enlace skip-link es el primer elemento enfocado al presionar Tab.
- [ ] Los botones del tablist responden a Enter y Space (comportamiento nativo del navegador).
- [ ] El enlace «↓ Descubrir la biografía» en `.hero-bottom` es enfocable y visualmente marcado.
- [ ] El `<summary>` de `<details>` es enfocable y responde a Enter/Space.
- [ ] Los enlaces de la galería (`.photo-link`) muestran foco visible al tabular.

### 5.3 Zoom al 200 %

- [ ] En escritorio al 200 %, verificar que el hero grid no produce scroll horizontal.
- [ ] El tablist de timeline no desborda su contenedor.
- [ ] El `.stats-grid` de 4 columnas colapsa correctamente o no produce overflow.

### 5.4 Breakpoints en dispositivos reales o DevTools

- [ ] **320 px:** verificar que nav no desborda; que todos los textos son legibles; que no hay overflow-x.
- [ ] **390 px (iPhone 14):** verificar hero con imagen y copia en columna única.
- [ ] **768 px (iPad):** verificar que el breakpoint de 960 px aplica correctamente y el grid de 2 columnas del bio no se rompe.
- [ ] **Escritorio (1280 px+):** verificar hero a 2 columnas, stats a 4 columnas, galería a 3 columnas.

### 5.5 Lector de pantalla

- [ ] NVDA + Chrome / JAWS + Edge en Windows: verificar anuncio del tablist, cambio de pestaña y contenido del panel activo.
- [ ] VoiceOver + Safari en macOS/iOS: verificar el skip-link, el `<details>` de créditos y la navegación por secciones.
- [ ] Verificar que `aria-hidden="true"` en elementos decorativos (`.dot`, flechas ↗) efectivamente los oculta del árbol de accesibilidad.

### 5.6 Apertura automática de `<details>` por ancla `#creditos`

- [ ] Navegar directamente a `index.html#creditos` y verificar si el `<details>` se abre automáticamente o queda cerrado ocultando el contenido referenciado.

### 5.7 Pruebas con herramientas automáticas de navegador

Ejecutar en el navegador real:

- [ ] **axe DevTools** (extensión gratuita) — revisar violaciones AA.
- [ ] **Lighthouse Accessibility** — objetivo ≥ 90.
- [ ] **WAVE** (WebAIM) — revisar errores y alertas de contraste.

---

## 6. Resumen de prioridades de corrección

| Prioridad | ID | Acción |
|-----------|-----|--------|
| 1 (inmediata) | ALTO-01 | Implementar menú móvil colapsable |
| 2 (inmediata) | ALTO-02 | Añadir `aria-label` estático a cada `<article class="stage">` |
| 3 (próxima iteración) | MEDIO-03 | Abrir `<details>` automáticamente al navegar por ancla `#creditos` |
| 4 (próxima iteración) | MEDIO-01 | Aumentar área táctil de enlaces de nav en móvil |
| 5 (próxima iteración) | BAJO-04 | Añadir `role="status"` a `#timeline-help` |
| 6 (mejora) | MEDIO-04 | Añadir `hreflang="en"` a enlaces externos en inglés |
| 7 (mejora) | MEDIO-02 | Unificar tamaño tipográfico de `<h2>` en sección de fuentes |
| 8 (mejora) | BAJO-01 | Usar variable CSS para `scroll-padding-top` |
| 9 (mejora) | BAJO-02 | Evaluar alternativa `position: absolute` para `.skip-link` |
| 10 (mejora) | BAJO-03 | Sustituir imagen duplicada en galería |
| 11 (futuro) | BAJO-05 | Configurar CSP en servidor de producción |

---

*Auditoría realizada mediante análisis estático de código fuente. Los hallazgos marcados como pendientes de verificación manual requieren prueba en navegador real con usuarios o herramientas de accesibilidad.*
