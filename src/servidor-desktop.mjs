import { readFileSync } from 'node:fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ListResourceTemplatesRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { FERRAMENTAS, chamarFerramenta } from './servidor.mjs';
import { ErroFormulario } from './formulario.mjs';
import { abrirArmazenamentoDesktop } from './armazenamento-desktop.mjs';
import { LIMITE_BUFFER_TRANSPORTE } from './limites.mjs';
import { RECURSOS_INTERFACE, lerRecursoInterface } from './exibicao.mjs';

const armazenamento = abrirArmazenamentoDesktop({ diretorio: process.env.PERGUNTAS_DIRETORIO_DADOS });
const html = readFileSync(new URL('../dist/web/painel.html', import.meta.url), 'utf8');
const imagemIcone = readFileSync(new URL('../assets/icone-128.png', import.meta.url));
const icones = [{ src: `data:image/png;base64,${imagemIcone.toString('base64')}`, mimeType: 'image/png', sizes: ['128x128'] }];
const servidor = new Server({ name: 'perguntas-decisoes', title: 'Perguntas e decisões', version: '0.3.9', icons: icones }, { capabilities: { tools: {}, resources: {} } });
servidor.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: FERRAMENTAS }));
servidor.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: RECURSOS_INTERFACE }));
servidor.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: [] }));
servidor.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => {
  return { contents: [lerRecursoInterface(html, params.uri)] };
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
