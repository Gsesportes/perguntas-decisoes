import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { abrirArmazenamentoDesktop } from '../src/armazenamento-desktop.mjs';
import { chamarFerramenta } from '../src/servidor.mjs';

function pastaTeste() { const pasta = join(process.cwd(), '.local', 'testes', crypto.randomUUID()); mkdirSync(pasta, { recursive: true }); return pasta; }

test('Rascunho desktop persiste no diretório do perfil e pode ser reaberto após fechar o banco', async () => {
  const diretorio = pastaTeste();
  let armazenamento = abrirArmazenamentoDesktop({ diretorio });
  const criado = await chamarFerramenta('criar_formulario', { perguntas: ['Pergunta local'] }, armazenamento.dono, armazenamento.DB);
  const id = criado.structuredContent.id;
  await chamarFerramenta('salvar_rascunho', { id, versao: 1, rascunho: { respostas: { p1: 'Resposta local' }, observacoes: { p1: 'Observação preservada.' } } }, armazenamento.dono, armazenamento.DB);
  armazenamento.fechar();
  armazenamento = abrirArmazenamentoDesktop({ diretorio });
  try {
    const atual = await chamarFerramenta('ler_formulario', { id }, armazenamento.dono, armazenamento.DB);
    assert.equal(atual._meta.rascunho.respostas.p1, 'Resposta local');
    assert.equal(atual._meta.rascunho.observacoes.p1, 'Observação preservada.');
    assert.equal(armazenamento.caminho, join(diretorio, 'rascunhos.sqlite'));
  } finally { armazenamento.fechar(); }
});

test('Perfis locais separados não compartilham registros', async () => {
  const primeiro = abrirArmazenamentoDesktop({ diretorio: pastaTeste() });
  const segundo = abrirArmazenamentoDesktop({ diretorio: pastaTeste() });
  try {
    const criado = await chamarFerramenta('criar_formulario', { perguntas: ['Privada'] }, primeiro.dono, primeiro.DB);
    await assert.rejects(chamarFerramenta('ler_formulario', { id: criado.structuredContent.id }, segundo.dono, segundo.DB), /não encontrado/);
  } finally { primeiro.fechar(); segundo.fechar(); }
});

test('Banco de versão futura é recusado e os dados permanecem disponíveis', () => {
  const diretorio = pastaTeste();
  const caminho = join(diretorio, 'rascunhos.sqlite');
  const banco = new DatabaseSync(caminho);
  banco.exec("CREATE TABLE futuro(valor TEXT); INSERT INTO futuro VALUES('preservado'); PRAGMA user_version=2;");
  banco.close();
  assert.throws(() => abrirArmazenamentoDesktop({ diretorio }), /versão mais nova/);
  const leitura = new DatabaseSync(caminho);
  try { assert.equal(leitura.prepare('SELECT valor FROM futuro').get().valor, 'preservado'); assert.equal(leitura.prepare('PRAGMA user_version').get().user_version, 2); }
  finally { leitura.close(); }
});
