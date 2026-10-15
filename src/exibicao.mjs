import { VERSAO_PLUGIN } from './versao.mjs';
export const URI_INTERFACE = `ui://perguntas-decisoes/${VERSAO_PLUGIN}/painel`;
export const URI_INTERFACE_CHAT = `ui://perguntas-decisoes/${VERSAO_PLUGIN}/chat`;
export const URI_INTERFACE_LEGADA = 'ui://perguntas-decisoes/painel';
export const URI_INTERFACE_CHAT_LEGADA = 'ui://perguntas-decisoes/chat';
export const EXIBICAO_FORMULARIO = { preferredDisplayMode: 'fullscreen', availableDisplayModes: ['fullscreen', 'inline'] };
export const EXIBICAO_NO_CHAT = { preferredDisplayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'] };
export const RECURSOS_INTERFACE = [
  { name: 'painel', uri: URI_INTERFACE, mimeType: 'text/html;profile=mcp-app' },
  { name: 'formulario-no-chat', uri: URI_INTERFACE_CHAT, mimeType: 'text/html;profile=mcp-app' }
];

export function lerRecursoInterface(html, uri) {
  const apresentacao = [URI_INTERFACE, URI_INTERFACE_LEGADA].includes(uri) ? 'lateral' : [URI_INTERFACE_CHAT, URI_INTERFACE_CHAT_LEGADA].includes(uri) ? 'chat' : null;
  if (!apresentacao) throw new Error('Recurso de interface não encontrado.');
  const marcador = 'id="perguntas-decisoes-app"';
  if (!html.includes(marcador)) throw new Error('A interface não contém o formulário esperado.');
  return {
    uri,
    mimeType: 'text/html;profile=mcp-app',
    text: html.replace(marcador, `${marcador} data-apresentacao="${apresentacao}"`),
    _meta: { ui: { permissions: { clipboardWrite: {} } }, 'openai/ui': apresentacao === 'chat' ? EXIBICAO_NO_CHAT : EXIBICAO_FORMULARIO }
  };
}

export async function ajustarApresentacao(aplicativo, apresentacao = 'lateral') {
  if (!['lateral', 'chat'].includes(apresentacao)) throw new Error('Apresentação desconhecida.');
  const esperado = apresentacao === 'chat' ? 'inline' : 'fullscreen';
  const contexto = aplicativo.getHostContext();
  if (contexto?.displayMode === esperado) return esperado;
  if (!contexto?.availableDisplayModes?.includes(esperado)) return contexto?.displayMode ?? 'desconhecido';
  let resultado;
  try { resultado = await aplicativo.requestDisplayMode({ mode: esperado }); }
  catch (erro) {
    const observado = aplicativo.getHostContext()?.displayMode;
    if (observado === esperado) return observado;
    throw erro;
  }
  return aplicativo.getHostContext()?.displayMode === esperado ? esperado : resultado.mode;
}
