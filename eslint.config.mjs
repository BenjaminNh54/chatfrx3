const js = require('@eslint/js');
const globals = require('globals');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  {
    files: ['**/*.{js,cjs}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',         // permet la syntaxe CommonJS (require)
      globals: globals.node,       // ajoute require, module, exports, __dirname, etc.
    },
  },
]);