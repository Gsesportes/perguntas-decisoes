import { readFile, writeFile, mkdir, copyFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { avisosTerceiros } from './avisos-terceiros.mjs';

const raiz = new URL('../', import.meta.url);
const pacote = new URL('pacote/plugins/perguntas-decisoes/', raiz);
await mkdir(new URL('server/', pacote), { recursive: true });
await mkdir(new URL('dist/web/', pacote), { recursive: true });
await mkdir(new URL('migracoes/', pacote), { recursive: true });
await mkdir(new URL('assets/', pacote), { recursive: true });
await mkdir(new URL('skills/usar-painel-preservando-chat/', pacote), { recursive: true });
await mkdir(new URL('.codex-plugin/', pacote), { recursive: true });
await mkdir(new URL('native/', pacote), { recursive: true });
await mkdir(new URL('pacote/.agents/plugins/', raiz), { recursive: true });
await build({ entryPoints: [fileURLToPath(new URL('src/servidor-desktop.mjs', raiz))], bundle: true, platform: 'node', format: 'esm', target: 'node24', packages: 'bundle', outfile: fileURLToPath(new URL('server/servidor.mjs', pacote)) });
await copyFile(new URL('dist/web/painel.html', raiz), new URL('dist/web/painel.html', pacote));
await copyFile(new URL('native/CapturaMicrofone.exe', raiz), new URL('native/CapturaMicrofone.exe', pacote));
await copyFile(new URL('scripts/preparar-ditado.mjs', raiz), new URL('server/preparar-ditado.mjs', pacote));
try { await unlink(new URL('server/diagnostico-microfone.mjs', pacote)); }
catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
await copyFile(new URL('migracoes/0001_rascunhos.sql', raiz), new URL('migracoes/0001_rascunhos.sql', pacote));
await copyFile(new URL('skills/usar-painel-preservando-chat/SKILL.md', raiz), new URL('skills/usar-painel-preservando-chat/SKILL.md', pacote));
await copyFile(new URL('assets/logo-verde.png', raiz), new URL('assets/logo-verde.png', pacote));
await copyFile(new URL('assets/icone-128.png', raiz), new URL('assets/icone-128.png', pacote));
await copyFile(new URL('LICENSE', raiz), new URL('LICENSE', pacote));
await writeFile(new URL('THIRD_PARTY_NOTICES.txt', pacote), await avisosTerceiros(raiz));
const interfacePlugin = { displayName: 'Perguntas e decisões', shortDescription: 'Perguntas e escolhas em lote', longDescription: 'Formulários locais com observações e entrega na conversa.', category: 'Productivity', capabilities: ['Interactive'], defaultPrompt: 'Crie um formulário para reunir as perguntas deste assunto.', logo: './assets/logo-verde.png', composerIcon: './assets/icone-128.png', brandColor: '#007568', brandColorDark: '#8AD7BF' };
const versao = JSON.parse(await readFile(new URL('package.json', raiz), 'utf8')).version;
const manifesto = { $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'perguntas-decisoes', version: versao, description: 'Perguntas e decisões em lote no aplicativo desktop.', extensions: { 'com.openai': { interface: interfacePlugin } } };
const mcp = { $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', mcpServers: { perguntas: { type: 'stdio', command: 'node', args: ['server/servidor.mjs'], cwd: './' } } };
const compativel = { name: manifesto.name, version: manifesto.version, description: manifesto.description, mcpServers: './.mcp.json', skills: './skills', interface: interfacePlugin };
const mcpCompativel = { mcpServers: { perguntas: { command: 'node', args: ['server/servidor.mjs'], cwd: './' } } };
const catalogo = { name: 'perguntas-decisoes-local', interface: { displayName: 'Perguntas e decisões — local' }, plugins: [{ name: manifesto.name, source: { source: 'local', path: './plugins/perguntas-decisoes' }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' }] };
for (const [arquivo, dados] of [['plugin.json', manifesto], ['mcp.json', mcp], ['.mcp.json', mcpCompativel], ['.codex-plugin/plugin.json', compativel]]) await writeFile(new URL(arquivo, pacote), JSON.stringify(dados, null, 2) + '\n');
await writeFile(new URL('pacote/.agents/plugins/marketplace.json', raiz), JSON.stringify(catalogo, null, 2) + '\n');
const arquivos = ['plugin.json', 'mcp.json', '.mcp.json', '.codex-plugin/plugin.json', 'server/servidor.mjs', 'dist/web/painel.html', 'migracoes/0001_rascunhos.sql', 'skills/usar-painel-preservando-chat/SKILL.md', 'assets/logo-verde.png', 'assets/icone-128.png'];
for (const arquivo of arquivos) if (!(await readFile(new URL(arquivo, pacote))).length) throw new Error(`Arquivo vazio no pacote: ${arquivo}`);
console.log(`Pacote desktop construído em ${fileURLToPath(pacote)}.`);
