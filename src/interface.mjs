import { POR_PAGINA, validarRascunho, rascunhoVazio, montarEntrega } from './formulario.mjs';
import { criarDitadoInterface } from './ditado-interface.mjs';

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
  let entregue = false;
  let entregaPreparada = null;
  let filaSalvamento = Promise.resolve();
  let erroSalvamento = null;
  let salvamentosPendentes = 0;
  let carregamentoPendente = null;
  let pedidoLeitura = 0;
  let preparacaoPendente = false;
  let chavePreparacao = null;
  const concluidos = new Set();
  const recebidos = new Map();
  const ditado = criarDitadoInterface({
    raiz, adaptador, contexto: () => atual, bloquear,
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
  function aplicarCarregamentoPendente() {
    if (!carregamentoPendente || ocupado || salvamentosPendentes || erroSalvamento || preparacaoPendente || (entregaPreparada && !entregue)) return;
    const resultado = carregamentoPendente;
    carregamentoPendente = null;
    carregar(resultado);
  }
  function bloquear(valor) {
    ocupado = valor;
    raiz.querySelectorAll('form input,form textarea,form button').forEach(campo => { campo.disabled = valor; });
    if (!valor && (entregue || entregaPreparada || preparacaoPendente)) raiz.querySelectorAll('form input,form textarea').forEach(campo => { campo.disabled = true; });
    atualizarNavegacao();
  }
  function atualizarNavegacao() {
    if (!atual) return;
    const pagina = atual.rascunho.pagina;
    const paginas = Math.ceil(atual.formulario.perguntas.length / POR_PAGINA);
    const total = atual.formulario.perguntas.length;
    const respondidas = Object.keys(atual.rascunho.respostas).length;
    obter('[data-progresso]').textContent = `${respondidas} de ${total} respondidas`;
    obter('[data-pagina]').textContent = `Página ${pagina + 1} de ${paginas}`;
    obter('[data-barra]').max = total;
    obter('[data-barra]').value = respondidas;
    obter('[data-anterior]').disabled = ocupado || entregue || preparacaoPendente || Boolean(entregaPreparada) || pagina === 0;
    obter('[data-proximo]').hidden = pagina === paginas - 1;
    obter('[data-proximo]').disabled = ocupado || entregue || preparacaoPendente || Boolean(entregaPreparada);
    obter('[data-entregas]').hidden = pagina !== paginas - 1;
    obter('[data-gerais]').hidden = pagina !== paginas - 1;
    const capacidades = adaptador.capacidades();
    raiz.querySelectorAll('[data-entrega]').forEach(botao => {
      const disponivel = capacidades[botao.dataset.entrega];
      botao.disabled = ocupado || entregue || preparacaoPendente || !disponivel;
      if (!disponivel) botao.setAttribute('aria-description', 'Requer integração suportada pelo aplicativo.');
      else botao.removeAttribute('aria-description');
    });
    obter('[data-conexao]').textContent = adaptador.conexao;
    obter('[data-retomar]').hidden = (!entregaPreparada && !preparacaoPendente) || entregue;
    obter('[data-retomar]').disabled = ocupado;
    const aviso = obter('[data-erro]');
    if (erroSalvamento && !salvamentosPendentes && !ocupado && !entregue && !entregaPreparada && !preparacaoPendente && !aviso.querySelector('[data-recuperacao]')) {
      const opcoes = elemento('span', { 'data-recuperacao': '' });
      opcoes.append(elemento('span', {}, ' Seu texto continua nesta tela. Usar a versão salva descarta alterações locais; guardar seu preenchimento substitui as respostas da versão atual. '));
      for (const [manterLocal, texto] of [[false, 'Usar versão salva'], [true, 'Guardar meu preenchimento']]) {
        const botao = elemento('button', { type: 'button', class: 'cursor-interaction' }, texto);
        botao.addEventListener('click', () => recuperarSalvamento(manterLocal)); opcoes.append(botao);
      }
      aviso.append(opcoes); aviso.hidden = false;
    }
  }
  function salvar() {
    if (!atual || entregue) return;
    const origem = atual;
    const preenchimento = structuredClone(origem.rascunho);
    salvamentosPendentes += 1;
    obter('[data-estado]').textContent = 'Guardando progresso…';
    filaSalvamento = filaSalvamento.then(async () => {
      try {
        validarRascunho(origem.formulario, preenchimento);
        const versao = await adaptador.salvar(origem.id, origem.versao, preenchimento);
        origem.versao = versao;
        erroSalvamento = null;
        obter('[data-estado]').textContent = adaptador.salvamento ?? 'Progresso guardado';
      } catch (erro) {
        erroSalvamento = erro;
        obter('[data-estado]').textContent = 'Progresso não confirmado';
        mostrarErro(erro.message);
      } finally {
        salvamentosPendentes -= 1;
        atualizarNavegacao();
        aplicarCarregamentoPendente();
      }
    });
  }
  function alterou(pergunta, campo, valor) {
    if (ocupado || entregue || entregaPreparada || preparacaoPendente) return;
    if (campo === 'observacoes') atual.rascunho.observacoes[pergunta.id] = valor;
    else if (valor === undefined || valor === '' || (Array.isArray(valor) && !valor.length)) delete atual.rascunho.respostas[pergunta.id];
    else atual.rascunho.respostas[pergunta.id] = valor;
    mostrarErro('');
    atualizarNavegacao();
    salvar();
  }
  function desenharPergunta(pergunta, indice) {
    const caixa = elemento('fieldset', { 'data-id': pergunta.id });
    const legenda = elemento('legend');
    legenda.append(elemento('span', {}, String(indice + 1)), document.createTextNode(` ${pergunta.texto}`));
    caixa.append(legenda);
    const resposta = atual.rascunho.respostas[pergunta.id];
    if (['sim_nao', 'unica', 'multipla', 'nota', 'escala'].includes(pergunta.tipo)) {
      const numerica = ['nota', 'escala'].includes(pergunta.tipo);
      const opcoes = numerica ? Array.from({ length: Math.floor((pergunta.max - pergunta.min) / pergunta.passo + 0.000001) + 1 }, (_, posicao) => Number((pergunta.min + posicao * pergunta.passo).toFixed(6))) : pergunta.opcoes;
      const conjunto = elemento('div', { class: 'pd-opcoes' });
      for (const opcao of opcoes) {
        const rotulo = elemento('label', { class: 'cursor-interaction' });
        const controle = elemento('input', { type: pergunta.tipo === 'multipla' ? 'checkbox' : 'radio', name: pergunta.id, value: opcao });
        controle.checked = pergunta.tipo === 'multipla' ? resposta?.includes(opcao) ?? false : resposta === opcao;
        controle.addEventListener('change', () => {
          const selecionadas = [...conjunto.querySelectorAll('input:checked')].map(campo => numerica ? Number(campo.value) : campo.value);
          alterou(pergunta, 'respostas', pergunta.tipo === 'multipla' ? selecionadas : selecionadas[0]);
        });
        rotulo.append(controle, document.createTextNode(String(opcao)));
        conjunto.append(rotulo);
      }
      caixa.append(conjunto);
    } else {
      const id = `pd-resposta-${pergunta.id}`;
      const rotulo = elemento('label', { for: id, class: 'pd-rotulo' }, 'Sua resposta');
      const controle = elemento(pergunta.tipo === 'texto' ? 'textarea' : 'input', { id, name: pergunta.id });
      if (pergunta.tipo === 'texto') { controle.rows = 2; controle.placeholder = 'Escreva livremente'; }
      else controle.type = { numero: 'number', data: 'date', hora: 'time' }[pergunta.tipo];
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
    const idObservacao = `pd-obs-${pergunta.id}`;
    const observacao = elemento('textarea', { id: idObservacao, rows: 1, placeholder: 'Acrescente uma observação, se quiser' });
    observacao.value = atual.rascunho.observacoes[pergunta.id] ?? '';
    observacao.addEventListener('input', () => alterou(pergunta, 'observacoes', observacao.value));
    caixa.append(elemento('label', { for: idObservacao, class: 'pd-rotulo' }, 'Observações · opcional'), observacao);
    ditado.adicionar(observacao, { campo: 'observacao', pergunta: pergunta.id }, `observação da pergunta ${indice + 1}`);
    return caixa;
  }
  function desenharPagina() {
    const inicio = atual.rascunho.pagina * POR_PAGINA;
    obter('[data-perguntas]').replaceChildren(...atual.formulario.perguntas.slice(inicio, inicio + POR_PAGINA).map((pergunta, indice) => desenharPergunta(pergunta, inicio + indice)));
    obter('#pd-observacoes-gerais').value = atual.rascunho.gerais;
    atualizarNavegacao();
  }
  function paginaValida() {
    try {
      const { pendentes } = validarRascunho(atual.formulario, atual.rascunho);
      const inicio = atual.rascunho.pagina * POR_PAGINA;
      const faltantes = atual.formulario.perguntas.slice(inicio, inicio + POR_PAGINA).filter(pergunta => pendentes.includes(pergunta.id));
      if (faltantes.length) { mostrarErro(`Faltam ${faltantes.length} respostas nesta página. Primeiro item: ${faltantes[0].texto}`); return false; }
      return true;
    } catch (erro) { mostrarErro(erro.message); return false; }
  }
  obter('[data-formulario]').addEventListener('submit', evento => evento.preventDefault());
  obter('[data-proximo]').addEventListener('click', () => {
    if (!paginaValida()) return;
    atual.rascunho.pagina += 1;
    mostrarErro(''); desenharPagina(); salvar();
    obter('[data-titulo]').scrollIntoView({ block: 'start', behavior: 'auto' });
  });
  obter('[data-anterior]').addEventListener('click', () => {
    atual.rascunho.pagina -= 1;
    mostrarErro(''); desenharPagina(); salvar();
    obter('[data-titulo]').scrollIntoView({ block: 'start', behavior: 'auto' });
  });
  obter('#pd-observacoes-gerais').addEventListener('input', evento => { if (!ocupado && !entregue && !entregaPreparada && !preparacaoPendente) { atual.rascunho.gerais = evento.target.value; salvar(); } });
  ditado.adicionar(obter('#pd-observacoes-gerais'), { campo: 'gerais' }, 'observações gerais');
  raiz.querySelectorAll('[data-entrega]').forEach(botao => botao.addEventListener('click', async () => {
    if (ocupado || entregue || !paginaValida()) return;
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
    if (ocupado) return;
    const origem = atual; const preparacao = entregaPreparada;
    bloquear(true);
    try { await adaptador.concluir(origem.id, preparacao.token); concluidos.add(origem.id); recebidos.delete(origem.id); obter('[data-formulario]').hidden = true; mostrarErro(''); }
    catch (erro) { mostrarErro(`Não consegui encerrar a retenção: ${erro.message}`); }
    finally { bloquear(false); aplicarCarregamentoPendente(); }
  });
  obter('[data-retomar]').addEventListener('click', async () => {
    if (ocupado) return;
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
    if (ocupado || salvamentosPendentes) return;
    const origem = atual;
    bloquear(true);
    try {
      const leitura = await adaptador.ler(origem.id);
      if (leitura.isError) throw new Error(leitura.content?.find(item => item.type === 'text')?.text ?? 'Não consegui reabrir o formulário.');
      if (manterLocal) {
        if (leitura._meta.preparacao) throw new Error('A versão salva está em entrega. Use a versão salva e confira a conversa antes de retomar.');
        validarRascunho(origem.formulario, origem.rascunho);
        origem.versao = await adaptador.salvar(origem.id, leitura._meta.versao, structuredClone(origem.rascunho));
        erroSalvamento = null; mostrarErro(''); obter('[data-estado]').textContent = 'Progresso guardado';
      } else {
        erroSalvamento = null; carregamentoPendente = leitura;
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
    if (ocupado || salvamentosPendentes || preparacaoPendente) { carregamentoPendente = resultado; return; }
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
  return { carregar, atualizarNavegacao, mostrarErro };
}
