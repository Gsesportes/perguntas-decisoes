import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions } from '@openai/mcp-extensions/app';
import { montarInterface } from './interface.mjs';
import { capacidadesEntrega, entregarNoAplicativo } from './entregas.mjs';
import { validarTamanhoChamada } from './formulario.mjs';
import { EXIBICAO_FORMULARIO, ajustarApresentacao } from './exibicao.mjs';

const aplicativo = new App({ name: 'perguntas-decisoes', version: '0.3.8' }, { availableDisplayModes: EXIBICAO_FORMULARIO.availableDisplayModes });
const apresentacao = document.getElementById('perguntas-decisoes-app').dataset.apresentacao ?? 'lateral';
const modoEsperado = apresentacao === 'chat' ? 'inline' : 'fullscreen';
const avisoApresentacao = `O aplicativo não confirmou a abertura ${apresentacao === 'chat' ? 'dentro da conversa' : 'na barra lateral'}.`;
const extensoes = new OpenAIExtensions(aplicativo);
async function chamar(name, args) {
  validarTamanhoChamada(name, args);
  const resultado = await aplicativo.callServerTool({ name, arguments: args });
  if (resultado.isError) throw new Error(resultado.content?.find(item => item.type === 'text')?.text ?? 'Operação não confirmada.');
  return resultado;
}
const adaptador = {
  origem: 'Perguntas e decisões',
  conexao: 'Os três modos entregam o conjunto ao aplicativo. A retenção termina depois da confirmação.',
  capacidades: () => capacidadesEntrega(aplicativo, extensoes),
  salvar: async (id, versao, rascunho) => (await chamar('salvar_rascunho', { id, versao, rascunho }))._meta.versao,
  preparar: async (id, versao, rascunho, ...extra) => { const resultado = await chamar('preparar_entrega', { id, versao, rascunho, idempotencia: extra[1] }); return { ...resultado._meta.entrega, versao: resultado._meta.versao }; },
  entregar: (modo, entrega) => entregarNoAplicativo(modo, entrega, aplicativo, extensoes),
  concluir: (id, token) => chamar('confirmar_entrega', { id, token }),
  retomar: async (id, token) => (await chamar('retomar_edicao', { id, token }))._meta.versao,
  ler: id => chamar('ler_formulario', { id }),
  listar: cursor => chamar('listar_pendentes', { cursor })
};
const interfaceUsuario = montarInterface(document.getElementById('perguntas-decisoes-app'), adaptador);
function atualizarApresentacao(modo) {
  document.documentElement.dataset.modoExibicao = modo ?? 'desconhecido';
  interfaceUsuario.mostrarAvisoApresentacao(modo === modoEsperado ? '' : avisoApresentacao);
}
function aplicarTema() {
  const contexto = aplicativo.getHostContext();
  atualizarApresentacao(contexto?.displayMode);
  if (contexto?.theme) applyDocumentTheme(contexto.theme);
  if (contexto?.styles?.variables) applyHostStyleVariables(contexto.styles.variables);
  interfaceUsuario.atualizarNavegacao();
}
aplicativo.ontoolresult = resultado => interfaceUsuario.carregar(resultado);
aplicativo.addEventListener('hostcontextchanged', aplicarTema);
if (window.parent === window) {
  adaptador.conexao = 'Abra este painel pelo plugin conectado ao Codex ou ao ChatGPT. Não há conexão com uma conversa nesta página isolada.';
  interfaceUsuario.mostrarErro(adaptador.conexao);
} else {
  let conectado = false;
  try {
    await aplicativo.connect();
    conectado = true;
    aplicarTema();
    const modo = await ajustarApresentacao(aplicativo, apresentacao);
    atualizarApresentacao(modo);
  } catch (erro) {
    if (!conectado) adaptador.conexao = 'Conexão com o aplicativo não confirmada. Nenhuma entrega foi realizada.';
    interfaceUsuario.mostrarAvisoApresentacao(`${conectado ? avisoApresentacao : adaptador.conexao} ${erro.message}`);
  }
}
