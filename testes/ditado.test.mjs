import test from 'node:test';
import assert from 'node:assert/strict';
import { acrescentarDitado } from '../src/ditado-interface.mjs';
import { empacotarWav, validarDestino } from '../src/ditado-desktop.mjs';

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

