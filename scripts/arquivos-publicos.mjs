export const ARQUIVOS_PUBLICOS = [
  '.gitignore', 'LICENSE', 'README.md', 'package.json', 'package-lock.json', 'eslint.config.mjs',
  'Instalar.cmd', 'scripts/instalar-desktop.mjs',
  'testes/instalador.test.mjs',
  'assets/logo-verde.png', 'assets/icone-128.png', 'docs/specs/contrato-publico.md',
  'docs/licencas/cfworker-LICENSE.md', 'docs/licencas/cfworker-THIRD_PARTY_NOTICES.md',
  'migracoes/0001_rascunhos.sql', 'skills/usar-painel-preservando-chat/SKILL.md', 'web/painel.html',
  'src/aplicativo.mjs', 'src/armazenamento-desktop.mjs', 'src/entregas.mjs', 'src/exemplo.mjs',
  'src/formulario.mjs', 'src/inline.mjs', 'src/interface.mjs', 'src/exibicao.mjs', 'src/limites.mjs', 'src/repositorio.mjs',
  'src/servidor.mjs', 'src/servidor-desktop.mjs',
  'scripts/arquivos-publicos.mjs', 'scripts/auditar-publicacao.mjs', 'scripts/avisos-terceiros.mjs',
  'scripts/banco-local.mjs', 'scripts/configuracao-mcp.mjs', 'scripts/construir.mjs',
  'scripts/empacotar-desktop.mjs', 'scripts/preparar-publicacao.mjs', 'scripts/servidor-local.mjs', 'scripts/verificar-desktop.mjs',
  'testes/apoio-dom.mjs', 'testes/armazenamento-desktop.test.mjs', 'testes/entregas.test.mjs',
  'testes/formulario.test.mjs', 'testes/interface.test.mjs', 'testes/exibicao.test.mjs', 'testes/aplicativo.test.mjs', 'testes/mcp.test.mjs',
  'testes/limites-desktop.test.mjs', 'testes/publicacao.test.mjs', 'testes/atomicidade.test.mjs'
];

export const ARQUIVOS_GERADOS = [
  '.agents/plugins/marketplace.json',
  ...['plugin.json', 'mcp.json', '.mcp.json', '.codex-plugin/plugin.json', 'server/servidor.mjs', 'dist/web/painel.html',
    'migracoes/0001_rascunhos.sql', 'skills/usar-painel-preservando-chat/SKILL.md', 'assets/logo-verde.png', 'assets/icone-128.png',
    'LICENSE', 'THIRD_PARTY_NOTICES.txt'].map(arquivo => 'plugins/perguntas-decisoes/' + arquivo),
  'dist/server/index.js', 'dist/web/painel.html', 'dist/web/inline.html', 'pacote/.agents/plugins/marketplace.json',
  ...['plugin.json', 'mcp.json', '.mcp.json', '.codex-plugin/plugin.json', 'server/servidor.mjs', 'dist/web/painel.html',
    'migracoes/0001_rascunhos.sql', 'skills/usar-painel-preservando-chat/SKILL.md', 'assets/logo-verde.png', 'assets/icone-128.png',
    'LICENSE', 'THIRD_PARTY_NOTICES.txt'].map(arquivo => 'pacote/plugins/perguntas-decisoes/' + arquivo)
];
