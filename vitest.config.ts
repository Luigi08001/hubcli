import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for hscli.
 *
 * The one non-default setting is `testTimeout: 20_000`. The default is
 * 5 s, which is fine on a warm laptop but gets tripped by a handful of
 * tests (audit timeline scan, CLI global-flag parse) on slower CI
 * runners where the first cold `import("../src/cli.js")` plus a tmpdir
 * directory scan can add several seconds of latency before the
 * assertion window even opens.
 *
 * 20 s gives the slowest runners headroom without hiding real bugs —
 * any test legitimately taking that long would be a problem worth
 * investigating independently.
 */
export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
