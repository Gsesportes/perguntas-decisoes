import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ARQUIVOS_PUBLICOS, ARQUIVOS_GERADOS } from './arquivos-publicos.mjs';

const ignorados = new Set(['node_modules', '.git', '.local', 'publicacao']);
export async function auditarPublicacao(pasta, termos = []) {
  const raiz = resolve(pasta);
  const termosPrivados = termos.map(termo => new RegExp('(^|[^\\p{L}\\p{N}])' + RegExp.escape(termo) + '($|[^\\p{L}\\p{N}])', 'iu'));
  const encontrados = [];
  async function visitar(diretorio) {
    for (const nome of await readdir(diretorio)) {
      const arquivo = resolve(diretorio, nome); const caminho = relative(raiz, arquivo).split(sep).join('/');
      const estado = await lstat(arquivo);
      if (estado.isSymbolicLink()) throw new Error('Link simbólico não permitido: ' + caminho);
      if (estado.isDirectory()) { if (!ignorados.has(nome)) await visitar(arquivo); continue; }
      const gerado = ARQUIVOS_GERADOS.includes(caminho);
      if (!gerado && !ARQUIVOS_PUBLICOS.includes(caminho)) throw new Error('Arquivo fora da lista pública: ' + caminho);
      if (/\.(sqlite(?:-\w+)?|db|log|jsonl|zip)$/i.test(caminho) || /(^|\/)\.env(?:\.|$)/.test(caminho)) throw new Error('Arquivo de uso particular: ' + caminho);
      const bytes = await readFile(arquivo); const texto = bytes.toString('utf8');
      const caminhoPessoal = /[A-Z]:[\\/]Users[\\/][^\\/\s"'<>]+/i.test(texto) || /\/(?:home|Users)\/[^\s"'\\/>]+/.test(texto);
      const segredo = /(?:sk-[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/.test(texto);
      if (caminhoPessoal || segredo || termosPrivados.some(termo => termo.test(texto) || termo.test(caminho))) throw new Error('Referência particular ou credencial detectada em ' + caminho + '; conteúdo omitido.');
      encontrados.push(caminho);
    }
  }
  await visitar(raiz);
  for (const caminho of ARQUIVOS_PUBLICOS) if (!encontrados.includes(caminho)) throw new Error('Arquivo público ausente: ' + caminho);
  return { fonte: ARQUIVOS_PUBLICOS.length, gerados: encontrados.length - ARQUIVOS_PUBLICOS.length, referenciasEncontradas: 0 };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const pasta = process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url));
  const termos = (process.env.PERGUNTAS_TERMOS_PRIVADOS ?? '').split(';').map(item => item.trim()).filter(Boolean);
  console.log(JSON.stringify(await auditarPublicacao(pasta, termos)));
}
