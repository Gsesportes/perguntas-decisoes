import { mkdir, copyFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { ARQUIVOS_PUBLICOS } from './arquivos-publicos.mjs';
import { auditarPublicacao } from './auditar-publicacao.mjs';

const raiz = new URL('../', import.meta.url);
const destino = new URL('publicacao/perguntas-decisoes/', raiz);
await mkdir(new URL('publicacao/', raiz), { recursive: true });
await mkdir(destino);
for (const caminho of ARQUIVOS_PUBLICOS) {
  const origem = new URL(caminho, raiz);
  const partes = caminho.split('/');
  for (let i = 1; i <= partes.length; i += 1) if ((await lstat(new URL(partes.slice(0, i).join('/'), raiz))).isSymbolicLink()) throw new Error('Link simbólico na fonte: ' + caminho);
  if (!(await lstat(origem)).isFile()) throw new Error('A fonte pública precisa ser arquivo regular: ' + caminho);
  const arquivo = new URL(caminho, destino);
  await mkdir(dirname(fileURLToPath(arquivo)), { recursive: true });
  await copyFile(origem, arquivo);
}
const termos = (process.env.PERGUNTAS_TERMOS_PRIVADOS ?? '').split(';').map(item => item.trim()).filter(Boolean);
console.log(JSON.stringify(await auditarPublicacao(fileURLToPath(destino), termos)));
console.log('Cópia pública preparada em publicacao/perguntas-decisoes. Nenhum envio remoto executado.');
