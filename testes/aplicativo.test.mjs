import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

async function iniciar(t, apresentacao, contexto, falhaExibicao, durantePedido) {
  const anteriores = { document: globalThis.document, window: globalThis.window, aplicativo: globalThis.__aplicativoTeste };
  t.after(() => { globalThis.document = anteriores.document; globalThis.window = anteriores.window; globalThis.__aplicativoTeste = anteriores.aplicativo; });
  const raiz = criarDomTeste();
  raiz.dataset.apresentacao = apresentacao;
  document.documentElement = { dataset: {} };
  document.getElementById = () => raiz;
  globalThis.window = { ...globalThis.window, parent: {} };
  const ouvintes = new Map();
  let versao = 1;
  const aplicativo = {
    contexto,
    getHostContext() { return this.contexto; },
    getHostCapabilities: () => ({}),
    addEventListener: (nome, funcao) => ouvintes.set(nome, funcao),
    connect: async () => {},
    requestDisplayMode: async () => { durantePedido?.(aplicativo, () => ouvintes.get('hostcontextchanged')()); if (falhaExibicao) throw new Error(falhaExibicao); return { mode: contexto.displayMode }; },
    callServerTool: async pedido => pedido.name === 'listar_pendentes' ? { _meta: { pendentes: [] } } : { _meta: { versao: ++versao } }
  };
  globalThis.__aplicativoTeste = aplicativo;
  const moduloTemporario = join(tmpdir(), `perguntas-app-teste-${crypto.randomUUID()}.mjs`);
  await writeFile(moduloTemporario, construcao.outputFiles[0].text);
  t.after(() => unlink(moduloTemporario));
  await import(pathToFileURL(moduloTemporario).href);
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
  assert.equal(c.raiz.querySelector('[data-pendentes]').hidden, false, 'A negociação recusada não deve impedir a carga inicial.');
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

for (const [apresentacao, inicial, esperado] of [['chat', 'fullscreen', 'inline'], ['lateral', 'inline', 'fullscreen']]) test('R3: evento confirma ' + esperado + ' antes da resposta perdida sem reintroduzir aviso', async t => {
  const c = await iniciar(t, apresentacao, { displayMode: inicial, availableDisplayModes: ['inline', 'fullscreen'] }, 'Resposta de exibição perdida', (aplicativo, emitir) => { aplicativo.contexto = { ...aplicativo.contexto, displayMode: esperado }; emitir(); });
  assert.equal(c.aviso.hidden, true);
  c.carregar(); assert.equal(c.aviso.hidden, true); assert.equal(document.documentElement.dataset.modoExibicao, esperado);
  c.mudarContexto({ displayMode: inicial, availableDisplayModes: ['inline', 'fullscreen'] });
  assert.equal(c.aviso.hidden, false, 'Uma confirmação antiga não deve esconder mudança posterior do modo.');
});
