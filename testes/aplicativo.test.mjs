import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { normalizarFormulario, rascunhoVazio } from '../src/formulario.mjs';
import { criarDomTeste, aguardarFila } from './apoio-dom.mjs';

const construcao = await build({
  entryPoints: [fileURLToPath(new URL('../src/aplicativo.mjs', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{
    name: 'anfitriao-simulado',
    setup(compilador) {
      compilador.onResolve({ filter: /^(@modelcontextprotocol\/ext-apps|@openai\/mcp-extensions\/app)$/ }, args => ({ path: args.path, namespace: 'anfitriao-simulado' }));
      compilador.onLoad({ filter: /.*/, namespace: 'anfitriao-simulado' }, args => ({
        contents: args.path === '@modelcontextprotocol/ext-apps'
          ? 'export class App { constructor() { return globalThis.__aplicativoTeste; } } export function applyDocumentTheme() {} export function applyHostStyleVariables() {}'
          : 'export class OpenAIExtensions {}',
        loader: 'js'
      }));
    }
  }]
});

async function iniciar(t, apresentacao, contexto, falhaExibicao, opcoes = {}) {
  const anteriores = { document: globalThis.document, window: globalThis.window, aplicativo: globalThis.__aplicativoTeste };
  t.after(() => { globalThis.document = anteriores.document; globalThis.window = anteriores.window; globalThis.__aplicativoTeste = anteriores.aplicativo; });
  const raiz = criarDomTeste();
  raiz.dataset.apresentacao = apresentacao;
  document.documentElement = { dataset: {} };
  document.getElementById = () => raiz;
  globalThis.window = { parent: {} };
  const ouvintes = new Map();
  let versao = 1;
  const aplicativo = {
    contexto,
    pedidos: 0,
    getHostContext() { return this.contexto; },
    getHostCapabilities: () => ({}),
    addEventListener: (nome, funcao) => ouvintes.set(nome, funcao),
    connect: async () => { if (opcoes.falhaConexao) throw new Error(opcoes.falhaConexao); },
    requestDisplayMode: async ({ mode }) => {
      aplicativo.pedidos += 1;
      if (opcoes.confirmarDurantePedido) {
        aplicativo.contexto = { ...aplicativo.contexto, displayMode: mode };
        ouvintes.get('hostcontextchanged')();
      }
      if (falhaExibicao) throw new Error(falhaExibicao);
      return { mode: contexto.displayMode };
    },
    callServerTool: async () => ({ _meta: { versao: ++versao } })
  };
  globalThis.__aplicativoTeste = aplicativo;
  await import(`data:text/javascript;base64,${Buffer.from(construcao.outputFiles[0].text).toString('base64')}#${crypto.randomUUID()}`);
  const carregar = () => aplicativo.ontoolresult({
    structuredContent: { id: 'formulario-ficticio-apresentacao' },
    _meta: {
      formulario: normalizarFormulario({ perguntas: Array.from({ length: 7 }, (_, i) => `Pergunta fictícia ${i + 1}`) }),
      rascunho: { ...rascunhoVazio(), respostas: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`p${i + 1}`, 'Resposta fictícia'])) },
      versao
    }
  });
  return { raiz, aplicativo, carregar, aviso: raiz.querySelector('[data-aviso-apresentacao]'), mudarContexto: novo => { aplicativo.contexto = novo; ouvintes.get('hostcontextchanged')(); } };
}

test('Aviso de chat indisponível permanece após carregar, navegar e listar pendentes', async t => {
  const c = await iniciar(t, 'chat', { displayMode: 'fullscreen', availableDisplayModes: ['fullscreen'] });
  assert.equal(c.aviso.hidden, false);
  assert.match(c.aviso.textContent, /dentro da conversa/);
  c.carregar();
  assert.equal(c.aviso.hidden, false);
  await c.raiz.querySelector('[data-proximo]').disparar('click');
  await aguardarFila();
  assert.equal(c.raiz.querySelector('[data-pagina]').textContent, 'Página 2 de 2');
  assert.equal(c.aviso.hidden, false);
  c.aplicativo.ontoolresult({ _meta: { pendentes: [] } });
  assert.equal(c.raiz.querySelector('[data-formulario]').hidden, true);
  assert.equal(c.aviso.hidden, false);
});

test('Aviso lateral só desaparece depois de o anfitrião confirmar fullscreen', async t => {
  const c = await iniciar(t, 'lateral', { displayMode: 'inline', availableDisplayModes: ['inline'] });
  assert.equal(c.aviso.hidden, false);
  c.carregar();
  c.mudarContexto({ displayMode: 'inline', availableDisplayModes: ['inline'], theme: 'dark' });
  assert.equal(c.aviso.hidden, false);
  c.mudarContexto({ displayMode: 'fullscreen', availableDisplayModes: ['inline', 'fullscreen'] });
  assert.equal(c.aviso.hidden, true);
  assert.equal(document.documentElement.dataset.modoExibicao, 'fullscreen');
});

test('Recusa da negociação fica visível depois do resultado da ferramenta', async t => {
  const c = await iniciar(t, 'chat', { displayMode: 'fullscreen', availableDisplayModes: ['inline', 'fullscreen'] }, 'Recusa de exibição');
  assert.equal(c.aviso.hidden, false);
  assert.match(c.aviso.textContent, /Recusa de exibição/);
  c.carregar();
  assert.equal(c.aviso.hidden, false);
  c.mudarContexto({ displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'] });
  assert.equal(c.aviso.hidden, true);
});

test('Chat confirmado abre sem aviso de apresentação e preserva o resultado recebido', async t => {
  const c = await iniciar(t, 'chat', { displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'] });
  c.carregar();
  assert.equal(c.aviso.hidden, true);
  assert.equal(c.raiz.querySelector('[data-progresso]').textContent, '6 de 7 respondidas');
});

for (const caso of [
  { nome: 'chat', apresentacao: 'chat', inicio: 'fullscreen', esperado: 'inline' },
  { nome: 'painel lateral', apresentacao: 'lateral', inicio: 'inline', esperado: 'fullscreen' }
]) {
  test(`Confirmação do ${caso.nome} antes da resposta perdida conserva o modo observado sem aviso`, async t => {
    const c = await iniciar(t, caso.apresentacao, { displayMode: caso.inicio, availableDisplayModes: ['inline', 'fullscreen'] }, 'Resposta de exibição perdida', { confirmarDurantePedido: true });
    assert.equal(c.aplicativo.getHostContext().displayMode, caso.esperado);
    assert.equal(document.documentElement.dataset.modoExibicao, caso.esperado);
    assert.equal(c.aviso.hidden, true);
    assert.equal(c.aplicativo.pedidos, 1);
    c.carregar();
    assert.equal(c.aviso.hidden, true);
    assert.equal(c.raiz.querySelector('[data-progresso]').textContent, '6 de 7 respondidas');
  });

  test(`Confirmação do ${caso.nome} prevalece sobre uma resposta anterior ao evento`, async t => {
    const c = await iniciar(t, caso.apresentacao, { displayMode: caso.inicio, availableDisplayModes: ['inline', 'fullscreen'] }, undefined, { confirmarDurantePedido: true });
    assert.equal(c.aplicativo.getHostContext().displayMode, caso.esperado);
    assert.equal(document.documentElement.dataset.modoExibicao, caso.esperado);
    assert.equal(c.aviso.hidden, true);
    assert.equal(c.aplicativo.pedidos, 1);
  });
}

test('Falha real de conexão permanece visível mesmo quando o contexto informa o modo desejado', async t => {
  const c = await iniciar(t, 'chat', { displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'] }, undefined, { falhaConexao: 'Falha real de conexão' });
  assert.equal(c.aviso.hidden, false);
  assert.match(c.aviso.textContent, /Conexão com o aplicativo não confirmada/);
  assert.match(c.aviso.textContent, /Falha real de conexão/);
  assert.equal(c.aplicativo.pedidos, 0);
});
