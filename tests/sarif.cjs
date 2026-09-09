"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { checkReport, checkDirectory } = require("../tools/check-sarif.cjs");
const valid = () => ({ version: "2.1.0", runs: [{ tool: { driver: { name: "CodeQL" } }, results: [] }] });
test("Informe limpio válido con invocación explícita u omitida", () => {
  assert.doesNotThrow(() => checkReport(valid()));
  const report = valid();
  report.runs[0].invocations = [{ executionSuccessful: true }];
  assert.doesNotThrow(() => checkReport(report));
});
test("Bloquea todos los niveles de hallazgos", () => {
  for (const level of ["error", "warning", "note"]) {
    const report = valid();
    report.runs[0].results.push({ level, ruleId: "test-rule" });
    assert.throws(() => checkReport(report), /hallazgos/);
  }
});
test("Bloquea informes e invocaciones inválidos", () => {
  for (const malformed of [null, {}, { version: "2.1.0", runs: [] }, { version: "2.1.0", runs: [{}] }]) {
    assert.throws(() => checkReport(malformed));
  }
  for (const invocations of [[{ executionSuccessful: false }], [{}], "invalid"]) {
    const report = valid();
    report.runs[0].invocations = invocations;
    assert.throws(() => checkReport(report));
  }
  const other = valid();
  other.runs[0].tool.driver.name = "Otro";
  assert.throws(() => checkReport(other));
});
function directory(contents, check) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cr7-sarif-test-"));
  try {
    for (const [file, report] of Object.entries(contents)) {
      fs.writeFileSync(path.join(dir, file), typeof report === "string" ? report : JSON.stringify(report));
    }
    check(dir);
  } finally {
    for (const file of Object.keys(contents)) fs.unlinkSync(path.join(dir, file));
    fs.rmdirSync(dir);
  }
}
test("Exige ambos informes, no basta uno limpio", () => {
  for (const contents of [{}, { "actions.sarif": valid() }, { "javascript.sarif": valid() }]) {
    directory(contents, dir => assert.throws(() => checkDirectory(dir), /Falta informe obligatorio/));
  }
  directory({ "actions.sarif": valid(), "javascript.sarif": valid() }, dir => assert.doesNotThrow(() => checkDirectory(dir)));
});
test("Bloquea JSON corrupto y también resultados en informes adicionales", () => {
  directory({ "actions.sarif": valid(), "javascript.sarif": "{" }, dir => {
    assert.throws(() => checkDirectory(dir), /javascript.sarif/);
  });
  const findings = valid();
  findings.runs[0].results.push({ ruleId: "test-rule" });
  directory({ "actions.sarif": valid(), "javascript.sarif": valid(), "extra.sarif": findings }, dir => {
    assert.throws(() => checkDirectory(dir), /extra.sarif/);
  });
});