"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { files } = require("./build.cjs");

async function verifyDeployment({
  siteUrl = process.env.SITE_URL,
  fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  readExpected = file => fs.readFileSync(path.join(__dirname, "..", ".site", file)),
  attempts = 12,
  delayMs = 5000,
  timeoutMs = 15000,
  log = console.log
} = {}) {
  const base = new URL(siteUrl);
  assert.equal(base.protocol, "https:", "SITE_URL debe usar HTTPS");
  assert.ok(!base.username && !base.password, "SITE_URL no debe contener credenciales");
  base.search = "";
  base.hash = "";
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  assert.ok(Number.isInteger(attempts) && attempts > 0 && attempts <= 12);
  const results = await Promise.allSettled(files.map(async file => {
    const expected = Buffer.from(readExpected(file));
    let reason = "Sin respuesta";
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await fetchImpl(new URL(file, base), {
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
          redirect: "error"
        });
        if (response.status !== 200) {
          reason = "HTTP " + response.status;
          await response.body?.cancel();
        } else {
          const actual = Buffer.from(await response.arrayBuffer());
          if (actual.equals(expected)) {
            log("Publicado y verificado: " + file);
            return;
          }
          reason = "Contenido diferente al artefacto";
        }
      } catch (error) {
        reason = "Fallo de red o lectura: " + (error.code || error.cause?.code || error.name || "Error");
      }
      log(file + ": intento " + attempt + "/" + attempts + " — " + reason);
      if (attempt < attempts) await sleep(delayMs);
    }
    throw new Error(file + ": verificación fallida tras " + attempts + " intentos. " + reason);
  }));
  const errors = results.filter(result => result.status === "rejected").map(result => result.reason);
  if (errors.length) throw new AggregateError(errors, errors.map(error => error.message).join("\n"));
}
if (require.main === module) {
  verifyDeployment().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { verifyDeployment };