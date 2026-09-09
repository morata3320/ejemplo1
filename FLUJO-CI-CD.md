> Actualización de correcciones (2026-09-09): las secciones originales describen el estado auditado. La sección 10 documenta la validación de ambos informes CodeQL y los nuevos reintentos de despliegue; sus detalles sustituyen las descripciones anteriores de esos controles.
# Flujo CI/CD completo hasta GitHub Pages — paginaCristianoRonaldo

> Auditoría + documentación del pipeline real de este repositorio.
> No describe un flujo genérico: describe **este** `pages.yml`, **estos** scripts `tools/*.cjs`,
> **estas** pruebas `tests/*.cjs` y **este** despliegue a Pages.
> Énfasis principal: **GitHub Actions + JavaScript de CI + pruebas** (detalle exhaustivo).

Fecha de documentación: 2026-09-09.
Rama documentada: `main`.
Workflow: `.github/workflows/pages.yml` — nombre: `Pruebas, seguridad y Pages`.
Requiere localmente: Git + Node.js 24 o superior (`node tools/ci.cjs`).

---

## 0. Mapa de un vistazo (Repos → Actions → Pages)

```text
DEV LOCAL (Windows, Node 25.2.1 verificado)
  index.html / styles.css / script.js
  observabilidad.html / observabilidad.css / observabilidad.js
  tests/*.cjs + tools/*.cjs
        |
        | git add / commit / push a main  (o PR a main, o Run workflow manual)
        v
GITHUB REPOS (origin: morata3320/paginaCristianoRonaldo, remoto secundario: ejemplo1/ejemplo1)
  - Rama main como única rama de despliegue
  - .gitignore excluye .site/ y sarif-results/
        |
        | evento push / pull_request / workflow_dispatch
        v
GITHUB ACTIONS (.github/workflows/pages.yml)
  Job 1 "tests" (paralelo)  ──┐
                              ├──> Job 3 "deploy" (SOLO si 1 y 2 OK + es push a main)
  Job 2 "codeql" (paralelo) ──┘         build .site/ -> configure-pages
                                        -> upload-pages-artifact -> deploy-pages
                                        -> verify-deployment.cjs (fetch HTTPS)
        v
GITHUB PAGES (source = GitHub Actions, environment = github-pages)
  https://<usuario>.github.io/<repo>/  (URL en steps.deployment.outputs.page_url)
  6 archivos públicos verificados byte a byte
```

Regla de oro del repo:

```yaml
needs: [tests, codeql]
if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
```

Es decir: **sin tests en verde y sin CodeQL limpio, no hay Pages. Los PR nunca publican.**

---

## 1. PARTE REPOS — GitHub Repos (origen del flujo)

### 1.1. Remotos y ramas reales de este proyecto

Estado verificado con `git remote -v / git branch -a / git log`:

| Concepto | Valor real |
|---|---|
| Remoto `origin` (principal) | `https://github.com/morata3320/paginaCristianoRonaldo.git` (fetch + push) |
| Remoto `ejemplo1` (secundario) | `https://github.com/morata3320/ejemplo1.git` (fetch + push) |
| Rama activa | `main` (`## main...ejemplo1/main`) |
| Ramas remotas | `remotes/ejemplo1/main`, `remotes/origin/main` |
| Historial (5 commits) | `62eaa61` Corrige detección de scripts y prueba variantes HTML señaladas por CodeQL → `9574be7` Muestra detalles de CodeQL y publica informes → `5ba2000` Configura pruebas y seguridad con despliegue condicionado → `a441174` Mejora compatibilidad de observabilidad → `f175439` Primer commit |

### 1.2. Qué contiene el repo y qué NO viaja a Pages

Árbol relevante:

```text
.github/workflows/pages.yml   # único workflow
.github/dependabot.yml         # updates semanales github-actions
.gitignore                     # excluye .site/ y sarif-results/
index.html, styles.css, script.js
observabilidad.html, observabilidad.css, observabilidad.js
tests/verificar.cjs, tests/observabilidad.cjs, tests/seguridad.cjs, tests/sarif.cjs
tools/ci.cjs, tools/build.cjs, tools/check-sarif.cjs, tools/verify-deployment.cjs
AUDITORIA.md, CI-CD.md, PROMPTS.md
.site/                         # generado, IGNORADO por git
sarif-results/                 # generado por CodeQL, IGNORADO por git
```

`.gitignore` (líneas 21-23) es parte del flujo:

```gitignore
.site/
sarif-results/
```

Efecto:

1. `tools/build.cjs` genera `.site/` localmente, pero nunca se commitea.
2. CodeQL genera `sarif-results/*.sarif` en el runner, nunca se commitea.
3. Solo el código fuente viaja al repo; el artefacto se reconstruye en Actions. Esto evita artefactos corruptos o manipulados.

### 1.3. Flujo Git que dispara el pipeline

| Acción del desarrollador | Evento GitHub | Qué hace Actions |
|---|---|---|
| `git push ejemplo1 main` | `push: branches: [main]` | Ejecuta `tests` + `codeql` + `deploy` (si pasan los dos primeros) |
| Abrir/actualizar PR a `main` | `pull_request: branches: [main]` | Ejecuta `tests` + `codeql`, **omite `deploy`** por el `if` |
| Botón Run workflow en pestaña Actions | `workflow_dispatch` | Ejecución manual, útil para re-desplegar sin push |
| Push a otra rama | — | **No dispara** el workflow (filtro `branches: [main]`) |

Cabecera exacta del workflow (`pages.yml:3-8`):

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
```

Configuración global de seguridad y concurrencia (`pages.yml:10-15`):

```yaml
permissions:
  contents: read
concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: false
```

* `contents: read` = permiso mínimo por defecto. Cada job que necesite más lo declara.
* `concurrency.group = pages-<ref>` = un despliegue por rama a la vez.
* `cancel-in-progress: false` = si hay dos push seguidos a `main`, el segundo espera, no cancela el primero. Evita Pages a medio escribir.

### 1.4. Configuración que el humano debe hacer una vez en GitHub (Repos → Settings → Pages)

El código ya lo asume, pero si Pages da 404, revisar:

1. `Settings → Pages → Build and deployment → Source: GitHub Actions` (no "Deploy from a branch"). El `CI-CD.md:29` lo exige y enlaza a la doc oficial.
2. `Settings → Environments → github-pages` existe (el job `deploy` lo referencia en `pages.yml:66-68`).
3. `Settings → Actions → General → Workflow permissions: Read` (el workflow ya pide `pages: write` y `security-events: write` solo donde toca).
4. `Security → Code scanning` debe mostrar los uploads de CodeQL.

---

## 2. PARTE ACTIONS — Flujo GitHub Actions (ÉNFASIS MÁXIMO)

Archivo único: `.github/workflows/pages.yml` (87 líneas). Tres jobs: `tests`, `codeql`, `deploy`.

### 2.1. Diagrama de jobs y dependencias

```text
on push/PR/manual
   ├─► Job tests (ubuntu-latest, 10 min)
   │     checkout → setup-node 24 → node tools/ci.cjs
   │
   ├─► Job codeql (ubuntu-latest, 20 min, +security-events: write)
   │     checkout → setup-node 24 → codeql/init → codeql/analyze → node tools/check-sarif.cjs
   │
   └─► Job deploy (ubuntu-latest, 10 min, needs [tests, codeql], solo push a main)
         checkout → setup-node 24 → node tools/build.cjs
           → configure-pages → upload-pages-artifact (path: .site)
           → deploy-pages (id: deployment) → verify-deployment.cjs (SITE_URL)
```

### 2.2. Tabla de actions fijadas por SHA (seguridad supply-chain)

Todas usan commit SHA de 40 hex, no tags mutables. Verificado por `tests/seguridad.cjs:50-52` con regex `/^[\w./-]+@[a-f0-9]{40}$/`.

| Paso | `uses:` exacto | Versión lógica | Para qué |
|---|---|---|---|
| checkout (x3 jobs) | `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` | v7.0.1 | Clona el commit que disparó el workflow, con `persist-credentials: false` |
| setup-node (x3 jobs) | `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020` | v7.0.0 | Instala Node `24` (sin npm, sin caché, proyecto sin dependencias) |
| codeql init | `github/codeql-action/init@b96794f015dfd88f77b49b1c93e0fa7110f94c63` | v4 | Inicializa análisis `javascript-typescript,actions` + `security-extended` |
| codeql analyze | `github/codeql-action/analyze@b96794f015dfd88f77b49b1c93e0fa7110f94c63` | v4 | Analiza, `output: sarif-results`, `upload: always` a Code Scanning |
| configure-pages | `actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d` | v6.0.0 | Prepara el runner para Pages |
| upload-pages-artifact | `actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9` | v5.0.0 | Sube `.site` como artefacto de Pages |
| deploy-pages | `actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346` | v5.0.1 | Publica y expone `steps.deployment.outputs.page_url` |

`persist-credentials: false` en los tres checkouts impide que el token `GITHUB_TOKEN` quede en `.git/config` del runner. Buena práctica auditada.

`pull_request_target` está prohibido y el test lo bloquea (`seguridad.cjs:53` → `assert.ok(!/pull_request_target/)`). Así un PR malicioso no obtiene token con escritura.

Dependabot (`.github/dependabot.yml`):

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```

Propone PRs semanales para subir esos SHA. Sin `package.json`, no hay `npm audit` que hacer (declarado en `CI-CD.md:13`).

### 2.3. JOB 1 — `tests`: Pruebas básicas y seguridad local (líneas 18-29)

```yaml
tests:
  name: Pruebas basicas y seguridad local
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - uses: actions/checkout@... # v7.0.1
    - uses: actions/setup-node@... # v7.0.0, node-version: '24'
    - run: node tools/ci.cjs
```

Todo el peso está en `tools/ci.cjs` (19 líneas). Hace dos fases:

**Fase A — `node --check` a todo JS/CJS/MJS:**

```js
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if ([".git", "node_modules", ".site", "sarif-results"].includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : /\.(?:js|cjs|mjs)$/.test(entry.name) ? [full] : [];
  });
}
for (const file of walk(root)) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit", cwd: root });
}
```

* Recursivo desde la raíz, excluye `.git`, `node_modules`, `.site`, `sarif-results`.
* Si un solo archivo tiene error de sintaxis, el job falla aquí. Cero dependencias externas.

**Fase B — Ejecuta 5 suites en orden, con `stdio: inherit`:**

```js
for (const file of ["tests/verificar.cjs", "tests/observabilidad.cjs",
  "tests/seguridad.cjs", "tests/sarif.cjs", "tools/build.cjs"]) {
  execFileSync(process.execPath, [file], { stdio: "inherit", cwd: root });
}
```

Si cualquiera sale con `process.exitCode = 1`, `execFileSync` lanza y el job falla. Orden intencionado: funcional → observabilidad → seguridad → puerta SARIF (test unitario) → build.

### 2.4. Detalle FULL de las pruebas JS (ActionJS) — qué verifica cada archivo

#### 2.4.1. `tests/verificar.cjs` (298 líneas, ~17 grupos de checks)

Propósito: integridad del sitio estático + lógica del `script.js` + HTTP local. Cero dependencias (`node:assert/strict`, `fs`, `path`, `vm`, `http`).

| # | Check (nombre literal) | Qué valida, específico |
|---|---|---|
| 1 | Tres archivos existen, UTF-8 | `index.html`, `styles.css`, `script.js` no vacíos, sin `U+FFFD`, contienen "Biografía" y "superación" |
| 2 | Referencia CSS/JS con defer | Un `<link rel=stylesheet href=styles.css>`, exactamente 2 `<script>`: `observabilidad.js` primero, `script.js defer` segundo |
| 3 | Enlaces internos únicos | `id` sin duplicados; cada `href="#x"` existe en `ids`. Imprime nº de enlaces |
| 4 | 4 img, 3 fotos, alt rico | `images.length==4`, `Set(src).size==3`, cada `alt` contiene `Cristiano Ronaldo` + `Portugal\|Real Madrid` + `2011\|2017\|2018`, `alt.length>40`, protocolo `https:` |
| 5 | Foco visible + 6 etapas sin JS | CSS `:focus-visible{outline:3px solid}`, `[hidden]{display:none!important}`, 6 `<article class=stage>` sin `hidden` en HTML estático |
| 6 | JS compila | `new vm.Script(script)` no lanza |
| 7 | Artículos, menú, idioma | Cada article `aria-label =~ /^Etapa [1-6]: .+, \d{4}/`; `#menu-toggle[aria-controls=nav-list]` con `hidden`; `<nav>` sin `hidden`; enlaces `manutd.com` y `juventus.com` con `hreflang=en` |
| 8 | Contraste calculado | Parsea `--text,--muted,--accent,--bg,--surface` hex, calcula luminancia WCAG y exige `>=4.5` en pares `text/bg, muted/bg, accent/bg, bg/accent, muted/surface` + `accent/#141f29`; además compone `figcaption #101923e6` sobre blanco y exige 4.5 para `text` y `accent` |
| 9 | Init timeline (mock DOM) | Con `vm.runInNewContext(script,{document})`: 6 botones, `controls.hidden==false`, `role=tablist`, `selected(0)`, cada botón `type=button, role=tab, aria-controls=<stage.id>`, cada stage `role=tabpanel, aria-labelledby=<button.id>, tabIndex=0`, `tabIndex` 0 solo en activo |
| 10 | Clic en 6 etapas | `button.events.click()` en cada uno deja `hidden` y `aria-selected` correctos |
| 11 | 24 casos teclado | `6 orígenes × 4 teclas (ArrowRight, ArrowLeft, Home, End)` con wrap-around módulo 6; exige `preventDefault()` y `focused==botón destino` |
| 12 | Tab/Enter/Espacio/Escape nativos | Esas teclas no llaman `preventDefault` ni cambian selección (quedan en etapa 2) |
| 13 | Sin excepciones si falta DOM | Ejecuta el script con `null` en `#timeline-controls`, `#timeline-help` o `.stage==[]` sin lanzar |
| 14 | Menú móvil | `navigationFixture()`: cerrado inicial, `click` abre (`aria-expanded=true`), `Escape` en nav cierra + devuelve foco a toggle, clic en enlace cierra + `focus(destino)` + `tabindex=-1`, clic con `ctrlKey` no cierra |
| 15 | Cambio móvil/escritorio | En desktop `nav.hidden==false, toggle.hidden==true`; al pasar a `matches=true` con foco en link, foco va a toggle; al volver a desktop, foco vuelve al link |
| 16 | Créditos `#creditos` | Hash inicial abre sin mover foco; `hashchange` abre + `focus(summary)`; clic repetido abre; clic con `metaKey` no abre; hash `#biografia` no abre |
| 17 | HTTP local | Servidor `http 127.0.0.1` efímero sirve 6 recursos (`/index.html, /styles.css, /script.js, /observabilidad.html, /observabilidad.css, /observabilidad.js`) con `200`, `Content-Type: <mime>; charset=utf-8` exacto y cuerpo idéntico al archivo. Imprime "Pendiente: navegador real..." como límite honesto |

Mock DOM mínimo (`class Element`): implementa `setAttribute/getAttribute/hasAttribute/contains/querySelector/addEventListener/append/focus`, `dataset.year/club`, `hidden`, `tabIndex`. No pretende ser navegador; prueba lógica de eventos.

#### 2.4.2. `tests/observabilidad.cjs` (215 líneas, 12 grupos)

Propósito: probar `observabilidad.js` (recolector local, clave `cr7-observability:v1`, límites 200 eventos / 30 navegaciones, sin red) con `vm` + dobles de `window/document/localStorage/performance`.

Infra `setup(options)`: `Target` (event emitter con `once`), `Element`, `store: Map`, timers falsos con `flush()`, `window.location`, `navigator`, `performance` (moderno `getEntriesByType` o `legacy timing`), `connection` (incluye alias `mozConnection/webkitConnection`), `Blob/URL.createObjectURL`, `fetch/XHR/sendBeacon` que hacen `assert.fail` si se llaman.

| # | Test literal | Detalle específico |
|---|---|---|
| 1 | Rutas locales, orden temprano, destinos dashboard | Cada `src/href="*.js\|css\|html"` existe en disco; `src="observabilidad.js"` aparece antes que `rel="stylesheet"` en ambos HTML; ids únicos; `href="#x"` válidos; `role="status"` presente; `new vm.Script(source)` OK |
| 2 | Persistencia y snapshot independiente | Primer evento es `entorno`; mutar `snap.events` no afecta interno (copia profunda `JSON.parse(JSON.stringify(...))`); `store.has(KEY)`; viewport `390`, `effectiveType 4g`; re-ejecutar source es idempotente (sigue 1 evento) |
| 3 | Errores JS/promesas/recursos sin credenciales | `error` con `filename=http://usuario:clave@localhost/app.js?token=secreto#x` → `details.file==http://localhost/app.js`; `unhandledrejection(Error("Promesa de prueba"))` → message preservado; `IMG src=http://localhost/foto.jpg?secreto=1` → `resource==http://localhost/foto.jpg` (strip query/fragment/credenciales vía `resourcePath()`) |
| 4 | Clics sin valores de formulario | `input.value="privado"` → `label=="Control de formulario"` y JSON no contiene "privado"; `button "Menú"` → label "Menú"; elemento con `data-observability-ignore` no registra |
| 5 | Visibilidad/conexión/resize agrupado | `visibilitychange hidden` registra; `offline` con `onLine=false`; dos `resize` + `flush()` = 1 evento `viewport` con `width==320` (debounce 250ms) |
| 6 | Performance tras load + legacy | `emit(load)` + `loadEventEnd=125.123` + `flush()` → `loadMs==125.12, responseStartMs==12, domReadyMs==50`; modo `legacy timing {navigationStart:1000,...,loadEventEnd:1200}` → `loadMs==200` |
| 7 | Sin APIs / sin localStorage / sin cuota | `noAPIs+blocked` y `quota` → `storage.persistent==false`, `demo()` funciona en memoria, `navigations[0].loadMs==null` si no hay APIs, `clear()` vacía |
| 8 | JSON corrupto + límites | `store="{no es JSON"` → `storage.message =~ /corrupto/`; 220 `demo()` → `events.length==200`; 32 navegaciones en mismo store → `navigations.length==30` (slice -MAX) |
| 9 | Clear solo clave propia | `store` con `otra-clave=conservar`; `a.clear()` no borra otra clave, elimina `KEY`; pestaña `b` (mismo store) ve 0 eventos (no restaura antiguos); `b.demo()` → 1 evento |
| 10 | Dashboard botones | Con `dashboard:true` + `DOMContentLoaded`: `refresh` habilitado, `demo.click` registra, `refresh.click` pone "actualizados" en `#status`, `download.click` crea `Blob type=application/json`, anchor `.download` termina en `.json`, `flush()` revoca `blob:local-test`, `clear.click` vacía y muestra `#empty-events`; sin APIs `download.disabled==true` |
| 11 | Sin URL no hay credenciales | Con `noAPIs`, `filename=https://usuario:secreto@localhost/app.js?token=privado` → `file=="Ruta no disponible"` y sin "secreto" en JSON |
| 12 | Conexión prefijada | `mozConnection` y `webkitConnection` emiten `change` → evento `conexion` con `effectiveType==2g` |

#### 2.4.3. `tests/seguridad.cjs` (55 líneas)

Puerta de seguridad estática, ejecutada en Actions y local:

1. `script.js` + `observabilidad.js` sin `eval|Function(`, sin `innerHTML|outerHTML=|insertAdjacentHTML|document.write`.
2. `checkScripts(html)`: regex de `<script>` conservadora; exige `scripts.length == match(/<script\b/)` (detecta sin cierre); atributos exactos `src="(observabilidad|script).js"( defer)?`; cuerpo inline vacío. Se auto-prueba con 3 variantes de cierre (`</script>`, `</script >`, `</script foo>`) + casos `alert(1)` y `https://example.com` que deben lanzar.
3. `observabilidad.js` sin comentarios (`replace(/\/\/[^\n]*/g,"")`) no contiene `fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon`; sin `localStorage.clear(`.
4. `index.html` + `observabilidad.html` sin `on*=`, sin `javascript:|vbscript:`, sin `src|href="http:` (HTTPS obligatorio).
5. Secretos en `git ls-files --cached --others --exclude-standard -z`: bloquea filenames `.env(.xxx)|id_rsa|id_ed25519|*.p12|*.pfx|*.key` y contenidos `-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----`, `gh[pousr]_[A-Za-z0-9]{36,}`, `github_pat_[A-Za-z0-9_]{60,}`, `AKIA[A-Z0-9]{16}`. Límite declarado: patrones reconocibles + archivos actuales, no detector exhaustivo ni historial.
6. Workflow: cada `uses:` con SHA 40 hex, sin `pull_request_target`, con `needs: [tests, codeql]`.

Salida: `OK: controles básicos de XSS, scripts locales, HTTPS, privacidad, secretos reconocibles y Actions fijadas.`

#### 2.4.4. `tests/sarif.cjs` (17 líneas) + `tools/check-sarif.cjs` (30 líneas)

Test unitario de la puerta que luego se usa contra CodeQL real:

* `valid()` = `{version:"2.1.0", runs:[{tool:{driver:{name:"CodeQL"}}, results:[]}]}` → no lanza.
* Cada `level` en `error|warning|note` con 1 resultado → lanza (incluso `note`: tolerancia cero).
* Malformados `{}` , `runs:[]`, `runs:[{}]` → lanzan.
* `invocations:[{executionSuccessful:false}]` → lanza.

`checkReport(report)` real:

```js
assert.equal(report.version,"2.1.0");
assert.ok(runs.length); // + tool.driver.name + Array results
for (invocations) assert.notEqual(executionSuccessful,false);
for (result of results) console.error({rule,message,file,line}); // visibilidad en logs
assert.equal(results.length,0,"CodeQL detectó hallazgos...");
```

`checkDirectory(dir)`: exige `*.sarif` existentes ("No hay informes SARIF: se bloquea"), parsea cada uno, imprime `CodeQL sin hallazgos: <file>`.

### 2.5. JOB 2 — `codeql`: CodeQL y bloqueo (líneas 31-54)

```yaml
codeql:
  name: CodeQL y bloqueo de hallazgos
  runs-on: ubuntu-latest
  timeout-minutes: 20
  permissions: { contents: read, security-events: write }
  steps:
    - checkout (persist-credentials:false)
    - setup-node 24
    - codeql/init: { languages: javascript-typescript,actions, queries: security-extended }
    - codeql/analyze: { output: sarif-results, upload: always }
    - run: node tools/check-sarif.cjs sarif-results
```

Qué significa cada campo:

* `languages: javascript-typescript,actions` = analiza JS del sitio **y** el propio `pages.yml` (supply-chain de Actions).
* `queries: security-extended` = pack más estricto que `security`; más verdaderos positivos a cambio de revisar más alertas.
* `output: sarif-results` + `upload: always` = guarda SARIF local para la puerta y lo sube a `Security → Code scanning` aunque haya fallos.
* `security-events: write` es el único permiso extra necesario para el upload.
* La puerta `check-sarif` corre **después** del upload: los hallazgos quedan visibles en GitHub aunque bloqueen el deploy. El log muestra `rule/message/file/line` por cada `result`.

### 2.6. JOB 3 — `deploy`: Publicar en Pages (líneas 56-87)

```yaml
deploy:
  name: Publicar en GitHub Pages
  needs: [tests, codeql]
  if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
  runs-on: ubuntu-latest
  timeout-minutes: 10
  permissions: { contents: read, pages: write, id-token: write }
  environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
  steps:
    - checkout / setup-node 24
    - run: node tools/build.cjs
    - uses: configure-pages / upload-pages-artifact {path: .site}
    - id: deployment, uses: deploy-pages
    - run: node tools/verify-deployment.cjs (env SITE_URL=page_url)
```

Paso a paso:

1. `needs` = espera a que `tests` y `codeql` terminen en éxito. Si uno falla o se salta, `deploy` se salta.
2. `if` = doble guarda: solo `refs/heads/main` y nunca en `pull_request`. En un PR, el job aparece como "Skipped".
3. `permissions.pages:write + id-token:write` = OIDC para Pages sin token de larga vida.
4. `environment.github-pages.url = page_url` = la URL pública aparece en la UI del environment y en el resumen del run.
5. `node tools/build.cjs` — ver §2.7.
6. `upload-pages-artifact path: .site` — solo sube el directorio construido, no todo el repo.
7. `deploy-pages id: deployment` — publica y devuelve `page_url`.
8. `verify-deployment.cjs con SITE_URL` — ver §2.8. Si falla, el workflow marca fallo **pero no revierte** Pages (limitación declarada en `CI-CD.md:11`).

### 2.7. `tools/build.cjs` — construcción del artefacto (19 líneas)

```js
const files = ["index.html","styles.css","script.js",
  "observabilidad.html","observabilidad.css","observabilidad.js"];
function build() {
  const output = path.join(root,".site");
  fs.mkdirSync(output,{recursive:true});
  assert.ok(fs.readdirSync(output).every(file=>files.includes(file)),
    "El artefacto contiene archivos no autorizados");
  for (const file of files) {
    assert.ok(fs.lstatSync(path.join(root,file)).isFile(),"Solo archivos regulares: "+file);
    fs.copyFileSync(path.join(root,file),path.join(output,file));
  }
  assert.deepEqual(fs.readdirSync(output).sort(),files.slice().sort());
}
```

Garantías:

* Lista blanca cerrada de 6 archivos. Si alguien añade `admin.html` al repo, no se publica salvo que edite esta lista (y los tests `verificar/observabilidad` que cuentan recursos).
* `lstatSync.isFile()` bloquea symlinks a `/etc/passwd` u otros.
* Limpia artefactos viejos: si `.site/` contenía un archivo no autorizado de una corrida anterior, falla antes de copiar.
* `deepEqual` final asegura que `.site/` contiene exactamente esos 6.

En CI se ejecuta dos veces: una dentro de `tools/ci.cjs` (valida que construye) y otra en `deploy` (construye lo que se sube).

### 2.8. `tools/verify-deployment.cjs` — verificación post-deploy (21 líneas)

```js
const base = new URL(process.env.SITE_URL);
assert.equal(base.protocol,"https:");
for (const file of files) {
  const expected = fs.readFileSync(path.join(__dirname,"..",file),"utf8");
  let ok=false;
  for (let attempt=0; attempt<12; attempt++) {
    const response = await fetch(new URL(file,base),
      { signal: AbortSignal.timeout(15000), cache:"no-store" });
    if (response.ok && await response.text()===expected) { ok=true; break; }
    await new Promise(r=>setTimeout(r,5000));
  }
  assert.ok(ok,"El archivo publicado no coincide: "+file);
}
```

* Exige `https:` (Pages siempre es HTTPS).
* Compara **byte a byte** cada uno de los 6 archivos contra el commit desplegado.
* 12 intentos × 5s = hasta ~60s de tolerancia a propagación de CDN de Pages.
* `AbortSignal.timeout(15000)` evita cuelgues; `cache:no-store` evita falsos positivos de caché.
* Falla con el nombre del archivo divergente. No hace rollback automático.

---

## 3. PARTE PAGES — GitHub Pages (destino final)

| Aspecto | Valor en este proyecto |
|---|---|
| Source | GitHub Actions (no branch) |
| Artefacto | `.site/` con 6 archivos (HTML+CSS+JS, sin `tests/`, sin `tools/`, sin `.github/`) |
| Environment | `github-pages`, URL dinámica `steps.deployment.outputs.page_url` |
| Protocolo | Solo HTTPS (verificado por test) |
| Actualización | Cada push a `main` en verde; PRs no tocan producción |

Flujo Pages paso a paso (lado GitHub):

1. `actions/configure-pages@v6` marca el run como despliegue Pages.
2. `actions/upload-pages-artifact@v5` comprime `.site/` y lo asocia al run.
3. `actions/deploy-pages@v5.0.1` lo entrega a la infraestructura Pages, actualiza el environment y devuelve `page_url` tipo `https://morata3320.github.io/ejemplo1/`.
4. `verify-deployment.cjs` hace GET a `page_url/index.html`, `.../styles.css`, etc., y compara.
5. El usuario abre la URL pública. Las imágenes se cargan desde `https://upload.wikimedia.org/...` (HTTPS obligatorio, verificado en tests). El recolector `observabilidad.js` sigue sin usar `fetch/XHR/Beacon`: Pages sirve sitio 100% estático, sin backend.

Si la verificación falla por caché/CDN, re-ejecutar con `workflow_dispatch` (no requiere push).

---

## 4. Cómo reproducir el pipeline en local (sin GitHub)

```sh
# Requiere Git y Node 24+
node --version   # 24.x esperado (verificado con 25.2.1, compatible hacia atrás)
node tools/ci.cjs
```

Eso ejecuta, en orden: `node --check` global → `verificar` → `observabilidad` → `seguridad` → `sarif` → `build`.
CodeQL **no** corre en local; solo en Actions. La puerta SARIF sí se prueba en local vía `tests/sarif.cjs`.
Para simular el artefacto Pages:

```sh
node tools/build.cjs
# inspeccionar .site/ (6 archivos)
npx serve .site   # o python -m http.server en .site/
```

---

## 5. Matriz de fallo (qué bloquea qué)

| Fallo | Dónde se detecta | Efecto |
|---|---|---|
| Error sintaxis JS | `tools/ci.cjs` fase A | `tests` rojo → `deploy` skipped |
| Alt sin "Cristiano Ronaldo", img http:, id duplicado, contraste <4.5, teclado roto | `tests/verificar.cjs` | `tests` rojo → no hay Pages |
| `observabilidad.js` hace fetch, guarda valores de formulario, pierde límites | `tests/observabilidad.cjs` | `tests` rojo |
| `eval`, `innerHTML`, script externo, `on*=`, `javascript:`, secreto `ghp_...`, action sin SHA, `pull_request_target` | `tests/seguridad.cjs` | `tests` rojo |
| Puerta SARIF rota (test unitario) | `tests/sarif.cjs` | `tests` rojo |
| CodeQL halla 1 `note` o más, SARIF ausente, análisis fallido | `tools/check-sarif.cjs` en job `codeql` | `codeql` rojo → `deploy` skipped, alerta en Security |
| `.site/` con archivo extra o symlink | `tools/build.cjs` | `tests` y/o `deploy` rojos |
| Contenido publicado ≠ commit (CDN, manipulación, Pages caído) | `tools/verify-deployment.cjs` | `deploy` rojo **tras** publicar (sin rollback auto) |
| Push a rama ≠ main | filtro `on` | Workflow ni arranca |
| PR a main | `if` de deploy | `tests+codeql` corren, `deploy` skipped |

---

## 6. Notas de auditoría (recomendaciones, sin cambios aplicados)

1. **Fortalezas verificadas:** pins SHA + `persist-credentials:false`, `contents:read` mínimo, `needs` estricto, tolerancia cero SARIF (incluso `note`), artefacto lista blanca, verificación byte a byte post-deploy, cero dependencias npm (superficie mínima), secretos escaneados en archivos trackeados, `concurrency` sin cancelación.
2. **Límites honestos ya declarados en `CI-CD.md`:** mocks DOM ≠ navegador real; detector de secretos no exhaustivo ni histórico; verificación post-deploy no revierte. No prometer más.
3. **Recomendaciones:**
   * Añadir cabecera CSP en Pages vía `_headers` o meta (`img-src 'self' https://upload.wikimedia.org`) cuando se endurezca (hallazgo BAJO-05 de `AUDITORIA.md`).
   * Considerar `branch protection` en `main` (requerir `tests` + `codeql` en verde + 1 review) para que el `if` no sea la única defensa.
   * Fijar `Node 24.x.y` exacto o `.nvmrc` si se quiere reproducibilidad bit a bit (hoy `node-version: '24'` sigue el último 24).
   * Añadir timeout global del workflow y `attestations` de artefacto si el sitio maneja datos sensibles en el futuro (hoy es estático + localStorage local).
   * Mantener `AUDITORIA.md` como deuda UX (menú móvil, `aria-label` estático, `details#creditos` auto-open) separada del gate CI: el pipeline ya cubre regresiones; lo manual (lector de pantalla, axe/Lighthouse, zoom 200%, 320px real) sigue pendiente según §5 de la auditoría.

---

## 7. Referencias cruzadas (archivo → línea)

* Disparadores/permisos/concurrencia: `pages.yml:3-15`
* Job tests: `pages.yml:18-29` → `tools/ci.cjs:1-19`
* Job CodeQL + puerta: `pages.yml:31-54` → `tools/check-sarif.cjs:1-30` (+ test `tests/sarif.cjs:1-17`)
* Job deploy + env: `pages.yml:56-87` → `tools/build.cjs:1-19` → `tools/verify-deployment.cjs:1-21`
* Dependabot Actions semanal: `.github/dependabot.yml:1-6`
* Exclusiones `.site/, sarif-results/`: `.gitignore:21-23`
* Puerta Actions SHA + anti-`pull_request_target` + `needs`: `tests/seguridad.cjs:49-54`
* Listas de 6 archivos públicos: `tools/build.cjs:6` y `tools/verify-deployment.cjs:5` (importado de build)
* Alcance y límites oficiales: `CI-CD.md:1-29`

---

## 8. Explicación en lenguaje natural (paso a paso, sin tecnicismos innecesarios)

Esta sección cuenta lo mismo que las secciones 0 a 7, pero como si se lo explicaras a alguien que no conoce GitHub Actions. Si la parte técnica es el "manual", esta es la "historia".

### 8.1. La idea general en una frase

Tú escribes la página en tu computador, la subes a GitHub, unos robots la revisan entera, y solo si está sana y segura, GitHub la publica en internet. Si algo falla, no se publica.

### 8.2. Paso 1 — Tú trabajas en local (Repos empieza aquí)

Imagina que tu proyecto es una maqueta de una casa. Los archivos `index.html`, `styles.css`, `script.js` y los de `observabilidad` son las paredes, la pintura y el cableado.

Cuando terminas un cambio, haces tres gestos:

1. Lo guardas (`git add` / `commit`): es como sacarle una foto a la maqueta y ponerle fecha.
2. Lo subes (`git push ejemplo1 main`): es como llevar esa foto a la oficina central, que es GitHub.
3. GitHub lo guarda en la carpeta `main`, que es la única carpeta que tiene permiso para salir publicada.

Hay dos oficinas registradas: `origin` (paginaCristianoRonaldo, la principal) y `ejemplo1` (una copia secundaria). Lo importante es que todo lo que llegue a `main` va a ser revisado.

Dos carpetas nunca se suben porque son basura de trabajo: `.site/` (la copia lista para publicar que se genera sola) y `sarif-results/` (los informes del escáner de seguridad). Están en `.gitignore` para que nadie las suba por error.

### 8.3. Paso 2 — GitHub se da cuenta y llama a los revisores (Actions se despierta)

GitHub está vigilando la puerta de `main`. Esa vigilancia se configura en `.github/workflows/pages.yml`:

* Si subes algo directo a `main` (push), se activa la revisión completa y, si todo va bien, se publica.
* Si abres una propuesta de cambio (pull request hacia `main`), se activa la revisión pero **no se publica**. Es como un ensayo general: se revisa todo, pero el público no lo ve todavía.
* Si pulsas el botón "Run workflow" a mano, obligas a revisar y publicar de nuevo sin subir nada nuevo. Sirve cuando Pages tardó en actualizarse o falló por red.

Además GitHub pone dos reglas de orden: permiso mínimo (los revisores solo pueden leer, salvo que pidan un permiso extra concreto) y fila única (si subes dos cambios seguidos, el segundo espera a que termine el primero, no lo interrumpe a la mitad).

Dependabot es el asistente que cada semana revisa si las herramientas que usan los robots tienen versión nueva y te propone actualizarlas con un pull request.

### 8.4. Paso 3 — Primer revisor: el que mira que nada esté roto (Job `tests`)

Es el más trabajador. Entra a una computadora prestada de GitHub (Ubuntu), instala Node 24 y ejecuta una sola orden: `node tools/ci.cjs`.

Esa orden hace dos cosas, en este orden:

**Primero, revisa que el JavaScript se entienda.** Es como pasar el corrector ortográfico: ejecuta `node --check` a cada archivo `.js/.cjs/.mjs`, ignorando `.git`, `node_modules`, `.site` y `sarif-results`. Si hay un solo punto y coma mal puesto que rompa la sintaxis, aquí se para todo.

**Segundo, pasa cinco exámenes, uno tras otro.** Si uno suspende, no sigue publicando:

1. `tests/verificar.cjs`: mira que la página tenga sentido. Que haya exactamente 2 scripts y que el segundo tenga `defer`, que no haya identificadores duplicados, que todos los enlaces internos apunten a algo que existe, que haya 4 imágenes con descripciones largas que mencionen a Cristiano Ronaldo, que el menú y las 6 etapas de la trayectoria funcionen con ratón y con teclado (flechas, Inicio, Fin, Escape), que los colores tengan contraste suficiente y que un servidor local sirva los 6 archivos con el tipo correcto. Usa una maqueta de navegador falsa para probar la lógica sin abrir Chrome de verdad.
2. `tests/observabilidad.cjs`: revisa el cuaderno de bitácora local (`observabilidad.js`). Comprueba que guarda hasta 200 eventos y 30 navegaciones en `cr7-observability:v1`, que no envía nada por internet (si intentara usar `fetch` el examen lo suspendería a propósito), que borra las consultas y contraseñas de las rutas, que no guarda lo que escribes en formularios, que sobrevive si el navegador no tiene `localStorage` o está lleno, que recupera un JSON corrupto sin romperse y que los botones del panel (actualizar, demo, limpiar, descargar) funcionan.
3. `tests/seguridad.cjs`: es el guardia. Busca trampas: `eval`, `innerHTML`, código dentro del HTML, enlaces `javascript:`, recursos `http:` sin `s`, scripts que no sean los dos locales permitidos, intentos de enviar datos fuera, borrado de almacenamiento ajeno, secretos tipo `ghp_...`, claves privadas, archivos `.env`, y que cada herramienta de GitHub esté fijada por código exacto (SHA de 40 letras) y no por una etiqueta que pueda cambiar. También prohíbe el modo peligroso `pull_request_target`.
4. `tests/sarif.cjs`: es el examen del examen. Prueba que la puerta que va a vigilar al escáner CodeQL funciona: acepta un informe limpio y suspende si hay un hallazgo aunque sea leve (`note`), si el informe viene vacío o roto, o si el escáner dice que falló.
5. `tools/build.cjs`: monta la caja que se va a publicar. Crea la carpeta `.site/` y copia exactamente 6 archivos permitidos. Si hay un séptimo archivo o un enlace raro, suspende. Así nadie cuela un archivo extra a la web sin querer.

Si este revisor dice "todo bien", pone un sello verde y deja pasar al siguiente.

### 8.5. Paso 4 — Segundo revisor: el detective de seguridad (Job `codeql`)

Mientras el primer revisor trabaja, otro en paralelo hace de detective. Usa CodeQL, que es como un lector que busca patrones de ataque en tu JavaScript y en tu propio archivo de Actions.

Lo configura para ser estricto (`security-extended`) y para mirar dos idiomas: `javascript-typescript` y `actions`. Guarda el resultado en `sarif-results/` y lo sube a la pestaña `Security > Code scanning` para que quede constancia.

Después ejecuta `node tools/check-sarif.cjs sarif-results`, que es una puerta de tolerancia cero: si hay un solo hallazgo, aunque sea informativo, bloquea la publicación y escribe en el registro qué regla falló, en qué archivo y en qué línea. Si no hay ningún informe, también bloquea, porque eso significaría que el detective no trabajó.

Solo si este detective también pone sello verde, se puede publicar.

### 8.6. Paso 5 — El publicador (Job `deploy`, solo en push a `main`)

Es el único que puede tocar la imprenta. Primero comprueba dos condiciones: que los dos revisores anteriores hayan aprobado (`needs: [tests, codeql]`) y que esto sea un push real a `main`, no una propuesta (pull request). Si es un pull request, este paso se salta educadamente.

Si pasa el filtro, hace esto en orden:

1. Vuelve a montar la caja con `node tools/build.cjs`.
2. Prepara la imprenta (`configure-pages`).
3. Sube solo la caja `.site/` (`upload-pages-artifact`), no todo el taller.
4. Publica (`deploy-pages`) y te devuelve la dirección web (`page_url`), que aparece en el entorno `github-pages`.
5. Hace de inspector final con `node tools/verify-deployment.cjs`: abre la web pública con `https`, descarga uno por uno los 6 archivos y los compara letra a letra con los que subiste. Como internet a veces tarda, lo reintenta hasta 12 veces esperando 5 segundos entre intentos. Si al final uno no coincide, marca el trabajo como fallido. Ojo: a esas alturas la web ya está publicada, así que este fallo avisa pero no despublica solo.

### 8.7. Paso 6 — La web visible (Pages)

GitHub Pages es simplemente la vitrina. Solo muestra lo que hay en la caja `.site/`. No hay servidor ni base de datos: son 6 archivos estáticos. Las fotos vienen de Wikimedia por `https`, y el panel de observabilidad sigue guardando todo solo en tu navegador, sin enviar nada fuera.

Para que esto funcione, alguien tuvo que hacer una vez en `Settings > Pages` el ajuste de "Source: GitHub Actions". Sin eso, la imprenta trabaja pero la vitrina no se abre.

En resumen natural: escribes → subes a `main` → dos revisores independientes te examinan → solo si ambos aprueban se monta la caja → se publica → se comprueba que lo publicado es idéntico a lo subido.

---

## 9. Tipos de fallos por severidad (básicos, medios, altos y graves)

Clasificación propia de auditoría para este repo. Mapea cada fallo a dónde se detecta y qué pasa con Pages. La regla general no cambia: **cualquier fallo en `tests` o `codeql` impide `deploy`, salvo el caso post-publicación que solo avisa.**

### 9.1. Fallos BÁSICOS (molestan, no rompen ni exponen)

Son errores de forma o contenido que empeoran la experiencia pero no tiran la página ni crean riesgo. El pipeline los bloquea igual para mantener calidad.

| Ejemplo concreto en este proyecto | Dónde se caza | Qué verías en Actions |
|---|---|---|
| Texto alternativo corto o sin "Cristiano Ronaldo / Portugal-Real Madrid / año" | `tests/verificar.cjs` check 4 (`alt.length>40` y regex) | `tests` rojo, assertion de `alt` |
| Enlace interno `href="#x"` sin `id="x"` o `id` duplicado | `tests/verificar.cjs` check 3 | `tests` rojo, muestra el target faltante |
| Falta `defer` en `script.js` o el orden `observabilidad.js` antes que CSS se invierte | `tests/observabilidad.cjs` test 1 + `verificar.cjs` check 2 | `tests` rojo |
| Un séptimo archivo suelto en `.site/` o falta uno de los 6 | `tools/build.cjs` (`every(files.includes)` + `deepEqual`) | `tests` o `deploy` rojo: "artefacto contiene archivos no autorizados" |
| Contraste justo por debajo de 4.5 en `muted/bg` o `accent/bg` tras cambiar paleta | `tests/verificar.cjs` check 8 (cálculo WCAG) | `tests` rojo con ratio impreso, ej. `muted/bg: 4.31:1` |
| MIME mal servido en local (ej. `text/plain` en vez de `text/css`) | `tests/verificar.cjs` check HTTP | `tests` rojo en fase servidor local |

En lenguaje natural: son como faltas de ortografía o una foto torcida en la maqueta. No se cae la casa, pero el revisor no te deja exponerla hasta que la endereces.

### 9.2. Fallos MEDIOS (rompen una función, degradan accesibilidad o fiabilidad)

La página carga, pero algo deja de funcionar para parte de los usuarios o el pipeline pierde garantías.

| Ejemplo concreto | Dónde se caza | Efecto |
|---|---|---|
| Teclado del timeline roto: flechas no envuelven, `Home/End` no van a 0/5, `Tab` queda atrapado | `tests/verificar.cjs` checks 11-12 (24 casos + nativos) | `tests` rojo, `selected(to)` falla |
| Menú móvil no abre/cierra, `Escape` no devuelve foco, foco se pierde al cambiar viewport | `tests/verificar.cjs` checks 14-15 (`navigationFixture`) | `tests` rojo |
| `#creditos` no se abre con hash directo o se abre con `metaKey` cuando no debe | `tests/verificar.cjs` check 16 | `tests` rojo |
| `observabilidad.js` pierde eventos al mutar snapshot (sin copia profunda) o no es idempotente al cargar dos veces | `tests/observabilidad.cjs` test 2 | `tests` rojo |
| Límites rotos: guarda 500 eventos o 100 navegaciones sin recortar a 200/30, o no recupera JSON corrupto | `tests/observabilidad.cjs` test 8 | `tests` rojo |
| `clear()` borra `otra-clave` o una segunda pestaña resucita datos viejos | `tests/observabilidad.cjs` test 9 | `tests` rojo |
| Dashboard con botones sin habilitar, descarga sin `Blob`, `revokeObjectURL` no llamado | `tests/observabilidad.cjs` test 10 | `tests` rojo |
| Sintaxis JS rota en cualquier `.js/.cjs/.mjs` | `tools/ci.cjs` fase `node --check` | `tests` rojo inmediato, sin llegar a suites |

En lenguaje natural: son como una puerta que no abre o una ventana que no cierra. La casa sigue en pie, pero no es habitable para todos, así que no se publica.

### 9.3. Fallos ALTOS (seguridad, privacidad o integridad del despliegue)

Aquí ya hay riesgo real: alguien podría ejecutar código, robar datos, colar archivos o publicar algo distinto a lo revisado. El pipeline es más duro: CodeQL + puerta SARIF + verificación byte a byte.

| Ejemplo concreto | Dónde se caza | Efecto |
|---|---|---|
| `eval(...)`, `new Function(...)`, `innerHTML=`, `insertAdjacentHTML`, `document.write` en `script.js`/`observabilidad.js` | `tests/seguridad.cjs` + CodeQL `security-extended` | `tests` o `codeql` rojo; si lo pilla CodeQL, alerta en `Security` y `deploy` bloqueado |
| Script inline `<script>alert(1)</script>`, script externo `https://example.com/x.js`, `onload=`, `href="javascript:..."` | `tests/seguridad.cjs` (`checkScripts` + regex `on\w+=`) | `tests` rojo |
| Recurso o enlace `http:` sin `s` (imagen o link) | `tests/seguridad.cjs` (`(src\|href)=["']http:`) | `tests` rojo |
| `observabilidad.js` intenta `fetch`/`XHR`/`WebSocket`/`EventSource`/`sendBeacon` o hace `localStorage.clear()` | `tests/seguridad.cjs` + `observabilidad.cjs` (dobles que hacen `assert.fail`) | `tests` rojo: "no debe transmitir / no borrar almacenamiento ajeno" |
| Guarda valores de formulario (`input.value="privado"` aparece en JSON) o guarda query/token/credenciales en rutas | `tests/observabilidad.cjs` tests 3-4 y 11 (`resourcePath` + strip) | `tests` rojo |
| Symlink en vez de archivo regular para colar `/etc/passwd` en `.site/` | `tools/build.cjs` (`lstatSync.isFile()`) | `deploy` rojo antes de subir |
| Archivo publicado distinto al commit (CDN corrupta, manipulación, despliegue parcial) | `tools/verify-deployment.cjs` (fetch `https`, `cache:no-store`, 12×5s, comparación exacta) | `deploy` rojo **después** de publicar; requiere re-ejecución manual, no hay rollback auto |
| Dependencia de Actions sin SHA fijo o con tag mutable | `tests/seguridad.cjs` (regex SHA 40) + Dependabot | `tests` rojo hasta fijar SHA |

En lenguaje natural: son como dejar la llave puesta o una pared falsa. Aunque la casa se vea bien, no se puede abrir al público.

### 9.4. Fallos GRAVES / CRÍTICOS (comprometen el repositorio o toda la cadena)

Pueden afectar no solo a esta web, sino a quien contribuya, al historial o a futuros despliegues. Son los que un auditor marca como "parar todo".

| Ejemplo concreto | Dónde se caza | Efecto |
|---|---|---|
| Secreto subido: `cabecera PEM de clave privada (ejemplo sin clave)`, `ghp_...` / `gho_...` / `github_pat_...`, `AKIA...`, `.env`, `id_rsa`, `*.pem/*.key/*.p12` | `tests/seguridad.cjs` (`git ls-files` + patrones) | `tests` rojo inmediato; además hay que **rotar el secreto** en GitHub aunque se borre del código, porque queda en historial |
| Uso de `pull_request_target` en el workflow (un PR externo podría robar `GITHUB_TOKEN` con escritura) | `tests/seguridad.cjs` (`!/pull_request_target/`) | `tests` rojo; si llegara a `main`, riesgo de ejecución privilegiada |
| CodeQL con hallazgo `error` (ej. XSS reflejado, inyección,072 bypass) o análisis con `executionSuccessful:false` | `tools/check-sarif.cjs` en job `codeql` | `codeql` rojo, informe en `Security`, `deploy` bloqueado por `needs` |
| Ausencia total de informes SARIF (`sarif-results/` vacío: el escáner no corrió) | `tools/check-sarif.cjs` (`No hay informes SARIF`) | `codeql` rojo por diseño (fail-closed, no fail-open) |
| `GITHUB_TOKEN` persistido en git del runner (`persist-credentials:true`) + log que filtra URL con token | Revisión manual + `pages.yml` exige `false` | No lo caza un test unitario; es grave porque expone credencial en artefactos/logs |
| `deploy` publicando desde rama/PR indebida por `if` mal editado | `pages.yml:59` + matriz §5 | Si se rompe el `if`, un PR podría publicar. Por eso se recomienda `branch protection` exigiendo `tests+codeql` en verde |
| Historial con secreto ya commiteado aunque el archivo actual esté limpio | **No** lo caza el test actual (solo mira archivos actuales, no `git log -p`, declarado en `CI-CD.md:7`) | Requiere `gitleaks`/`secret scanning` + limpieza con `BFG` + rotación. Clasificado grave precisamente porque el pipeline actual no lo ve |

En lenguaje natural: son como descubrir que alguien copió las llaves maestras del edificio. No basta con cambiar la cerradura de tu puerta: hay que cambiar las llaves de todos, avisar a los vecinos y revisar las cámaras (historial, tokens, alertas de GitHub).

### 9.5. Cómo leer un fallo en la pestaña Actions (guía rápida natural)

1. Entra a `Actions > último run >` mira qué job está rojo: `tests`, `codeql` o `deploy`.
2. Si es `tests`, abre el log y busca la línea `OK N:` anterior al error: el fallo está en el siguiente check. El mensaje de `assert` te dice el archivo y el valor esperado.
3. Si es `codeql`, ve a `Security > Code scanning` para ver regla/archivo/línea, y al log de `Bloquear cualquier hallazgo` para el JSON con `rule/message/file/line`.
4. Si es `deploy` en `verify-deployment`, mira qué archivo dice `no coincide`: suele ser caché de Pages; re-ejecuta con `Run workflow` antes de tocar código.
5. Si es `deploy` en `build`, mira si dice "no autorizado" o "solo archivos regulares": hay un archivo de más o un symlink.

## 10. Correcciones de los controles de CodeQL y despliegue

La consulta de Actions mostró dos ejecuciones históricas fallidas por CodeQL (34370151707 y 34370657689) y una posterior exitosa (34371073560). En las fallidas, el despliegue fue omitido por dependencia; no se constató un fallo independiente del despliegue. Los hallazgos HTML originales ya se habían corregido en 62eaa61.

La revisión del código asociado a esta auditoría identificó y corrigió dos debilidades adicionales:

1. **CodeQL incompleto:** antes bastaba cualquier archivo SARIF limpio, aunque faltara el análisis de uno de los lenguajes configurados. Ahora `tools/check-sarif.cjs` exige `actions.sarif` y `javascript.sarif`, valida el origen CodeQL, rechaza JSON corrupto e invocaciones no exitosas y conserva el bloqueo de cualquier hallazgo. También valida informes adicionales y muestra errores de todos ellos. `tests/sarif.cjs` cubre archivos ausentes, informes limpios, inválidos y hallazgos.
2. **Verificación de despliegue frágil:** antes una excepción de `fetch` o de lectura del cuerpo terminaba el proceso en el primer intento. Ahora `tools/verify-deployment.cjs` reintenta errores de red, timeout, lectura, HTTP distinto de 200 y contenido diferente. Compara bytes con el artefacto `.site`, normaliza la barra final de la URL, exige HTTPS sin credenciales y rechaza redirecciones. Comprueba los seis archivos en paralelo, hasta 12 intentos por archivo, timeout de 15 segundos y pausas de 5 segundos solo entre intentos: el presupuesto de red por archivo llega a 235 segundos, no a los 60 segundos indicados en la descripción original. Informa archivo, intento y causa. Un fallo final sigue marcando el workflow como fallido; no se añadió rollback automático.

`tests/despliegue.cjs` simula respuestas HTTP y fallos sin solicitar servicios externos ni esperar tiempo real. Cubre recuperación, agotamiento de reintentos, contenido antiguo, diferencias binarias y URL inválida. Se ejecuta mediante `node tools/ci.cjs` antes de publicar. El paso HTTPS real posterior conserva un timeout de 5 minutos.

Se corrigió además el ejemplo literal de cabecera de clave privada de este documento: activaba el detector de secretos, aunque no contenía una clave. El detector continúa activo para todos los documentos.

El remoto de publicación es `ejemplo1` y la URL es https://morata3320.github.io/ejemplo1/. Los fallos históricos permanecen en Actions como evidencia; corregirlos no cambia el estado de ejecuciones antiguas.