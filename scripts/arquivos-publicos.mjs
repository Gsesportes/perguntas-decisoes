export const ARQUIVOS_PUBLICOS = [
  '.gitignore', 'LICENSE', 'README.md', 'package.json', 'package-lock.json', 'eslint.config.mjs',
  'Instalar.cmd', 'scripts/instalar-desktop.mjs',
  'testes/instalador.test.mjs',
  'assets/logo-verde.png', 'assets/icone-128.png', 'docs/specs/contrato-publico.md',
  'docs/licencas/cfworker-LICENSE.md', 'docs/licencas/cfworker-THIRD_PARTY_NOTICES.md',
  'migracoes/0001_rascunhos.sql', 'skills/usar-painel-preservando-chat/SKILL.md', 'web/painel.html',
  'src/aplicativo.mjs', 'src/armazenamento-desktop.mjs', 'src/entregas.mjs', 'src/exemplo.mjs',
  'src/formulario.mjs', 'src/inline.mjs', 'src/interface.mjs', 'src/limites.mjs', 'src/repositorio.mjs',
  'src/servidor.mjs', 'src/servidor-desktop.mjs', 'src/ditado-desktop.mjs', 'src/ditado-interface.mjs', 'native/CapturaMicrofone.cs',
  'scripts/preparar-ditado.mjs', 'scripts/compilar-ditado.mjs', 'testes/ditado.test.mjs', 'docs/specs/ditado-nos-campos.md',
  'scripts/arquivos-publicos.mjs', 'scripts/auditar-publicacao.mjs', 'scripts/avisos-terceiros.mjs',
  'scripts/banco-local.mjs', 'scripts/configuracao-mcp.mjs', 'scripts/construir.mjs',
  'scripts/empacotar-desktop.mjs', 'scripts/preparar-publicacao.mjs', 'scripts/servidor-local.mjs', 'scripts/verificar-desktop.mjs',
  'testes/apoio-dom.mjs', 'testes/armazenamento-desktop.test.mjs', 'testes/entregas.test.mjs',
  'testes/formulario.test.mjs', 'testes/interface.test.mjs', 'testes/mcp.test.mjs',
  'testes/limites-desktop.test.mjs', 'testes/publicacao.test.mjs', 'testes/atomicidade.test.mjs',
  'src/erros.mjs', 'src/formatos.mjs', 'src/controles-formatos.mjs', 'src/imagens-desktop.mjs',
  'docs/specs/formatos-avancados.md', 'testes/formatos.test.mjs', 'testes/imagens.test.mjs',
  'src/icones-estrelas.mjs', 'docs/licencas/heroicons-LICENSE.md', 'src/versao.mjs',
  'src/conciliacao.mjs', 'testes/conciliacao.test.mjs',
  'src/copia.mjs', 'src/copia-desktop.mjs', 'src/exibicao.mjs',
  'testes/copia.test.mjs', 'testes/exibicao.test.mjs', 'testes/aplicativo.test.mjs',
  'docs/specs/copia-e-apresentacoes.md', 'testes/revisao-pr3.test.mjs'
];

export const ARQUIVOS_GERADOS = [
  'native/CapturaMicrofone.exe',
  '.agents/plugins/marketplace.json',
  ...['plugin.json', 'mcp.json', '.mcp.json', '.codex-plugin/plugin.json', 'server/servidor.mjs', 'server/preparar-ditado.mjs', 'native/CapturaMicrofone.exe', 'dist/web/painel.html',
    'migracoes/0001_rascunhos.sql', 'skills/usar-painel-preservando-chat/SKILL.md', 'assets/logo-verde.png', 'assets/icone-128.png',
    'LICENSE', 'THIRD_PARTY_NOTICES.txt'].map(arquivo => 'plugins/perguntas-decisoes/' + arquivo),
  'dist/server/index.js', 'dist/web/painel.html', 'dist/web/inline.html', 'pacote/.agents/plugins/marketplace.json',
  ...['plugin.json', 'mcp.json', '.mcp.json', '.codex-plugin/plugin.json', 'server/servidor.mjs', 'server/preparar-ditado.mjs', 'native/CapturaMicrofone.exe', 'dist/web/painel.html',
    'migracoes/0001_rascunhos.sql', 'skills/usar-painel-preservando-chat/SKILL.md', 'assets/logo-verde.png', 'assets/icone-128.png',
    'LICENSE', 'THIRD_PARTY_NOTICES.txt'].map(arquivo => 'pacote/plugins/perguntas-decisoes/' + arquivo)
];
