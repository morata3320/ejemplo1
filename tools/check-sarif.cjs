"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const expectedReports = ["actions.sarif", "javascript.sarif"];
function checkReport(report) {
  assert.ok(report && typeof report === "object", "Informe SARIF inválido");
  assert.equal(report.version, "2.1.0", "Versión SARIF desconocida");
  assert.ok(Array.isArray(report.runs) && report.runs.length, "Faltan ejecuciones SARIF");
  for (const run of report.runs) {
    assert.equal(run?.tool?.driver?.name, "CodeQL", "El informe no pertenece a CodeQL");
    assert.ok(Array.isArray(run.results), "Faltan resultados");
    if (run.invocations !== undefined) {
      assert.ok(Array.isArray(run.invocations), "Invocaciones inválidas");
      for (const invocation of run.invocations) {
        assert.equal(invocation?.executionSuccessful, true, "El analizador no confirmó una ejecución correcta");
      }
    }
    for (const result of run.results) {
      const location = result.locations?.[0]?.physicalLocation;
      console.error(JSON.stringify({ rule: result.ruleId, message: result.message?.text, file: location?.artifactLocation?.uri, line: location?.region?.startLine }));
    }
    assert.equal(run.results.length, 0, "CodeQL detectó hallazgos; revisar el análisis antes de publicar");
  }
}
function checkDirectory(dir) {
  const reports = fs.readdirSync(dir).filter(file => file.endsWith(".sarif"));
  for (const file of expectedReports) {
    assert.ok(reports.includes(file), "Falta informe obligatorio de CodeQL: " + file);
  }
  const errors = [];
  for (const file of reports) {
    try {
      checkReport(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
      console.log("CodeQL sin hallazgos: " + file);
    } catch (error) {
      errors.push(new Error(file + ": " + error.message));
    }
  }
  if (errors.length) throw new AggregateError(errors, errors.map(error => error.message).join("\n"));
}
if (require.main === module) {
  try { checkDirectory(process.argv[2]); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { checkReport, checkDirectory };