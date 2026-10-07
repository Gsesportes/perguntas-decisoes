import test from 'node:test';
import assert from 'node:assert/strict';
import { entregarNoAplicativo, capacidadesEntrega } from '../src/entregas.mjs';

const entrega = { id: 'formulario-1', texto: 'Respostas\nP1: Não\nObservação: preservar.' };
function aplicativoDeTeste() {
  const chamadas = [];
  const aplicativo = { getHostCapabilities: () => ({ message: { text: {} } }) };
  const extensoes = { message: { async send(parametros) { chamadas.push({ metodo: 'ui/message', parametros }); return {}; } }, modelContext: { async update(parametros) { chamadas.push({ metodo: 'ui/update-model-context', parametros }); return { updateId: 'confirmacao-1' }; } } };
  return { chamadas, aplicativo, extensoes };
}

test('Enviar ao chat chama a API de mensagem com as respostas completas', async () => {
  const { chamadas, aplicativo, extensoes } = aplicativoDeTeste();
  await entregarNoAplicativo('chat', entrega, aplicativo, extensoes);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].metodo, 'ui/message');
  assert.equal(chamadas[0].parametros.role, 'user');
  assert.equal(chamadas[0].parametros.content[0].text, entrega.texto);
});

test('Inserir anotação atualiza o campo de mensagem e não envia uma mensagem', async () => {
  const { chamadas, aplicativo, extensoes } = aplicativoDeTeste();
  await entregarNoAplicativo('anotacao', entrega, aplicativo, extensoes);
  assert.equal(chamadas[0].metodo, 'ui/update-model-context');
  assert.equal(chamadas[0].parametros.content[0]._meta['openai/title'], 'Respostas do formulário');
  assert.equal(chamadas[0].parametros.content[0].text, entrega.texto);
});

test('Anexar TXT entrega recurso de arquivo com conteúdo e nome próprios', async () => {
  const { chamadas, aplicativo, extensoes } = aplicativoDeTeste();
  await entregarNoAplicativo('arquivo', entrega, aplicativo, extensoes);
  const arquivo = chamadas[0].parametros.content[0];
  assert.equal(arquivo.type, 'resource');
  assert.equal(arquivo.resource.mimeType, 'text/plain');
  assert.equal(arquivo.resource.text, entrega.texto);
  assert.match(arquivo.resource.uri, /respostas\.txt$/);
});

test('Aplicativo sem suporte e resposta sem confirmação falham de forma explícita', async () => {
  assert.deepEqual(capacidadesEntrega({}, {}), { chat: false, anotacao: false, arquivo: false });
  await assert.rejects(entregarNoAplicativo('arquivo', entrega, {}, {}), /não anunciou suporte/);
  const { aplicativo, extensoes } = aplicativoDeTeste();
  extensoes.modelContext.update = async () => undefined;
  await assert.rejects(entregarNoAplicativo('anotacao', entrega, aplicativo, extensoes), /não confirmou/);
  extensoes.message.send = async () => { throw new Error('Conversa indisponível'); };
  await assert.rejects(entregarNoAplicativo('chat', entrega, aplicativo, extensoes), /Conversa indisponível/);
});
