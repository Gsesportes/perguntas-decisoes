import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validarCatalogo, prepararComponentesDesktop, ARQUIVOS_CATALOGO } from '../scripts/instalar-desktop.mjs';

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
    mcp.mcpServers.perguntas.cwd = '.'; await writeFile(arquivo, JSON.stringify(mcp));
    assert.throws(() => validarCatalogo(pasta), /não corresponde ao servidor/);
    mcp.mcpServers.perguntas.cwd = './'; await writeFile(arquivo, JSON.stringify(mcp));
    await writeFile(join(pasta, '.agents/plugins/marketplace.json'), JSON.stringify({ name: 'outro' }));
    assert.throws(() => validarCatalogo(pasta), /identidade/);
  } finally { assert.ok(resolve(pasta).startsWith(resolve(tmpdir()) + sep)); await rm(pasta, { recursive: true, force: true }); }
});

test('componentes persistem por versão e uma atualização não remove a versão em uso', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'componentes instalador '));
  const origem = join(pasta, 'catalogo');
  const diretorio = join(pasta, 'componentes');
  const pacote = fileURLToPath(new URL('../pacote/', import.meta.url));
  try {
    for (const arquivo of ARQUIVOS_CATALOGO) { const destino = join(origem, arquivo); await mkdir(dirname(destino), { recursive: true }); await copyFile(join(pacote, arquivo), destino); }
    const anterior = prepararComponentesDesktop({ origem, diretorio });
    assert.deepEqual(prepararComponentesDesktop({ origem, diretorio }), anterior);
    const capturadorAnterior = join(dirname(dirname(anterior.servidor)), 'native/CapturaMicrofone.exe');
    const bytesAnteriores = await readFile(capturadorAnterior);
    const manifesto = join(origem, 'plugins/perguntas-decisoes/plugin.json');
    const plugin = JSON.parse(await readFile(manifesto, 'utf8'));
    plugin.version = '9.0.0'; await writeFile(manifesto, JSON.stringify(plugin));
    const capturadorNovo = join(origem, 'plugins/perguntas-decisoes/native/CapturaMicrofone.exe');
    await writeFile(capturadorNovo, 'componente fictício; não executar');
    const novo = prepararComponentesDesktop({ origem, diretorio });
    assert.notEqual(novo.servidor, anterior.servidor);
    assert.ok((await readFile(capturadorAnterior)).equals(bytesAnteriores));
    assert.ok((await readFile(anterior.servidor)).length > 0);
    await writeFile(capturadorNovo, 'conteúdo alterado sem nova versão');
    assert.throws(() => prepararComponentesDesktop({ origem, diretorio }), /conteúdo diferente/);
    assert.equal(await readFile(join(dirname(dirname(novo.servidor)), 'native/CapturaMicrofone.exe'), 'utf8'), 'componente fictício; não executar');
  } finally { assert.ok(resolve(pasta).startsWith(resolve(tmpdir()) + sep)); await rm(pasta, { recursive: true, force: true }); }
});

test('componentes recusam uma pasta existente sem identificação própria', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'propriedade componentes '));
  const origem = fileURLToPath(new URL('../pacote/', import.meta.url));
  try {
    const { versao } = validarCatalogo(origem);
    await mkdir(join(pasta, versao));
    assert.throws(() => prepararComponentesDesktop({ origem, diretorio: pasta }), /não pertence a este instalador/);
  } finally { assert.ok(resolve(pasta).startsWith(resolve(tmpdir()) + sep)); await rm(pasta, { recursive: true, force: true }); }
});
