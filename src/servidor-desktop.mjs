import { readFileSync } from 'node:fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ListResourceTemplatesRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { FERRAMENTAS, URI_INTERFACE, chamarFerramenta } from './servidor.mjs';
import { ErroFormulario } from './formulario.mjs';
import { abrirArmazenamentoDesktop } from './armazenamento-desktop.mjs';
import { LIMITE_BUFFER_TRANSPORTE } from './limites.mjs';

const armazenamento = abrirArmazenamentoDesktop({ diretorio: process.env.PERGUNTAS_DIRETORIO_DADOS });
const html = readFileSync(new URL('../dist/web/painel.html', import.meta.url), 'utf8');
const imagemIcone = readFileSync(new URL('../assets/icone-128.png', import.meta.url));
const icones = [{ src: `data:image/png;base64,${imagemIcone.toString('base64')}`, mimeType: 'image/png', sizes: ['128x128'] }];
const servidor = new Server({ name: 'perguntas-decisoes', title: 'Perguntas e decisões', version: '0.3.5', icons: icones }, { capabilities: { tools: {}, resources: {} } });
servidor.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: FERRAMENTAS }));
servidor.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [{ name: 'painel', uri: URI_INTERFACE, mimeType: 'text/html;profile=mcp-app' }] }));
servidor.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: [] }));
servidor.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => {
  if (params.uri !== URI_INTERFACE) throw new Error('Recurso de interface não encontrado.');
  return { contents: [{ uri: URI_INTERFACE, mimeType: 'text/html;profile=mcp-app', text: html, _meta: { 'openai/ui': { preferredDisplayMode: 'fullscreen', availableDisplayModes: ['fullscreen'] } } }] };
});
servidor.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  try { return await chamarFerramenta(params.name, params.arguments ?? {}, armazenamento.dono, armazenamento.DB); }
  catch (erro) {
    console.error('Operação local não confirmada:', erro.message);
    return { isError: true, content: [{ type: 'text', text: erro instanceof ErroFormulario ? erro.message : 'Falha no armazenamento local. O progresso não foi confirmado.' }] };
  }
});
servidor.onclose = () => armazenamento.fechar();
servidor.onerror = erro => console.error('Falha no protocolo da ferramenta:', erro.message);
await servidor.connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: LIMITE_BUFFER_TRANSPORTE }));
async function encerrar() { await servidor.close(); armazenamento.fechar(); }
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
