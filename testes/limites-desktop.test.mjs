import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { normalizarFormulario, validarRascunho } from '../src/formulario.mjs';

function preenchimentoGrande() {
  const respostas = {}; const observacoes = {};
  for (let i = 1; i <= 64; i += 1) { respostas['p' + i] = 'X'.repeat(16000); observacoes['p' + i] = 'Y'.repeat(16000); }
  return { respostas, observacoes };
}
test('Limite agregado recusa rascunho grande antes da transmissão', () => {
  const formulario = normalizarFormulario({ perguntas: Array.from({ length: 100 }, () => 'Fictício') });
  assert.throws(() => validarRascunho(formulario, preenchimentoGrande()), /preenchimento supera 1 MB/);
});
test('Alternativas comuns também respeitam orçamento da definição normalizada', () => {
  assert.throws(() => normalizarFormulario({ perguntas: Array.from({ length: 1000 }, () => 'Fictício'), tipo: 'unica', opcoes: ['X'.repeat(300), 'Y'.repeat(300)] }), /formulário supera 400 KB/);
});
test('Servidor stdio real recusa mais de 2 MB e continua atendendo', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'perguntas-limite-'));
  const raiz = fileURLToPath(new URL('../', import.meta.url));
  const transporte = new StdioClientTransport({ command: process.execPath, args: ['src/servidor-desktop.mjs'], cwd: raiz, env: { ...process.env, PERGUNTAS_DIRETORIO_DADOS: pasta }, stderr: 'pipe' });
  const cliente = new Client({ name: 'verificacao-limite', version: '1.0.0' });
  transporte.stderr?.on('data', () => {});
  try {
    await cliente.connect(transporte);
    const resposta = await cliente.callTool({ name: 'salvar_rascunho', arguments: { id: 'ficticio', versao: 1, rascunho: preenchimentoGrande() } });
    assert.equal(resposta.isError, true); assert.match(resposta.content[0].text, /limite de 2 MB/);
    const lista = await cliente.callTool({ name: 'abrir_painel', arguments: {} });
    assert.deepEqual(lista._meta.pendentes, []);
  } finally {
    await cliente.close(); await transporte.close();
    assert.ok(resolve(pasta).startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')));
    await rm(pasta, { recursive: true, force: true });
  }
});
