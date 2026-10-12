export function acrescentarDitado({ original, atual, texto, limite = 16000 }) {
  if (atual !== original) throw new Error('O campo mudou durante o ditado. O texto existente foi preservado.');
  if (typeof texto !== 'string' || !texto.trim()) throw new Error('Nenhuma fala foi reconhecida. O campo foi preservado.');
  const combinado = original + (original && !/\s$/.test(original) ? ' ' : '') + texto.trim();
  if (combinado.length > limite) throw new Error('O ditado excede o limite do campo. O texto existente foi preservado.');
  return combinado;
}
export function criarDitadoInterface({ raiz, adaptador, contexto, bloquear, antesDeIniciar, validarTexto, erro, estado }) {
  if (!adaptador.ditado) return { adicionar() {} };
  let ativo = null;
  const pausa = () => new Promise(resolver => setTimeout(resolver, 250));
  async function cancelar() {
    if (!ativo || ativo.cancelado) return;
    ativo.cancelado = true;
    if (ativo.sessao) await adaptador.ditado({ acao: 'cancelar', sessao: ativo.sessao });
  }
  window.addEventListener('pagehide', () => { void cancelar().catch(falha => console.error('Cancelamento do ditado não confirmado:', falha.message)); });
  raiz.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && ativo) { evento.preventDefault(); void cancelar().catch(falha => erro(falha.message)); }
  });
  function adicionar(campo, destino, descricao) {
    if (!adaptador.ditado) return;
    const grupo = document.createElement('div'); grupo.className = 'pd-ditado-campo';
    campo.before(grupo); grupo.append(campo);
    const microfone = document.createElement('button');
    microfone.type = 'button'; microfone.className = 'pd-microfone cursor-interaction'; microfone.title = 'Ditar ' + descricao;
    microfone.setAttribute('aria-label', 'Ditar ' + descricao);
    microfone.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const descartar = document.createElement('button');
    descartar.type = 'button'; descartar.className = 'pd-cancelar-ditado cursor-interaction'; descartar.textContent = '×'; descartar.hidden = true;
    descartar.setAttribute('aria-label', 'Cancelar ditado de ' + descricao); descartar.title = 'Cancelar ditado';
    grupo.append(microfone, descartar);
    descartar.addEventListener('click', () => { void cancelar().catch(falha => erro(falha.message)); });
    microfone.addEventListener('click', async () => {
      if (ativo) {
        if (ativo.botao === microfone && ativo.sessao) {
          microfone.disabled = true;
          try { await adaptador.ditado({ acao: 'parar', sessao: ativo.sessao }); }
          catch (falha) { erro(falha.message); await cancelar(); }
        }
        return;
      }
      const origem = contexto();
      const operacao = { origem, campo, original: campo.value, botao: microfone, sessao: null, cancelado: false };
      ativo = operacao; bloquear(true); erro(''); estado('Iniciando microfone…');
      microfone.disabled = true; descartar.hidden = false; descartar.disabled = false;
      try {
        await antesDeIniciar();
        const iniciado = await adaptador.ditado({ acao: 'iniciar', destino: { id: origem.id, versao: origem.versao, ...destino } });
        operacao.sessao = iniciado.sessao;
        if (operacao.cancelado) await adaptador.ditado({ acao: 'cancelar', sessao: operacao.sessao });
        for (;;) {
          const resposta = await adaptador.ditado({ acao: 'consultar', sessao: operacao.sessao });
          if (resposta.erro) throw new Error(resposta.erro);
          if (resposta.estado === 'cancelado' || operacao.cancelado) { operacao.finalizado = resposta.estado === 'cancelado'; estado('Ditado cancelado; campo preservado'); break; }
          if (resposta.estado === 'concluido') {
            operacao.finalizado = true;
            if (contexto() !== origem || !campo.isConnected) throw new Error('A pergunta mudou. O retorno do ditado não foi aplicado.');
            const combinado = acrescentarDitado({ original: operacao.original, atual: campo.value, texto: resposta.texto });
            validarTexto(destino, combinado);
            bloquear(false); campo.value = combinado;
            campo.dispatchEvent(new window.Event('input', { bubbles: true }));
            estado('Ditado inserido; revise o texto');
            break;
          }
          const gravando = resposta.estado === 'gravando';
          microfone.disabled = !gravando; microfone.setAttribute('aria-label', gravando ? 'Parar ditado de ' + descricao : 'Processando ditado de ' + descricao);
          microfone.title = gravando ? 'Parar e transcrever' : 'Processando…';
          grupo.dataset.gravando = String(gravando);
          estado(gravando ? 'Ouvindo… clique no microfone para parar (até 60 s)' : resposta.estado === 'transcrevendo' ? 'Transcrevendo no computador…' : 'Iniciando microfone…');
          await pausa();
        }
      } catch (falha) { estado('Ditado não aplicado'); erro('Ditado não aplicado. ' + falha.message); }
      finally {
        if (operacao.sessao) {
          try {
            if (operacao.cancelado || !operacao.finalizado) await adaptador.ditado({ acao: 'cancelar', sessao: operacao.sessao });
            else await adaptador.ditado({ acao: 'descartar', sessao: operacao.sessao });
          } catch (falha) { erro('Limpeza do ditado não confirmada: ' + falha.message); }
        }
        ativo = null; grupo.dataset.gravando = 'false'; descartar.hidden = true;
        microfone.setAttribute('aria-label', 'Ditar ' + descricao); microfone.title = 'Ditar ' + descricao;
        bloquear(false);
      }
    });
  }
  return { adicionar };
}

