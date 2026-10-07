export default [{
  files: ['**/*.mjs'],
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    globals: Object.fromEntries(['document', 'window', 'globalThis', 'crypto', 'structuredClone', 'Headers', 'Request', 'Response', 'URL', 'FormData', 'Blob', 'TextEncoder', 'setTimeout', 'clearTimeout', 'console', 'process', 'Buffer'].map(nome => [nome, 'readonly']))
  },
  rules: { 'no-undef': 'error', 'no-unused-vars': 'error', 'no-unreachable': 'error', 'no-dupe-keys': 'error', 'no-constant-condition': 'error' }
}];
