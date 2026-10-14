import { ICONE_ESTRELA } from './icones-estrelas.mjs';
import { verificarResposta } from './formatos.mjs';

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
  campo.addEventListener('input', () => registrar(campo.value === '' || !Number.isFinite(campo.valueAsNumber) ? undefined : campo.valueAsNumber, campo));
  grupo.append(criar('label', { for: id, class: 'pd-rotulo' }, rotulo), campo);
  return grupo;
}
export function montarControleFormato({ pergunta, resposta, alterar, lerImagem, podeEditar }) {
  const bloco = criar('div', { class: 'pd-formato', 'data-formato': pergunta.tipo });
  if (pergunta.tipo === 'ordenacao') {
    let ordem = resposta ? [...resposta] : [...pergunta.opcoes];
    let confirmando = false;
    const lista = criar('ol', { class: 'pd-ordenacao', 'aria-label': pergunta.texto });
    const confirmar = criar('button', { type: 'button', 'data-confirmar-ordem': '', 'data-editavel': 'true' }, resposta ? 'Confirmar novamente' : 'Confirmar esta ordem');
    const estado = criar('p', { class: 'pd-ajuda', role: 'status', 'data-estado-ordem': '' }, resposta ? 'Ordem confirmada e guardada. Você pode alterar ou confirmar novamente.' : 'Mova os itens ou confirme a ordem apresentada.');
    function desenhar() {
      lista.replaceChildren(...ordem.map((texto, indice) => {
        const linha = criar('li');
        linha.append(criar('span', {}, texto));
        for (const [deslocamento, simbolo, verbo] of [[-1, '↑', 'Subir'], [1, '↓', 'Descer']]) {
          const botao = criar('button', { type: 'button', 'aria-label': `${verbo} ${texto}`, 'data-editavel': 'true' }, simbolo);
          indisponivel(botao, confirmando || indice + deslocamento < 0 || indice + deslocamento >= ordem.length);
          botao.addEventListener('click', () => {
            const destino = indice + deslocamento;
            if (confirmando || !podeEditar() || destino < 0 || destino >= ordem.length) return;
            [ordem[indice], ordem[destino]] = [ordem[destino], ordem[indice]];
            desenhar(); alterar([...ordem]);
            confirmar.textContent = 'Confirmar esta ordem'; indisponivel(confirmar, false);
            estado.textContent = 'Ordem alterada. A nova sequência já está selecionada.';
          });
          linha.append(botao);
        }
        return linha;
      }));
    }
    confirmar.addEventListener('click', async () => {
      if (!podeEditar() || confirmar.disabled) return;
      confirmando = true; indisponivel(confirmar, true); confirmar.textContent = 'Confirmando…';
      estado.textContent = 'Aguardando confirmação do salvamento.'; desenhar();
      try {
        const resultado = await alterar([...ordem]);
        if (!resultado?.confirmado) throw resultado?.erro ?? new Error('O salvamento não foi confirmado.');
        if (confirmar.isConnected) { confirmar.textContent = 'Ordem confirmada'; estado.textContent = 'Ordem confirmada e guardada. Você pode continuar ou mover os itens novamente.'; }
      } catch (erro) {
        if (confirmar.isConnected) { confirmar.textContent = 'Tentar confirmar novamente'; estado.textContent = 'Não consegui confirmar a ordem. ' + erro.message; indisponivel(confirmar, false); }
      } finally { confirmando = false; if (lista.isConnected) desenhar(); }
    });
    bloco.append(estado, lista, confirmar);
    desenhar(); return bloco;
  }
  if (pergunta.tipo === 'data_hora') {
    const [data = '', hora = ''] = typeof resposta === 'string' ? resposta.split('T') : [];
    const partes = { data, hora };
    bloco.className += ' pd-data-hora';
    const aviso = criar('p', { class: 'pd-aviso-limite pd-data-hora-aviso', role: 'alert', 'data-aviso-data-hora': '' }); aviso.hidden = true;
    const estado = criar('p', { class: 'pd-ajuda pd-data-hora-aviso', role: 'status' });
    const atualizar = () => { estado.textContent = partes.data && partes.hora ? 'Data e hora preenchidas.' : 'Preencha a data e a hora.'; };
    for (const [chave, tipo, rotulo] of [['data', 'date', 'Data'], ['hora', 'time', 'Hora']]) {
      const id = `${pergunta.id}-${chave}`;
      const grupo = criar('div', { class: 'pd-campo-composto' });
      const campo = criar('input', { id, type: tipo, name: id, inputmode: 'numeric', required: '', ...(tipo === 'date' ? { min: '0001-01-01', max: '9999-12-31' } : { min: '00:00', max: '23:59', step: 60 }) });
      campo.value = partes[chave];
      const registrar = () => {
        if (!podeEditar()) return;
        const valor = campo.value;
        try {
          if (valor) verificarResposta(pergunta, chave === 'data' ? `${valor}T` : `T${valor}`);
        } catch {
          campo.value = partes[chave]; aviso.textContent = chave === 'data' ? 'Use uma data válida. O valor anterior foi mantido.' : 'Use um horário válido entre 00:00 e 23:59. O valor anterior foi mantido.';
          aviso.hidden = false; return;
        }
        const mudou = partes[chave] !== valor;
        partes[chave] = valor;
        aviso.hidden = !campo.validity?.badInput;
        aviso.textContent = campo.validity?.badInput ? `Complete ${chave === 'data' ? 'uma data' : 'um horário'} válido.` : '';
        atualizar(); if (mudou) alterar(partes.data || partes.hora ? `${partes.data}T${partes.hora}` : undefined);
      };
      campo.addEventListener('input', registrar); campo.addEventListener('change', registrar);
      grupo.append(criar('label', { for: id, class: 'pd-rotulo' }, rotulo), campo); bloco.append(grupo);
    }
    atualizar(); bloco.append(estado, aviso); return bloco;
  }
  if (pergunta.tipo === 'pontos') {
    const valores = { ...(resposta ?? {}) };
    const resumo = criar('p', { class: 'pd-ajuda', role: 'status', 'data-soma-pontos': '' });
    const aviso = criar('p', { class: 'pd-aviso-limite', role: 'alert', 'data-aviso-pontos': '' }); aviso.hidden = true;
    const campos = new Map();
    const soma = () => pergunta.itens.reduce((total, item) => total + (valores[item.id] ?? 0), 0);
    const disponiveis = id => Math.max(0, pergunta.total - (soma() - (valores[id] ?? 0)));
    function atualizar() {
      const saldo = pergunta.total - soma();
      resumo.textContent = `Distribuídos ${soma()} de ${pergunta.total} pontos. ${saldo >= 0 ? `Restam ${saldo} pontos.` : `Excesso de ${-saldo} pontos.`}`;
      for (const [id, { campo, ajuda }] of campos) {
        const limite = disponiveis(id);
        campo.setAttribute('max', limite); ajuda.textContent = `Disponíveis neste critério: até ${limite} pontos.`;
      }
      aviso.hidden = saldo >= 0;
      aviso.textContent = saldo < 0 ? 'Este rascunho ultrapassa o total. Reduza os valores para corrigir; suas respostas foram preservadas.' : '';
    }
    for (const item of pergunta.itens) {
      const grupo = numero(`${pergunta.id}-${item.id}`, item.texto, { min: 0, max: disponiveis(item.id), passo: 1 }, valores[item.id] ?? 0, (valor, campo) => {
        if (!podeEditar()) return;
        const limite = disponiveis(item.id), anterior = valores[item.id] ?? 0;
        const corrigindoExcesso = soma() > pergunta.total && valor < anterior;
        if (valor !== undefined && (!Number.isSafeInteger(valor) || valor < 0 || valor > pergunta.total || (valor > limite && !corrigindoExcesso))) {
          campo.value = valores[item.id] === undefined ? '0' : String(valores[item.id]);
          aviso.textContent = !Number.isSafeInteger(valor) || valor < 0 ? 'Use pontos inteiros a partir de zero. O valor anterior foi mantido.' : `Neste critério há até ${limite} pontos disponíveis. Reduza outro valor para aumentar este. O valor anterior foi mantido.`;
          aviso.hidden = false; return;
        }
        if (valor === undefined) delete valores[item.id]; else valores[item.id] = valor;
        atualizar(); alterar({ ...valores });
      });
      const ajuda = criar('p', { id: `${pergunta.id}-${item.id}-limite`, class: 'pd-ajuda' });
      const campo = grupo.querySelector('input'); campo.setAttribute('aria-describedby', `${pergunta.id}-${item.id}-limite`);
      grupo.append(ajuda); campos.set(item.id, { campo, ajuda }); bloco.append(grupo);
    }
    atualizar(); bloco.append(resumo, aviso); return bloco;
  }
  if (pergunta.tipo === 'intervalo') {
    const valores = { ...(resposta ?? {}) };
    bloco.className += ' pd-intervalo';
    const resumo = criar('p', { class: 'pd-ajuda pd-intervalo-resumo', role: 'status' });
    const aviso = criar('p', { class: 'pd-aviso-limite pd-intervalo-resumo', role: 'alert', 'data-aviso-intervalo': '' });
    const campos = new Map();
    const diferenca = conteudo => (conteudo.min !== undefined && conteudo.max !== undefined) ? Math.max(0, conteudo.min - conteudo.max) : 0;
    const atualizar = () => {
      resumo.textContent = valores.min === undefined || valores.max === undefined ? 'Preencha os dois limites.' : `Faixa de ${valores.min} a ${valores.max}${pergunta.unidade ? ' ' + pergunta.unidade : ''}`;
      aviso.hidden = diferenca(valores) === 0;
      aviso.textContent = aviso.hidden ? '' : `O mínimo (${valores.min}) deve ser menor ou igual ao máximo (${valores.max}). Reduza o mínimo ou aumente o máximo; os valores anteriores foram preservados.`;
      campos.get('min')?.setAttribute('max', valores.max ?? pergunta.max);
      campos.get('max')?.setAttribute('min', valores.min ?? pergunta.min);
      for (const campo of campos.values()) campo.setAttribute('aria-invalid', String(!aviso.hidden));
    };
    for (const [chave, rotulo] of [['min', 'Mínimo'], ['max', 'Máximo']]) {
      const grupo = numero(`${pergunta.id}-${chave}`, rotulo + (pergunta.unidade ? ` (${pergunta.unidade})` : ''), pergunta, valores[chave], (valor, campo) => {
        if (!podeEditar()) return;
        const propostos = { ...valores };
        if (valor === undefined) delete propostos[chave]; else propostos[chave] = valor;
        try {
          if (campo.validity?.badInput || (campo.value !== '' && valor === undefined)) throw new Error('Use um número válido.');
          verificarResposta(pergunta, propostos);
          if (diferenca(propostos) > 0 && (diferenca(valores) === 0 || diferenca(propostos) >= diferenca(valores))) throw new Error(`O mínimo deve ser menor ou igual ao máximo. ${chave === 'min' ? `Use no máximo ${valores.max}.` : `Use no mínimo ${valores.min}.`}`);
        } catch (erro) {
          campo.value = valores[chave] === undefined ? '' : String(valores[chave]);
          aviso.textContent = `${erro.message} O valor anterior foi mantido.`; aviso.hidden = false;
          return;
        }
        if (valores[chave] === valor) { atualizar(); return; }
        if (valor === undefined) delete valores[chave]; else valores[chave] = valor;
        atualizar(); alterar({ ...valores });
      });
      const campo = grupo.querySelector('input');
      campos.set(chave, campo); bloco.append(grupo);
    }
    atualizar(); bloco.append(resumo, aviso);
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

export function montarEstrelas(pergunta, resposta, alterar, podeEditar) {
  const bloco = criar('div', { class: 'pd-controle-estrelas' });
  const grupo = criar('div', { class: 'pd-estrelas', role: 'radiogroup', 'aria-label': 'Sua avaliação em estrelas' });
  const resumo = criar('output', { class: 'pd-estrelas-valor', 'data-valor-estrelas': '', 'aria-live': 'polite' });
  const icones = [];
  function atualizar(valor) {
    resumo.textContent = valor === undefined ? 'Ainda não respondido' : `${valor} de ${pergunta.max} estrelas`;
    for (const { icone, nota } of icones) icone.setAttribute('data-preenchida', String(valor !== undefined && nota <= valor));
  }
  for (let nota = pergunta.min === 0 ? 0 : 1; nota <= pergunta.max; nota += 1) {
    const rotulo = criar('label', { class: 'pd-estrela-escolha cursor-interaction' });
    const campo = criar('input', { type: 'radio', name: pergunta.id, value: nota, 'aria-label': `${nota} de ${pergunta.max} estrelas` });
    campo.checked = resposta === nota; indisponivel(campo, nota < pergunta.min);
    campo.addEventListener('change', () => {
      if (campo.disabled || !podeEditar() || !campo.checked) return;
      atualizar(nota); alterar(nota);
    });
    rotulo.append(campo);
    if (nota === 0) rotulo.append(criar('span', { 'aria-hidden': 'true' }, '0'));
    else {
      const icone = criar('span', { class: 'pd-estrela-icone', 'aria-hidden': 'true', 'data-estrela': nota });
      icone.innerHTML = ICONE_ESTRELA;
      icones.push({ icone, nota }); rotulo.append(icone);
    }
    grupo.append(rotulo);
  }
  atualizar(resposta);
  bloco.append(grupo, resumo, criar('p', { class: 'pd-ajuda' }, 'Clique em uma estrela para escolher sua nota.'));
  return bloco;
}
