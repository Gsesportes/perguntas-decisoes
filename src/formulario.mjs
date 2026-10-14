import { LIMITE_ENTRADA_MCP, LIMITE_FORMULARIO, LIMITE_RASCUNHO, tamanhoJson } from './limites.mjs';
import { ErroFormulario } from './erros.mjs';
import { normalizarPergunta, validarCondicoes, possuiRecursosNovos, perguntasVisiveis, verificarResposta, respostaAusente, respostaParaEntrega, formatarResposta } from './formatos.mjs';

export { TIPOS, perguntasVisiveis } from './formatos.mjs';
export { ErroFormulario } from './erros.mjs';
export const POR_PAGINA = 6;

function texto(valor, nome, limite = 6000) {
  if (typeof valor !== 'string' || !valor.trim() || valor.length > limite) throw new ErroFormulario(`${nome} deve conter texto de até ${limite} caracteres.`);
  return valor;
}

export function validarTamanhoChamada(nome, entrada) {
  if (tamanhoJson({ name: nome, arguments: entrada }) > LIMITE_ENTRADA_MCP - 4096) throw new ErroFormulario('A chamada supera o limite de 2 MB. Divida o conteúdo; nenhum texto foi truncado.', 'limite_tamanho');
}

export function normalizarFormulario(entrada) {
  if (!entrada || !Array.isArray(entrada.perguntas) || !entrada.perguntas.length || entrada.perguntas.length > 1000) throw new ErroFormulario('Informe de 1 a 1000 perguntas.');
  const titulo = entrada.titulo === undefined ? 'Perguntas e decisões' : texto(entrada.titulo, 'Título', 200);
  const perguntas = entrada.perguntas.flatMap((original, indice) => normalizarPergunta(original, entrada, indice));
  if (entrada.opcoes !== undefined && !perguntas.some(pergunta => ['unica', 'multipla', 'ordenacao'].includes(pergunta.tipo))) throw new ErroFormulario('Alternativas informadas sem uma pergunta de escolha. Indique o tipo de pergunta.');
  if (perguntas.length > 1000) throw new ErroFormulario('O formulário expandido supera 1000 perguntas. Divida a tabela.');
  validarCondicoes(perguntas);
  const formulario = { titulo, perguntas, ...(possuiRecursosNovos(perguntas) ? { formato: perguntas.some(pergunta => pergunta.tipo === 'data_hora') ? 3 : 2 } : {}) };
  if (tamanhoJson(formulario) > LIMITE_FORMULARIO) throw new ErroFormulario('O formulário supera 400 KB. Divida a lista ou reduza as alternativas por item.', 'limite_tamanho');
  return formulario;
}

export function rascunhoVazio() { return { respostas: {}, observacoes: {}, gerais: '', pagina: 0, itens_por_pagina: POR_PAGINA }; }

export function migrarPaginacao(formulario, rascunho) {
  const quantidadeAnterior = rascunho.itens_por_pagina ?? 4;
  if (!Number.isInteger(quantidadeAnterior) || quantidadeAnterior < 1) throw new ErroFormulario('A paginação guardada é inválida. O rascunho foi preservado.');
  const paginaAnterior = rascunho.pagina ?? 0;
  if (!Number.isInteger(paginaAnterior) || paginaAnterior < 0) throw new ErroFormulario('A posição guardada é inválida. O rascunho foi preservado.');
  const ultima = Math.max(0, Math.ceil(perguntasVisiveis(formulario, rascunho.respostas).length / POR_PAGINA) - 1);
  return { ...rascunho, respostas: { ...rascunho.respostas }, observacoes: { ...rascunho.observacoes }, pagina: Math.min(ultima, Math.floor(paginaAnterior * quantidadeAnterior / POR_PAGINA)), itens_por_pagina: POR_PAGINA };
}

export function validarRascunho(formulario, entrada, completo = false) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new ErroFormulario('Preenchimento inválido.');
  const saida = rascunhoVazio();
  const ids = new Set(formulario.perguntas.map(pergunta => pergunta.id));
  for (const grupo of ['respostas', 'observacoes']) {
    if (entrada[grupo] !== undefined && (!entrada[grupo] || typeof entrada[grupo] !== 'object' || Array.isArray(entrada[grupo]))) throw new ErroFormulario(`Grupo ${grupo} inválido.`);
    for (const id of Object.keys(entrada[grupo] ?? {})) if (!ids.has(id)) throw new ErroFormulario(`Pergunta desconhecida: ${id}.`);
  }
  const pendentes = [];
  const visiveis = new Set(perguntasVisiveis(formulario, entrada.respostas).map(pergunta => pergunta.id));
  for (const pergunta of formulario.perguntas) {
    const resposta = entrada.respostas?.[pergunta.id];
    const concluida = verificarResposta(pergunta, resposta);
    if (!concluida && visiveis.has(pergunta.id)) pendentes.push(pergunta.id);
    if (!respostaAusente(resposta)) saida.respostas[pergunta.id] = structuredClone(resposta);
    const observacao = entrada.observacoes?.[pergunta.id] ?? '';
    if (typeof observacao !== 'string' || observacao.length > 16000) throw new ErroFormulario(`Observação inválida em ${pergunta.id}.`);
    if (observacao) saida.observacoes[pergunta.id] = observacao;
  }
  const gerais = entrada.gerais ?? '';
  if (typeof gerais !== 'string' || gerais.length > 16000) throw new ErroFormulario('Observações gerais inválidas.');
  saida.gerais = gerais;
  const ultimaPagina = Math.max(0, Math.ceil(visiveis.size / POR_PAGINA) - 1);
  if (entrada.pagina !== undefined && (!Number.isInteger(entrada.pagina) || entrada.pagina < 0 || entrada.pagina > ultimaPagina)) throw new ErroFormulario('Página inválida.');
  saida.pagina = entrada.pagina ?? 0;
  if (tamanhoJson(saida) > LIMITE_RASCUNHO) throw new ErroFormulario('O preenchimento supera 1 MB. Reduza o conteúdo antes de guardar. O texto digitado permanece nesta tela; não feche o painel antes de confirmar o salvamento.', 'limite_tamanho');
  if (completo && pendentes.length) throw new ErroFormulario(`Faltam ${pendentes.length} respostas. Primeiro item pendente: ${pendentes[0]}.`, 'incompleto');
  return { rascunho: saida, pendentes };
}

export function montarEntrega(formulario, preenchimento) {
  const { rascunho } = validarRascunho(formulario, preenchimento, true);
  const ativas = perguntasVisiveis(formulario, rascunho.respostas);
  const respostas = ativas.map(pergunta => ({ id: pergunta.id, pergunta: pergunta.grupo ? `${pergunta.grupo.texto} — ${pergunta.texto}` : pergunta.texto, resposta: respostaParaEntrega(pergunta, rascunho.respostas[pergunta.id]), ...(rascunho.observacoes[pergunta.id] ? { observacao: rascunho.observacoes[pergunta.id] } : {}) }));
  const blocos = respostas.map((item, indice) => `${item.id.toUpperCase()} · ${item.pergunta}\nResposta: ${formatarResposta(ativas[indice], item.resposta)}${item.observacao ? `\nObservações: ${item.observacao}` : ''}`);
  return { texto: [formulario.titulo, ...blocos, ...(rascunho.gerais ? [`Observações gerais: ${rascunho.gerais}`] : [])].join('\n\n'), compacto: { respostas: respostas.map(({ id, resposta, observacao }) => observacao ? [id, resposta, observacao] : [id, resposta]), ...(rascunho.gerais ? { observacoes: rascunho.gerais } : {}) } };
}
