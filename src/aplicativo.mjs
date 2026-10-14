import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions } from '@openai/mcp-extensions/app';
import { montarInterface, coordenarCargaInicial } from './interface.mjs';
import { capacidadesEntrega, entregarNoAplicativo } from './entregas.mjs';
import { validarTamanhoChamada } from './formulario.mjs';
import { VERSAO_PLUGIN } from './versao.mjs';

const aplicativo = new App({ name: 'perguntas-decisoes', version: VERSAO_PLUGIN });
document.getElementById('perguntas-decisoes-app').setAttribute('data-versao', VERSAO_PLUGIN);
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
  listar: cursor => chamar('listar_pendentes', cursor === undefined ? {} : { cursor }),
  ditado: async entrada => (await chamar('controlar_ditado', entrada))._meta,
  lerImagem: async (id, pergunta, opcao) => (await chamar('ler_imagem', { id, pergunta, opcao }))._meta.imagem
};
const interfaceUsuario = montarInterface(document.getElementById('perguntas-decisoes-app'), adaptador);
const cargaInicial = coordenarCargaInicial({ carregar: interfaceUsuario.carregar, listar: () => adaptador.listar(), mostrarErro: interfaceUsuario.mostrarErro });
function aplicarTema() {
  const contexto = aplicativo.getHostContext();
  if (contexto?.theme) applyDocumentTheme(contexto.theme);
  if (contexto?.styles?.variables) applyHostStyleVariables(contexto.styles.variables);
  interfaceUsuario.atualizarNavegacao();
}
aplicativo.ontoolresult = resultado => cargaInicial.receber(resultado);
aplicativo.addEventListener('hostcontextchanged', aplicarTema);
if (window.parent === window) {
  adaptador.conexao = 'Abra este painel pelo plugin conectado ao Codex ou ao ChatGPT. Não há conexão com uma conversa nesta página isolada.';
  interfaceUsuario.mostrarErro(adaptador.conexao);
} else {
  try {
    await aplicativo.connect();
    aplicarTema();
    const contexto = aplicativo.getHostContext();
    if (contexto?.displayMode === 'inline' && contexto.availableDisplayModes?.includes('fullscreen')) await aplicativo.requestDisplayMode({ mode: 'fullscreen' });
    await cargaInicial.iniciar();
  } catch (erro) {
    adaptador.conexao = 'Conexão com o aplicativo não confirmada. Nenhuma entrega foi realizada.';
    interfaceUsuario.mostrarErro(`${adaptador.conexao} ${erro.message}`);
  }
}
