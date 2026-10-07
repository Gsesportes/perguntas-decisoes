import test from 'node:test';
import assert from 'node:assert/strict';
import { Repositorio } from '../src/repositorio.mjs';
import { bancoLocal } from '../scripts/banco-local.mjs';
import { normalizarFormulario, rascunhoVazio } from '../src/formulario.mjs';
import { promessaControlada } from './apoio-dom.mjs';

function atrasarMutacao(banco, sqlAlvo, iniciou, pausa) {
  return { prepare(sql) { return { bind(...valores) {
    const consulta = banco.prepare(sql).bind(...valores);
    const executar = metodo => async () => { const resultado = await consulta[metodo](); if (sql.startsWith(sqlAlvo)) { iniciou.resolver(); await pausa.promessa; } return resultado; };
    return { first: executar('first'), run: executar('run'), all: executar('all') };
  } }; } };
}
test('Salvar devolve a versão de sua própria mutação, mesmo com outra gravação antes da resposta', async () => {
  const banco = bancoLocal(); const iniciou = promessaControlada(); const pausa = promessaControlada();
  try {
    const normal = new Repositorio(banco); const lento = new Repositorio(atrasarMutacao(banco, 'UPDATE formularios SET rascunho=', iniciou, pausa));
    const criado = await normal.criar('perfil', normalizarFormulario({ perguntas: ['Texto'] }), rascunhoVazio());
    const primeira = lento.salvar('perfil', criado.id, 1, { respostas: { p1: 'A' } });
    await iniciou.promessa;
    const segunda = await normal.salvar('perfil', criado.id, 2, { respostas: { p1: 'B' } });
    pausa.resolver(); const devolvido = await primeira;
    assert.equal(devolvido.versao, 2); assert.equal(segunda.versao, 3);
    await assert.rejects(normal.salvar('perfil', criado.id, devolvido.versao, { respostas: { p1: 'A seguinte' } }), /mudou/);
    assert.equal((await normal.ler('perfil', criado.id)).rascunho.respostas.p1, 'B');
  } finally { banco.fechar(); }
});
test('Preparar devolve seu token e texto, sem adotar preparação posterior', async () => {
  const banco = bancoLocal(); const iniciou = promessaControlada(); const pausa = promessaControlada();
  try {
    const normal = new Repositorio(banco); const lento = new Repositorio(atrasarMutacao(banco, 'UPDATE formularios SET rascunho=', iniciou, pausa));
    const criado = await normal.criar('perfil', normalizarFormulario({ perguntas: ['Texto'] }), rascunhoVazio());
    const primeira = lento.preparar('perfil', criado.id, 1, { respostas: { p1: 'A' } }, { token: 'token-a', texto: 'A' });
    await iniciou.promessa;
    const retomado = await normal.retomar('perfil', criado.id, 'token-a');
    await normal.preparar('perfil', criado.id, retomado.versao, { respostas: { p1: 'B' } }, { token: 'token-b', texto: 'B' });
    pausa.resolver(); const devolvido = await primeira;
    assert.equal(devolvido.entrega.token, 'token-a'); assert.equal(devolvido.entrega.texto, 'A');
    await assert.rejects(normal.concluir('perfil', criado.id, devolvido.entrega.token), /Confirmação de entrega inválida/);
    assert.equal((await normal.ler('perfil', criado.id)).entrega.token, 'token-b');
  } finally { banco.fechar(); }
});
