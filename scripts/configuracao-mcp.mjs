import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';

export async function configuracaoMcp(pastaPacote) {
  const raiz = resolve(pastaPacote);
  const manifesto = JSON.parse(await readFile(join(raiz, 'mcp.json'), 'utf8'));
  const servidor = manifesto.mcpServers?.perguntas;
  if (!servidor || typeof servidor.command !== 'string' || !Array.isArray(servidor.args) || !servidor.args.every(item => typeof item === 'string')) throw new Error('O manifesto MCP não contém um comando válido.');
  const cwd = resolve(raiz, servidor.cwd ?? '.');
  const caminhoRelativo = relative(raiz, cwd);
  if (isAbsolute(caminhoRelativo) || caminhoRelativo === '..' || caminhoRelativo.startsWith('..' + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('O diretório do servidor precisa permanecer dentro do pacote.');
  return { command: servidor.command, args: servidor.args, cwd };
}
