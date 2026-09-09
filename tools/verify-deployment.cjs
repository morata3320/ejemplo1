"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { files } = require("./build.cjs");
async function verify() {
  const base = new URL(process.env.SITE_URL);
  assert.equal(base.protocol, "https:");
  for (const file of files) {
    const expected = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    let ok = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const response = await fetch(new URL(file, base), { signal: AbortSignal.timeout(15000), cache: "no-store" });
      if (response.ok && await response.text() === expected) { ok = true; break; }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.ok(ok, "El archivo publicado no coincide: " + file);
    console.log("Publicado y verificado: " + file);
  }
}
verify().catch(error => { console.error(error); process.exitCode = 1; });