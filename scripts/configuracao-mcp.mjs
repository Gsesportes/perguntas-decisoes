import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';

export async function configuracaoMcp(pastaPacote, { diretorioDados } = {}) {
  const raiz = resolve(pastaPacote);
  const manifesto = JSON.parse(await readFile(join(raiz, 'mcp.json'), 'utf8'));
  const servidor = manifesto.mcpServers?.perguntas;
  if (!servidor || typeof servidor.command !== 'string' || !Array.isArray(servidor.args) || !servidor.args.every(item => typeof item === 'string')) throw new Error('O manifesto MCP não contém um comando válido.');
  const usaDados = String(servidor.cwd).includes('${PLUGIN_DATA}') || servidor.args.some(item => item.includes('${PLUGIN_DATA}'));
  if (usaDados && !diretorioDados) throw new Error('Informe o diretório de dados para verificar este manifesto.');
  const dados = diretorioDados ? resolve(diretorioDados) : raiz;
  const expandir = valor => valor.replaceAll('${PLUGIN_ROOT}', raiz).replaceAll('${PLUGIN_DATA}', dados);
  const cwd = resolve(raiz, expandir(servidor.cwd ?? '.'));
  const basePermitida = String(servidor.cwd).startsWith('${PLUGIN_DATA}') ? dados : raiz;
  const caminhoRelativo = relative(basePermitida, cwd);
  if (isAbsolute(caminhoRelativo) || caminhoRelativo === '..' || caminhoRelativo.startsWith('..' + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('O diretório do servidor precisa permanecer dentro do pacote.');
  return { command: servidor.command, args: servidor.args.map(expandir), cwd };
}
