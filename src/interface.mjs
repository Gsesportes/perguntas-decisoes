import { POR_PAGINA, validarRascunho, rascunhoVazio, montarEntrega, perguntasVisiveis, migrarPaginacao } from './formulario.mjs';
import { criarDitadoInterface } from './ditado-interface.mjs';
import { verificarResposta } from './formatos.mjs';
import { montarControleFormato, montarBarra, montarEstrelas } from './controles-formatos.mjs';
import { conciliarRascunhos, conteudoIgual, perguntasAlteradas } from './conciliacao.mjs';

export function coordenarCargaInicial({ carregar, listar, mostrarErro }) {
  let recebeuResultado = false;
  let iniciou = false;
  return {
    receber(resultado) {
      if (!resultado?.isError && !resultado?._meta?.formulario && !Array.isArray(resultado?._meta?.pendentes)) return;
      recebeuResultado = true;
      carregar(resultado);
    },
    async iniciar() {
      if (recebeuResultado || iniciou) return;
      iniciou = true;
      try {
        const resultado = await listar();
        if (recebeuResultado) return;
        if (!Array.isArray(resultado?._meta?.pendentes)) throw new Error('O servidor não devolveu o conteúdo do painel.');
        carregar(resultado);
      } catch (erro) {
        if (!recebeuResultado) mostrarErro('Não foi possível carregar os formulários. ' + erro.message);
      }
    }
  };
}

function elemento(tag, atributos = {}, conteudo) {
  const item = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) item.setAttribute(chave, String(valor));
  if (conteudo !== undefined) item.textContent = conteudo;
  return item;
}

export function montarInterface(raiz, adaptador) {
  const obter = seletor => raiz.querySelector(seletor);
  let atual = null;
  let ocupado = false;
  let ditando = false;
  let entregue = false;
  let textoCopiaFinal = null;
  let entregaPreparada = null;
  let filaSalvamento = Promise.resolve();
  let erroSalvamento = null;
  let conflitoPendente = false;
  const controlesPendentes = new Set();
  let paginaPendente = false;
  let geraisPendentes = false;
  let salvamentosPendentes = 0;
  let carregamentoPendente = null;
  let pedidoLeitura = 0;
  let preparacaoPendente = false;
  let chavePreparacao = null;
  const concluidos = new Set();
  const recebidos = new Map();
  const ditado = criarDitadoInterface({
    raiz, adaptador, contexto: () => atual, bloquear: bloquearDitado,
    antesDeIniciar: async () => { await filaSalvamento; if (erroSalvamento) throw erroSalvamento; },
    validarTexto: (destino, texto) => {
      const copia = structuredClone(atual.rascunho);
      if (destino.campo === 'gerais') copia.gerais = texto;
      else if (destino.campo === 'resposta') copia.respostas[destino.pergunta] = texto;
      else copia.observacoes[destino.pergunta] = texto;
      validarRascunho(atual.formulario, copia);
    },
    erro: mostrarErro, estado: texto => { obter('[data-estado]').textContent = texto; }
  });
  obter('[data-origem]').textContent = adaptador.origem;

  function mostrarErro(mensagem) {
    const campo = obter('[data-erro]'); campo.textContent = mensagem; campo.hidden = !mensagem;
    const lista = obter('[data-pendentes]');
    let aviso = lista.querySelector('[data-erro-pendentes]');
    if (!aviso) { aviso = elemento('p', { 'data-erro-pendentes': '', role: 'alert' }); lista.append(aviso); }
    aviso.textContent = mensagem;
    aviso.hidden = !mensagem || lista.hidden;
  }
  function mostrarAvisoApresentacao(mensagem) {
    const aviso = obter('[data-aviso-apresentacao]');
    aviso.textContent = mensagem; aviso.hidden = !mensagem;
  }
  function aplicarCarregamentoPendente() {
    if (!carregamentoPendente || ocupado || ditando || salvamentosPendentes || erroSalvamento || preparacaoPendente || (entregaPreparada && !entregue)) return;
    const resultado = carregamentoPendente;
    carregamentoPendente = null;
    carregar(resultado);
  }
  function bloquear(valor) {
    ocupado = valor;
    raiz.querySelectorAll('form input,form textarea,form button').forEach(campo => { campo.disabled = valor || campo.dataset.indisponivel === 'true'; });
    if (!valor && (entregue || entregaPreparada || preparacaoPendente)) {
      raiz.querySelectorAll('form input,form textarea').forEach(campo => { campo.disabled = true; });
      raiz.querySelectorAll('[data-editavel],[data-ditado]').forEach(campo => { campo.disabled = true; });
    }
    atualizarNavegacao();
  }
  function bloquearDitado(valor, destino, preparando = false) {
    ditando = valor;
    if (valor) {
      raiz.querySelectorAll('form input,form textarea').forEach(campo => { campo.disabled = ocupado || preparando || campo === destino || campo.dataset.condiciona === 'true' || campo.dataset.indisponivel === 'true'; });
      raiz.querySelectorAll('form button').forEach(botao => { botao.disabled = preparando || botao.dataset.editavel !== 'true' || botao.dataset.condiciona === 'true' || botao.dataset.indisponivel === 'true'; });
      atualizarNavegacao();
    } else {
      atualizarControlesConciliados();
      bloquear(ocupado);
      aplicarCarregamentoPendente();
    }
  }
  function atualizarNavegacao() {
    if (!atual) return;
    const pagina = atual.rascunho.pagina;
    const visiveis = perguntasVisiveis(atual.formulario, atual.rascunho.respostas);
    const paginas = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA));
    const total = visiveis.length;
    const respondidas = visiveis.filter(pergunta => { try { return verificarResposta(pergunta, atual.rascunho.respostas[pergunta.id]); } catch (erro) { mostrarErro(erro.message); return false; } }).length;
    obter('[data-progresso]').textContent = `${respondidas} de ${total} respondidas`;
    obter('[data-pagina]').textContent = `Página ${pagina + 1} de ${paginas}`;
    obter('[data-barra]').max = total;
    obter('[data-barra]').value = respondidas;
    obter('[data-anterior]').disabled = ocupado || ditando || entregue || preparacaoPendente || Boolean(entregaPreparada) || pagina === 0;
    obter('[data-proximo]').hidden = pagina === paginas - 1;
    obter('[data-proximo]').disabled = ocupado || ditando || entregue || preparacaoPendente || Boolean(entregaPreparada);
    obter('[data-entregas]').hidden = pagina !== paginas - 1;
    obter('[data-gerais]').hidden = pagina !== paginas - 1;
    const capacidades = adaptador.capacidades();
    raiz.querySelectorAll('[data-entrega]').forEach(botao => {
      const disponivel = capacidades[botao.dataset.entrega];
      botao.disabled = ocupado || ditando || entregue || preparacaoPendente || !disponivel;
      if (!disponivel) botao.setAttribute('aria-description', 'Requer integração suportada pelo aplicativo.');
      else botao.removeAttribute('aria-description');
    });
    obter('[data-conexao]').textContent = adaptador.conexao;
    obter('[data-retomar]').hidden = (!entregaPreparada && !preparacaoPendente) || entregue;
    obter('[data-retomar]').disabled = ocupado || ditando;
    raiz.querySelectorAll('[data-copiar]').forEach(botao => {
      const final = botao.dataset.copiar === 'final';
      if (final) botao.hidden = !textoCopiaFinal;
      botao.disabled = !adaptador.copiar || ocupado || ditando || (final ? !textoCopiaFinal : entregue || preparacaoPendente || Boolean(entregaPreparada));
    });
    const aviso = obter('[data-erro]');
    if (erroSalvamento && !salvamentosPendentes && !ocupado && !ditando && !entregue && !entregaPreparada && !preparacaoPendente && !aviso.querySelector('[data-recuperacao]')) {
      const opcoes = elemento('span', { 'data-recuperacao': '' });
      opcoes.append(elemento('span', {}, ' Seu preenchimento continua nesta tela. Usar a versão salva descarta alterações locais; guardar meu preenchimento mantém suas escolhas nos campos em conflito e preserva os demais campos salvos. '));
      for (const [manterLocal, texto] of [[false, 'Usar versão salva'], [true, 'Guardar meu preenchimento']]) {
        const botao = elemento('button', { type: 'button', class: 'cursor-interaction' }, texto);
        botao.addEventListener('click', () => recuperarSalvamento(manterLocal)); opcoes.append(botao);
      }
      aviso.append(opcoes); aviso.hidden = false;
    }
  }
  function atualizarControlesConciliados() {
    if (ditando || !atual) return;
    if (controlesPendentes.size || paginaPendente) desenharPagina(true, controlesPendentes);
    if (geraisPendentes) obter('#pd-observacoes-gerais').value = atual.rascunho.gerais;
    controlesPendentes.clear();
    paginaPendente = false;
    geraisPendentes = false;
  }
  function conferirLeitura(origem, leitura) {
    if (leitura.isError || leitura.structuredContent?.id !== origem.id || !Number.isSafeInteger(leitura._meta?.versao) || leitura._meta.versao < origem.versao) throw new Error('Não consegui conferir a versão atual do formulário. Seu preenchimento foi preservado.');
    if (leitura._meta.preparacao) throw new Error('Este formulário está em entrega em outra aba. Seu preenchimento foi preservado; confira a conversa antes de retomar.');
    if (!conteudoIgual(origem.formulario.perguntas, leitura._meta.formulario?.perguntas)) throw new Error('As perguntas mudaram em outra aba. Seu preenchimento foi preservado; confira a versão salva.');
    validarRascunho(origem.formulario, leitura._meta.rascunho);
    return leitura._meta;
  }
  function conciliarOuFalhar(origem, base, preenchimento, salvo) {
    const resultado = conciliarRascunhos(base, preenchimento, salvo);
    if (resultado.conflitos.length) {
      conflitoPendente = true;
      const primeiro = resultado.conflitos[0];
      const pergunta = origem.formulario.perguntas.find(item => item.id === primeiro.pergunta);
      const campo = primeiro.campo === 'gerais' ? 'observações gerais' : `${primeiro.campo === 'observacoes' ? 'observação' : 'resposta'} de “${pergunta?.texto ?? primeiro.pergunta}”`;
      throw new Error(`A ${campo} foi alterada de formas diferentes em duas abas. Escolha abaixo qual preenchimento manter; suas alterações continuam nesta tela.`);
    }
    return validarRascunho(origem.formulario, migrarPaginacao(origem.formulario, resultado.rascunho)).rascunho;
  }
  async function gravarConfirmado(origem, versaoAnterior, rascunho) {
    const versao = await adaptador.salvar(origem.id, versaoAnterior, rascunho);
    if (!Number.isSafeInteger(versao) || versao <= versaoAnterior) throw new Error('O servidor não confirmou uma nova versão do preenchimento.');
    return versao;
  }
  function salvar() {
    if (!atual || entregue) return Promise.resolve({ confirmado: false, erro: new Error('Este formulário não está disponível para edição.') });
    const origem = atual;
    const preenchimento = structuredClone(origem.rascunho);
    const baseLocalAnterior = structuredClone(origem.baseLocalConfirmada);
    const servidorAnterior = structuredClone(origem.rascunhoServidor);
    salvamentosPendentes += 1;
    obter('[data-estado]').textContent = 'Guardando progresso…';
    const operacao = filaSalvamento.then(async () => {
      try {
        if (conflitoPendente) throw erroSalvamento ?? new Error('Escolha qual preenchimento manter antes de confirmar.');
        validarRascunho(origem.formulario, preenchimento);
        // Atualiza a base das operações enfileiradas sem confundir uma edição
        // feita depois da conciliação com uma edição sobre dados antigos.
        const base = conciliarRascunhos(baseLocalAnterior, origem.baseLocalConfirmada, servidorAnterior, { preferirLocal: true }).rascunho;
        let confirmado = conciliarOuFalhar(origem, base, preenchimento, origem.rascunhoServidor);
        let versao;
        try { versao = await gravarConfirmado(origem, origem.versao, confirmado); }
        catch (erro) {
          if (erro.codigo !== 'conflito') throw erro;
          conflitoPendente = true;
          const meta = conferirLeitura(origem, await adaptador.ler(origem.id));
          confirmado = conciliarOuFalhar(origem, base, preenchimento, meta.rascunho);
          if (conteudoIgual(confirmado, meta.rascunho)) versao = meta.versao;
          else {
            try { versao = await gravarConfirmado(origem, meta.versao, confirmado); }
            catch (novaFalha) {
              if (novaFalha.codigo === 'conflito') { conflitoPendente = true; throw new Error('O formulário mudou novamente durante a confirmação. Seu preenchimento foi preservado; escolha abaixo como continuar.'); }
              throw novaFalha;
            }
          }
        }
        origem.versao = versao;
        origem.rascunhoServidor = structuredClone(confirmado);
        origem.baseLocalConfirmada = preenchimento;
        const anterior = origem.rascunho;
        origem.rascunho = migrarPaginacao(origem.formulario, conciliarRascunhos(preenchimento, anterior, confirmado, { preferirLocal: true }).rascunho);
        paginaPendente ||= anterior.pagina !== origem.rascunho.pagina;
        for (const id of perguntasAlteradas(anterior, origem.rascunho)) controlesPendentes.add(id);
        if (anterior.gerais !== origem.rascunho.gerais) geraisPendentes = true;
        atualizarControlesConciliados();
        conflitoPendente = false;
        if (erroSalvamento) mostrarErro('');
        erroSalvamento = null;
        obter('[data-estado]').textContent = salvamentosPendentes > 1 ? 'Guardando progresso…' : adaptador.salvamento ?? 'Progresso guardado';
        return { confirmado: true, versao };
      } catch (erro) {
        erroSalvamento = erro;
        obter('[data-estado]').textContent = 'Progresso não confirmado';
        mostrarErro(erro.message);
        return { confirmado: false, erro };
      } finally {
        salvamentosPendentes -= 1;
        atualizarNavegacao();
        aplicarCarregamentoPendente();
      }
    });
    filaSalvamento = operacao.then(() => undefined);
    return operacao;
  }
  function alterou(pergunta, campo, valor) {
    if (ocupado || entregue || entregaPreparada || preparacaoPendente) return;
    if (ditando && campo === 'respostas' && atual.formulario.perguntas.some(item => item.se?.pergunta === pergunta.id)) return;
    const anteriores = perguntasVisiveis(atual.formulario, atual.rascunho.respostas).map(item => item.id).join(',');
    if (campo === 'observacoes') atual.rascunho.observacoes[pergunta.id] = valor;
    else if (valor === undefined || valor === '' || (Array.isArray(valor) && !valor.length)) delete atual.rascunho.respostas[pergunta.id];
    else atual.rascunho.respostas[pergunta.id] = valor;
    mostrarErro('');
    const seguintes = perguntasVisiveis(atual.formulario, atual.rascunho.respostas).map(item => item.id).join(',');
    if (anteriores !== seguintes) desenharPagina(true); else atualizarNavegacao();
    return salvar();
  }
  function desenharPergunta(pergunta, indice) {
    const caixa = elemento('fieldset', { 'data-id': pergunta.id });
    if (pergunta.grupo) caixa.className = 'pd-linha-tabela';
    const legenda = elemento('legend');
    legenda.append(elemento('span', {}, String(indice + 1)), document.createTextNode(` ${pergunta.texto}`));
    caixa.append(legenda);
    const resposta = atual.rascunho.respostas[pergunta.id];
    const condiciona = atual.formulario.perguntas.some(item => item.se?.pergunta === pergunta.id);
    const podeEditar = () => !ocupado && !entregue && !entregaPreparada && !preparacaoPendente && (!ditando || !condiciona);
    const composto = montarControleFormato({ pergunta, resposta, alterar: valor => alterou(pergunta, 'respostas', valor), podeEditar, lerImagem: adaptador.lerImagem ? (id, opcao) => adaptador.lerImagem(atual.id, id, opcao) : null });
    if (composto) caixa.append(composto);
    else if (pergunta.visual === 'barra') caixa.append(montarBarra(pergunta, resposta, valor => alterou(pergunta, 'respostas', valor), podeEditar));
    else if (pergunta.visual === 'estrelas') caixa.append(montarEstrelas(pergunta, resposta, valor => alterou(pergunta, 'respostas', valor), podeEditar));
    else if (['sim_nao', 'unica', 'multipla', 'nota', 'escala'].includes(pergunta.tipo)) {
      const numerica = ['nota', 'escala'].includes(pergunta.tipo);
      const opcoes = numerica ? Array.from({ length: Math.floor((pergunta.max - pergunta.min) / pergunta.passo + 0.000001) + 1 }, (_, posicao) => Number((pergunta.min + posicao * pergunta.passo).toFixed(6))) : pergunta.opcoes;
      const conjunto = elemento('div', { class: 'pd-opcoes' });
      const rostos = ['😞', '🙁', '😐', '🙂', '😄'];
      for (const opcao of opcoes) {
        const rotulo = elemento('label', { class: 'cursor-interaction' });
        const controle = elemento('input', { type: pergunta.tipo === 'multipla' ? 'checkbox' : 'radio', name: pergunta.id, value: opcao });
        controle.checked = pergunta.tipo === 'multipla' ? resposta?.includes(opcao) ?? false : resposta === opcao;
        controle.addEventListener('change', () => {
          if (!podeEditar()) return;
          const selecionadas = [...conjunto.querySelectorAll('input:checked')].map(campo => numerica ? Number(campo.value) : campo.value);
          alterou(pergunta, 'respostas', pergunta.tipo === 'multipla' ? selecionadas : selecionadas[0]);
        });
        rotulo.append(controle);
        if (pergunta.visual === 'emojis') {
          rotulo.className += ' pd-emoji'; controle.setAttribute('aria-label', `Nota ${opcao} de 5`);
          rotulo.append(elemento('span', { 'aria-hidden': 'true' }, rostos[opcao - 1]), document.createTextNode(String(opcao)));
        } else rotulo.append(document.createTextNode(String(opcao)));
        conjunto.append(rotulo);
      }
      caixa.append(conjunto);
    } else {
      if (!['texto', 'numero', 'data', 'hora'].includes(pergunta.tipo)) {
        caixa.append(elemento('p', { role: 'alert' }, 'Este formato exige uma versão atualizada do painel. Reabra pelo plugin; nenhum campo de texto foi usado no lugar dele.'));
        return caixa;
      }
      const id = `pd-resposta-${pergunta.id}`;
      const rotulo = elemento('label', { for: id, class: 'pd-rotulo' }, 'Sua resposta');
      const controle = elemento(pergunta.tipo === 'texto' ? 'textarea' : 'input', { id, name: pergunta.id });
      if (pergunta.tipo === 'texto') { controle.rows = 2; controle.placeholder = 'Escreva livremente'; }
      else controle.setAttribute('type', { numero: 'number', data: 'date', hora: 'time' }[pergunta.tipo]);
      if (pergunta.tipo === 'numero') { controle.min = pergunta.min; controle.max = pergunta.max; controle.step = pergunta.passo; }
      controle.value = resposta ?? '';
      const registrarResposta = () => {
        const valor = pergunta.tipo === 'numero' ? (controle.value === '' || !Number.isFinite(controle.valueAsNumber) ? undefined : controle.valueAsNumber) : controle.value;
        alterou(pergunta, 'respostas', valor);
      };
      controle.addEventListener('input', registrarResposta);
      caixa.append(rotulo, controle);
      if (pergunta.tipo === 'texto') ditado.adicionar(controle, { campo: 'resposta', pergunta: pergunta.id }, `resposta da pergunta ${indice + 1}`);
    }
    if (condiciona) caixa.querySelectorAll('input,textarea,button[data-editavel]').forEach(controle => controle.setAttribute('data-condiciona', 'true'));
    const idObservacao = `pd-obs-${pergunta.id}`;
    const observacao = elemento('textarea', { id: idObservacao, rows: 1, placeholder: 'Acrescente uma observação, se quiser' });
    observacao.value = atual.rascunho.observacoes[pergunta.id] ?? '';
    observacao.addEventListener('input', () => alterou(pergunta, 'observacoes', observacao.value));
    caixa.append(elemento('label', { for: idObservacao, class: 'pd-rotulo' }, 'Observações · opcional'), observacao);
    ditado.adicionar(observacao, { campo: 'observacao', pergunta: pergunta.id }, `observação da pergunta ${indice + 1}`);
    return caixa;
  }
  function desenharPagina(preservar = false, recriar = new Set()) {
    const visiveis = perguntasVisiveis(atual.formulario, atual.rascunho.respostas);
    atual.rascunho.pagina = Math.min(atual.rascunho.pagina, Math.max(0, Math.ceil(visiveis.length / POR_PAGINA) - 1));
    const inicio = atual.rascunho.pagina * POR_PAGINA;
    const container = obter('[data-perguntas]');
    const existentes = preservar ? new Map([...container.children].filter(item => item.dataset?.id && !recriar.has(item.dataset.id)).map(item => [item.dataset.id, item])) : new Map();
    const elementos = []; let grupo = null;
    for (const pergunta of visiveis.slice(inicio, inicio + POR_PAGINA)) {
      if (pergunta.grupo && pergunta.grupo.id !== grupo) elementos.push(elemento('p', { class: 'pd-tabela-titulo' }, pergunta.grupo.texto));
      grupo = pergunta.grupo?.id ?? null;
      elementos.push(existentes.get(pergunta.id) ?? desenharPergunta(pergunta, atual.formulario.perguntas.indexOf(pergunta)));
    }
    const foco = preservar ? document.activeElement : null;
    const selecao = foco && typeof foco.selectionStart === 'number' ? [foco.selectionStart, foco.selectionEnd] : null;
    container.replaceChildren(...elementos);
    if (foco?.isConnected) foco.focus({ preventScroll: true });
    else if (foco?.id) {
      const substituto = document.getElementById(foco.id);
      substituto?.focus({ preventScroll: true });
      if (selecao && substituto?.setSelectionRange) substituto.setSelectionRange(...selecao);
    }
    obter('#pd-observacoes-gerais').value = atual.rascunho.gerais;
    const avisoCondicoes = obter('[data-condicoes]');
    if (avisoCondicoes) avisoCondicoes.hidden = !atual.formulario.perguntas.some(pergunta => pergunta.se);
    atualizarNavegacao();
  }
  function paginaValida() {
    try {
      const { pendentes } = validarRascunho(atual.formulario, atual.rascunho);
      const inicio = atual.rascunho.pagina * POR_PAGINA;
      const faltantes = perguntasVisiveis(atual.formulario, atual.rascunho.respostas).slice(inicio, inicio + POR_PAGINA).filter(pergunta => pendentes.includes(pergunta.id));
      if (faltantes.length) {
        const pergunta = faltantes[0], resposta = atual.rascunho.respostas[pergunta.id];
        if (pergunta.tipo === 'intervalo' && resposta) {
          mostrarErro(resposta.min === undefined || resposta.max === undefined ? `Complete ${resposta.min === undefined && resposta.max === undefined ? 'o mínimo e o máximo' : resposta.min === undefined ? 'o mínimo' : 'o máximo'} de “${pergunta.texto}”.` : `Corrija “${pergunta.texto}”: o mínimo (${resposta.min}) deve ser menor ou igual ao máximo (${resposta.max}).`);
        } else mostrarErro(`Faltam ${faltantes.length} respostas nesta página. Primeiro item: ${pergunta.texto}`);
        return false;
      }
      return true;
    } catch (erro) { mostrarErro(erro.message); return false; }
  }
  obter('[data-formulario]').addEventListener('submit', evento => evento.preventDefault());
  raiz.querySelectorAll('[data-copiar]').forEach(botao => botao.addEventListener('click', async () => {
    if (botao.disabled || ocupado || ditando || !adaptador.copiar) return;
    const final = botao.dataset.copiar === 'final';
    if (!final && (!paginaValida() || entregue || entregaPreparada || preparacaoPendente)) return;
    const aviso = obter('[data-estado-copia]');
    try {
      bloquear(true);
      if (!final) { await filaSalvamento; if (erroSalvamento) throw erroSalvamento; }
      const texto = final ? textoCopiaFinal : montarEntrega(atual.formulario, atual.rascunho).texto;
      aviso.textContent = 'Copiando respostas…'; aviso.setAttribute('role', 'status'); aviso.hidden = false;
      aviso.textContent = await adaptador.copiar(texto);
    } catch (erro) { aviso.textContent = 'Não consegui copiar. ' + erro.message; aviso.setAttribute('role', 'alert'); aviso.hidden = false; }
    finally { bloquear(false); aplicarCarregamentoPendente(); }
  }));
  obter('[data-proximo]').addEventListener('click', () => {
    if (ocupado || ditando || entregue || preparacaoPendente || entregaPreparada) return;
    if (!paginaValida()) return;
    atual.rascunho.pagina += 1;
    mostrarErro(''); desenharPagina(); salvar();
    obter('[data-titulo]').scrollIntoView({ block: 'start', behavior: 'auto' });
  });
  obter('[data-anterior]').addEventListener('click', () => {
    if (ocupado || ditando || entregue || preparacaoPendente || entregaPreparada) return;
    atual.rascunho.pagina -= 1;
    mostrarErro(''); desenharPagina(); salvar();
    obter('[data-titulo]').scrollIntoView({ block: 'start', behavior: 'auto' });
  });
  obter('#pd-observacoes-gerais').addEventListener('input', evento => { if (!ocupado && !entregue && !entregaPreparada && !preparacaoPendente) { atual.rascunho.gerais = evento.target.value; salvar(); } });
  ditado.adicionar(obter('#pd-observacoes-gerais'), { campo: 'gerais' }, 'observações gerais');
  raiz.querySelectorAll('[data-entrega]').forEach(botao => botao.addEventListener('click', async () => {
    if (ocupado || ditando || entregue || !paginaValida()) return;
    const origem = atual;
    try {
      montarEntrega(atual.formulario, atual.rascunho);
      bloquear(true); mostrarErro('');
      await filaSalvamento;
      if (erroSalvamento) throw erroSalvamento;
      if (!entregaPreparada) {
        preparacaoPendente = true;
        chavePreparacao = crypto.randomUUID();
        entregaPreparada = await adaptador.preparar(origem.id, origem.versao, structuredClone(origem.rascunho), origem.formulario, chavePreparacao);
        preparacaoPendente = false;
        origem.versao = entregaPreparada.versao;
      }
      const entregaDaOperacao = entregaPreparada;
      const mensagem = await adaptador.entregar(botao.dataset.entrega, entregaDaOperacao);
      entregue = true;
      textoCopiaFinal = entregaDaOperacao.texto;
      atualizarNavegacao();
      recebidos.set(origem.id, entregaDaOperacao.token);
      obter('[data-sucesso]').textContent = mensagem;
      obter('[data-sucesso]').hidden = false;
      try {
        await adaptador.concluir(origem.id, entregaDaOperacao.token);
        concluidos.add(origem.id);
        obter('[data-formulario]').hidden = true;
      } catch (erro) {
        mostrarErro(`A entrega foi confirmada, mas não consegui encerrar a retenção do rascunho: ${erro.message}`);
        obter('[data-limpar]').hidden = false;
      }
    } catch (erro) {
      mostrarErro(`A entrega não foi confirmada. Verifique a conversa antes de tentar novamente. ${erro.message}`);
    } finally {
      bloquear(false);
      if (entregue || entregaPreparada) raiz.querySelectorAll('form input,form textarea').forEach(campo => { campo.disabled = true; });
      aplicarCarregamentoPendente();
    }
  }));
  obter('[data-limpar]').addEventListener('click', async () => {
    if (ocupado || ditando) return;
    const origem = atual; const preparacao = entregaPreparada;
    bloquear(true);
    try { await adaptador.concluir(origem.id, preparacao.token); concluidos.add(origem.id); recebidos.delete(origem.id); obter('[data-formulario]').hidden = true; mostrarErro(''); }
    catch (erro) { mostrarErro(`Não consegui encerrar a retenção: ${erro.message}`); }
    finally { bloquear(false); aplicarCarregamentoPendente(); }
  });
  obter('[data-retomar]').addEventListener('click', async () => {
    if (ocupado || ditando) return;
    const origem = atual; let preparacao = entregaPreparada;
    bloquear(true);
    try {
      if (preparacaoPendente) {
        const leitura = await adaptador.ler(origem.id);
        if (leitura.isError) throw new Error(leitura.content?.find(item => item.type === 'text')?.text ?? 'Não consegui conferir a preparação.');
        if (!leitura._meta.preparacao || leitura._meta.preparacao.token !== chavePreparacao || leitura._meta.versao !== origem.versao + 1) {
          preparacaoPendente = false;
          erroSalvamento = new Error('A preparação mudou em outra janela. Seu texto foi preservado; escolha usar a versão salva ou guardar seu preenchimento.');
          throw erroSalvamento;
        }
        preparacao = leitura._meta.preparacao;
        origem.versao = leitura._meta.versao;
      }
      if (preparacao) origem.versao = await adaptador.retomar(origem.id, preparacao.token, origem.versao);
      entregaPreparada = null;
      preparacaoPendente = false;
      erroSalvamento = null;
      mostrarErro('');
    } catch (erro) { mostrarErro(`Não consegui retomar a edição: ${erro.message}`); }
    finally { bloquear(false); if (entregaPreparada) raiz.querySelectorAll('form input,form textarea').forEach(campo => { campo.disabled = true; }); aplicarCarregamentoPendente(); }
  });

  async function recuperarSalvamento(manterLocal) {
    if (ocupado || ditando || salvamentosPendentes) return;
    const origem = atual;
    bloquear(true);
    try {
      const leitura = await adaptador.ler(origem.id);
      if (leitura.isError) throw new Error(leitura.content?.find(item => item.type === 'text')?.text ?? 'Não consegui reabrir o formulário.');
      if (manterLocal) {
        const meta = conferirLeitura(origem, leitura);
        const preenchimento = structuredClone(origem.rascunho);
        const conciliado = validarRascunho(origem.formulario, migrarPaginacao(origem.formulario, conciliarRascunhos(origem.rascunhoServidor, preenchimento, meta.rascunho, { preferirLocal: true }).rascunho)).rascunho;
        origem.versao = await gravarConfirmado(origem, meta.versao, conciliado);
        origem.baseLocalConfirmada = preenchimento; origem.rascunhoServidor = structuredClone(conciliado); origem.rascunho = conciliado;
        conflitoPendente = false; erroSalvamento = null; mostrarErro(''); desenharPagina(); obter('[data-estado]').textContent = 'Progresso guardado';
      } else {
        conflitoPendente = false; erroSalvamento = null; carregamentoPendente = leitura;
      }
    } catch (erro) { erroSalvamento = erro; mostrarErro(erro.message); }
    finally { bloquear(false); aplicarCarregamentoPendente(); }
  }
  function desenharPendentes(meta, acrescentar = false) {
    const lista = obter('[data-pendentes]');
    if (!acrescentar) lista.replaceChildren();
    if (!meta.pendentes.length && !acrescentar) lista.append(elemento('p', {}, 'Nenhum formulário pendente. Peça ao agente para criar um.'));
    for (const item of meta.pendentes) {
      const botao = elemento('button', { type: 'button', class: 'cursor-interaction' }, item.titulo);
      botao.addEventListener('click', async () => {
        const pedido = ++pedidoLeitura;
        try { const resposta = await adaptador.ler(item.id); if (pedido === pedidoLeitura) carregar(resposta); }
        catch (erro) { if (pedido === pedidoLeitura) mostrarErro(erro.message); }
      });
      lista.append(botao);
    }
    if (meta.proximaPagina) {
      const mais = elemento('button', { type: 'button', class: 'cursor-interaction' }, 'Carregar mais formulários');
      mais.addEventListener('click', async () => {
        const pedido = ++pedidoLeitura;
        mais.disabled = true;
        try {
          const resposta = await adaptador.listar(meta.proximaPagina);
          if (pedido !== pedidoLeitura) return;
          if (resposta.isError) throw new Error(resposta.content?.find(item => item.type === 'text')?.text ?? 'Não consegui listar os próximos formulários.');
          mais.hidden = true;
          desenharPendentes(resposta._meta, true);
        } catch (erro) { if (pedido === pedidoLeitura) mostrarErro(erro.message); }
        finally { mais.disabled = false; }
      });
      lista.append(mais);
    }
  }
  function carregar(resultado) {
    if (concluidos.has(resultado.structuredContent?.id)) return;
    pedidoLeitura += 1;
    if (ocupado || ditando || salvamentosPendentes || preparacaoPendente) { carregamentoPendente = resultado; return; }
    if (erroSalvamento) { mostrarErro(`O progresso não foi confirmado. Corrija o preenchimento e confirme o salvamento antes de trocar de formulário. ${erroSalvamento.message}`); return; }
    if (resultado.isError) {
      const mensagem = resultado.content?.find(item => item.type === 'text')?.text ?? 'Não foi possível abrir o formulário.';
      if (atual) mostrarErro(mensagem);
      else {
        obter('[data-formulario]').hidden = true;
        const aviso = obter('[data-pendentes]');
        aviso.hidden = false;
        aviso.replaceChildren(elemento('p', { role: 'alert' }, mensagem));
      }
      return;
    }
    mostrarErro('');
    textoCopiaFinal = null;
    obter('[data-estado-copia]').textContent = ''; obter('[data-estado-copia]').hidden = true;
    raiz.querySelector('[data-copiar="final"]').hidden = true;
    const meta = resultado._meta ?? {};
    if (meta.pendentes) {
      obter('[data-formulario]').hidden = true;
      const lista = obter('[data-pendentes]');
      lista.hidden = false;
      desenharPendentes(meta);
      return;
    }
    if (!meta.formulario) return;
    if (resultado.structuredContent.id === atual?.id) {
      if (entregue) return;
      if (meta.versao < atual.versao) {
        meta.versao = atual.versao; meta.rascunho = atual.rascunho; meta.preparacao = entregaPreparada;
      }
    }
    atual = { id: resultado.structuredContent.id, versao: meta.versao, formulario: meta.formulario, rascunho: structuredClone(meta.rascunho ?? rascunhoVazio()) };
    atual.baseLocalConfirmada = structuredClone(atual.rascunho); atual.rascunhoServidor = structuredClone(atual.rascunho);
    conflitoPendente = false; controlesPendentes.clear(); paginaPendente = false; geraisPendentes = false;
    entregue = false; entregaPreparada = meta.preparacao ? { ...meta.preparacao, versao: meta.versao } : null; erroSalvamento = null; preparacaoPendente = false;
    if (recebidos.has(atual.id)) { entregue = true; entregaPreparada = { token: recebidos.get(atual.id), versao: meta.versao }; }
    obter('[data-titulo]').textContent = atual.formulario.titulo;
    obter('[data-pendentes]').hidden = true;
    obter('[data-formulario]').hidden = false;
    obter('[data-sucesso]').hidden = true;
    obter('[data-limpar]').hidden = true;
    desenharPagina();
    bloquear(false);
    if (entregue) { obter('[data-limpar]').hidden = false; mostrarErro('O recebimento deste formulário já foi confirmado nesta sessão. Encerre a retenção; não reenvie as respostas.'); }
    if (entregaPreparada) {
      mostrarErro('Existe uma entrega sem encerramento confirmado. Verifique a conversa antes de reenviar ou retomar a edição.');
      raiz.querySelectorAll('form input,form textarea').forEach(campo => { campo.disabled = true; });
    }
  }
  return { carregar, atualizarNavegacao, mostrarErro, mostrarAvisoApresentacao };
}
