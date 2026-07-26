import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import endurance from './eslint-rules/endurance.js'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: { endurance },
    rules: {
      // Defects that review caught twice each — fixed, then rewritten into a new component the same
      // day. See eslint-rules/endurance.js for what each one is and why it exists.
      //
      // Both of these produce zero findings across src/ and both were verified to fire on the exact
      // code that motivated them, so they can block.
      'endurance/multi-child-control-needs-label': 'error',
      'endurance/no-interpolated-tailwind': 'error',
      //
      // `warn`, not `error`, and deliberately. It fires on 15 pre-existing sites — team names,
      // league names, championship names, all set in caps. Those are not accidents; they are the
      // broadcast register applied to entity names, and whether that is right for *user-generated*
      // text (a league someone named themselves, rendered as shouting) is a design call, not a lint
      // fix. Warning surfaces the pattern without failing a build over a decision nobody has made
      // yet. Promote it once that call is taken.
      'endurance/no-uppercase-data': 'warn',
    },
  },
])
