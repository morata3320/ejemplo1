"use strict";

// Ejecutar con: node tests/verificar.cjs. Solo usa módulos incluidos en Node.js.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const http = require("node:http");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
let checks = 0;
function check(name, run) {
  run();
  checks += 1;
  console.log(`OK ${checks}: ${name}`);
}
// Extracción limitada al marcado de este sitio; no sustituye un validador HTML.
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
}
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
check("Los tres archivos existen, tienen contenido y se leen como UTF-8", () => {
  for (const content of [html, css, script]) {
    assert.ok(content.length > 0);
    assert.ok(!content.includes("\uFFFD"));
  }
  assert.ok(html.includes("Biografía"));
  assert.ok(html.includes("superación"));
});
check("index.html referencia styles.css y script.js con defer", () => {
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map(m => attributes(m[0]));
  assert.ok(links.some(link => link.rel === "stylesheet" && link.href === "styles.css"));
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map(m => m[0]);
  assert.equal(scripts.length, 2);
  assert.equal(attributes(scripts[0]).src, "observabilidad.js");
  assert.equal(attributes(scripts[1]).src, "script.js");
  assert.match(scripts[1], /\sdefer(?:\s|>)/);
});
check("Todos los enlaces internos tienen un destino único", () => {
  assert.equal(ids.length, new Set(ids).size);
  const anchors = [...html.matchAll(/href="#([^"]*)"/g)];
  assert.ok(anchors.length > 0);
  for (const [, target] of anchors) assert.ok(ids.includes(target), target);
  console.log(`  ${anchors.length} enlaces internos comprobados.`);
});
check("Cuatro elementos img, tres fotos distintas y alt con sujeto y contexto", () => {
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map(m => attributes(m[0]));
  assert.equal(images.length, 4);
  assert.equal(new Set(images.map(img => img.src)).size, 3);
  for (const img of images) {
    assert.match(img.alt, /Cristiano Ronaldo/);
    assert.match(img.alt, /Portugal|Real Madrid/);
    assert.match(img.alt, /2011|2017|2018/);
    assert.ok(img.alt.length > 40);
    assert.equal(new URL(img.src).protocol, "https:");
  }
});
check("Hay foco visible y las seis etapas permanecen disponibles sin JS", () => {
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*3px solid/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  const articles = [...html.matchAll(/<article class="stage"[^>]*>/g)];
  assert.equal(articles.length, 6);
  for (const [tag] of articles) assert.ok(!/\shidden(?:\s|>)/.test(tag));
});
check("JavaScript compila sin errores de sintaxis", () => new vm.Script(script));
check("Artículos con nombre estático, menú progresivo y metadatos de idioma", () => {
  for (const [tag] of html.matchAll(/<article class="stage"[^>]*>/g)) {
    assert.match(attributes(tag)["aria-label"], /^Etapa [1-6]: .+, \d{4}/);
  }
  const toggle = html.match(/<button[^>]*id="menu-toggle"[^>]*>/)[0];
  assert.equal(attributes(toggle)["aria-controls"], "nav-list");
  assert.match(toggle, /\shidden>/);
  assert.ok(!/\shidden/.test(html.match(/<nav\b[^>]*>/)[0]));
  for (const host of ["www.manutd.com", "www.juventus.com"]) {
    const link = [...html.matchAll(/<a\b[^>]*>/g)].map(m => attributes(m[0])).find(a => a.href.includes(host));
    assert.equal(link.hreflang, "en");
  }
});
check("Contraste calculado de paleta sólida y fondo de pie de foto", () => {
  const palette = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map(m => [m[1], m[2]]));
  function rgb(hex) { return hex.slice(1).match(/../g).map(v => parseInt(v, 16)); }
  function luminance(color) {
    const linear = color.map(value => {
      const s = value / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return linear.reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  }
  function ratio(fg, bg) {
    const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
  }
  for (const [fg, bg] of [["text", "bg"], ["muted", "bg"], ["accent", "bg"], ["bg", "accent"], ["muted", "surface"]]) {
    const value = ratio(rgb(palette[fg]), rgb(palette[bg]));
    assert.ok(value >= 4.5);
    console.log(`  ${fg}/${bg}: ${value.toFixed(2)}:1`);
  }
  assert.ok(ratio(rgb(palette.accent), rgb("#141f29")) >= 4.5);
  const caption = css.match(/\.hero-portrait figcaption\s*\{[^}]*background:\s*(#[\da-f]{8})/i)[1];
  const opacity = parseInt(caption.slice(7), 16) / 255;
  const brightest = rgb(caption.slice(0, 7)).map(channel => channel * opacity + 255 * (1 - opacity));
  for (const color of ["text", "accent"]) assert.ok(ratio(rgb(palette[color]), brightest) >= 4.5);
});

// DOM mínimo: prueba la lógica de eventos, no la implementación de un navegador.
class Element {
  constructor(attrs = {}) {
    this.id = attrs.id;
    this.dataset = { year: attrs["data-year"], club: attrs["data-club"] };
    this.attrs = {};
    this.events = {};
    this.children = [];
    this.hidden = false;
  }
  setAttribute(name, value) { this.attrs[name] = value; }
  getAttribute(name) { return this.attrs[name]; }
  hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
  contains(element) { return this === element || this.children.includes(element); }
  querySelector() { return this.children[0]; }
  addEventListener(name, handler) { this.events[name] = handler; }
  append(...children) { this.children.push(...children); }
  focus() { focused = this; }
}
let focused;
const stages = [...html.matchAll(/<article class="stage"[^>]*>/g)].map(m => new Element(attributes(m[0])));
const controls = new Element();
const help = new Element();
const document = {
  querySelector: selector => ({ "#timeline-controls": controls, "#timeline-help": help })[selector],
  querySelectorAll: selector => selector === ".stage" ? stages : [],
  createElement: () => new Element()
};
function selected(index) {
  stages.forEach((stage, i) => {
    assert.equal(stage.hidden, i !== index);
    assert.equal(controls.children[i].attrs["aria-selected"], String(i === index));
    assert.equal(controls.children[i].tabIndex, i === index ? 0 : -1);
  });
}
check("Inicialización: seis botones, primer panel activo y relaciones ARIA válidas", () => {
  vm.runInNewContext(script, { document });
  assert.equal(controls.children.length, 6);
  assert.equal(controls.hidden, false);
  assert.equal(help.hidden, false);
  assert.equal(controls.attrs.role, "tablist");
  selected(0);
  stages.forEach((stage, i) => {
    const button = controls.children[i];
    assert.equal(button.type, "button");
    assert.equal(button.attrs.role, "tab");
    assert.equal(button.attrs["aria-controls"], stage.id);
    assert.equal(stage.attrs.role, "tabpanel");
    assert.equal(stage.attrs["aria-labelledby"], button.id);
    assert.equal(stage.tabIndex, 0);
  });
});
check("Clic en cada una de las seis etapas", () => {
  controls.children.forEach((button, index) => { button.events.click(); selected(index); });
});
check("24 casos de teclado: flechas, vuelta en los extremos, Home y End", () => {
  for (let from = 0; from < stages.length; from += 1) {
    for (const [key, to] of [["ArrowRight", (from + 1) % 6], ["ArrowLeft", (from + 5) % 6], ["Home", 0], ["End", 5]]) {
      controls.children[from].events.click();
      let prevented = false;
      controls.children[from].events.keydown({ key, preventDefault() { prevented = true; } });
      selected(to);
      assert.ok(prevented);
      assert.equal(focused, controls.children[to]);
    }
  }
});
check("Tab, Enter y Espacio no se interceptan; conservan el comportamiento nativo", () => {
  controls.children[2].events.click();
  for (const key of ["Tab", "Enter", " ", "Escape"]) {
    controls.children[2].events.keydown({ key, preventDefault() { assert.fail(key); } });
    selected(2);
  }
});
check("No hay excepciones al faltar controles, ayuda o etapas", () => {
  for (const missing of ["#timeline-controls", "#timeline-help", ".stage"]) {
    vm.runInNewContext(script, { document: {
      ...document,
      querySelector: selector => selector === missing ? null : document.querySelector(selector),
      querySelectorAll: () => missing === ".stage" ? [] : stages
    } });
  }
});

function navigationFixture(hash = "", isMobile = true) {
  const toggle = new Element();
  const nav = new Element();
  const link = new Element();
  const destination = new Element();
  link.hash = "#biografia";
  link.closest = () => link;
  nav.append(link);
  const credits = new Element();
  credits.open = false;
  const summary = new Element();
  credits.append(summary);
  const creditLink = new Element();
  const media = { matches: isMobile, addEventListener(name, handler) { this.change = handler; } };
  const window = { location: { hash }, events: {}, matchMedia: () => media,
    addEventListener(name, handler) { this.events[name] = handler; } };
  const document = {
    get activeElement() { return focused; },
    querySelector: selector => ({ "#menu-toggle": toggle, "#nav-list": nav, "#creditos": credits })[selector],
    querySelectorAll: selector => selector === 'a[href="#creditos"]' ? [creditLink] : [],
    getElementById: id => id === "biografia" ? destination : null
  };
  focused = null;
  vm.runInNewContext(script, { document, window });
  return { toggle, nav, link, destination, credits, summary, creditLink, media, window };
}
check("Menú móvil: abre, cierra, Escape devuelve foco y selección enfoca destino", () => {
  const f = navigationFixture();
  assert.equal(f.toggle.hidden, false);
  assert.equal(f.nav.hidden, true);
  f.toggle.events.click();
  assert.equal(f.toggle.attrs["aria-expanded"], "true");
  assert.equal(f.nav.hidden, false);
  let prevented = false;
  f.nav.events.keydown({ key: "Escape", preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(f.nav.hidden, true);
  assert.equal(focused, f.toggle);
  f.toggle.events.click();
  f.nav.events.click({ target: f.link });
  assert.equal(f.nav.hidden, true);
  assert.equal(focused, f.destination);
  assert.equal(f.destination.attrs.tabindex, "-1");
  f.toggle.events.click();
  f.nav.events.click({ target: f.link, ctrlKey: true });
  assert.equal(f.nav.hidden, false);
});
check("Cambiar móvil/escritorio no deja foco en controles ocultos", () => {
  const f = navigationFixture("", false);
  assert.equal(f.nav.hidden, false);
  assert.equal(f.toggle.hidden, true);
  f.link.focus();
  f.media.matches = true;
  f.media.change();
  assert.equal(focused, f.toggle);
  assert.equal(f.nav.hidden, true);
  f.media.matches = false;
  f.media.change();
  assert.equal(focused, f.link);
  assert.equal(f.nav.hidden, false);
});
check("Créditos: URL directa, hashchange, clic repetido y clic modificado", () => {
  const f = navigationFixture("#creditos");
  assert.equal(f.credits.open, true);
  assert.equal(focused, null);
  f.credits.open = false;
  f.window.events.hashchange();
  assert.equal(f.credits.open, true);
  assert.equal(focused, f.summary);
  f.credits.open = false;
  f.creditLink.events.click({});
  assert.equal(f.credits.open, true);
  f.credits.open = false;
  f.creditLink.events.click({ metaKey: true });
  assert.equal(f.credits.open, false);
  const unrelated = navigationFixture("#biografia");
  unrelated.window.events.hashchange();
  assert.equal(unrelated.credits.open, false);
});

async function verifyHttp() {
  const resources = { "/index.html": "text/html", "/styles.css": "text/css", "/script.js": "text/javascript", "/observabilidad.html": "text/html", "/observabilidad.css": "text/css", "/observabilidad.js": "text/javascript" };
  const server = http.createServer((req, res) => {
    const resource = req.url === "/" ? "/index.html" : req.url;
    if (!Object.hasOwn(resources, resource)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": `${resources[resource]}; charset=utf-8` });
    res.end(fs.readFileSync(path.join(root, resource.slice(1))));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [resource, mime] of Object.entries(resources)) {
      const response = await fetch(base + resource);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), `${mime}; charset=utf-8`);
      assert.equal(await response.text(), fs.readFileSync(path.join(root, resource.slice(1)), "utf8"));
    }
    check("HTTP local: HTML, CSS y JS responden 200 con contenido y MIME correctos", () => {});
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  console.log(`\n${checks} grupos de comprobaciones aprobados. Sin dependencias externas.`);
  console.log("Pendiente: navegador real, consola, red externa, desplazamiento, foco visual, Enter/Espacio nativos y lector de pantalla.");
}
verifyHttp().catch(error => { console.error(error); process.exitCode = 1; });
