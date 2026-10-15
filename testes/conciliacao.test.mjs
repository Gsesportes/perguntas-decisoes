import test from 'node:test';
import assert from 'node:assert/strict';
import { conciliarRascunhos, conteudoIgual, perguntasAlteradas } from '../src/conciliacao.mjs';

const vazio = { respostas: {}, observacoes: {}, gerais: '', pagina: 0 };
test('conciliação conserva respostas independentes, zero, não e observações remotas', () => {
  const local = { ...vazio, respostas: { p1: 0, p2: false }, pagina: 2 };
  const remoto = { ...vazio, respostas: { p3: ['A', 'B'] }, observacoes: { p1: 'Outra aba' }, gerais: 'Anotação geral', pagina: 1 };
  const resultado = conciliarRascunhos(vazio, local, remoto);
  assert.deepEqual(resultado.conflitos, []);
  assert.deepEqual(resultado.rascunho, { respostas: { p1: 0, p2: false, p3: ['A', 'B'] }, observacoes: { p1: 'Outra aba' }, gerais: 'Anotação geral', pagina: 2 });
});
test('conteúdo igual desconsidera ordem de propriedades, mas preserva ordem dos itens', () => {
  assert.ok(conteudoIgual({ min: 1, max: 2 }, { max: 2, min: 1 }));
  assert.ok(!conteudoIgual(['A', 'B'], ['B', 'A']));
  assert.ok(!conteudoIgual({ p1: undefined }, {}));
  const resposta = { ...vazio, respostas: { p1: { min: 1, max: 2 } } };
  assert.deepEqual(conciliarRascunhos(vazio, resposta, { ...resposta, respostas: { p1: { max: 2, min: 1 } } }).conflitos, []);
});
test('respostas, observações e gerais diferentes exigem decisão, mantendo o local intacto', () => {
  const local = { ...vazio, respostas: { p1: ['B', 'A'] }, observacoes: { p1: 'Local' }, gerais: 'Local' };
  const remoto = { ...vazio, respostas: { p1: ['A', 'B'] }, observacoes: { p1: 'Remoto' }, gerais: 'Remoto' };
  const resultado = conciliarRascunhos(vazio, local, remoto);
  assert.deepEqual(resultado.conflitos, [{ campo: 'respostas', pergunta: 'p1' }, { campo: 'observacoes', pergunta: 'p1' }, { campo: 'gerais' }]);
  assert.deepEqual(resultado.rascunho, local);
  assert.deepEqual(local.respostas.p1, ['B', 'A']);
});
test('preferência explícita local resolve só os campos disputados e mantém exclusões', () => {
  const base = { ...vazio, respostas: { p1: 'Original', p2: 'Remover' }, observacoes: { p2: 'Remover' } };
  const local = { ...vazio, respostas: { p1: 'Local' }, observacoes: { p2: '' } };
  const remoto = { ...base, respostas: { ...base.respostas, p1: 'Remoto', p3: 'Só remoto' }, observacoes: { ...base.observacoes, p1: 'Só remoto' } };
  const resultado = conciliarRascunhos(base, local, remoto, { preferirLocal: true });
  assert.deepEqual(resultado.conflitos, []);
  assert.deepEqual(resultado.rascunho.respostas, { p1: 'Local', p3: 'Só remoto' });
  assert.deepEqual(resultado.rascunho.observacoes, { p1: 'Só remoto' });
  assert.deepEqual([...perguntasAlteradas(local, resultado.rascunho)].sort(), ['p1', 'p2', 'p3']);
});
