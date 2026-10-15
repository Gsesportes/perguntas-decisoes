import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validarCatalogo, ARQUIVOS_CATALOGO } from '../scripts/instalar-desktop.mjs';

test('Catálogo escolhido pelo instalador corresponde ao pacote construído', async () => {
  const raiz = fileURLToPath(new URL('../', import.meta.url));
  const pacote = join(raiz, 'pacote');
  const origem = existsSync(join(raiz, '.agents/plugins/marketplace.json')) ? raiz : pacote;
  assert.equal(validarCatalogo(origem).versao, validarCatalogo(pacote).versao);
  for (const arquivo of ARQUIVOS_CATALOGO) {
    const [distribuido, construido] = await Promise.all([readFile(join(origem, arquivo)), readFile(join(pacote, arquivo))]);
    const iguais = arquivo.endsWith('.png')
      ? distribuido.equals(construido)
      : distribuido.toString('utf8').replace(/\r\n/g, '\n') === construido.toString('utf8').replace(/\r\n/g, '\n');
    assert.ok(iguais, `Catálogo desatualizado: ${arquivo}. Execute npm run sincronizar:catalogo antes de publicar.`);
  }
});

test('Instalador confere catálogo completo e recusa identidade ou comando inesperados', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'catalogo instalador '));
  const raiz = fileURLToPath(new URL('../pacote/', import.meta.url));
  try {
    for (const arquivo of ARQUIVOS_CATALOGO) { const destino = join(pasta, arquivo); await mkdir(dirname(destino), { recursive: true }); await copyFile(join(raiz, arquivo), destino); }
    const verificado = validarCatalogo(pasta);
    assert.equal(verificado.versao, '0.3.9');
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
