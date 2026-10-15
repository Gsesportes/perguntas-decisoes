import test from 'node:test';
import assert from 'node:assert/strict';
import { acrescentarDitado, faseDitado } from '../src/ditado-interface.mjs';
import { argumentosReconhecimento, empacotarWav, validarDestino, validarRegistroDestino } from '../src/ditado-desktop.mjs';

test('ditado acrescenta texto e preserva o conteúdo anterior', () => {
  assert.equal(acrescentarDitado({ original: 'Texto anterior.', atual: 'Texto anterior.', texto: ' Nova fala. ' }), 'Texto anterior. Nova fala.');
});
test('retorno atrasado nunca substitui campo editado', () => {
  assert.throws(() => acrescentarDitado({ original: 'Antes', atual: 'Alterado', texto: 'Fala' }), /campo mudou/);
});
test('excesso e silêncio não truncam ou apagam o campo', () => {
  assert.throws(() => acrescentarDitado({ original: 'abc', atual: 'abc', texto: 'def', limite: 5 }), /limite/);
  assert.throws(() => acrescentarDitado({ original: 'abc', atual: 'abc', texto: '   ' }), /Nenhuma fala/);
});
test('WAV em memória mantém formato e comprimento sem arquivo', () => {
  const wav = empacotarWav(Buffer.from([0, 0, 255, 127]));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.readUInt32LE(40), 4);
  assert.equal(wav.length, 48);
  assert.throws(() => empacotarWav(Buffer.alloc(3)), /inválido/);
});
test('destino precisa indicar formulário, versão e pergunta quando individual', () => {
  assert.throws(() => validarDestino({ id: 'teste', versao: 1, campo: 'resposta' }), /Pergunta/);
  assert.throws(() => validarDestino({ id: 'teste', versao: 1, campo: 'numero', pergunta: 'p1' }), /campo/);
  assert.doesNotThrow(() => validarDestino({ id: 'teste', versao: 1, campo: 'observacao', pergunta: 'p1' }));
  assert.doesNotThrow(() => validarDestino({ id: 'teste', versao: 1, campo: 'gerais' }));
});

test('entrada por pipe mantém saída de texto capturável no Windows, sem arquivos', () => {
  const argumentos = argumentosReconhecimento({ modelo: 'modelo-local.bin' });
  assert.equal(argumentos[argumentos.indexOf('-f') + 1], '-');
  assert.notEqual(argumentos[argumentos.indexOf('-of') + 1], '-');
  for (const proibido of ['-otxt', '-oj', '-ojf', '-osrt', '-ovtt']) assert.equal(argumentos.includes(proibido), false);
});

test('parada solicitada prevalece sobre uma consulta atrasada de gravação', () => {
  assert.equal(faseDitado('gravando', { paradaSolicitada: true }), 'encerrando');
  assert.equal(faseDitado('transcrevendo', { paradaSolicitada: true }), 'transcrevendo');
  assert.equal(faseDitado('gravando', { cancelado: true }), 'cancelando');
  assert.throws(() => faseDitado('desconhecido'), /não reconhecido/);
});

test('edição de outro campo não invalida ditado, mas alteração do destino invalida', () => {
  const destino = { id: 'teste', versao: 1, campo: 'resposta', pergunta: 'p1' };
  const registro = { versao: 1, entrega: null, formulario: { perguntas: [{ id: 'p1', tipo: 'texto' }] }, rascunho: { respostas: { p1: 'Antes' }, observacoes: {}, gerais: '' } };
  const original = validarRegistroDestino(registro, destino);
  registro.versao = 2; registro.rascunho.gerais = 'Outro campo preenchido';
  assert.equal(validarRegistroDestino(registro, destino, original), 'Antes');
  assert.throws(() => validarRegistroDestino(registro, destino), /formulário mudou/);
  registro.rascunho.respostas.p1 = 'Outra janela alterou o destino';
  assert.throws(() => validarRegistroDestino(registro, destino, original), /destino mudou/);
  registro.rascunho.respostas.p1 = 'Antes'; registro.entrega = { token: 'preparacao-ficticia' };
  assert.throws(() => validarRegistroDestino(registro, destino, original), /em entrega/);
});

test('paralelismo respeita disponibilidade e conserva o limite de quatro tarefas', () => {
  for (const [disponiveis, esperado] of [[1, '1'], [2, '2'], [8, '4']]) {
    const argumentos = argumentosReconhecimento({ modelo: 'modelo-local.bin', tarefas: disponiveis });
    assert.equal(argumentos[argumentos.indexOf('-t') + 1], esperado);
  }
});

