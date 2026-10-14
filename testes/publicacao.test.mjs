import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { ARQUIVOS_PUBLICOS } from '../scripts/arquivos-publicos.mjs';
import { auditarPublicacao } from '../scripts/auditar-publicacao.mjs';
import { configuracaoMcp } from '../scripts/configuracao-mcp.mjs';

test('Cópia por inclusão é neutra e recusa registros privados ou segredos acrescentados', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'perguntas-publicacao-'));
  const raiz = fileURLToPath(new URL('../', import.meta.url));
  try {
    for (const caminho of ARQUIVOS_PUBLICOS) { const destino = join(pasta, caminho); await mkdir(dirname(destino), { recursive: true }); await copyFile(join(raiz, caminho), destino); }
    assert.equal((await auditarPublicacao(pasta)).fonte, ARQUIVOS_PUBLICOS.length);
    await writeFile(join(pasta, 'README.md'), 'banana'); assert.equal((await auditarPublicacao(pasta, ['a' + 'na'])).referenciasEncontradas, 0);
    await writeFile(join(pasta, 'README.md'), 'DADOS_' + ['a', 'na'].join('').toUpperCase()); await assert.rejects(auditarPublicacao(pasta, ['a' + 'na']), /Referência particular/);
    await copyFile(join(raiz, 'README.md'), join(pasta, 'README.md'));
    const particular = join(pasta, 'docs', 'evidencias', 'registro.md'); await mkdir(dirname(particular), { recursive: true }); await writeFile(particular, 'Conteúdo fictício privado');
    await assert.rejects(auditarPublicacao(pasta), /fora da lista pública/); await rm(particular);
    await writeFile(join(pasta, 'README.md'), 'sk-' + 'A'.repeat(30)); await assert.rejects(auditarPublicacao(pasta), /credencial detectada/);
    await writeFile(join(pasta, 'README.md'), 'C:' + '\\Users\\' + 'perfil-ficticio\\arquivo'); await assert.rejects(auditarPublicacao(pasta), /Referência particular/);
  } finally {
    assert.ok(resolve(pasta).startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')));
    await rm(pasta, { recursive: true, force: true });
  }
});
test('Diagnóstico usa comando, argumentos e diretório do manifesto', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'pacote perguntas '));
  try {
    await writeFile(join(pasta, 'mcp.json'), JSON.stringify({ mcpServers: { perguntas: { command: 'comando-ficticio', args: ['server/servidor.mjs'], cwd: '.' } } }));
    const configuracao = await configuracaoMcp(pasta);
    assert.equal(configuracao.command, 'comando-ficticio'); assert.deepEqual(configuracao.args, ['server/servidor.mjs']); assert.equal(configuracao.cwd, resolve(pasta));
    await writeFile(join(pasta, 'mcp.json'), JSON.stringify({ mcpServers: { perguntas: { command: 'node', args: [], cwd: '..' } } }));
    await assert.rejects(configuracaoMcp(pasta), /dentro do pacote/);
  } finally {
    assert.ok(resolve(pasta).startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')));
    await rm(pasta, { recursive: true, force: true });
  }
});

test('diagnóstico expande variáveis oficiais e protege o diretório de dados', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'variaveis-plugin-'));
  const dados = join(pasta, 'dados');
  try {
    await writeFile(join(pasta, 'mcp.json'), JSON.stringify({ mcpServers: { perguntas: { command: 'node', args: ['${PLUGIN_ROOT}/server/servidor.mjs'], cwd: '${PLUGIN_DATA}' } } }));
    await assert.rejects(configuracaoMcp(pasta), /diretório de dados/);
    const c = await configuracaoMcp(pasta, { diretorioDados: dados });
    assert.equal(c.cwd, resolve(dados)); assert.equal(c.args[0], resolve(pasta) + '/server/servidor.mjs');
    await writeFile(join(pasta, 'mcp.json'), JSON.stringify({ mcpServers: { perguntas: { command: 'node', args: [], cwd: '${PLUGIN_DATA}/../fora' } } }));
    await assert.rejects(configuracaoMcp(pasta, { diretorioDados: dados }), /dentro do pacote/);
  } finally { assert.ok(resolve(pasta).startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/'))); await rm(pasta, { recursive: true, force: true }); }
});
