"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { verifyDeployment } = require("../tools/verify-deployment.cjs");
const { files } = require("../tools/build.cjs");
const content = Buffer.from("CR7: prueba de publicación\n");
const response = (status = 200, data = content) => new Response(data, { status });
function setup(overrides = {}) {
  const calls = new Map();
  const waits = [];
  const logs = [];
  return {
    calls, waits, logs,
    options: {
      siteUrl: "https://example.com/ejemplo1",
      attempts: 3,
      readExpected: () => content,
      sleep: async ms => { waits.push(ms); },
      log: text => logs.push(text),
      fetchImpl: async (url, options) => {
        assert.ok(url.href.startsWith("https://example.com/ejemplo1/"));
        assert.equal(options.cache, "no-store");
        assert.equal(options.redirect, "error");
        assert.ok(options.signal instanceof AbortSignal);
        const file = url.pathname.split("/").at(-1);
        const attempt = (calls.get(file) || 0) + 1;
        calls.set(file, attempt);
        return overrides.respond ? overrides.respond(file, attempt) : response();
      }
    }
  };
}
test("Se comprueban los seis archivos bajo la ruta del proyecto", async () => {
  const fixture = setup();
  await verifyDeployment(fixture.options);
  assert.deepEqual([...fixture.calls.keys()].sort(), files.slice().sort());
  assert.equal(fixture.waits.length, 0);
});
for (const failure of ["network", "timeout", "body", "404", "503", "stale"]) {
  test("Reintenta y se recupera de " + failure, async () => {
    const fixture = setup({ respond: (file, attempt) => {
      if (file !== "index.html" || attempt > 1) return response();
      if (failure === "network") throw new TypeError("fetch failed");
      if (failure === "timeout") throw new DOMException("timeout", "TimeoutError");
      if (failure === "body") return { status: 200, arrayBuffer: async () => { throw new Error("body interrupted"); } };
      if (failure === "stale") return response(200, "versión anterior");
      return response(Number(failure));
    } });
    await verifyDeployment(fixture.options);
    assert.equal(fixture.calls.get("index.html"), 2);
    assert.equal(fixture.waits.length, 1);
  });
}
for (const failure of ["network", "404", "stale"]) {
  test("Falla al agotar los intentos por " + failure, async () => {
    const fixture = setup({ respond: file => {
      if (file !== "index.html") return response();
      if (failure === "network") throw new TypeError("fetch failed");
      return failure === "404" ? response(404) : response(200, "distinto");
    } });
    await assert.rejects(verifyDeployment(fixture.options), /index.html.*3 intentos/);
    assert.equal(fixture.calls.get("index.html"), 3);
    assert.equal(fixture.waits.length, 2, "Sin espera inútil después del último intento");
  });
}
test("Compara bytes: no acepta binarios distintos que se decodifican igual", async () => {
  const fixture = setup({ respond: () => response(200, Buffer.from([0xfe])) });
  fixture.options.readExpected = () => Buffer.from([0xff]);
  fixture.options.attempts = 1;
  await assert.rejects(verifyDeployment(fixture.options), /Contenido diferente/);
});
test("Rechaza URL HTTP y credenciales antes de solicitar archivos", async () => {
  for (const siteUrl of ["http://example.com/", "https://usuario:clave@example.com/"]) {
    const fixture = setup();
    await assert.rejects(verifyDeployment({ ...fixture.options, siteUrl }));
    assert.equal(fixture.calls.size, 0);
  }
});