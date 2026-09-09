"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if ([".git", "node_modules", ".site", "sarif-results"].includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : /\.(?:js|cjs|mjs)$/.test(entry.name) ? [full] : [];
  });
}
for (const file of walk(root)) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit", cwd: root });
  console.log("Sintaxis OK: " + path.relative(root, file));
}
for (const file of ["tests/verificar.cjs", "tests/observabilidad.cjs", "tests/seguridad.cjs", "tests/sarif.cjs", "tests/despliegue.cjs", "tools/build.cjs"]) {
  execFileSync(process.execPath, [file], { stdio: "inherit", cwd: root });
}