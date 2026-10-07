import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const raiz = new URL('../', import.meta.url);
const painel = await readFile(new URL('web/painel.html', raiz), 'utf8');
await mkdir(new URL('dist/server/', raiz), { recursive: true });
await mkdir(new URL('dist/web/', raiz), { recursive: true });
async function compilar(arquivo, formato) {
  const resultado = await build({ entryPoints: [fileURLToPath(new URL(arquivo, raiz))], bundle: true, write: false, minify: true, platform: 'browser', target: 'es2022', format: formato });
  return resultado.outputFiles[0].text.replaceAll('</script', '<\\/script');
}
const javascriptApp = await compilar('src/aplicativo.mjs', 'esm');
const htmlApp = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Perguntas e decisões</title><style>html{color-scheme:light dark}body{margin:0;padding:12px}</style></head><body>${painel}<script type="module">${javascriptApp}</script></body></html>`;
await writeFile(new URL('dist/web/painel.html', raiz), htmlApp);
const origemServidor = `import { atenderMcp } from './src/servidor.mjs'; const html = ${JSON.stringify(htmlApp)}; export default { async fetch(request, env) { const caminho = new URL(request.url).pathname; if (caminho === '/mcp') return atenderMcp(request, env, html); if (caminho === '/') return new Response('Perguntas e decisões: conecte o plugin para abrir um formulário.', {headers:{'content-type':'text/plain; charset=utf-8'}}); return new Response('Página não encontrada.', {status:404}); }};`;
await build({ stdin: { contents: origemServidor, resolveDir: fileURLToPath(raiz), sourcefile: 'worker.mjs' }, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', outfile: fileURLToPath(new URL('dist/server/index.js', raiz)) });
const javascriptInline = await compilar('src/inline.mjs', 'iife');
const inline = `${painel}\n<script>${javascriptInline}</script>\n`;
if (new TextEncoder().encode(inline).length > 1000000) throw new Error('A apresentação ultrapassou 1 MB.');
await writeFile(new URL('dist/web/inline.html', raiz), inline);
console.log(`Construção concluída. Interface MCP: ${new TextEncoder().encode(htmlApp).length} bytes. Apresentação: ${new TextEncoder().encode(inline).length} bytes.`);
