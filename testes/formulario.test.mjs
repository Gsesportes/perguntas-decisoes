import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarFormulario, validarRascunho, montarEntrega, rascunhoVazio, migrarPaginacao, POR_PAGINA } from '../src/formulario.mjs';

test('Classificar cinquenta itens com opções comuns preserva a ordem e as observações', () => {
  const formulario = normalizarFormulario({ perguntas: Array.from({ length: 50 }, (_, indice) => `Item ${indice + 1}`), tipo: 'unica', opcoes: ['Aprovar', 'Ajustar', 'Deixar pendente'] });
  const preenchimento = rascunhoVazio();
  for (const pergunta of formulario.perguntas) preenchimento.respostas[pergunta.id] = 'Aprovar';
  preenchimento.observacoes.p50 = 'Revisar somente este item.\nPreservar esta linha.';
  const entrega = montarEntrega(formulario, preenchimento);
  assert.equal(formulario.perguntas.length, 50);
  assert.equal(entrega.compacto.respostas.length, 50);
  assert.deepEqual(entrega.compacto.respostas[49], ['p50', 'Aprovar', preenchimento.observacoes.p50]);
  assert.match(entrega.texto, /P50 · Item 50\nResposta: Aprovar\nObservações: Revisar somente este item\.\nPreservar esta linha\./);
});

test('Não, nota zero, duas seleções e texto livre são respostas diferentes de ausência', () => {
  const formulario = normalizarFormulario({ perguntas: [{ texto: 'Concorda?', tipo: 'sim_nao' }, { texto: 'Nota?', tipo: 'nota' }, { texto: 'Escolha', tipo: 'multipla', opcoes: ['A', 'B', 'C'] }, 'Texto'] });
  const preenchimento = { respostas: { p1: 'Não', p2: 0, p3: ['A', 'C'], p4: ' Resposta com espaços preservados. ' }, observacoes: { p1: 'Ressalva' }, gerais: 'Contexto geral.' };
  assert.deepEqual(validarRascunho(formulario, preenchimento, true).pendentes, []);
  const texto = montarEntrega(formulario, preenchimento).texto;
  assert.match(texto, /Resposta: Não/);
  assert.match(texto, /Resposta: 0/);
  assert.match(texto, /Resposta: A; C/);
  assert.match(texto, /Resposta:  Resposta com espaços preservados\. /);
});

test('Rascunho incompleto é guardável, mas entrega incompleta é recusada', () => {
  const formulario = normalizarFormulario({ perguntas: ['A', 'B'] });
  const preenchimento = { respostas: { p1: 'Resposta' }, observacoes: { p2: 'Apenas comentário' } };
  assert.deepEqual(validarRascunho(formulario, preenchimento).pendentes, ['p2']);
  assert.throws(() => montarEntrega(formulario, preenchimento), /Faltam 1 respostas/);
});

test('Opções inventadas, duplicadas e identificadores desconhecidos não passam pela validação', () => {
  const formulario = normalizarFormulario({ perguntas: [{ texto: 'Escolha', tipo: 'multipla', opcoes: ['A', 'B'] }] });
  assert.throws(() => validarRascunho(formulario, { respostas: { p1: ['Outra'] } }), /inválida/);
  assert.throws(() => validarRascunho(formulario, { respostas: { p1: ['A', 'A'] } }), /inválida/);
  assert.throws(() => validarRascunho(formulario, { respostas: { p2: ['A'] } }), /desconhecida/);
  assert.throws(() => normalizarFormulario({ perguntas: ['Escolha'], tipo: 'unica', opcoes: ['A', 'A'] }), /distintas/);
});

test('Escalas respeitam o passo e notas não viram valores escolhidos automaticamente', () => {
  const formulario = normalizarFormulario({ perguntas: [{ texto: 'Escala', tipo: 'escala', min: 0, max: 10, passo: 2 }, { texto: 'Nota', tipo: 'nota', min: 1, max: 5 }] });
  assert.deepEqual(validarRascunho(formulario, rascunhoVazio()).pendentes, ['p1', 'p2']);
  assert.throws(() => validarRascunho(formulario, { respostas: { p1: 3 } }), /numérico inválido/);
  assert.throws(() => validarRascunho(formulario, { respostas: { p2: 6 } }), /numérico inválido/);
});

test('Datas impossíveis e horários fora dos limites são recusados', () => {
  const formulario = normalizarFormulario({ perguntas: [{ texto: 'Data', tipo: 'data' }, { texto: 'Hora', tipo: 'hora' }] });
  assert.throws(() => validarRascunho(formulario, { respostas: { p1: '2026-02-30' } }), /Data inválida/);
  assert.throws(() => validarRascunho(formulario, { respostas: { p2: '25:00' } }), /Hora inválida/);
  assert.equal(validarRascunho(formulario, { respostas: { p1: '2026-10-03', p2: '09:15' } }, true).pendentes.length, 0);
});

test('Botões não arredondam frações silenciosamente; valores fracionários usam número', () => {
  assert.throws(() => normalizarFormulario({ perguntas: [{ texto: 'Nota', tipo: 'nota', min: 0, max: 1, passo: 0.1 }] }), /para frações, use número/);
  const formulario = normalizarFormulario({ perguntas: [{ texto: 'Valor', tipo: 'numero', min: 0, max: 1, passo: 0.01 }] });
  assert.equal(validarRascunho(formulario, { respostas: { p1: 0.05 } }, true).rascunho.respostas.p1, 0.05);
});

test('Cinquenta itens usam nove páginas com seis itens e dois na última', () => {
  assert.equal(POR_PAGINA, 6);
  const formulario = normalizarFormulario({ perguntas: Array.from({ length: 50 }, (_, indice) => `Item ${indice + 1}`) });
  const paginas = [];
  for (let inicio = 0; inicio < formulario.perguntas.length; inicio += POR_PAGINA) paginas.push(formulario.perguntas.slice(inicio, inicio + POR_PAGINA));
  assert.deepEqual(paginas.map(pagina => pagina.length), [6, 6, 6, 6, 6, 6, 6, 6, 2]);
  assert.deepEqual(validarRascunho(formulario, { ...rascunhoVazio(), pagina: 8 }).rascunho.pagina, 8);
  assert.throws(() => validarRascunho(formulario, { ...rascunhoVazio(), pagina: 9 }), /Página inválida/);
});

test('Retomada migra a posição de quatro para seis sem alterar respostas ou observações', () => {
  const formulario = normalizarFormulario({ perguntas: Array.from({ length: 50 }, (_, indice) => `Item ${indice + 1}`) });
  const anterior = { respostas: { p49: 'Texto preservado' }, observacoes: { p49: 'Observação\ncom duas linhas.' }, gerais: 'Geral', pagina: 12 };
  const copia = structuredClone(anterior);
  const migrado = migrarPaginacao(formulario, anterior);
  assert.equal(migrado.pagina, 8);
  assert.equal(migrado.itens_por_pagina, 6);
  assert.deepEqual(migrado.respostas, anterior.respostas);
  assert.deepEqual(migrado.observacoes, anterior.observacoes);
  assert.deepEqual(anterior, copia);
  assert.equal(migrarPaginacao(formulario, migrado).pagina, 8);
});
