#!/usr/bin/env node
/**
 * Walk `dist/` and emit SHA-256 checksums for every file into
 * `release/checksums.sha256`. Consumed by `npm run release:verify`
 * so a cold `shasum -a 256 -c release/checksums.sha256` can prove
 * the published tarball hasn't been tampered with between build
 * and publish.
 *
 * Re-run every release — the output is committed alongside the
 * version bump so CI can verify it.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const distDir = join(projectRoot, "dist");
const outDir = join(projectRoot, "release");
const outFile = join(outDir, "checksums.sha256");

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

if (!statSync(distDir, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error("dist directory not found. Run npm run build first.");
}

const files = walk(distDir).sort();
if (files.length === 0) {
  throw new Error("No distributable files found in dist/. Run npm run build first.");
}

const lines = files.map((file) => {
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
  return `${hash}  ${relative(projectRoot, file)}`;
});

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${files.length} checksums to ${relative(projectRoot, outFile)}`);
