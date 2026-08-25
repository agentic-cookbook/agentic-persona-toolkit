import { defineConfig } from 'vitest/config'

// Self-contained config so `pnpm --filter @agenticdevelopertoolkit/themes run test`
// (cwd = this package) discovers src/__tests__/* (the workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing —
// see the @agenticdevelopertoolkit/ui package for the same pattern). No test files
// exist yet for this package, so `passWithNoTests` keeps `test` green rather than
// failing on an empty suite.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../vitest.setup.ts'],
    dir: 'src',
    passWithNoTests: true,
  },
})
