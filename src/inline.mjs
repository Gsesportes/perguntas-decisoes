import { montarInterface } from './interface.mjs';
import { FORMULARIO_EXEMPLO, RASCUNHO_EXEMPLO } from './exemplo.mjs';
import { montarEntrega, migrarPaginacao } from './formulario.mjs';
import { copiarTexto } from './copia.mjs';

const id = 'exemplo-interface-v2';
const estadosProprios = new Set();
const adaptador = {
  copiar: texto => copiarTexto(texto),
  origem: 'Demonstração com perguntas fictícias · comece sem respostas selecionadas',
  conexao: 'Enviar ao chat usa a conversa quando o aplicativo oferece esse recurso. Anotação e arquivo exigem o plugin conectado; ficam indisponíveis aqui.',
  capacidades: () => ({ chat: typeof window.openai?.sendFollowUpMessage === 'function', anotacao: false, arquivo: false }),
  get salvamento() { return window.openai?.setWidgetState ? 'Progresso guardado' : 'Progresso só nesta sessão'; },
  salvar: async (_id, versao, rascunho) => {
    const api = window.openai;
    if (!api?.setWidgetState) return versao + 1;
    const estado = { id, rascunho };
    if (new TextEncoder().encode(JSON.stringify(estado)).length > 15000) throw new Error('O progresso ultrapassou o limite desta apresentação. Use o plugin conectado.');
    estadosProprios.add(JSON.stringify(estado));
    if (estadosProprios.size > 100) estadosProprios.delete(estadosProprios.values().next().value);
    await api.setWidgetState({ modelContent: null, privateContent: estado });
    return versao + 1;
  },
  preparar: async (_id, versao, rascunho, formulario) => ({ id, token: 'preenchimento-local', versao, ...montarEntrega(formulario, rascunho) }),
  entregar: async (modo, entrega) => {
    if (modo !== 'chat' || !adaptador.capacidades().chat) throw new Error('Essa entrega exige o plugin conectado.');
    await window.openai.sendFollowUpMessage({ prompt: entrega.texto, title: 'Enviar respostas do formulário à conversa' });
    return 'Respostas entregues à conversa pelo aplicativo.';
  },
  concluir: async () => {
    const marcador = { id, concluido: true };
    estadosProprios.clear();
    estadosProprios.add(JSON.stringify(marcador));
    if (window.openai?.setWidgetState) await window.openai.setWidgetState({ modelContent: null, privateContent: marcador });
  },
  retomar: async (_id, _token, versao) => versao + 1,
  ler: async () => { throw new Error('Reabertura disponível no plugin conectado.'); }
};
const interfaceUsuario = montarInterface(document.getElementById('perguntas-decisoes-app'), adaptador);
function carregar(estado) {
  if (estado?.id === id && estado.concluido) {
    const raiz = document.getElementById('perguntas-decisoes-app');
    raiz.querySelector('[data-formulario]').hidden = true;
    raiz.querySelector('[data-sucesso]').textContent = 'Este formulário já foi entregue. As respostas não foram mantidas no rascunho.';
    raiz.querySelector('[data-sucesso]').hidden = false;
    return;
  }
  const rascunho = migrarPaginacao(FORMULARIO_EXEMPLO, estado?.id === id ? estado.rascunho : RASCUNHO_EXEMPLO);
  interfaceUsuario.carregar({ structuredContent: { id }, _meta: { formulario: FORMULARIO_EXEMPLO, rascunho, versao: 1 } });
  if (!window.openai?.setWidgetState) document.querySelector('#perguntas-decisoes-app [data-estado]').textContent = 'Página isolada · progresso só nesta sessão';
}
carregar(window.openai?.widgetState?.privateContent);
window.addEventListener('openai:set_globals', evento => {
  const globals = evento.detail?.globals;
  if (globals?.widgetState && !estadosProprios.has(JSON.stringify(globals.widgetState.privateContent))) carregar(globals.widgetState.privateContent);
});
