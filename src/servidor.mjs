import { normalizarFormulario, rascunhoVazio, validarRascunho, montarEntrega, migrarPaginacao, ErroFormulario, TIPOS, validarTamanhoChamada } from './formulario.mjs';
import { VERSAO_PLUGIN } from './versao.mjs';
import { Repositorio } from './repositorio.mjs';
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker';

export const URI_INTERFACE = `ui://perguntas-decisoes/${VERSAO_PLUGIN}/painel`;
export const URI_INTERFACE_LEGADA = 'ui://perguntas-decisoes/painel';
const esquemaPergunta = { anyOf: [{ type: 'string' }, { type: 'object', properties: { texto: { type: 'string' }, tipo: { enum: TIPOS }, opcoes: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'object', properties: { texto: { type: 'string' }, imagem: { type: 'string' } }, required: ['texto', 'imagem'], additionalProperties: false }] } }, min: { type: 'number' }, max: { type: 'number' }, passo: { type: 'number' }, itens: { type: 'array', items: { type: 'string' } }, total: { type: 'integer' }, unidade: { type: 'string' }, min_itens: { type: 'integer' }, max_itens: { type: 'integer' }, visual: { enum: ['botoes', 'estrelas', 'emojis', 'barra'] }, se: { type: 'object', properties: { pergunta: { type: 'string' }, igual: { type: ['string', 'number'] } }, required: ['pergunta', 'igual'], additionalProperties: false } }, required: ['texto'], additionalProperties: false }] };
const objeto = properties => ({ type: 'object', properties, additionalProperties: false });
const leitura = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const alteracao = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const ui = { ui: { resourceUri: URI_INTERFACE } };
const privada = { ui: { visibility: ['app'] } };

export const FERRAMENTAS = [
  { name: 'criar_formulario', title: 'Responder perguntas', description: 'Cria no painel lateral sem mudar de chat. Observações e páginas automáticas. tabela/pontos usam itens; ordenacao usa opcoes; imagens usa opcoes [{texto,imagem local}]; visual muda notas; se {pergunta:p1,igual:valor} condiciona. Tipo/opções comuns opcionais.', inputSchema: { ...objeto({ titulo: { type: 'string' }, perguntas: { type: 'array', items: esquemaPergunta }, tipo: { enum: TIPOS }, opcoes: { type: 'array', items: { type: 'string' } } }), required: ['perguntas'] }, annotations: alteracao, _meta: ui },
  { name: 'abrir_painel', title: 'Perguntas e decisões', description: 'Abre a aba lateral; pelo id retoma um formulário, sem id lista pendentes. Preserve o chat principal: não navegue nem ative janelas para abrir ou verificar.', inputSchema: objeto({ id: { type: 'string' } }), annotations: leitura, _meta: { ...ui, 'openai/ui': { entrypoints: [{ type: 'thread' }, { type: 'global' }] } } },
  { name: 'ler_formulario', inputSchema: { ...objeto({ id: { type: 'string' } }), required: ['id'] }, annotations: leitura, _meta: privada },
  { name: 'listar_pendentes', inputSchema: objeto({ cursor: { ...objeto({ criado_em: { type: 'string', minLength: 1, maxLength: 100 }, id: { type: 'string', minLength: 1, maxLength: 100 } }), required: ['criado_em', 'id'] } }), annotations: leitura, _meta: privada },
  { name: 'salvar_rascunho', inputSchema: { ...objeto({ id: { type: 'string' }, versao: { type: 'integer' }, rascunho: { type: 'object' } }), required: ['id', 'versao', 'rascunho'] }, annotations: alteracao, _meta: privada },
  { name: 'preparar_entrega', inputSchema: { ...objeto({ id: { type: 'string' }, versao: { type: 'integer' }, rascunho: { type: 'object' }, idempotencia: { type: 'string', minLength: 1, maxLength: 100 } }), required: ['id', 'versao', 'rascunho'] }, annotations: alteracao, _meta: privada },
  { name: 'confirmar_entrega', inputSchema: { ...objeto({ id: { type: 'string' }, token: { type: 'string' } }), required: ['id', 'token'] }, annotations: { ...alteracao, destructiveHint: true }, _meta: privada },
  { name: 'retomar_edicao', inputSchema: { ...objeto({ id: { type: 'string' }, token: { type: 'string' } }), required: ['id', 'token'] }, annotations: alteracao, _meta: privada }
];

const esquemasEntrada = new CfWorkerJsonSchemaValidator();
const validadoresEntrada = new Map(FERRAMENTAS.map(ferramenta => [ferramenta.name, esquemasEntrada.getValidator(ferramenta.inputSchema)]));
const mensagensObrigatorias = {
  id: 'Identificador do formulário obrigatório.',
  versao: 'Número de versão do rascunho obrigatório.',
  rascunho: 'Preenchimento obrigatório.',
  token: 'Confirmação da entrega obrigatória.',
  perguntas: 'Lista de perguntas obrigatória.'
};

function validarEntradaFerramenta(nome, entrada) {
  validarTamanhoChamada(nome, entrada);
  const ferramenta = FERRAMENTAS.find(item => item.name === nome);
  if (!ferramenta) throw new ErroFormulario('Ferramenta desconhecida.');
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new ErroFormulario('Os parâmetros da ferramenta devem formar um objeto.');
  for (const campo of ferramenta.inputSchema.required ?? []) {
    if (entrada[campo] === undefined || entrada[campo] === null) throw new ErroFormulario(mensagensObrigatorias[campo]);
  }
  for (const campo of ['id', 'token']) {
    if (typeof entrada[campo] === 'string' && !entrada[campo].trim()) throw new ErroFormulario(mensagensObrigatorias[campo]);
  }
  if (!validadoresEntrada.get(nome)(entrada).valid) throw new ErroFormulario('Parâmetros inválidos. Confira os tipos dos campos e remova campos não previstos pela ferramenta.');
}

function paraInterface(registro) {
  return { content: [], structuredContent: { id: registro.id, total: registro.formulario.perguntas.length }, _meta: { formulario: registro.formulario, rascunho: migrarPaginacao(registro.formulario, registro.rascunho), versao: registro.versao, preparacao: registro.entrega, versao_plugin: VERSAO_PLUGIN } };
}

export async function chamarFerramenta(nome, entrada, dono, banco) {
  validarEntradaFerramenta(nome, entrada);
  const repositorio = new Repositorio(banco);
  if (nome === 'criar_formulario') return paraInterface(await repositorio.criar(dono, normalizarFormulario(entrada), rascunhoVazio()));
  if (nome === 'abrir_painel') {
    if (entrada.id) return paraInterface(await repositorio.ler(dono, entrada.id));
    return { content: [], structuredContent: { estado: 'painel' }, _meta: await repositorio.listar(dono) };
  }
  if (nome === 'listar_pendentes') return { content: [], _meta: await repositorio.listar(dono, entrada.cursor) };
  if (nome === 'ler_formulario') return paraInterface(await repositorio.ler(dono, entrada.id));
  if (nome === 'salvar_rascunho') {
    const atual = await repositorio.ler(dono, entrada.id);
    const { rascunho } = validarRascunho(atual.formulario, entrada.rascunho);
    const salvo = await repositorio.salvar(dono, entrada.id, entrada.versao, rascunho);
    return { content: [], _meta: { versao: salvo.versao } };
  }
  if (nome === 'preparar_entrega') {
    const atual = await repositorio.ler(dono, entrada.id);
    const { rascunho } = validarRascunho(atual.formulario, entrada.rascunho, true);
    const entrega = { ...montarEntrega(atual.formulario, rascunho), id: atual.id, token: entrada.idempotencia ?? crypto.randomUUID() };
    const salvo = await repositorio.preparar(dono, atual.id, entrada.versao, rascunho, entrega);
    return { content: [], _meta: { entrega: salvo.entrega, versao: salvo.versao } };
  }
  if (nome === 'confirmar_entrega') {
    await repositorio.concluir(dono, entrada.id, entrada.token);
    return { content: [], structuredContent: { estado: 'entregue' } };
  }
  if (nome === 'retomar_edicao') {
    const atual = await repositorio.retomar(dono, entrada.id, entrada.token);
    return { content: [], _meta: { versao: atual.versao } };
  }
  throw new ErroFormulario('Ferramenta desconhecida.');
}

function json(valor, status = 200) { return new Response(JSON.stringify(valor), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }); }

export async function atenderMcp(request, env, interfaceHtml) {
  if (request.method !== 'POST') return new Response('Use POST para MCP.', { status: 405, headers: { Allow: 'POST' } });
  let chamada;
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 2000000) return json({ erro: 'Entrada muito grande.' }, 413);
    const corpo = await request.text();
    if (new TextEncoder().encode(corpo).length > 2000000) return json({ erro: 'Entrada muito grande.' }, 413);
    chamada = JSON.parse(corpo);
  } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido.' } }, 400); }
  if (!chamada || Array.isArray(chamada) || chamada.jsonrpc !== '2.0' || typeof chamada.method !== 'string') return json({ jsonrpc: '2.0', id: chamada?.id ?? null, error: { code: -32600, message: 'Requisição MCP inválida.' } }, 400);
  if (chamada.id === undefined && chamada.method.startsWith('notifications/')) return new Response(null, { status: 202 });
  if (chamada.id === undefined) return json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Identificador de requisição ausente.' } }, 400);
  const responder = result => json({ jsonrpc: '2.0', id: chamada.id, result });
  if (chamada.method === 'initialize') {
    const suportados = ['2025-03-26', '2025-06-18', '2025-11-25', '2026-07-28'];
    return responder({ protocolVersion: suportados.includes(chamada.params?.protocolVersion) ? chamada.params.protocolVersion : '2025-11-25', capabilities: { tools: {}, resources: {} }, serverInfo: { name: 'perguntas-decisoes', title: 'Perguntas e decisões', version: VERSAO_PLUGIN } });
  }
  if (chamada.method === 'ping') return responder({});
  if (chamada.method === 'tools/list') return responder({ tools: FERRAMENTAS });
  if (chamada.method === 'resources/list') return responder({ resources: [{ name: 'painel', uri: URI_INTERFACE, mimeType: 'text/html;profile=mcp-app' }] });
  if (chamada.method === 'resources/templates/list') return responder({ resourceTemplates: [] });
  if (chamada.method === 'resources/read' && [URI_INTERFACE, URI_INTERFACE_LEGADA].includes(chamada.params?.uri)) return responder({ contents: [{ uri: chamada.params.uri, mimeType: 'text/html;profile=mcp-app', text: interfaceHtml, _meta: { 'openai/ui': { preferredDisplayMode: 'fullscreen', availableDisplayModes: ['fullscreen'] } } }] });
  if (chamada.method !== 'tools/call') return json({ jsonrpc: '2.0', id: chamada.id, error: { code: -32601, message: 'Método não encontrado.' } });
  const dono = request.headers.get('oai-authenticated-user-id');
  if (!dono) return json({ jsonrpc: '2.0', id: chamada.id, error: { code: -32001, message: 'Entre na sua conta para acessar formulários.' } }, 401);
  if (!env.DB) return responder({ isError: true, content: [{ type: 'text', text: 'Armazenamento não configurado. Nenhum formulário foi criado.' }] });
  try {
    const result = await chamarFerramenta(chamada.params?.name, chamada.params?.arguments ?? {}, dono, env.DB);
    return responder(result);
  } catch (erro) {
    if (!(erro instanceof ErroFormulario)) console.error('Falha no serviço de formulários:', erro.message);
    return responder({ isError: true, ...(erro instanceof ErroFormulario ? { _meta: { codigo_erro: erro.codigo } } : {}), content: [{ type: 'text', text: erro instanceof ErroFormulario ? erro.message : 'Falha no armazenamento. O recebimento ou salvamento não foi confirmado.' }] });
  }
}
