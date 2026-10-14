import { ErroFormulario } from './erros.mjs';

export const TIPOS = ['sim_nao', 'unica', 'multipla', 'texto', 'nota', 'escala', 'numero', 'data', 'hora', 'tabela', 'ordenacao', 'imagens', 'pontos', 'intervalo', 'lista', 'data_hora'];
const antigos = new Set(TIPOS.slice(0, 9));
const numericos = new Set(['nota', 'escala', 'numero', 'intervalo']);
const visuais = ['botoes', 'estrelas', 'emojis', 'barra'];
export function textoFormato(valor, nome, limite = 6000) {
  if (typeof valor !== 'string' || !valor.trim() || valor.length > limite) throw new ErroFormulario(`${nome} deve conter texto de até ${limite} caracteres.`);
  return valor;
}
function listaTextos(valor, nome, minimo, maximo, distintos = false) {
  if (!Array.isArray(valor) || valor.length < minimo || valor.length > maximo) throw new ErroFormulario(`${nome}: informe de ${minimo} a ${maximo} itens.`);
  const resultado = valor.map(item => textoFormato(item, nome, 300));
  if (distintos && new Set(resultado).size !== resultado.length) throw new ErroFormulario(`${nome}: as alternativas devem ser distintas.`);
  return resultado;
}
function condicao(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor) || Object.keys(valor).some(chave => !['pergunta', 'igual'].includes(chave)) || typeof valor.pergunta !== 'string' || !['string', 'number'].includes(typeof valor.igual) || (typeof valor.igual === 'number' && !Number.isFinite(valor.igual))) throw new ErroFormulario('Condição inválida. Use pergunta e igual.');
  return { pergunta: valor.pergunta, igual: valor.igual };
}
export function normalizarPergunta(original, entrada, indice) {
  const item = typeof original === 'string' ? { texto: original } : original;
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ErroFormulario(`Pergunta ${indice + 1} inválida.`);
  const tipo = item.tipo ?? entrada.tipo ?? 'texto';
  if (!TIPOS.includes(tipo)) throw new ErroFormulario(`Tipo inválido na pergunta ${indice + 1}.`);
  for (const [campo, permitidos] of [['itens', ['tabela', 'pontos']], ['opcoes', ['tabela', 'unica', 'multipla', 'ordenacao', 'imagens', 'sim_nao']], ['total', ['pontos']], ['min_itens', ['lista']], ['max_itens', ['lista']], ['min', [...numericos]], ['max', [...numericos]], ['passo', [...numericos]], ['unidade', [...numericos]]]) if (item[campo] !== undefined && !permitidos.includes(tipo)) throw new ErroFormulario(`O campo ${campo} não pertence ao tipo ${tipo}.`);
  const pergunta = { id: `p${indice + 1}`, texto: textoFormato(item.texto, `Pergunta ${indice + 1}`), tipo };
  if (item.se !== undefined) pergunta.se = condicao(item.se);
  if (item.visual !== undefined) {
    if (!visuais.includes(item.visual) || !['nota', 'escala', 'numero'].includes(tipo)) throw new ErroFormulario('Apresentação inválida para esse tipo de pergunta.');
    if (item.visual !== 'botoes') pergunta.visual = item.visual;
  }
  if (tipo === 'tabela') {
    const opcoes = listaTextos(item.opcoes ?? entrada.opcoes, 'Alternativas da tabela', 2, 10, true);
    if (item.itens === undefined && entrada.tipo === 'tabela' && item.tipo === undefined) return [{ ...pergunta, tipo: 'unica', opcoes, grupo: { id: 'tabela', texto: entrada.titulo ?? 'Classificação' } }];
    const itens = listaTextos(item.itens, 'Itens da tabela', 1, 200);
    return itens.map((texto, posicao) => ({ id: `${pergunta.id}_i${posicao + 1}`, texto, tipo: 'unica', opcoes: [...opcoes], grupo: { id: pergunta.id, texto: pergunta.texto }, ...(pergunta.se ? { se: { ...pergunta.se } } : {}) }));
  }
  if (tipo === 'sim_nao') {
    if (item.opcoes !== undefined && JSON.stringify(item.opcoes) !== JSON.stringify(['Sim', 'Não'])) throw new ErroFormulario('Sim/não usa apenas Sim e Não; para outras alternativas use escolha única.');
    pergunta.opcoes = ['Sim', 'Não'];
  }
  if (['unica', 'multipla', 'ordenacao'].includes(tipo)) pergunta.opcoes = listaTextos(item.opcoes ?? entrada.opcoes, 'Alternativas', 2, 100, true);
  if (tipo === 'imagens') {
    if (!Array.isArray(item.opcoes) || item.opcoes.length < 2 || item.opcoes.length > 20) throw new ErroFormulario('Informe de 2 a 20 opções com imagem.');
    pergunta.opcoes = item.opcoes.map(opcao => {
      if (!opcao || typeof opcao !== 'object' || Array.isArray(opcao) || Object.keys(opcao).some(chave => !['texto', 'imagem'].includes(chave))) throw new ErroFormulario('Cada imagem exige texto e imagem.');
      const imagem = textoFormato(opcao.imagem, 'Referência da imagem', 400000);
      if (/^(?:https?|javascript|blob):/i.test(imagem) || (imagem.startsWith('data:') && !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(imagem))) throw new ErroFormulario('Use imagem PNG, JPEG ou WebP local ou incorporada; links remotos não são aceitos nesta versão.');
      if (!imagem.startsWith('data:') && !imagem.startsWith('file:') && !/^[A-Za-z]:[\\/]/.test(imagem) && !/^\/(?!\/)/.test(imagem) && !/^assets[\\/]/.test(imagem)) throw new ErroFormulario('Use um caminho local absoluto, um asset do plugin ou imagem incorporada.');
      return { texto: textoFormato(opcao.texto, 'Texto da imagem', 300), imagem };
    });
    if (new Set(pergunta.opcoes.map(opcao => opcao.texto)).size !== pergunta.opcoes.length) throw new ErroFormulario('Os textos das imagens devem ser distintos.');
  }
  if (numericos.has(tipo)) {
    const estrelasOuEmojis = ['estrelas', 'emojis'].includes(pergunta.visual);
    pergunta.min = item.min ?? (estrelasOuEmojis ? 1 : tipo === 'numero' ? -1000000 : 0);
    pergunta.max = item.max ?? (estrelasOuEmojis ? 5 : pergunta.visual === 'barra' ? 100 : ['numero', 'intervalo'].includes(tipo) ? 1000000 : 10);
    pergunta.passo = item.passo ?? 1;
    if (![pergunta.min, pergunta.max, pergunta.passo].every(Number.isFinite) || pergunta.min >= pergunta.max || pergunta.passo <= 0 || !Number.isFinite((pergunta.max - pergunta.min) / pergunta.passo) || pergunta.min + pergunta.passo === pergunta.min) throw new ErroFormulario(`Limites numéricos inválidos na pergunta ${indice + 1}.`);
    if (['nota', 'escala'].includes(tipo) && ![pergunta.min, pergunta.max, pergunta.passo].every(Number.isSafeInteger)) throw new ErroFormulario('Nota e escala por botões exigem limites e passos inteiros; para frações, use número.');
    if (['nota', 'escala'].includes(tipo) && pergunta.visual !== 'barra' && (pergunta.max - pergunta.min) / pergunta.passo > 20) throw new ErroFormulario('Uma nota ou escala por botões pode ter até 21 alternativas; para mais valores, use número.');
    if (pergunta.visual === 'estrelas' && (pergunta.min < 0 || pergunta.max > 10 || pergunta.passo !== 1 || tipo === 'numero')) throw new ErroFormulario('Estrelas exigem nota ou escala inteira entre zero e dez, com passo um.');
    if (pergunta.visual === 'emojis' && (pergunta.min !== 1 || pergunta.max !== 5 || pergunta.passo !== 1 || tipo === 'numero')) throw new ErroFormulario('Emojis exigem nota ou escala de um a cinco, com passo um.');
    if (item.unidade !== undefined) {
      if (tipo !== 'intervalo' && pergunta.visual !== 'barra') throw new ErroFormulario('Unidade é usada em intervalo ou barra deslizante.');
      pergunta.unidade = textoFormato(item.unidade, 'Unidade', 40);
    }
  }
  if (tipo === 'pontos') {
    pergunta.itens = listaTextos(item.itens, 'Critérios de pontuação', 2, 30).map((texto, posicao) => ({ id: `i${posicao + 1}`, texto }));
    pergunta.total = item.total ?? 100;
    if (!Number.isSafeInteger(pergunta.total) || pergunta.total < 1 || pergunta.total > 1000000) throw new ErroFormulario('O total de pontos deve ser inteiro entre 1 e 1000000.');
  }
  if (tipo === 'lista') {
    pergunta.min_itens = item.min_itens ?? 1; pergunta.max_itens = item.max_itens ?? 50;
    if (![pergunta.min_itens, pergunta.max_itens].every(Number.isSafeInteger) || pergunta.min_itens < 1 || pergunta.max_itens > 200 || pergunta.min_itens > pergunta.max_itens) throw new ErroFormulario('Limites da lista inválidos: use entre 1 e 200 itens.');
  }
  return [pergunta];
}
export function possuiRecursosNovos(perguntas) { return perguntas.some(pergunta => !antigos.has(pergunta.tipo) || pergunta.visual || pergunta.se || pergunta.grupo); }
export function validarCondicoes(perguntas) {
  const anteriores = new Map();
  for (const pergunta of perguntas) {
    if (pergunta.se) {
      const origem = anteriores.get(pergunta.se.pergunta);
      if (!origem) throw new ErroFormulario(`A condição de ${pergunta.id} deve referenciar uma pergunta anterior existente.`);
      const valor = pergunta.se.igual;
      if (['sim_nao', 'unica', 'multipla'].includes(origem.tipo)) {
        if (!origem.opcoes.includes(valor)) throw new ErroFormulario(`Valor de condição inválido em ${pergunta.id}.`);
      } else if (origem.tipo === 'imagens') {
        if (!origem.opcoes.some(opcao => opcao.texto === valor)) throw new ErroFormulario(`Valor de condição inválido em ${pergunta.id}.`);
      } else if (['nota', 'escala', 'numero'].includes(origem.tipo)) validarNumero(origem, valor);
      else throw new ErroFormulario('A condição exige origem de escolha, nota, escala ou número.');
    }
    anteriores.set(pergunta.id, pergunta);
  }
}
export function perguntasVisiveis(formulario, respostas = {}) {
  const ativas = new Set();
  return formulario.perguntas.filter(pergunta => {
    const regra = pergunta.se;
    const valor = regra && respostas[regra.pergunta];
    const ativa = !regra || (ativas.has(regra.pergunta) && (Array.isArray(valor) ? valor.includes(regra.igual) : valor === regra.igual));
    if (ativa) ativas.add(pergunta.id);
    return ativa;
  });
}
function validarNumero(pergunta, valor) {
  if (!Number.isFinite(valor) || valor < pergunta.min || valor > pergunta.max || Math.abs((valor - pergunta.min) / pergunta.passo - Math.round((valor - pergunta.min) / pergunta.passo)) > 0.000001) throw new ErroFormulario(`Valor numérico inválido em ${pergunta.id}.`);
}
function objetoResposta(valor, permitidas, nome) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor) || Object.keys(valor).some(chave => !permitidas.includes(chave))) throw new ErroFormulario(`Resposta ${nome} inválida.`);
}
export function respostaAusente(resposta) { return resposta === undefined || resposta === null || resposta === '' || (typeof resposta === 'string' && !resposta.trim()) || (Array.isArray(resposta) && !resposta.length); }
export function verificarResposta(pergunta, resposta) {
  if (!TIPOS.includes(pergunta.tipo) || pergunta.tipo === 'tabela') throw new ErroFormulario('Definição de pergunta inválida.');
  if (respostaAusente(resposta)) return false;
  if (['sim_nao', 'unica'].includes(pergunta.tipo) && !pergunta.opcoes.includes(resposta)) throw new ErroFormulario(`Alternativa inválida em ${pergunta.id}.`);
  if (pergunta.tipo === 'multipla' && (!Array.isArray(resposta) || resposta.some(valor => !pergunta.opcoes.includes(valor)) || new Set(resposta).size !== resposta.length)) throw new ErroFormulario(`Seleção múltipla inválida em ${pergunta.id}.`);
  if (pergunta.tipo === 'texto') textoFormato(resposta, `Resposta ${pergunta.id}`, 16000);
  if (['nota', 'escala', 'numero'].includes(pergunta.tipo)) validarNumero(pergunta, resposta);
  if (pergunta.tipo === 'data' && (typeof resposta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(resposta) || !Number.isFinite(Date.parse(`${resposta}T00:00:00Z`)) || new Date(`${resposta}T00:00:00Z`).toISOString().slice(0, 10) !== resposta)) throw new ErroFormulario(`Data inválida em ${pergunta.id}.`);
  if (pergunta.tipo === 'hora' && (typeof resposta !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(resposta))) throw new ErroFormulario(`Hora inválida em ${pergunta.id}.`);
  if (pergunta.tipo === 'data_hora') {
    if (typeof resposta !== 'string' || resposta.split('T').length !== 2) throw new ErroFormulario(`Data e hora inválidas em ${pergunta.id}.`);
    const [data, hora] = resposta.split('T');
    if (data) {
      if (data.startsWith('0000-')) throw new ErroFormulario(`Data inválida em ${pergunta.id}.`);
      verificarResposta({ id: pergunta.id, tipo: 'data' }, data);
    }
    if (hora) verificarResposta({ id: pergunta.id, tipo: 'hora' }, hora);
    return Boolean(data && hora);
  }
  if (pergunta.tipo === 'ordenacao' && (!Array.isArray(resposta) || resposta.length !== pergunta.opcoes.length || new Set(resposta).size !== resposta.length || resposta.some(valor => !pergunta.opcoes.includes(valor)))) throw new ErroFormulario(`Ordenação incompleta ou inválida em ${pergunta.id}.`);
  if (pergunta.tipo === 'imagens' && !pergunta.opcoes.some(opcao => opcao.texto === resposta)) throw new ErroFormulario(`Imagem escolhida inválida em ${pergunta.id}.`);
  if (pergunta.tipo === 'pontos') {
    const ids = pergunta.itens.map(item => item.id);
    objetoResposta(resposta, ids, 'de pontos');
    for (const valor of Object.values(resposta)) if (!Number.isSafeInteger(valor) || valor < 0 || valor > pergunta.total) throw new ErroFormulario(`Pontos inválidos em ${pergunta.id}.`);
    return ids.reduce((soma, id) => soma + (resposta[id] ?? 0), 0) === pergunta.total;
  }
  if (pergunta.tipo === 'intervalo') {
    objetoResposta(resposta, ['min', 'max'], 'de intervalo');
    for (const valor of Object.values(resposta)) validarNumero(pergunta, valor);
    return resposta.min !== undefined && resposta.max !== undefined && resposta.min <= resposta.max;
  }
  if (pergunta.tipo === 'lista') {
    if (!Array.isArray(resposta) || resposta.length > pergunta.max_itens || resposta.some(item => typeof item !== 'string' || item.length > 2000)) throw new ErroFormulario(`Lista inválida em ${pergunta.id}.`);
    return resposta.filter(item => item.trim()).length >= pergunta.min_itens;
  }
  return true;
}
export function respostaParaEntrega(pergunta, resposta) {
  if (pergunta.tipo === 'lista') return resposta.filter(item => item.trim());
  if (pergunta.tipo === 'pontos') return Object.fromEntries(pergunta.itens.map(item => [item.id, resposta[item.id] ?? 0]));
  return resposta;
}
export function formatarResposta(pergunta, resposta) {
  if (pergunta.tipo === 'data_hora') {
    const [data, hora] = resposta.split('T'); const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano} às ${hora}`;
  }
  if (pergunta.tipo === 'ordenacao' || pergunta.tipo === 'lista') return '\n' + resposta.map((item, indice) => `${indice + 1}. ${item}`).join('\n');
  if (pergunta.tipo === 'pontos') return '\n' + pergunta.itens.map(item => `${item.texto}: ${resposta[item.id] ?? 0} pontos`).join('\n');
  if (pergunta.tipo === 'intervalo') return `De ${resposta.min} a ${resposta.max}${pergunta.unidade ? ' ' + pergunta.unidade : ''}`;
  return Array.isArray(resposta) ? resposta.join('; ') : String(resposta);
}
