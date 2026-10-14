import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { bancoLocal } from '../scripts/banco-local.mjs';
import { chamarFerramenta } from '../src/servidor.mjs';
import { lerImagemFormulario } from '../src/imagens-desktop.mjs';

async function criar(banco, imagens) {
  const r = await chamarFerramenta('criar_formulario', { perguntas: [{ texto: 'Escolha', tipo: 'imagens', opcoes: imagens.map((imagem, i) => ({ texto: `Opção ${i + 1}`, imagem })) }] }, 'perfil-imagens', banco);
  return { id: r.structuredContent.id, pergunta: 'p1', opcao: 0 };
}
test('imagem local declarada é lida somente como metadado privado do formulário', async () => {
  const banco = bancoLocal();
  try {
    const entrada = await criar(banco, ['assets/icone-128.png', 'assets/logo-verde.png']);
    const r = await lerImagemFormulario({ banco, dono: 'perfil-imagens', entrada });
    assert.deepEqual(r.content, []); assert.equal(r._meta.imagem.tipo, 'image/png');
    assert.ok(Buffer.from(r._meta.imagem.dados, 'base64').equals(await readFile(new URL('../assets/icone-128.png', import.meta.url))));
    await assert.rejects(lerImagemFormulario({ banco, dono: 'outro-perfil', entrada }), /acesso não autorizado/);
    await assert.rejects(lerImagemFormulario({ banco, dono: 'perfil-imagens', entrada: { ...entrada, opcao: 99 } }), /inválida/);
    await assert.rejects(lerImagemFormulario({ banco, dono: 'perfil-imagens', entrada: { ...entrada, caminho: 'arquivo-ficticio' } }), /inválida/);
  } finally { banco.fechar(); }
});
test('imagem incorporada confere os bytes e recusa SVG, script e URL remota', async () => {
  const banco = bancoLocal();
  try {
    const png = 'data:image/png;base64,' + (await readFile(new URL('../assets/icone-128.png', import.meta.url))).toString('base64');
    const entrada = await criar(banco, [png, png]);
    assert.equal((await lerImagemFormulario({ banco, dono: 'perfil-imagens', entrada }))._meta.imagem.tipo, 'image/png');
    for (const valor of ['javascript:alert(1)', 'https://exemplo.invalid/imagem.png', 'data:image/svg+xml;base64,AAAA']) await assert.rejects(criar(banco, [valor, png]), /local|incorporada/);
    const falso = await criar(banco, ['data:image/png;base64,SGVsbG8=', png]);
    await assert.rejects(lerImagemFormulario({ banco, dono: 'perfil-imagens', entrada: falso }), /não é uma imagem/);
  } finally { banco.fechar(); }
});
test('arquivo excessivo, inexistente ou texto não vira imagem silenciosamente', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'imagens-perguntas-'));
  const banco = bancoLocal();
  try {
    const grande = join(pasta, 'grande.png'); await writeFile(grande, Buffer.alloc(1024 * 1024 + 1));
    const texto = join(pasta, 'texto.png'); await writeFile(texto, 'Conteúdo fictício que não é imagem');
    for (const caminho of [grande, texto, join(pasta, 'ausente.png')]) {
      const entrada = await criar(banco, [caminho, 'assets/icone-128.png']);
      await assert.rejects(lerImagemFormulario({ banco, dono: 'perfil-imagens', entrada }), /imagem|Imagem/);
    }
  } finally { banco.fechar(); assert.ok(resolve(pasta).startsWith(resolve(tmpdir()) + sep)); await rm(pasta, { recursive: true, force: true }); }
});

test('asset persistente é independente da pasta descartável do pacote', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'asset-persistente-'));
  const banco = bancoLocal();
  try {
    await copyFile(new URL('../assets/icone-128.png', import.meta.url), join(pasta, 'opcao-salva.png'));
    const entrada = await criar(banco, ['assets/opcao-salva.png', 'assets/icone-128.png']);
    const r = await lerImagemFormulario({ banco, dono: 'perfil-imagens', entrada, diretorioAssets: pasta });
    assert.equal(r._meta.imagem.tipo, 'image/png');
    assert.ok(Buffer.from(r._meta.imagem.dados, 'base64').equals(await readFile(join(pasta, 'opcao-salva.png'))));
  } finally { banco.fechar(); assert.ok(resolve(pasta).startsWith(resolve(tmpdir()) + sep)); await rm(pasta, { recursive: true, force: true }); }
});
