import test from 'node:test';
import assert from 'node:assert/strict';
import { copiarTexto } from '../src/copia.mjs';
import { copiarNoWindows, FERRAMENTA_COPIA } from '../src/copia-desktop.mjs';

test('cópia usa a API real oferecida e só confirma após sua conclusão', async () => {
  const textos = [];
  const mensagem = await copiarTexto('Pergunta\nResposta: ação', { area: { writeText: async texto => textos.push(texto) }, copiarLocal: () => assert.fail('Não deve duplicar a cópia.') });
  assert.deepEqual(textos, ['Pergunta\nResposta: ação']); assert.match(mensagem, /copiadas/);
});
test('recusa do navegador usa a integração local com retorno explícito', async () => {
  const textos = [];
  const mensagem = await copiarTexto('Conjunto', { area: { writeText: async () => { throw new Error('Permissão recusada'); } }, copiarLocal: async texto => { textos.push(texto); return { copiado: true }; } });
  assert.deepEqual(textos, ['Conjunto']); assert.match(mensagem, /integração local/);
  await assert.rejects(copiarTexto('Conjunto', { area: null, copiarLocal: async () => ({ copiado: false }) }), /não foi confirmada/);
  await assert.rejects(copiarTexto('Conjunto', { area: null }), /não permitiu copiar/);
});
test('operação Windows passa Unicode pelo pipe, sem interpolar texto no programa', async () => {
  const texto = 'Ação\n$env:NAO_EXECUTAR; $(NAO_EXECUTAR) "aspas"';
  let recebido;
  const resultado = await copiarNoWindows({ texto }, { plataforma: 'win32', executar: (executavel, argumentos, opcoes, retorno) => {
    assert.match(executavel, /powershell\.exe$/); assert.equal(opcoes.windowsHide, true); assert.equal(opcoes.timeout, 10000);
    assert.ok(argumentos.includes('-STA')); assert.ok(!argumentos.at(-1).includes(texto));
    return { stdin: { on() {}, end(valor, codificacao) { recebido = valor; assert.equal(codificacao, 'utf8'); retorno(null, '{"copiado":true}'); } } };
  } });
  assert.equal(recebido, texto); assert.deepEqual(resultado, { copiado: true });
  assert.deepEqual(FERRAMENTA_COPIA._meta.ui.visibility, ['app']);
});
test('entrada inválida, excesso e sistema incompatível falham antes da execução', async () => {
  const executar = () => assert.fail('Não pode executar uma entrada inválida.');
  for (const entrada of [{ texto: '' }, { texto: 'a\0b' }, { texto: 'a', extra: true }, {}, { texto: 1 }, { texto: 'a'.repeat(2000000) }]) await assert.rejects(copiarNoWindows(entrada, { executar }));
  await assert.rejects(copiarNoWindows({ texto: 'a' }, { executar, plataforma: 'linux' }), /requer Windows/);
});
test('falha ou confirmação malformada do Windows nunca produz sucesso', async () => {
  for (const [erro, saida] of [[new Error('Falha'), ''], [null, '{"copiado":false}'], [null, 'saída inválida']]) {
    await assert.rejects(copiarNoWindows({ texto: 'Conjunto' }, { plataforma: 'win32', executar: (_arquivo, _argumentos, _opcoes, retorno) => ({ stdin: { on() {}, end() { retorno(erro, saida); } } }) }), /confirm/);
  }
});
