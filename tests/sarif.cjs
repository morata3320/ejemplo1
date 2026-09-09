"use strict";
const assert = require("node:assert/strict");
const { checkReport } = require("../tools/check-sarif.cjs");
const valid = () => ({ version: "2.1.0", runs: [{ tool: { driver: { name: "CodeQL" } }, results: [] }] });
assert.doesNotThrow(() => checkReport(valid()));
for (const level of ["error", "warning", "note"]) {
  const report = valid();
  report.runs[0].results.push({ level, ruleId: "test-rule" });
  assert.throws(() => checkReport(report));
}
for (const malformed of [{}, { version: "2.1.0", runs: [] }, { version: "2.1.0", runs: [{}] }]) {
  assert.throws(() => checkReport(malformed));
}
const failed = valid();
failed.runs[0].invocations = [{ executionSuccessful: false }];
assert.throws(() => checkReport(failed));
console.log("OK: puerta SARIF acepta informe limpio y bloquea hallazgos, informes incompletos y análisis fallidos.");