import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { OpenAIUiToolMetadataSchema } from '@openai/mcp-extensions/server';
import { configuracaoMcp } from './configuracao-mcp.mjs';

const raiz = new URL('../', import.meta.url);
const raizPacote = process.env.PERGUNTAS_PACOTE_INSTALADO ?? fileURLToPath(new URL('pacote/plugins/perguntas-decisoes/', raiz));
const manifesto = JSON.parse(await readFile(join(raizPacote, 'plugin.json'), 'utf8'));
const caminhoDados = fileURLToPath(new URL(`.local/verificacao/${crypto.randomUUID()}/`, raiz));
await mkdir(caminhoDados, { recursive: true });
const configuracao = await configuracaoMcp(raizPacote, { diretorioDados: caminhoDados });
async function conectar() {
  const transporte = new StdioClientTransport({ ...configuracao, env: { ...process.env, PERGUNTAS_DIRETORIO_DADOS: caminhoDados }, stderr: 'pipe' });
  let diagnostico = '';
  transporte.stderr?.on('data', parte => { diagnostico += parte.toString(); });
  const cliente = new Client({ name: 'verificacao-desktop', version: '1.0.0' });
  try { await cliente.connect(transporte); }
  catch (erro) { await transporte.close(); throw new Error(`${erro.message}\n${diagnostico}`); }
  return cliente;
}
let cliente = await conectar();
try {
  assert.equal(cliente.getServerVersion().version, manifesto.version, 'Versão do servidor diferente do manifesto.');
  const ferramentas = await cliente.listTools();
  const visiveis = ferramentas.tools.filter(ferramenta => ferramenta._meta?.ui?.visibility?.[0] !== 'app');
  assert.equal(visiveis.length, 2);
  const abertura = ferramentas.tools.find(ferramenta => ferramenta.name === 'abrir_painel');
  assert.equal(abertura.title, 'Perguntas e decisões');
  assert.equal(abertura._meta.ui.resourceUri, 'ui://perguntas-decisoes/painel');
  const metadados = OpenAIUiToolMetadataSchema.parse(abertura._meta['openai/ui']);
  assert.ok(metadados.entrypoints.some(item => item.type === 'thread'));
  const painelVazio = await cliente.callTool({ name: 'abrir_painel', arguments: {} });
  assert.deepEqual(painelVazio._meta.pendentes, []);
  const criado = await cliente.callTool({ name: 'criar_formulario', arguments: { titulo: 'Integração local — verificação', perguntas: [{ texto: 'O formulário local abre?', tipo: 'sim_nao' }] } });
  assert.equal(criado.isError, undefined);
  const id = criado.structuredContent.id;
  const leitura = await cliente.readResource({ uri: 'ui://perguntas-decisoes/painel' });
  assert.equal(leitura.contents[0].mimeType, 'text/html;profile=mcp-app');
  assert.ok(leitura.contents[0].text.includes('perguntas-decisoes-app'));
  assert.ok(leitura.contents[0].text.includes(manifesto.version), 'A interface não contém a versão atual do pacote.');
  const salvo = await cliente.callTool({ name: 'salvar_rascunho', arguments: { id, versao: criado._meta.versao, rascunho: { respostas: { p1: 'Não' }, observacoes: { p1: 'Comentário da verificação local.' } } } });
  assert.equal(salvo.isError, undefined);
  await cliente.close();
  cliente = await conectar();
  const reaberto = await cliente.callTool({ name: 'ler_formulario', arguments: { id } });
  assert.equal(reaberto._meta.rascunho.respostas.p1, 'Não');
  assert.equal(reaberto._meta.rascunho.observacoes.p1, 'Comentário da verificação local.');
  const painelReaberto = await cliente.callTool({ name: 'abrir_painel', arguments: {} });
  assert.ok(painelReaberto._meta.pendentes.some(item => item.id === id));
  const rascunho = reaberto._meta.rascunho;
  const chave = crypto.randomUUID();
  const preparado = await cliente.callTool({ name: 'preparar_entrega', arguments: { id, versao: reaberto._meta.versao, rascunho, idempotencia: chave } });
  assert.equal(preparado._meta.entrega.token, chave);
  const retomado = await cliente.callTool({ name: 'retomar_edicao', arguments: { id, token: chave } });
  assert.equal(retomado.isError, undefined);
  const preparadoNovamente = await cliente.callTool({ name: 'preparar_entrega', arguments: { id, versao: retomado._meta.versao, rascunho } });
  await cliente.callTool({ name: 'confirmar_entrega', arguments: { id, token: preparadoNovamente._meta.entrega.token } });
  const lote = await cliente.callTool({ name: 'criar_formulario', arguments: { titulo: 'Lote fictício de conferência', perguntas: Array.from({ length: 50 }, (_, i) => 'Item ' + (i + 1)), tipo: 'unica', opcoes: ['Aprovar', 'Ajustar'] } });
  assert.equal(lote.structuredContent.total, 50);
  const listaPrivada = await cliente.callTool({ name: 'listar_pendentes', arguments: {} });
  assert.ok(listaPrivada._meta.pendentes.some(item => item.id === lote.structuredContent.id));
  const preenchimentoLote = { respostas: Object.fromEntries(Array.from({ length: 50 }, (_, i) => ['p' + (i + 1), 'Aprovar'])) };
  const entregaLote = await cliente.callTool({ name: 'preparar_entrega', arguments: { id: lote.structuredContent.id, versao: 1, rascunho: preenchimentoLote } });
  await cliente.callTool({ name: 'confirmar_entrega', arguments: { id: lote.structuredContent.id, token: entregaLote._meta.entrega.token } });
  assert.deepEqual((await cliente.callTool({ name: 'abrir_painel', arguments: {} }))._meta.pendentes, []);
  const resultado = { data: new Date().toISOString(), transporte: 'stdio', pacote: manifesto.version, comandoDoManifesto: configuracao.command, ferramentasVisiveis: visiveis.length, ferramentasConferidas: ferramentas.tools.map(item => item.name), lote: 50, recursoInterface: 'text/html;profile=mcp-app', entradaPainelDeclarada: { titulo: abertura.title, tipo: 'thread', abreSemArgumentos: true }, persistenciaAposReiniciarProcessoDeTeste: true, limpezaRegistrosFicticios: true, entregasNaConversaTestadas: false, provaDesktopVisual: false, menuFerramentasComprovado: false };
  await mkdir(new URL('.local/diagnosticos/', raiz), { recursive: true });
  await writeFile(new URL('.local/diagnosticos/verificacao-desktop.json', raiz), JSON.stringify(resultado, null, 2));
  console.log('Processo local verificado: inicialização, duas ferramentas visíveis, recurso de interface e retomada após reiniciar.');
} finally { await cliente.close(); }
