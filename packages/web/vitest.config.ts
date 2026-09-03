import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: {
    fs: {
      allow: ['..'],
    },
  },
  test: {
    // Two projects, because `avatar-engine` cannot run under the settings the
    // rest of the workspace needs.
    //
    // This used to be one run: `dir: './packages'`, jsdom, and no `@character`
    // alias — which is declared only in `avatar-engine/vitest.config.ts`, a
    // file this run does not read. Twelve of that package's twenty-five test
    // files import their character config through `@character/*` and so failed
    // module resolution here with "Cannot find package
    // '@character/character.json'". Among them was `src/golden/record.test.ts`,
    // the only check anywhere that a checked-in golden still matches what the
    // recorder produces today.
    //
    // Copying the alias down here would fix the resolution and expose the rest:
    // that package's tests are `environment: "node"` tests. Under jsdom
    // `import.meta.url` is not a `file:` URL, so `deps.test.ts` dies reading
    // its own package.json, and the recorder — which replays 43MB scenarios —
    // runs slowly enough to blow the 5s default timeout. Naming the package's
    // own config as a project runs those tests under the settings their author
    // chose and their consumers build against, which is the whole point of a
    // package carrying a config at all.
    projects: [
      {
        extends: true,
        test: {
          name: 'web',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          dir: './packages',
          // Vitest's own defaults, which naming `exclude` at all would drop,
          // plus the package that runs as its own project below.
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/cypress/**',
            '**/.{idea,git,cache,output,temp}/**',
            '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
            // Relative to `dir` above, not to the workspace root.
            '**/avatar-engine/**',
          ],
        },
      },
      './packages/avatar-engine/vitest.config.ts',
    ],
  },
})
