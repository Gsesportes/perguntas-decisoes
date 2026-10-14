import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { atenderMcp, chamarFerramenta, FERRAMENTAS, URI_INTERFACE, URI_INTERFACE_LEGADA } from '../src/servidor.mjs';
import { bancoLocal } from '../scripts/banco-local.mjs';
import { OpenAIUiToolMetadataSchema } from '@openai/mcp-extensions/server';

test('Cliente oficial MCP inicializa, descobre ferramentas, abre interface e cria lote de 50', async () => {
  const DB = bancoLocal();
  const cliente = new Client({ name: 'verificacao-local', version: '1.0.0' });
  const transporte = new StreamableHTTPClientTransport(new URL('https://verificacao.local/mcp'), {
    fetch: async (url, opcoes) => {
      const request = new Request(url, opcoes);
      request.headers.set('oai-authenticated-user-id', 'perfil-teste');
      return atenderMcp(request, { DB }, '<div>Interface registrada</div>');
    }
  });
  try {
    await cliente.connect(transporte);
    const ferramentas = await cliente.listTools();
    assert.equal(ferramentas.tools.filter(item => item._meta?.ui?.visibility?.[0] !== 'app').length, 2);
    const abertura = ferramentas.tools.find(item => item.name === 'abrir_painel');
    assert.equal(abertura.title, 'Perguntas e decisões');
    assert.equal(abertura._meta.ui.resourceUri, URI_INTERFACE);
    const metadados = OpenAIUiToolMetadataSchema.parse(abertura._meta['openai/ui']);
    assert.ok(metadados.entrypoints.some(item => item.type === 'thread'));
    const painel = await cliente.callTool({ name: 'abrir_painel', arguments: {} });
    assert.deepEqual(painel._meta.pendentes, []);
    const resultado = await cliente.callTool({ name: 'criar_formulario', arguments: { perguntas: Array.from({ length: 50 }, (_, indice) => `Item ${indice + 1}`), tipo: 'unica', opcoes: ['Sim', 'Não'] } });
    assert.equal(resultado.structuredContent.total, 50);
    assert.deepEqual(Object.keys(resultado.structuredContent), ['id', 'total']);
    assert.equal(resultado._meta.formulario.perguntas.length, 50);
    assert.deepEqual(resultado.content, []);
    const recurso = await cliente.readResource({ uri: URI_INTERFACE });
    const recursos = await cliente.listResources(); assert.equal(recursos.resources[0].uri, URI_INTERFACE);
    const legado = await cliente.readResource({ uri: URI_INTERFACE_LEGADA });
    assert.notEqual(URI_INTERFACE, URI_INTERFACE_LEGADA); assert.equal(legado.contents[0].text, recurso.contents[0].text);
    assert.equal(recurso.contents[0].mimeType, 'text/html;profile=mcp-app');
    assert.deepEqual(recurso.contents[0]._meta['openai/ui'].availableDisplayModes, ['fullscreen']);
  } finally { await cliente.close(); DB.fechar(); }
});

test('Dados exigem identidade e formulários não atravessam usuários', async () => {
  const DB = bancoLocal();
  try {
    const resposta = await atenderMcp(new Request('https://teste.local/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'criar_formulario', arguments: { perguntas: ['A'] } } }) }), { DB }, 'Interface');
    assert.equal(resposta.status, 401);
    const criado = await chamarFerramenta('criar_formulario', { perguntas: ['A'] }, 'dono-a', DB);
    await assert.rejects(chamarFerramenta('ler_formulario', { id: criado.structuredContent.id }, 'dono-b', DB), /acesso não autorizado/);
  } finally { DB.fechar(); }
});

test('Campos obrigatórios e tipos incorretos são recusados antes de acessar o banco', async () => {
  const DB = bancoLocal();
  try {
    await assert.rejects(chamarFerramenta('ler_formulario', {}, 'dono', DB), /Identificador do formulário obrigatório/);
    await assert.rejects(chamarFerramenta('salvar_rascunho', { id: 'conferencia', rascunho: {} }, 'dono', DB), /Número de versão do rascunho obrigatório/);
    await assert.rejects(chamarFerramenta('salvar_rascunho', { id: 'conferencia', versao: '1', rascunho: {} }, 'dono', DB), /Parâmetros inválidos/);
    await assert.rejects(chamarFerramenta('ler_formulario', { id: 'conferencia', campoInventado: true }, 'dono', DB), /Parâmetros inválidos/);
    await assert.rejects(chamarFerramenta('abrir_painel', { id: '' }, 'dono', DB), /Identificador do formulário obrigatório/);
    assert.deepEqual((await chamarFerramenta('abrir_painel', {}, 'dono', DB))._meta.pendentes, []);
  } finally { DB.fechar(); }
});

test('Rascunho é reaberto, versões protegem janelas concorrentes e a entrega só limpa após confirmação', async () => {
  const DB = bancoLocal();
  const dono = 'perfil-teste';
  try {
    const criado = await chamarFerramenta('criar_formulario', { perguntas: [{ texto: 'Concorda?', tipo: 'sim_nao' }] }, dono, DB);
    const id = criado.structuredContent.id;
    const rascunho = { respostas: { p1: 'Não' }, observacoes: { p1: 'Ressalva preservada' }, gerais: '' };
    await chamarFerramenta('salvar_rascunho', { id, versao: 1, rascunho }, dono, DB);
    await assert.rejects(chamarFerramenta('salvar_rascunho', { id, versao: 1, rascunho }, dono, DB), /mudou/);
    const reaberto = await chamarFerramenta('ler_formulario', { id }, dono, DB);
    assert.equal(reaberto._meta.rascunho.respostas.p1, 'Não');
    const preparado = await chamarFerramenta('preparar_entrega', { id, versao: reaberto._meta.versao, rascunho }, dono, DB);
    assert.match(preparado._meta.entrega.texto, /Ressalva preservada/);
    await assert.rejects(chamarFerramenta('confirmar_entrega', { id, token: 'token-invalido' }, dono, DB), /Confirmação de entrega inválida/);
    assert.equal((await chamarFerramenta('ler_formulario', { id }, dono, DB)).structuredContent.id, id);
    await chamarFerramenta('confirmar_entrega', { id, token: preparado._meta.entrega.token }, dono, DB);
    await assert.rejects(chamarFerramenta('ler_formulario', { id }, dono, DB), /não encontrado/);
  } finally { DB.fechar(); }
});

test('Ferramentas visíveis mantêm orçamento de contexto e não repetem o preenchimento', () => {
  const visiveis = FERRAMENTAS.filter(item => item._meta?.ui?.visibility?.[0] !== 'app');
  assert.equal(visiveis.length, 2);
  const tamanho = new TextEncoder().encode(JSON.stringify(visiveis)).length;
  assert.ok(tamanho < 3500, `Definições visíveis excessivas: ${tamanho} bytes.`);
});

test('Falha na entrega permite retomar a edição sem perder respostas', async () => {
  const DB = bancoLocal();
  try {
    const criado = await chamarFerramenta('criar_formulario', { perguntas: ['Pergunta'] }, 'dono', DB);
    const id = criado.structuredContent.id;
    const rascunho = { respostas: { p1: 'Primeira resposta' } };
    const preparado = await chamarFerramenta('preparar_entrega', { id, versao: 1, rascunho }, 'dono', DB);
    assert.ok((await chamarFerramenta('ler_formulario', { id }, 'dono', DB))._meta.preparacao);
    const retomado = await chamarFerramenta('retomar_edicao', { id, token: preparado._meta.entrega.token }, 'dono', DB);
    await chamarFerramenta('salvar_rascunho', { id, versao: retomado._meta.versao, rascunho: { respostas: { p1: 'Resposta revisada' } } }, 'dono', DB);
    const atual = await chamarFerramenta('ler_formulario', { id }, 'dono', DB);
    assert.equal(atual._meta.rascunho.respostas.p1, 'Resposta revisada');
    assert.equal(atual._meta.preparacao, null);
  } finally { DB.fechar(); }
});
