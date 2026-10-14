function criar(tag, atributos = {}, texto) {
  const elemento = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) elemento.setAttribute(nome, String(valor));
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}
function indisponivel(elemento, valor) { elemento.setAttribute('data-indisponivel', String(valor)); elemento.disabled = valor; }
function numero(id, rotulo, pergunta, valor, registrar) {
  const grupo = criar('div', { class: 'pd-campo-composto' });
  const campo = criar('input', { id, type: 'number', min: pergunta.min, max: pergunta.max, step: pergunta.passo });
  campo.value = valor ?? '';
  campo.addEventListener('input', () => registrar(campo.value === '' || !Number.isFinite(campo.valueAsNumber) ? undefined : campo.valueAsNumber));
  grupo.append(criar('label', { for: id, class: 'pd-rotulo' }, rotulo), campo);
  return grupo;
}
export function montarControleFormato({ pergunta, resposta, alterar, lerImagem, podeEditar }) {
  const bloco = criar('div', { class: 'pd-formato', 'data-formato': pergunta.tipo });
  if (pergunta.tipo === 'ordenacao') {
    let ordem = resposta ? [...resposta] : [...pergunta.opcoes];
    const lista = criar('ol', { class: 'pd-ordenacao', 'aria-label': pergunta.texto });
    const confirmar = criar('button', { type: 'button', 'data-confirmar-ordem': '', 'data-editavel': 'true' }, 'Confirmar esta ordem');
    function desenhar() {
      lista.replaceChildren(...ordem.map((texto, indice) => {
        const linha = criar('li');
        linha.append(criar('span', {}, texto));
        for (const [deslocamento, simbolo, verbo] of [[-1, '↑', 'Subir'], [1, '↓', 'Descer']]) {
          const botao = criar('button', { type: 'button', 'aria-label': `${verbo} ${texto}`, 'data-editavel': 'true' }, simbolo);
          indisponivel(botao, indice + deslocamento < 0 || indice + deslocamento >= ordem.length);
          botao.addEventListener('click', () => {
            const destino = indice + deslocamento;
            if (!podeEditar() || destino < 0 || destino >= ordem.length) return;
            [ordem[indice], ordem[destino]] = [ordem[destino], ordem[indice]];
            desenhar(); alterar([...ordem]);
          });
          linha.append(botao);
        }
        return linha;
      }));
    }
    confirmar.addEventListener('click', () => { if (podeEditar()) alterar([...ordem]); });
    bloco.append(criar('p', { class: 'pd-ajuda' }, 'Mova os itens ou confirme a ordem apresentada.'), lista, confirmar);
    desenhar(); return bloco;
  }
  if (pergunta.tipo === 'pontos') {
    const valores = { ...(resposta ?? {}) };
    const resumo = criar('p', { class: 'pd-ajuda', role: 'status', 'data-soma-pontos': '' });
    const atualizar = () => { resumo.textContent = `Distribuídos ${pergunta.itens.reduce((soma, item) => soma + (valores[item.id] ?? 0), 0)} de ${pergunta.total} pontos`; };
    for (const item of pergunta.itens) bloco.append(numero(`${pergunta.id}-${item.id}`, item.texto, { min: 0, max: pergunta.total, passo: 1 }, valores[item.id] ?? 0, valor => {
      if (!podeEditar()) return;
      if (valor === undefined) delete valores[item.id]; else valores[item.id] = valor;
      atualizar(); alterar({ ...valores });
    }));
    atualizar(); bloco.append(resumo); return bloco;
  }
  if (pergunta.tipo === 'intervalo') {
    const valores = { ...(resposta ?? {}) };
    bloco.className += ' pd-intervalo';
    const resumo = criar('p', { class: 'pd-ajuda pd-intervalo-resumo', role: 'status' });
    const atualizar = () => { resumo.textContent = valores.min === undefined || valores.max === undefined ? 'Preencha os dois limites.' : valores.min > valores.max ? 'O mínimo deve ser menor ou igual ao máximo.' : `Faixa de ${valores.min} a ${valores.max}${pergunta.unidade ? ' ' + pergunta.unidade : ''}`; };
    for (const [chave, rotulo] of [['min', 'Mínimo'], ['max', 'Máximo']]) bloco.append(numero(`${pergunta.id}-${chave}`, rotulo + (pergunta.unidade ? ` (${pergunta.unidade})` : ''), pergunta, valores[chave], valor => {
      if (!podeEditar()) return;
      if (valor === undefined) delete valores[chave]; else valores[chave] = valor;
      atualizar(); alterar({ ...valores });
    }));
    atualizar(); bloco.append(resumo);
    return bloco;
  }
  if (pergunta.tipo === 'lista') {
    let itens = resposta ? [...resposta] : [''];
    const lista = criar('div', { class: 'pd-lista-livre' });
    const adicionar = criar('button', { type: 'button', 'data-adicionar-item': '', 'data-editavel': 'true' }, '+ Adicionar item');
    function desenhar() {
      lista.replaceChildren(...itens.map((texto, indice) => {
        const linha = criar('div', { class: 'pd-lista-linha' });
        const campo = criar('textarea', { rows: 1, 'aria-label': `Item ${indice + 1} de ${pergunta.texto}`, maxlength: 2000 }); campo.value = texto;
        const remover = criar('button', { type: 'button', 'aria-label': `Remover item ${indice + 1}`, 'data-editavel': 'true' }, '×');
        campo.addEventListener('input', () => { if (podeEditar()) { itens[indice] = campo.value; alterar([...itens]); } });
        remover.addEventListener('click', () => { if (podeEditar()) { itens.splice(indice, 1); desenhar(); alterar([...itens]); } });
        linha.append(campo, remover); return linha;
      }));
      indisponivel(adicionar, itens.length >= pergunta.max_itens);
    }
    adicionar.addEventListener('click', () => { if (podeEditar() && itens.length < pergunta.max_itens) { itens.push(''); desenhar(); alterar([...itens]); } });
    bloco.append(lista, adicionar, criar('p', { class: 'pd-ajuda' }, `De ${pergunta.min_itens} a ${pergunta.max_itens} itens. Linhas vazias ficam no rascunho e não entram na entrega.`));
    desenhar(); return bloco;
  }
  if (pergunta.tipo === 'imagens') {
    bloco.className += ' pd-imagens';
    pergunta.opcoes.forEach((opcao, indice) => {
      const rotulo = criar('label', { class: 'pd-imagem-escolha cursor-interaction' });
      const campo = criar('input', { type: 'radio', name: pergunta.id, value: opcao.texto }); campo.checked = resposta === opcao.texto;
      indisponivel(campo, true);
      const quadro = criar('span', { class: 'pd-imagem-quadro' });
      const imagem = criar('img', { alt: opcao.texto, loading: 'eager' }); imagem.hidden = true;
      const aviso = criar('span', { class: 'pd-ajuda', role: 'status' }, 'Carregando imagem…');
      quadro.append(imagem, aviso);
      imagem.addEventListener('load', () => { if (imagem.isConnected) { imagem.hidden = false; aviso.hidden = true; indisponivel(campo, false); campo.disabled = !podeEditar(); } });
      const falhou = () => { aviso.hidden = false; aviso.textContent = 'Não foi possível carregar esta imagem.'; aviso.setAttribute('role', 'alert'); imagem.hidden = true; indisponivel(campo, true); };
      imagem.addEventListener('error', falhou);
      campo.addEventListener('change', () => { if (podeEditar() && campo.checked) alterar(opcao.texto); });
      rotulo.append(quadro, campo, criar('span', {}, opcao.texto)); bloco.append(rotulo);
      Promise.resolve().then(() => {
        if (!lerImagem) throw new Error('Imagens não disponíveis nesta conexão.');
        return lerImagem(pergunta.id, indice);
      }).then(dados => {
        if (!imagem.isConnected) return;
        if (!dados || !['image/png', 'image/jpeg', 'image/webp'].includes(dados.tipo) || typeof dados.dados !== 'string') throw new Error('Imagem não confirmada.');
        imagem.src = `data:${dados.tipo};base64,${dados.dados}`;
      }).catch(falhou);
    });
    return bloco;
  }
  return null;
}

export function montarBarra(pergunta, resposta, alterar, podeEditar) {
  const bloco = criar('div', { class: 'pd-controle-barra' });
  const id = `pd-barra-${pergunta.id}`;
  const campo = criar('input', { id, type: 'range', min: pergunta.min, max: pergunta.max, step: pergunta.passo, 'aria-label': 'Sua resposta' });
  campo.value = resposta ?? pergunta.min;
  const valor = criar('output', { for: id, 'aria-live': 'polite' }, resposta === undefined ? 'Ainda não respondido — escolha um valor na barra' : String(resposta));
  let anterior = resposta;
  const registrar = () => {
    if (!podeEditar()) return;
    const escolhido = Number(campo.value);
    if (anterior === escolhido) return;
    anterior = escolhido; valor.textContent = String(escolhido); alterar(escolhido);
  };
  campo.addEventListener('input', registrar); campo.addEventListener('click', registrar);
  campo.addEventListener('keyup', evento => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'].includes(evento.key)) registrar(); });
  bloco.append(campo, valor, criar('span', { class: 'pd-ajuda' }, `${pergunta.min} a ${pergunta.max}${pergunta.unidade ? ' ' + pergunta.unidade : ''}`));
  return bloco;
}
