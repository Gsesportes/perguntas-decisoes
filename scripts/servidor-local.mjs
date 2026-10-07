import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { bancoLocal } from './banco-local.mjs';
import worker from '../dist/server/index.js';

await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
const DB = bancoLocal(fileURLToPath(new URL('../.local/rascunhos.sqlite', import.meta.url)));
const servidor = createServer(async (entrada, saida) => {
  try {
    const url = new URL(entrada.url, 'http://127.0.0.1:8768');
    if (url.pathname === '/painel') {
      saida.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      saida.end(await readFile(new URL('../dist/web/painel.html', import.meta.url)));
      return;
    }
    const pedacos = [];
    for await (const pedaco of entrada) pedacos.push(pedaco);
    const headers = new Headers(entrada.headers);
    if (entrada.headers['x-verificacao-local'] === 'sim') headers.set('oai-authenticated-user-id', 'verificacao-local');
    const request = new Request(url, { method: entrada.method, headers, ...(entrada.method === 'POST' ? { body: Buffer.concat(pedacos) } : {}) });
    const resposta = await worker.fetch(request, { DB });
    saida.writeHead(resposta.status, Object.fromEntries(resposta.headers));
    saida.end(Buffer.from(await resposta.arrayBuffer()));
  } catch (erro) { console.error('Falha na verificação local:', erro.message); saida.writeHead(500); saida.end('Falha na verificação local.'); }
});
servidor.listen(8768, '127.0.0.1', () => console.log('Verificação local em http://127.0.0.1:8768 — identidade de teste apenas neste servidor.'));
process.on('SIGINT', () => servidor.close(() => { DB.fechar(); process.exit(0); }));
