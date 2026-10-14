import test from 'node:test';
import assert from 'node:assert/strict';
import { ajustarApresentacao, lerRecursoInterface, URI_INTERFACE, URI_INTERFACE_CHAT } from '../src/exibicao.mjs';

test('Padrão lateral já aberto não troca de modo', async () => {
  const aplicativo = { getHostContext: () => ({ displayMode: 'fullscreen', availableDisplayModes: ['inline', 'fullscreen'] }), requestDisplayMode: () => assert.fail('A barra lateral já está aberta.') };
  assert.equal(await ajustarApresentacao(aplicativo), 'fullscreen');
});

test('Padrão lateral solicita fullscreen uma única vez quando iniciado no chat', async () => {
  const pedidos = [];
  const aplicativo = { getHostContext: () => ({ displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'] }), requestDisplayMode: async pedido => { pedidos.push(pedido); return { mode: 'fullscreen' }; } };
  assert.equal(await ajustarApresentacao(aplicativo), 'fullscreen');
  assert.deepEqual(pedidos, [{ mode: 'fullscreen' }]);
});

test('Chat opcional já inline não solicita expansão', async () => {
  const aplicativo = { getHostContext: () => ({ displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'] }), requestDisplayMode: () => assert.fail('O cartão já está dentro da conversa.') };
  assert.equal(await ajustarApresentacao(aplicativo, 'chat'), 'inline');
});

test('Abertura em painel solicita inline uma única vez quando o aplicativo oferece esse modo', async () => {
  const pedidos = [];
  const aplicativo = { getHostContext: () => ({ displayMode: 'fullscreen', availableDisplayModes: ['inline', 'fullscreen'] }), requestDisplayMode: async pedido => { pedidos.push(pedido); return { mode: 'inline' }; } };
  assert.equal(await ajustarApresentacao(aplicativo, 'chat'), 'inline');
  assert.deepEqual(pedidos, [{ mode: 'inline' }]);
});

test('Anfitrião sem inline conserva o modo observado e não fabrica confirmação', async () => {
  const aplicativo = { getHostContext: () => ({ displayMode: 'fullscreen', availableDisplayModes: ['fullscreen'] }), requestDisplayMode: () => assert.fail('O anfitrião não oferece o modo solicitado.') };
  assert.equal(await ajustarApresentacao(aplicativo, 'chat'), 'fullscreen');
});

test('Recusa de inline pelo anfitrião é devolvida sem insistência', async () => {
  let pedidos = 0;
  const aplicativo = { getHostContext: () => ({ displayMode: 'fullscreen', availableDisplayModes: ['inline', 'fullscreen'] }), requestDisplayMode: async () => { pedidos += 1; return { mode: 'fullscreen' }; } };
  assert.equal(await ajustarApresentacao(aplicativo, 'chat'), 'fullscreen');
  assert.equal(pedidos, 1);
});

test('Falha ao negociar exibição permanece visível', async () => {
  const aplicativo = { getHostContext: () => ({ displayMode: 'fullscreen', availableDisplayModes: ['inline'] }), requestDisplayMode: async () => { throw new Error('Recusa de exibição'); } };
  await assert.rejects(ajustarApresentacao(aplicativo, 'chat'), /Recusa de exibição/);
});

test('Ausência de suporte lateral não é tratada como confirmação de fullscreen', async () => {
  const aplicativo = { getHostContext: () => ({ displayMode: 'inline', availableDisplayModes: ['inline'] }), requestDisplayMode: () => assert.fail('Não há suporte ao painel.') };
  assert.equal(await ajustarApresentacao(aplicativo), 'inline');
});

test('Recusa de fullscreen é devolvida sem insistência', async () => {
  let pedidos = 0;
  const aplicativo = { getHostContext: () => ({ displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'] }), requestDisplayMode: async () => { pedidos += 1; return { mode: 'inline' }; } };
  assert.equal(await ajustarApresentacao(aplicativo), 'inline');
  assert.equal(pedidos, 1);
});

test('Apresentação desconhecida é recusada antes de negociar com o aplicativo', async () => {
  await assert.rejects(ajustarApresentacao({}, 'inventada'), /Apresentação desconhecida/);
});

test('Recursos lateral e no chat têm preferências e inicialização próprias', () => {
  const html = '<div id="perguntas-decisoes-app"></div>';
  const lateral = lerRecursoInterface(html, URI_INTERFACE);
  const chat = lerRecursoInterface(html, URI_INTERFACE_CHAT);
  assert.equal(lateral._meta['openai/ui'].preferredDisplayMode, 'fullscreen');
  assert.equal(chat._meta['openai/ui'].preferredDisplayMode, 'inline');
  assert.match(lateral.text, /data-apresentacao="lateral"/);
  assert.match(chat.text, /data-apresentacao="chat"/);
  assert.equal(html, '<div id="perguntas-decisoes-app"></div>');
  assert.throws(() => lerRecursoInterface(html, 'ui://desconhecida'), /não encontrado/);
  assert.throws(() => lerRecursoInterface('<div></div>', URI_INTERFACE), /formulário esperado/);
});
