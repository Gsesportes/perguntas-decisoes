import { LIMITE_ENTRADA_MCP, LIMITE_FORMULARIO, LIMITE_RASCUNHO, tamanhoJson } from './limites.mjs';

export const TIPOS = ['sim_nao', 'unica', 'multipla', 'texto', 'nota', 'escala', 'numero', 'data', 'hora'];
export const POR_PAGINA = 6;

export class ErroFormulario extends Error {
  constructor(mensagem, codigo = 'entrada_invalida') {
    super(mensagem);
    this.name = 'ErroFormulario';
    this.codigo = codigo;
  }
}

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
  const perguntas = entrada.perguntas.map((original, indice) => {
    const item = typeof original === 'string' ? { texto: original } : original;
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ErroFormulario(`Pergunta ${indice + 1} inválida.`);
    const tipo = item.tipo ?? entrada.tipo ?? 'texto';
    if (!TIPOS.includes(tipo)) throw new ErroFormulario(`Tipo inválido na pergunta ${indice + 1}.`);
    const pergunta = { id: `p${indice + 1}`, texto: texto(item.texto, `Pergunta ${indice + 1}`), tipo };
    if (tipo === 'sim_nao') pergunta.opcoes = ['Sim', 'Não'];
    if (tipo === 'unica' || tipo === 'multipla') {
      const opcoes = item.opcoes ?? entrada.opcoes;
      if (!Array.isArray(opcoes) || opcoes.length < 2 || opcoes.length > 100 || new Set(opcoes).size !== opcoes.length) throw new ErroFormulario(`Informe de 2 a 100 alternativas distintas na pergunta ${indice + 1}.`);
      pergunta.opcoes = opcoes.map(opcao => texto(opcao, 'Alternativa', 300));
    }
    if (['nota', 'escala', 'numero'].includes(tipo)) {
      pergunta.min = item.min ?? (tipo === 'numero' ? -1000000 : 0);
      pergunta.max = item.max ?? (tipo === 'numero' ? 1000000 : 10);
      pergunta.passo = item.passo ?? 1;
      if (![pergunta.min, pergunta.max, pergunta.passo].every(Number.isFinite) || pergunta.min >= pergunta.max || pergunta.passo <= 0) throw new ErroFormulario(`Limites numéricos inválidos na pergunta ${indice + 1}.`);
      if (['nota', 'escala'].includes(tipo) && ![pergunta.min, pergunta.max, pergunta.passo].every(Number.isSafeInteger)) throw new ErroFormulario('Nota e escala por botões exigem limites e passos inteiros; para frações, use número.');
      if ((pergunta.max - pergunta.min) / pergunta.passo > 20 && ['nota', 'escala'].includes(tipo)) throw new ErroFormulario('Uma nota ou escala por botões pode ter até 21 alternativas; para mais valores, use número.');
    }
    return pergunta;
  });
  const formulario = { titulo, perguntas };
  if (tamanhoJson(formulario) > LIMITE_FORMULARIO) throw new ErroFormulario('O formulário supera 400 KB. Divida a lista ou reduza as alternativas por item.', 'limite_tamanho');
  return formulario;
}

export function rascunhoVazio() { return { respostas: {}, observacoes: {}, gerais: '', pagina: 0, itens_por_pagina: POR_PAGINA }; }

export function migrarPaginacao(formulario, rascunho) {
  const quantidadeAnterior = rascunho.itens_por_pagina ?? 4;
  if (!Number.isInteger(quantidadeAnterior) || quantidadeAnterior < 1) throw new ErroFormulario('A paginação guardada é inválida. O rascunho foi preservado.');
  const paginaAnterior = rascunho.pagina ?? 0;
  if (!Number.isInteger(paginaAnterior) || paginaAnterior < 0) throw new ErroFormulario('A posição guardada é inválida. O rascunho foi preservado.');
  const ultima = Math.max(0, Math.ceil(formulario.perguntas.length / POR_PAGINA) - 1);
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
  for (const pergunta of formulario.perguntas) {
    const resposta = entrada.respostas?.[pergunta.id];
    if (resposta === undefined || resposta === null || resposta === '' || (typeof resposta === 'string' && !resposta.trim()) || (Array.isArray(resposta) && !resposta.length)) pendentes.push(pergunta.id);
    else {
      if (['sim_nao', 'unica'].includes(pergunta.tipo) && !pergunta.opcoes.includes(resposta)) throw new ErroFormulario(`Alternativa inválida em ${pergunta.id}.`);
      if (pergunta.tipo === 'multipla' && (!Array.isArray(resposta) || resposta.some(valor => !pergunta.opcoes.includes(valor)) || new Set(resposta).size !== resposta.length)) throw new ErroFormulario(`Seleção múltipla inválida em ${pergunta.id}.`);
      if (pergunta.tipo === 'texto') texto(resposta, `Resposta ${pergunta.id}`, 16000);
      if (['nota', 'escala', 'numero'].includes(pergunta.tipo)) {
        if (!Number.isFinite(resposta) || resposta < pergunta.min || resposta > pergunta.max || Math.abs((resposta - pergunta.min) / pergunta.passo - Math.round((resposta - pergunta.min) / pergunta.passo)) > 0.000001) throw new ErroFormulario(`Valor numérico inválido em ${pergunta.id}.`);
      }
      if (pergunta.tipo === 'data') {
        if (typeof resposta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(resposta) || !Number.isFinite(Date.parse(`${resposta}T00:00:00Z`)) || new Date(`${resposta}T00:00:00Z`).toISOString().slice(0, 10) !== resposta) throw new ErroFormulario(`Data inválida em ${pergunta.id}.`);
      }
      if (pergunta.tipo === 'hora' && (typeof resposta !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(resposta))) throw new ErroFormulario(`Hora inválida em ${pergunta.id}.`);
      saida.respostas[pergunta.id] = resposta;
    }
    const observacao = entrada.observacoes?.[pergunta.id] ?? '';
    if (typeof observacao !== 'string' || observacao.length > 16000) throw new ErroFormulario(`Observação inválida em ${pergunta.id}.`);
    if (observacao) saida.observacoes[pergunta.id] = observacao;
  }
  const gerais = entrada.gerais ?? '';
  if (typeof gerais !== 'string' || gerais.length > 16000) throw new ErroFormulario('Observações gerais inválidas.');
  saida.gerais = gerais;
  const ultimaPagina = Math.ceil(formulario.perguntas.length / POR_PAGINA) - 1;
  if (entrada.pagina !== undefined && (!Number.isInteger(entrada.pagina) || entrada.pagina < 0 || entrada.pagina > ultimaPagina)) throw new ErroFormulario('Página inválida.');
  saida.pagina = entrada.pagina ?? 0;
  if (tamanhoJson(saida) > LIMITE_RASCUNHO) throw new ErroFormulario('O preenchimento supera 1 MB. Reduza o conteúdo antes de guardar. O texto digitado permanece nesta tela; não feche o painel antes de confirmar o salvamento.', 'limite_tamanho');
  if (completo && pendentes.length) throw new ErroFormulario(`Faltam ${pendentes.length} respostas. Primeiro item pendente: ${pendentes[0]}.`, 'incompleto');
  return { rascunho: saida, pendentes };
}

export function montarEntrega(formulario, preenchimento) {
  const { rascunho } = validarRascunho(formulario, preenchimento, true);
  const respostas = formulario.perguntas.map(pergunta => ({ id: pergunta.id, pergunta: pergunta.texto, resposta: rascunho.respostas[pergunta.id], ...(rascunho.observacoes[pergunta.id] ? { observacao: rascunho.observacoes[pergunta.id] } : {}) }));
  const blocos = respostas.map(item => `${item.id.toUpperCase()} · ${item.pergunta}\nResposta: ${Array.isArray(item.resposta) ? item.resposta.join('; ') : item.resposta}${item.observacao ? `\nObservações: ${item.observacao}` : ''}`);
  return { texto: [formulario.titulo, ...blocos, ...(rascunho.gerais ? [`Observações gerais: ${rascunho.gerais}`] : [])].join('\n\n'), compacto: { respostas: respostas.map(({ id, resposta, observacao }) => observacao ? [id, resposta, observacao] : [id, resposta]), ...(rascunho.gerais ? { observacoes: rascunho.gerais } : {}) } };
}
