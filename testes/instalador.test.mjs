import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validarCatalogo, ARQUIVOS_CATALOGO } from '../scripts/instalar-desktop.mjs';

test('Instalador confere catálogo completo e recusa identidade ou comando inesperados', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'catalogo instalador '));
  const raiz = fileURLToPath(new URL('../pacote/', import.meta.url));
  try {
    for (const arquivo of ARQUIVOS_CATALOGO) { const destino = join(pasta, arquivo); await mkdir(dirname(destino), { recursive: true }); await copyFile(join(raiz, arquivo), destino); }
    const verificado = validarCatalogo(pasta);
    assert.equal(verificado.versao, JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version);
    const arquivo = join(pasta, 'plugins/perguntas-decisoes/mcp.json');
    const mcp = JSON.parse(await readFile(arquivo, 'utf8'));
    mcp.mcpServers.perguntas.args[0] = '../outro-servidor.mjs';
    await writeFile(arquivo, JSON.stringify(mcp));
    assert.throws(() => validarCatalogo(pasta), /não corresponde ao servidor/);
    mcp.mcpServers.perguntas.args[0] = 'server/servidor.mjs'; await writeFile(arquivo, JSON.stringify(mcp));
    await writeFile(join(pasta, '.agents/plugins/marketplace.json'), JSON.stringify({ name: 'outro' }));
    assert.throws(() => validarCatalogo(pasta), /identidade/);
  } finally { assert.ok(resolve(pasta).startsWith(resolve(tmpdir()) + sep)); await rm(pasta, { recursive: true, force: true }); }
});
