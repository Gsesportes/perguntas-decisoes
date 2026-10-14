import { open } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Repositorio } from './repositorio.mjs';
import { ErroFormulario } from './erros.mjs';

const LIMITE_IMAGEM = 1024 * 1024;
export const FERRAMENTA_IMAGEM = { name: 'ler_imagem', description: 'Carrega uma alternativa visual do formulário atual.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, pergunta: { type: 'string' }, opcao: { type: 'integer' } }, required: ['id', 'pergunta', 'opcao'], additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, _meta: { ui: { visibility: ['app'] } } };
function identificar(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new ErroFormulario('O arquivo não é uma imagem PNG, JPEG ou WebP válida.');
}
async function carregar(referencia, diretorioAssets) {
  if (referencia.startsWith('data:')) {
    const partes = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(referencia);
    if (!partes || partes[2].length > Math.ceil(LIMITE_IMAGEM / 3) * 4) throw new ErroFormulario('Imagem incorporada inválida ou maior que 1 MiB.');
    const bytes = Buffer.from(partes[2], 'base64');
    const tipo = identificar(bytes);
    if (bytes.length > LIMITE_IMAGEM || tipo !== partes[1]) throw new ErroFormulario('Formato ou tamanho da imagem não confirmado.');
    return { tipo, dados: bytes.toString('base64') };
  }
  let caminho = referencia;
  if (caminho.startsWith('file:')) { const url = new URL(caminho); if (url.hostname && url.hostname !== 'localhost') throw new ErroFormulario('Use uma imagem neste computador.'); caminho = fileURLToPath(url); }
  if (caminho.startsWith('\\\\') || /^[a-z][a-z\d+.-]*:\/\//i.test(caminho)) throw new ErroFormulario('Use uma imagem local, sem servidor remoto.');
  if (!isAbsolute(caminho)) {
    if (!/^assets[\\/]/.test(caminho)) throw new ErroFormulario('Informe o caminho absoluto da imagem ou um asset do plugin.');
    const base = resolve(diretorioAssets ?? fileURLToPath(new URL('../assets/', import.meta.url)));
    caminho = resolve(base, caminho.replace(/^assets[\\/]/, ''));
    if (relative(base, caminho).startsWith('..')) throw new ErroFormulario('Referência de imagem fora dos assets.');
  }
  const arquivo = await open(caminho, 'r');
  try {
    const info = await arquivo.stat();
    if (!info.isFile() || info.size < 1 || info.size > LIMITE_IMAGEM) throw new ErroFormulario('A imagem deve ser um arquivo de até 1 MiB.');
    const memoria = Buffer.alloc(info.size + 1); let usados = 0;
    while (usados < memoria.length) {
      const { bytesRead } = await arquivo.read(memoria, usados, memoria.length - usados, usados);
      if (!bytesRead) break;
      usados += bytesRead;
    }
    if (usados > info.size) throw new ErroFormulario('A imagem mudou durante a leitura. Tente novamente.');
    const bytes = memoria.subarray(0, usados);
    return { tipo: identificar(bytes), dados: bytes.toString('base64') };
  } finally { await arquivo.close(); }
}
export async function lerImagemFormulario({ banco, dono, entrada, diretorioAssets }) {
  if (!entrada || Object.keys(entrada).some(chave => !['id', 'pergunta', 'opcao'].includes(chave)) || typeof entrada.id !== 'string' || entrada.id.length < 1 || entrada.id.length > 100 || typeof entrada.pergunta !== 'string' || entrada.pergunta.length > 100 || !Number.isInteger(entrada.opcao) || entrada.opcao < 0 || entrada.opcao > 19) throw new ErroFormulario('Referência de alternativa visual inválida.');
  const registro = await new Repositorio(banco).ler(dono, entrada.id);
  const pergunta = registro.formulario.perguntas.find(item => item.id === entrada.pergunta);
  if (pergunta?.tipo !== 'imagens' || !pergunta.opcoes[entrada.opcao]) throw new ErroFormulario('Alternativa visual não encontrada.');
  try { return { content: [], _meta: { imagem: await carregar(pergunta.opcoes[entrada.opcao].imagem, diretorioAssets) } }; }
  catch (erro) { throw erro instanceof ErroFormulario ? erro : new ErroFormulario('Não foi possível ler a imagem local. Confira se o arquivo ainda existe e está acessível.'); }
}
