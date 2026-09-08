"use strict";

// Ejecutar: node tests/observabilidad.cjs. Simula APIs; no sustituye pruebas de navegador.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "observabilidad.js"), "utf8");
const html = fs.readFileSync(path.join(root, "observabilidad.html"), "utf8");
const KEY = "cr7-observability:v1";
let passed = 0;
function test(name, run) { run(); console.log(`OK ${++passed}: ${name}`); }

class Target {
  constructor() { this.handlers = {}; }
  addEventListener(type, callback, options) {
    (this.handlers[type] ||= []).push({ callback, once: Boolean(options && options.once) });
  }
  emit(type, event = {}) {
    const list = this.handlers[type] || [];
    this.handlers[type] = list.filter(item => !item.once);
    list.forEach(item => item.callback(event));
  }
}
class Element extends Target {
  constructor(tag = "div") { super(); this.tagName = tag.toUpperCase(); this.attrs = {}; this.children = []; this.textContent = ""; this.id = ""; this.disabled = true; if (tag === "a") this.download = ""; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key] || null; }
  matches(selector) { return selector.split(", ").includes(this.tagName.toLowerCase()); }
  closest(selector) { return selector === "[data-observability-ignore]" ? (this.ignore ? this : null) : this; }
  click() { this.clicked = true; this.emit("click", {}); }
  remove() { this.removed = true; }
}
function setup(options = {}) {
  const store = options.store || new Map();
  const window = new Target();
  const document = new Target();
  const timers = new Map();
  let timerId = 0;
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], new Element()]));
  document.readyState = "loading";
  document.visibilityState = "visible";
  document.createElement = tag => new Element(tag);
  document.getElementById = id => elements[id];
  document.querySelector = () => options.dashboard ? elements.contenido : null;
  document.body = new Element("body");
  window.location = { pathname: "/index.html", href: "http://localhost:8080/index.html" };
  window.navigator = { onLine: true };
  window.innerWidth = 390; window.innerHeight = 844; window.devicePixelRatio = 2;
  window.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; };
  window.clearTimeout = id => timers.delete(id);
  const navigation = { startTime: 0, responseStart: 12, domContentLoadedEventEnd: 50, loadEventEnd: 0 };
  if (!options.noAPIs) {
    window.performance = options.legacy ? { timing: { navigationStart: 1000, responseStart: 1015, domContentLoadedEventEnd: 1080, loadEventEnd: 1200 } } : { getEntriesByType: () => [navigation] };
    window.navigator.connection = Object.assign(new Target(), { effectiveType: "4g", rtt: 50, downlink: 10, saveData: false });
    window.Blob = Blob;
    window.URL = class extends URL {
      static createObjectURL(blob) { window.downloadBlob = blob; return "blob:local-test"; }
      static revokeObjectURL(url) { window.revoked = url; }
    };
  }
  if (options.blocked) Object.defineProperty(window, "localStorage", { get() { throw new Error("SecurityError"); } });
  else window.localStorage = {
    getItem: key => store.get(key) || null,
    setItem(key, value) { if (options.quota) throw new Error("QuotaExceededError"); store.set(key, value); },
    removeItem(key) { store.delete(key); }
  };
  // Toda llamada de envío sería un fallo de la prueba.
  window.fetch = () => assert.fail("No debe enviar datos");
  window.XMLHttpRequest = () => assert.fail("No debe enviar datos");
  window.navigator.sendBeacon = () => assert.fail("No debe enviar datos");
  const context = { window, document };
  vm.runInNewContext(source, context);
  function flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(timer => timer.callback()); }
  return { window, document, store, elements, navigation, flush, api: window.CR7Observability, context };
}

test("Rutas locales, orden temprano del recolector y destinos internos del dashboard", () => {
  for (const text of [html, fs.readFileSync(path.join(root, "index.html"), "utf8")]) {
    for (const [, src] of text.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css|html))"/g)) assert.ok(fs.existsSync(path.join(root, src)), src);
    assert.ok(text.indexOf('src="observabilidad.js"') < text.indexOf('rel="stylesheet"'));
  }
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id));
  assert.match(html, /role="status"/);
  new vm.Script(source);
});
test("Persistencia local y snapshot independiente del estado interno", () => {
  const f = setup();
  assert.equal(f.api.getSnapshot().events[0].type, "entorno");
  const snap = f.api.getSnapshot(); snap.events.length = 0;
  assert.equal(f.api.getSnapshot().events.length, 1);
  assert.ok(f.store.has(KEY));
  assert.equal(f.api.getSnapshot().environment.viewport.width, 390);
  assert.equal(f.api.getSnapshot().environment.connection.effectiveType, "4g");
  vm.runInNewContext(source, f.context);
  assert.equal(f.api.getSnapshot().events.length, 1, "Inicialización idempotente");
});
test("Errores JS, promesas rechazadas y recursos; rutas sin consultas ni credenciales", () => {
  const f = setup();
  f.window.emit("error", { target: f.window, message: "Fallo controlado", filename: "http://usuario:clave@localhost/app.js?token=secreto#x", lineno: 9, colno: 2 });
  f.window.emit("unhandledrejection", { reason: new Error("Promesa de prueba") });
  f.window.emit("error", { target: { tagName: "IMG", src: "http://localhost/foto.jpg?secreto=1" } });
  const events = f.api.getSnapshot().events.slice(-3);
  assert.equal(events[0].type, "error-javascript");
  assert.equal(events[0].details.file, "http://localhost/app.js");
  assert.equal(events[1].details.message, "Promesa de prueba");
  assert.equal(events[2].type, "error-recurso");
  assert.equal(events[2].details.resource, "http://localhost/foto.jpg");
});
test("Clics y controles sin valores de formulario; acciones de gestión excluidas", () => {
  const f = setup();
  const input = new Element("input"); input.value = "privado";
  f.document.emit("click", { target: input });
  assert.equal(f.api.getSnapshot().events.at(-1).details.label, "Control de formulario");
  assert.ok(!JSON.stringify(f.api.getSnapshot()).includes("privado"));
  const button = new Element("button"); button.textContent = "Menú";
  f.document.emit("click", { target: button });
  assert.equal(f.api.getSnapshot().events.at(-1).details.label, "Menú");
  const count = f.api.getSnapshot().events.length;
  button.ignore = true; f.document.emit("click", { target: button });
  assert.equal(f.api.getSnapshot().events.length, count);
});
test("Visibilidad, conexión y redimensionado agrupado", () => {
  const f = setup();
  f.document.visibilityState = "hidden";
  f.document.emit("visibilitychange");
  assert.equal(f.api.getSnapshot().events.at(-1).details.state, "hidden");
  f.window.navigator.onLine = false; f.window.emit("offline");
  assert.equal(f.api.getSnapshot().events.at(-1).details.online, false);
  f.window.innerWidth = 320;
  f.window.emit("resize"); f.window.emit("resize"); f.flush();
  assert.equal(f.api.getSnapshot().events.filter(e => e.type === "viewport").length, 1);
  assert.equal(f.api.getSnapshot().events.at(-1).details.width, 320);
});
test("Performance API: lectura tras load y compatibilidad con timing antiguo", () => {
  const f = setup();
  f.window.emit("load"); f.navigation.loadEventEnd = 125.123; f.flush();
  const timing = f.api.getSnapshot().navigations[0];
  assert.equal(timing.loadMs, 125.12);
  assert.equal(timing.responseStartMs, 12);
  assert.equal(timing.domReadyMs, 50);
  const legacy = setup({ legacy: true }); legacy.window.emit("load"); legacy.flush();
  assert.equal(legacy.api.getSnapshot().navigations[0].loadMs, 200);
});
test("Sin APIs opcionales, sin localStorage y sin cuota: funciona en memoria", () => {
  for (const options of [{ noAPIs: true, blocked: true }, { quota: true }]) {
    const f = setup(options); f.api.demo(); f.window.emit("load"); f.flush();
    assert.equal(f.api.getSnapshot().storage.persistent, false);
    assert.equal(f.api.getSnapshot().events.at(-1).type, "demostracion");
    if (options.noAPIs) assert.equal(f.api.getSnapshot().navigations[0].loadMs, null);
    f.api.clear(); assert.equal(f.api.getSnapshot().events.length, 0);
  }
});
test("Recuperación de JSON corrupto y límites de 200 eventos / 30 navegaciones", () => {
  const store = new Map([[KEY, "{no es JSON"]]);
  let f = setup({ store });
  assert.match(f.api.getSnapshot().storage.message, /corrupto/);
  for (let i = 0; i < 220; i++) f.api.demo();
  assert.equal(f.api.getSnapshot().events.length, 200);
  for (let i = 0; i < 32; i++) { f = setup({ store }); f.navigation.loadEventEnd = 100; f.window.emit("load"); f.flush(); }
  assert.equal(f.api.getSnapshot().navigations.length, 30);
});
test("Limpiar elimina solo la clave propia y una pestaña no restaura datos antiguos", () => {
  const store = new Map([["otra-clave", "conservar"]]);
  const a = setup({ store }); const b = setup({ store });
  a.api.clear();
  assert.equal(store.get("otra-clave"), "conservar");
  assert.ok(!store.has(KEY));
  assert.equal(b.api.getSnapshot().events.length, 0);
  b.api.demo(); assert.equal(b.api.getSnapshot().events.length, 1);
});
test("Dashboard: actualizar, demostración, limpiar y descarga Blob local", () => {
  const f = setup({ dashboard: true });
  f.document.emit("DOMContentLoaded");
  assert.equal(f.elements.refresh.disabled, false);
  f.elements.demo.click(); assert.equal(f.api.getSnapshot().events.at(-1).type, "demostracion");
  f.elements.refresh.click(); assert.match(f.elements.status.textContent, /actualizados/);
  f.elements.download.click();
  assert.equal(f.window.downloadBlob.type, "application/json");
  assert.ok(f.document.body.children.at(-1).download.endsWith(".json"));
  f.flush(); assert.equal(f.window.revoked, "blob:local-test");
  f.elements.clear.click();
  assert.equal(f.api.getSnapshot().events.length, 0);
  assert.equal(f.elements["empty-events"].hidden, false);
  const unsupported = setup({ dashboard: true, noAPIs: true });
  unsupported.document.emit("DOMContentLoaded");
  assert.equal(unsupported.elements.download.disabled, true);
});
console.log(`\n${passed} grupos aprobados. Pendiente: ejecución y descargas en navegador real.`);
