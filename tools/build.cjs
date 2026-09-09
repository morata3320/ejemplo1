"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const files = ["index.html", "styles.css", "script.js", "observabilidad.html", "observabilidad.css", "observabilidad.js"];
function build() {
  const output = path.join(root, ".site");
  fs.mkdirSync(output, { recursive: true });
  assert.ok(fs.readdirSync(output).every(file => files.includes(file)), "El artefacto contiene archivos no autorizados");
  for (const file of files) {
    assert.ok(fs.lstatSync(path.join(root, file)).isFile(), "Solo archivos regulares: " + file);
    fs.copyFileSync(path.join(root, file), path.join(output, file));
  }
  assert.deepEqual(fs.readdirSync(output).sort(), files.slice().sort());
  console.log("Artefacto verificado: seis archivos públicos.");
}
if (require.main === module) build();
module.exports = { files, build };