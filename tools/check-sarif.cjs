"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
function checkReport(report) {
  assert.equal(report.version, "2.1.0", "Versión SARIF desconocida");
  assert.ok(Array.isArray(report.runs) && report.runs.length, "Faltan ejecuciones SARIF");
  for (const run of report.runs) {
    assert.ok(run.tool && run.tool.driver && run.tool.driver.name, "Falta el analizador");
    assert.ok(Array.isArray(run.results), "Faltan resultados");
    for (const invocation of run.invocations || []) {
      assert.notEqual(invocation.executionSuccessful, false, "El analizador falló");
    }
    assert.equal(run.results.length, 0, "CodeQL detectó hallazgos; revisar el análisis antes de publicar");
  }
}
function checkDirectory(dir) {
  const files = fs.readdirSync(dir).filter(file => file.endsWith(".sarif"));
  assert.ok(files.length, "No hay informes SARIF: se bloquea el despliegue");
  for (const file of files) {
    checkReport(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
    console.log("CodeQL sin hallazgos: " + file);
  }
}
if (require.main === module) checkDirectory(process.argv[2]);
module.exports = { checkReport, checkDirectory };