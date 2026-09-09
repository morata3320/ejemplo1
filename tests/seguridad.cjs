"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
for (const file of ["script.js", "observabilidad.js"]) {
  const source = read(file);
  assert.ok(!/\b(?:eval|Function)\s*\(/.test(source), file + ": ejecución dinámica");
  assert.ok(!/\.(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/.test(source), file + ": inserción HTML insegura");
}
const collector = read("observabilidad.js").replace(/\/\/[^\n]*/g, "");
assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(collector), "El recolector no debe transmitir datos");
assert.ok(!/localStorage\.clear\s*\(/.test(collector), "No borrar almacenamiento ajeno");
for (const file of ["index.html", "observabilidad.html"]) {
  const html = read(file);
  assert.ok(!/\son\w+\s*=|(?:href|src)\s*=\s*["']\s*(?:javascript|vbscript):/i.test(html), file + ": código inline");
  for (const [tag] of html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)) {
    assert.match(tag, /^<script\s+src="[^":]+"(?:\s+defer)?>\s*<\/script>$/i, "Solo scripts locales sin código inline");
  }
  assert.ok(!/(?:src|href)=["']http:/i.test(html), "Recursos y enlaces externos deben usar HTTPS");
}
const tracked = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  new RegExp("gh[pousr]_" + "[A-Za-z0-9]{36,}"),
  new RegExp("github_pat_" + "[A-Za-z0-9_]{60,}"),
  new RegExp("AKIA" + "[A-Z0-9]{16}")
];
for (const file of new Set(tracked)) {
  assert.ok(!/(^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519)$|\.(?:p12|pfx|key)$/i.test(file), "Archivo sensible: " + file);
  const text = read(file);
  for (const pattern of secretPatterns) assert.ok(!pattern.test(text), "Posible secreto en " + file);
}
const workflow = read(".github/workflows/pages.yml");
for (const [, action] of workflow.matchAll(/uses:\s*(\S+)/g)) {
  assert.match(action, /^[\w./-]+@[a-f0-9]{40}$/, "Action sin commit fijo");
}
assert.ok(!/pull_request_target/.test(workflow));
assert.match(workflow, /needs: \[tests, codeql\]/);
console.log("OK: controles básicos de XSS, scripts locales, HTTPS, privacidad, secretos reconocibles y Actions fijadas.");