// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

/**
 * Arkitekturgränser (se CLAUDE.md och src/features/README.md):
 *
 *   src/application/<layer>       layer = main | preload | renderer | ipc
 *   src/common/<layer>            layer = model | ipc | main | renderer
 *   src/features/<name>/<layer>   layer = model | ipc | main | renderer
 *   src/features/<name>/index.ts  publikt API för renderer-sidan
 *
 *   model, ipc  = rena, körs i båda processerna, inga electron/react/node-beroenden
 *   main        = node/electron main-process
 *   renderer    = React
 */

const el = (type, captured) => ({ element: captured ? { type, captured } : { type } });
/** Wrappar entitetsselektorer till `{ to: ... }` som allow/disallow kräver. */
const to = (...selectors) => selectors.map((selector) => ({ to: selector }));

const RENDERER_SIDE = [
  el('application', { layer: 'renderer' }),
  el('common', { layer: 'renderer' }),
  el('feature', { layer: 'renderer' }),
  el('feature-public'),
];
const MAIN_SIDE = [
  el('application', { layer: 'main' }),
  el('common', { layer: 'main' }),
  el('feature', { layer: 'main' }),
];
const PURE = [
  el('application', { layer: 'ipc' }),
  el('common', { layer: 'model' }),
  el('common', { layer: 'ipc' }),
  el('feature', { layer: 'model' }),
  el('feature', { layer: 'ipc' }),
];
const PRELOAD = [el('application', { layer: 'preload' })];

const ELECTRON = { module: { source: 'electron' } };
const NODE_CORE = { module: { origin: 'core' } };
const REACT = { module: { source: 'react|react-dom|react-dom/*' } };

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**', '.husky/**', 'demo/**'] },

  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },

  // React (renderer-sidan)
  {
    files: ['src/**/renderer/**/*.{ts,tsx}', 'src/features/*/index.ts'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Arkitekturgränser
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['tsconfig.node.json', 'tsconfig.web.json'],
          noWarnOnMultipleProjects: true,
        },
      },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        {
          type: 'feature',
          partialMatch: false,
          pattern: 'src/features/*/(model|ipc|main|renderer)',
          capture: ['feature', 'layer'],
        },
        // Filer direkt i feature-mappen (i praktiken index.ts). Måste ligga efter 'feature'.
        {
          type: 'feature-public',
          partialMatch: false,
          pattern: 'src/features/*',
          capture: ['feature'],
        },
        {
          type: 'common',
          partialMatch: false,
          pattern: 'src/common/(model|ipc|main|renderer)',
          capture: ['layer'],
        },
        {
          type: 'application',
          partialMatch: false,
          pattern: 'src/application/(main|preload|renderer|ipc)',
          capture: ['layer'],
        },
      ],
    },
    rules: {
      // Varje fil under src måste ligga i ett känt lager, och varje lokal import måste nå ett.
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',

      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          message:
            '{{ from.element.type }}/{{ from.element.captured.layer }} får inte importera {{ to.element.type }}/{{ to.element.captured.layer }}{{ to.module.source }}. Se CLAUDE.md.',
          policies: [
            // Externa paket är tillåtna om inget nedan säger annat
            { allow: to({ module: { origin: 'external' } }, NODE_CORE) },

            // Vem får importera vad (sista matchande regel vinner)
            { from: el('common'), allow: to(el('common')) },
            {
              from: el('feature'),
              allow: to(
                el('common'),
                el('feature', { feature: '{{ from.element.captured.feature }}' }),
                el('feature-public'),
              ),
            },
            {
              from: el('feature'),
              disallow: to(el('feature', { feature: '!{{ from.element.captured.feature }}' })),
              message:
                'En feature får bara nå en annan feature via dess index.ts (import från @/features/<namn>).',
            },
            {
              from: el('feature-public'),
              allow: to(el('feature', { feature: '{{ from.element.captured.feature }}' })),
            },
            {
              from: el('application'),
              allow: to(el('common'), el('feature'), el('feature-public'), el('application')),
            },

            // Processgränser
            { from: RENDERER_SIDE, disallow: to(...MAIN_SIDE, ...PRELOAD, ELECTRON, NODE_CORE) },
            { from: MAIN_SIDE, disallow: to(...RENDERER_SIDE, ...PRELOAD, REACT) },
            {
              from: PURE,
              disallow: to(...MAIN_SIDE, ...RENDERER_SIDE, ...PRELOAD, ELECTRON, NODE_CORE, REACT),
            },
            {
              from: PRELOAD,
              disallow: to(
                ...MAIN_SIDE,
                ...RENDERER_SIDE,
                el('feature'),
                el('application', { layer: 'ipc' }),
                REACT,
              ),
            },
          ],
        },
      ],
    },
  },

  // Konfigfiler i roten och skript: ingen typad lintning
  {
    files: ['*.js', '*.mjs', '*.ts', 'scripts/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Node-skript får använda node-globaler och console
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: { 'no-console': 'off' },
  },

  prettier,
);
