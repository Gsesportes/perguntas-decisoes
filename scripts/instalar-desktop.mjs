import { readdirSync, statSync, lstatSync, readFileSync, mkdirSync, mkdtempSync, renameSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ARQUIVOS_CATALOGO = [
  '.agents/plugins/marketplace.json',
  ...['plugin.json', 'mcp.json', '.mcp.json', '.codex-plugin/plugin.json', 'server/servidor.mjs', 'server/preparar-ditado.mjs', 'native/CapturaMicrofone.exe',
    'dist/web/painel.html', 'migracoes/0001_rascunhos.sql', 'skills/usar-painel-preservando-chat/SKILL.md',
    'assets/logo-verde.png', 'assets/icone-128.png', 'LICENSE', 'THIRD_PARTY_NOTICES.txt']
    .map(arquivo => 'plugins/perguntas-decisoes/' + arquivo)
];
function lerJson(arquivo) { return JSON.parse(readFileSync(arquivo, 'utf8')); }
function dentroDaPasta(raiz, arquivo) {
  const caminho = relative(resolve(raiz), resolve(arquivo));
  return !isAbsolute(caminho) && caminho !== '..' && !caminho.startsWith('..' + sep);
}
export function validarCatalogo(pasta) {
  const raiz = resolve(pasta);
  for (const arquivo of ARQUIVOS_CATALOGO) {
    const partes = arquivo.split('/');
    for (let i = 1; i <= partes.length; i += 1) if (lstatSync(join(raiz, ...partes.slice(0, i))).isSymbolicLink()) throw new Error('O pacote não pode conter links simbólicos.');
    const completo = join(raiz, arquivo);
    if (!dentroDaPasta(raiz, completo) || !statSync(completo).isFile() || !statSync(completo).size) throw new Error('Arquivo necessário ausente ou vazio: ' + arquivo);
  }
  const catalogo = lerJson(join(raiz, '.agents/plugins/marketplace.json'));
  const plugin = lerJson(join(raiz, 'plugins/perguntas-decisoes/plugin.json'));
  if (catalogo.name !== 'perguntas-decisoes-local' || plugin.name !== 'perguntas-decisoes' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(plugin.version)) throw new Error('A identidade ou versão do pacote é inválida.');
  if (catalogo.plugins?.length !== 1 || catalogo.plugins[0].source?.path !== './plugins/perguntas-decisoes') throw new Error('O catálogo não corresponde a este plugin.');
  for (const nome of ['mcp.json', '.mcp.json']) {
    const servidor = lerJson(join(raiz, 'plugins/perguntas-decisoes', nome)).mcpServers?.perguntas;
    if (servidor?.command !== 'node' || servidor.args?.length !== 1 || servidor.args[0] !== 'server/servidor.mjs' || servidor.cwd !== '.') throw new Error('O comando do pacote não corresponde ao servidor local esperado.');
  }
  return { raiz, versao: plugin.version };
}
export function prepararComponentesDesktop({ origem, diretorio }) {
  const catalogo = validarCatalogo(origem);
  const base = resolve(diretorio);
  if (existsSync(base) && (lstatSync(base).isSymbolicLink() || !statSync(base).isDirectory())) throw new Error('A pasta de componentes não é um diretório próprio válido.');
  mkdirSync(base, { recursive: true });
  const destino = join(base, catalogo.versao);
  const arquivos = ARQUIVOS_CATALOGO.filter(arquivo => arquivo.startsWith('plugins/perguntas-decisoes/')).map(arquivo => arquivo.slice('plugins/perguntas-decisoes/'.length));
  const marcador = '.componentes-perguntas.json';
  if (existsSync(destino)) {
    if (lstatSync(destino).isSymbolicLink() || !statSync(destino).isDirectory()) throw new Error('A versão de componentes não é um diretório válido.');
    const registro = join(destino, marcador);
    if (!existsSync(registro) || lstatSync(registro).isSymbolicLink()) throw new Error('A pasta de componentes existente não pertence a este instalador.');
    const identidade = lerJson(registro);
    if (identidade.nome !== 'perguntas-decisoes' || identidade.versao !== catalogo.versao) throw new Error('Identidade dos componentes existentes não confirmada.');
    for (const arquivo of arquivos) {
      const partes = arquivo.split('/');
      for (let i = 1; i <= partes.length; i += 1) if (lstatSync(join(destino, ...partes.slice(0, i))).isSymbolicLink()) throw new Error('Link simbólico inesperado nos componentes.');
      if (!readFileSync(join(destino, arquivo)).equals(readFileSync(join(catalogo.raiz, 'plugins/perguntas-decisoes', arquivo)))) throw new Error('Esta versão já possui conteúdo diferente. Gere uma nova versão; os componentes existentes foram preservados.');
    }
  } else {
    const preparo = mkdtempSync(join(base, '.preparo-'));
    for (const arquivo of arquivos) {
      const alvo = join(preparo, arquivo);
      mkdirSync(dirname(alvo), { recursive: true });
      copyFileSync(join(catalogo.raiz, 'plugins/perguntas-decisoes', arquivo), alvo);
    }
    writeFileSync(join(preparo, marcador), JSON.stringify({ nome: 'perguntas-decisoes', versao: catalogo.versao }, null, 2));
    renameSync(preparo, destino);
  }
  return { versao: catalogo.versao, servidor: join(destino, 'server/servidor.mjs'), arquivos: arquivos.length };
}
function acharMotor(pasta) {
  if (!existsSync(pasta)) throw new Error('O Codex desktop não foi encontrado. Instale o aplicativo antes de continuar.');
  const encontrados = [];
  for (const item of readdirSync(pasta, { withFileTypes: true })) {
    if (!item.isDirectory() || item.isSymbolicLink()) continue;
    const executavel = join(pasta, item.name, 'codex.exe');
    if (existsSync(executavel) && statSync(executavel).isFile()) encontrados.push(executavel);
  }
  encontrados.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!encontrados.length) throw new Error('A CLI do Codex desktop não foi encontrada.');
  const motor = encontrados[0];
  const versao = execFileSync(motor, ['--version'], { encoding: 'utf8', windowsHide: true }).trim();
  if (!versao.startsWith('codex-cli ')) throw new Error('O executável encontrado não corresponde à CLI do Codex.');
  execFileSync(motor, ['plugin', 'marketplace', 'add', '--help'], { stdio: 'pipe', windowsHide: true });
  return { motor, versao };
}
export function instalarDesktop({ raiz, verificar = false, ambiente = process.env } = {}) {
  if (process.platform !== 'win32') throw new Error('Este instalador é para Windows.');
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('É necessário Node.js 24 ou superior: https://nodejs.org/en/download');
  if (!ambiente.LOCALAPPDATA) throw new Error('A pasta local do perfil Windows não foi encontrada.');
  const pastaOrigem = existsSync(join(raiz, '.agents/plugins/marketplace.json')) ? raiz : join(raiz, 'pacote');
  const catalogo = validarCatalogo(pastaOrigem);
  const { motor, versao } = acharMotor(join(ambiente.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin'));
  const executarJson = args => JSON.parse(execFileSync(motor, args, { encoding: 'utf8', windowsHide: true }));
  const existentes = executarJson(['plugin', 'marketplace', 'list', '--json']).marketplaces;
  const destino = join(ambiente.LOCALAPPDATA, 'PerguntasDecisoes', 'catalogo');
  const existente = existentes?.find(item => item.name === 'perguntas-decisoes-local');
  if (existente && resolve(existente.root).toLowerCase() !== resolve(destino).toLowerCase()) throw new Error('Já existe um catálogo deste plugin em outra pasta. Para preservar essa instalação, use o fluxo de atualização do catálogo existente.');
  const marcador = join(destino, '.instalador-perguntas.json');
  if (existsSync(destino) && lstatSync(destino).isSymbolicLink()) throw new Error('A pasta de destino é um link simbólico. Nenhum arquivo foi substituído.');
  if (existsSync(destino) && (!existsSync(marcador) || lerJson(marcador).nome !== 'perguntas-decisoes')) throw new Error('A pasta de destino já existe e não foi criada por este instalador. Nenhum arquivo foi substituído.');
  const plano = { plugin: 'perguntas-decisoes', versao: catalogo.versao, node: process.versions.node, codex: versao, arquivos: ARQUIVOS_CATALOGO.length, verificarSomente: verificar };
  if (verificar) return plano;
  const componentes = prepararComponentesDesktop({ origem: catalogo.raiz, diretorio: join(ambiente.LOCALAPPDATA, 'PerguntasDecisoes', 'componentes') });
  mkdirSync(destino, { recursive: true });
  writeFileSync(marcador, JSON.stringify({ nome: 'perguntas-decisoes', versao: catalogo.versao }, null, 2));
  for (const arquivo of ARQUIVOS_CATALOGO) {
    const alvo = join(destino, arquivo);
    if (!dentroDaPasta(destino, alvo)) throw new Error('O arquivo saiu da pasta do catálogo.');
    const partes = arquivo.split('/');
    for (let i = 1; i < partes.length; i += 1) {
      const pasta = join(destino, ...partes.slice(0, i));
      if (existsSync(pasta) && lstatSync(pasta).isSymbolicLink()) throw new Error('Link simbólico inesperado na pasta de destino.');
    }
    if (existsSync(alvo) && lstatSync(alvo).isSymbolicLink()) throw new Error('Link simbólico inesperado no arquivo de destino.');
    mkdirSync(dirname(alvo), { recursive: true });
    copyFileSync(join(catalogo.raiz, arquivo), alvo);
  }
  const cadastro = executarJson(['plugin', 'marketplace', 'add', destino, '--json']);
  if (cadastro.name && cadastro.name !== 'perguntas-decisoes-local') throw new Error('O aplicativo registrou um catálogo diferente.');
  const instalacao = executarJson(['plugin', 'add', 'perguntas-decisoes@perguntas-decisoes-local', '--json']);
  if (instalacao.version !== catalogo.versao || !instalacao.installedPath) throw new Error('A versão instalada não foi confirmada pelo Codex.');
  const servidor = componentes.servidor;
  if (!existsSync(servidor)) throw new Error('O servidor instalado não foi encontrado.');
  execFileSync(motor, ['mcp', 'add', 'perguntas_decisoes_local', '--', process.execPath, servidor], { stdio: 'pipe', windowsHide: true });
  const vinculo = executarJson(['mcp', 'get', 'perguntas_decisoes_local', '--json']);
  if (!vinculo.enabled || vinculo.transport?.args?.[0] !== servidor) throw new Error('O vínculo local do servidor não foi confirmado.');
  return { ...plano, instalado: true, componentesPersistentes: true, conexaoAtivaVerificada: false, aplicativoReiniciado: false };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const raiz = fileURLToPath(new URL('../', import.meta.url));
    const resultado = instalarDesktop({ raiz, verificar: process.argv.includes('--verificar') });
    console.log(JSON.stringify(resultado, null, 2));
    if (resultado.instalado) console.log('Instalação registrada com componentes preservados fora do cache. Conexões já abertas podem continuar na versão anterior; a recarga depende do aplicativo e não foi confirmada pelo instalador.');
    else console.log('Requisitos conferidos. Nenhuma instalação ou configuração foi alterada.');
  } catch (erro) { console.error('Instalação não concluída: ' + erro.message); process.exitCode = 1; }
}
