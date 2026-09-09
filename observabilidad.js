"use strict";

// Recolector compartido. No usa fetch, XHR, sendBeacon ni servicios externos.
(() => {
  if (window.CR7Observability) return;
  const KEY = "cr7-observability:v1";
  const MAX_EVENTS = 200;
  const MAX_NAVIGATIONS = 30;
  let memory = emptyState();
  let persistent = true;
  let storageMessage = "Disponible";
  let storage;
  const page = short(window.location.pathname || "página", 200);

  function emptyState() { return { version: 1, events: [], navigations: [] }; }
  function short(value, limit = 300) {
    try { return String(value == null ? "" : value).slice(0, limit); }
    catch { return "No disponible"; }
  }
  function readSafely(getter, fallback = null) {
    try { const value = getter(); return value === undefined ? fallback : value; }
    catch { return fallback; }
  }
  function disableStorage() {
    persistent = false;
    storageMessage = "Solo memoria: almacenamiento bloqueado, lleno o no disponible.";
  }
  try { storage = window.localStorage; if (!storage) disableStorage(); }
  catch { disableStorage(); }

  // Validar también los datos existentes: localStorage puede editarse o estar corrupto.
  function readState() {
    if (!persistent) return memory;
    try {
      const raw = storage.getItem(KEY);
      if (!raw) { memory = emptyState(); return memory; }
      if (raw.length > 1000000) throw new SyntaxError("Registro demasiado grande");
      const state = JSON.parse(raw);
      if (!state || state.version !== 1 || !Array.isArray(state.events) || !Array.isArray(state.navigations)) {
        throw new SyntaxError("Formato desconocido");
      }
      memory = {
        version: 1,
        events: state.events.filter(e => e && typeof e.type === "string" && typeof e.at === "string").slice(-MAX_EVENTS),
        navigations: state.navigations.filter(n => n && typeof n.at === "string" && typeof n.page === "string").slice(-MAX_NAVIGATIONS)
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        memory = emptyState();
        storageMessage = "Se descartó un registro local corrupto o incompatible.";
      } else { disableStorage(); }
    }
    return memory;
  }
  function persist(state) {
    memory = state;
    if (persistent) {
      try { storage.setItem(KEY, JSON.stringify(state)); }
      catch { disableStorage(); }
    }
  }
  function record(type, details = {}) {
    const state = readState();
    state.events.push({ at: new Date().toISOString(), page, type, details });
    state.events = state.events.slice(-MAX_EVENTS);
    persist(state);
  }
  function environment() {
    const nav = window.navigator || {};
    const connection = readSafely(() => nav.connection || nav.mozConnection || nav.webkitConnection);
    const perf = readSafely(() => window.performance);
    return {
      viewport: { width: readSafely(() => window.innerWidth), height: readSafely(() => window.innerHeight), pixelRatio: readSafely(() => window.devicePixelRatio) },
      visibility: document.visibilityState || "no disponible",
      connection: {
        online: typeof nav.onLine === "boolean" ? nav.onLine : null,
        effectiveType: readSafely(() => connection.effectiveType),
        downlinkMbps: readSafely(() => connection.downlink),
        rttMs: readSafely(() => connection.rtt),
        saveData: readSafely(() => connection.saveData)
      },
      apis: {
        localStorage: Boolean(storage), performance: Boolean(perf),
        navigationTiming: Boolean(perf && typeof perf.getEntriesByType === "function"),
        performanceObserver: typeof window.PerformanceObserver === "function",
        networkInformation: Boolean(connection), visibility: "visibilityState" in document,
        matchMedia: typeof window.matchMedia === "function",
        download: typeof window.Blob === "function" && Boolean(window.URL && typeof window.URL.createObjectURL === "function" && typeof window.URL.revokeObjectURL === "function") && "download" in document.createElement("a")
      }
    };
  }
  function snapshot() {
    const state = readState();
    // Copia profunda: el consumidor no puede mutar el registro interno.
    return JSON.parse(JSON.stringify({
      ...state, generatedAt: new Date().toISOString(), environment: environment(),
      storage: { key: KEY, persistent, message: storageMessage, maxEvents: MAX_EVENTS, maxNavigations: MAX_NAVIGATIONS }
    }));
  }
  function clear() {
    memory = emptyState();
    if (storage) {
      try { storage.removeItem(KEY); persistent = true; storageMessage = "Registro local eliminado."; }
      catch { disableStorage(); }
    }
    return snapshot();
  }
  const demo = () => record("demostracion", { message: "Evento de prueba generado localmente; no es un error real." });
  window.CR7Observability = Object.freeze({ getSnapshot: snapshot, clear, demo });

  function resourcePath(value) {
    // No guardar consultas, fragmentos ni credenciales en las rutas.
    try { const url = new window.URL(value, window.location.href); return short(url.protocol === "http:" || url.protocol === "https:" ? url.origin + url.pathname : url.protocol, 250); }
    catch { return "Ruta no disponible"; }
  }
  window.addEventListener("error", event => {
    const target = event.target;
    if (target && target !== window && target.tagName) {
      record("error-recurso", { tag: short(target.tagName, 30), resource: resourcePath(target.currentSrc || target.src || target.href || "") });
    } else {
      record("error-javascript", { message: short(event.message), file: resourcePath(event.filename || ""), line: event.lineno || null, column: event.colno || null });
    }
  }, true);
  window.addEventListener("unhandledrejection", event => {
    record("promesa-rechazada", { message: short(readSafely(() => event.reason.message, event.reason)) });
  });
  document.addEventListener("click", event => {
    const target = event.target && typeof event.target.closest === "function" ? event.target : null;
    if (!target || target.closest("[data-observability-ignore]")) return;
    const control = target.closest("a, button, summary, input, select, textarea, [role='button'], [role='tab']");
    if (!control) return;
    record("clic", {
      tag: short(control.tagName, 30), id: short(control.id, 80),
      label: short(control.getAttribute("aria-label") || control.getAttribute("name") || (control.matches("input, select, textarea") ? "Control de formulario" : control.textContent.trim()), 120),
      destination: control.tagName === "A" ? resourcePath(control.href) : null
    });
  }, true);
  document.addEventListener("visibilitychange", () => record("visibilidad", { state: document.visibilityState || "no disponible" }));
  window.addEventListener("online", () => record("conexion", environment().connection));
  window.addEventListener("offline", () => record("conexion", environment().connection));
  const connection = readSafely(() => window.navigator.connection || window.navigator.mozConnection || window.navigator.webkitConnection);
  if (connection && typeof connection.addEventListener === "function") connection.addEventListener("change", () => record("conexion", environment().connection));
  let resizeTimer;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => record("viewport", environment().viewport), 250);
  });

  function measureNavigation() {
    const perf = readSafely(() => window.performance);
    const entry = readSafely(() => perf.getEntriesByType("navigation")[0]);
    const legacy = readSafely(() => perf.timing);
    const base = entry ? (entry.startTime || 0) : legacy && legacy.navigationStart;
    const timing = entry || legacy;
    function elapsed(field) {
      const value = readSafely(() => timing[field]);
      return typeof value === "number" && value > 0 && typeof base === "number" ? Math.max(0, Math.round((value - base) * 100) / 100) : null;
    }
    const state = readState();
    state.navigations.push({ at: new Date().toISOString(), page,
      source: entry ? "navigation" : legacy ? "timing-legacy" : "no disponible",
      responseStartMs: elapsed("responseStart"), domReadyMs: elapsed("domContentLoadedEventEnd"), loadMs: elapsed("loadEventEnd")
    });
    state.navigations = state.navigations.slice(-MAX_NAVIGATIONS);
    persist(state);
  }
  // La siguiente tarea permite que loadEventEnd esté disponible tras el evento load.
  if (document.readyState === "complete") window.setTimeout(measureNavigation, 0);
  else window.addEventListener("load", () => window.setTimeout(measureNavigation, 0), { once: true });
  record("entorno", environment());

  function initDashboard() {
    if (!document.querySelector("[data-observability-dashboard]")) return;
    const $ = id => document.getElementById(id);
    const labels = { "error-recurso": "Error de recurso", "error-javascript": "Error JavaScript", "promesa-rechazada": "Promesa rechazada", clic: "Clic", visibilidad: "Visibilidad", entorno: "Entorno", viewport: "Viewport", conexion: "Conexión", demostracion: "Demostración" };
    function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
    function render(message) {
      const data = snapshot();
      $("event-count").textContent = data.events.length;
      $("error-count").textContent = data.events.filter(event => ["error-recurso", "error-javascript", "promesa-rechazada"].includes(event.type)).length;
      $("navigation-count").textContent = data.navigations.length;
      $("storage-status").textContent = `${data.storage.persistent ? "localStorage" : "Memoria temporal"}: ${data.storage.message}`;
      $("timing-rows").textContent = "";
      data.navigations.slice().reverse().forEach(navigation => {
        const row = document.createElement("tr");
        [navigation.at, navigation.page, navigation.responseStartMs, navigation.domReadyMs, navigation.loadMs].forEach(value => row.append(element("td", value == null ? "No disponible" : String(value))));
        $("timing-rows").append(row);
      });
      if (!data.navigations.length) { const row = document.createElement("tr"); const cell = element("td", "Todavía no hay mediciones. Actualiza después de completar la carga."); cell.colSpan = 5; row.append(cell); $("timing-rows").append(row); }
      $("environment").textContent = "";
      for (const [label, value] of [["Viewport", data.environment.viewport], ["Conexión", data.environment.connection], ["Soporte de APIs", data.environment.apis], ["Visibilidad", data.environment.visibility]]) {
        const group = document.createElement("div"); group.append(element("dt", label), element("dd", JSON.stringify(value))); $("environment").append(group);
      }
      $("events").textContent = "";
      data.events.slice().reverse().forEach(event => {
        const item = document.createElement("li");
        const time = element("time", event.at); time.dateTime = event.at;
        item.append(element("strong", labels[event.type] || short(event.type)), time, element("p", short(event.page)), element("pre", JSON.stringify(event.details, null, 2)));
        $("events").append(item);
      });
      $("empty-events").hidden = data.events.length !== 0;
      $("status").textContent = `${message} Consulta: ${new Date().toLocaleTimeString("es")}.`;
    }
    $("refresh").addEventListener("click", () => render("Datos actualizados."));
    $("demo").addEventListener("click", () => { demo(); render("Evento de demostración guardado."); });
    $("clear").addEventListener("click", () => {
      clear();
      render(persistent ? "Registro eliminado. Las nuevas interacciones volverán a registrarse." : "Memoria vaciada. No se pudo garantizar el borrado del almacenamiento del navegador.");
    });
    $("download").addEventListener("click", () => {
      let url;
      let anchor;
      try {
        const blob = new window.Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" });
        url = window.URL.createObjectURL(blob);
        anchor = document.createElement("a"); anchor.href = url;
        anchor.download = `cr7-observability-${Date.now()}.json`;
        anchor.setAttribute("data-observability-ignore", "");
        document.body.append(anchor); anchor.click();
        $("status").textContent = "Descarga JSON solicitada al navegador.";
      } catch { $("status").textContent = "El navegador no pudo iniciar la descarga."; }
      finally {
        if (anchor) anchor.remove();
        if (url) window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      }
    });
    ["refresh", "demo", "clear"].forEach(id => { $(id).disabled = false; });
    $("download").disabled = !environment().apis.download;
    render($("download").disabled ? "Panel listo. Descarga no disponible en este navegador." : "Panel listo.");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initDashboard, { once: true });
  else initDashboard();
})();
