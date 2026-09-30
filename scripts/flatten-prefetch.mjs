// Post-build fix for the static export.
//
// Next.js writes each page's prefetch data as a nested file, e.g.
//   out/diary/__next.diary/__PAGE__.txt
// but the browser requests it under a flat, dotted name:
//   out/diary/__next.diary.__PAGE__.txt
// A Next.js server would translate between the two. GitHub Pages is a plain
// file host, so every prefetch 404s (harmless, but it costs a request and
// fills the console with errors). This script copies each nested file to its
// flat name as well.
import { copyFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = "out";
let copied = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith("__next.")) flatten(dir, full);
      else walk(full);
    }
  }
}

// dir/__next.a/b/__PAGE__.txt  →  dir/__next.a.b.__PAGE__.txt
function flatten(parent, nestedRoot) {
  const stack = [nestedRoot];
  while (stack.length) {
    const d = stack.pop();
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) stack.push(full);
      else {
        const flat = relative(parent, full).split(sep).join(".");
        copyFileSync(full, join(parent, flat));
        copied++;
      }
    }
  }
}

walk(OUT);
console.log(`flatten-prefetch: wrote ${copied} flat prefetch file(s)`);
