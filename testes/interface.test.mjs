import test from 'node:test';
import assert from 'node:assert/strict';
import { montarInterface, coordenarCargaInicial } from '../src/interface.mjs';
import { chamarFerramenta } from '../src/servidor.mjs';
import { bancoLocal } from '../scripts/banco-local.mjs';
import { criarDomTeste, aguardarFila, promessaControlada } from './apoio-dom.mjs';

async function contexto() {
  const banco = bancoLocal(); const dono = 'perfil-ficticio';
  const criar = titulo => chamarFerramenta('criar_formulario', { titulo, perguntas: ['Pergunta fictícia'] }, dono, banco);
  const A = await criar('A'); const B = await criar('B');
  const adaptar = {
    origem: 'Teste de lógica isolado', conexao: 'Sem aplicativo nativo', capacidades: () => ({ chat: true, anotacao: true, arquivo: true }),
    ler: id => chamarFerramenta('ler_formulario', { id }, dono, banco),
    salvar: async (id, versao, rascunho) => (await chamarFerramenta('salvar_rascunho', { id, versao, rascunho }, dono, banco))._meta.versao,
    preparar: async (id, versao, rascunho, ...extra) => { const resposta = await chamarFerramenta('preparar_entrega', { id, versao, rascunho, ...(extra[1] ? { idempotencia: extra[1] } : {}) }, dono, banco); return { ...resposta._meta.entrega, versao: resposta._meta.versao }; },
    concluir: (id, token) => chamarFerramenta('confirmar_entrega', { id, token }, dono, banco),
    retomar: async (id, token) => (await chamarFerramenta('retomar_edicao', { id, token }, dono, banco))._meta.versao,
    listar: cursor => chamarFerramenta('listar_pendentes', cursor === undefined ? {} : { cursor }, dono, banco)
  };
  return { banco, dono, A, B, adaptar };
}
function entrada(raiz) { return raiz.querySelector('[data-perguntas]').descendentes().find(item => item.attrs.name === 'p1'); }

test('ditado permite salvar outro campo e mantém o destino e a entrega protegidos', async () => {
  const c = await contexto();
  const processamento = promessaControlada();
  try {
    let consultas = 0;
    const raiz = criarDomTeste();
    const painel = montarInterface(raiz, { ...c.adaptar, ditado: async pedido => {
      if (pedido.acao === 'iniciar') return { sessao: 'sessao-ficticia', estado: 'iniciando' };
      if (pedido.acao === 'consultar') return consultas++ === 0 ? { estado: 'gravando' } : processamento.promessa;
      return { estado: pedido.acao === 'parar' ? 'gravando' : 'concluido' };
    } });
    painel.carregar(c.A);
    const campo = entrada(raiz), observacao = raiz.querySelector('#pd-obs-p1');
    const microfone = raiz.querySelectorAll('[data-ditado]').find(item => item.attrs['aria-label'] === 'Ditar resposta da pergunta 1');
    const ditando = microfone.disparar('click');
    await aguardarFila();
    assert.equal(campo.disabled, true); assert.equal(observacao.disabled, false);
    assert.equal(raiz.querySelectorAll('[data-entrega]')[0].disabled, true);
    observacao.value = 'Escrita enquanto a voz é processada';
    observacao.events.input[0](); await aguardarFila();
    await microfone.disparar('click');
    assert.equal(microfone.parentElement.dataset.estado, 'encerrando');
    assert.ok(microfone.innerHTML.includes('pd-giro'));
    assert.equal(microfone.disabled, true);
    processamento.resolver({ estado: 'concluido', texto: 'Resposta reconhecida fictícia' });
    await ditando; await aguardarFila();
    const salvo = (await c.adaptar.ler(c.A.structuredContent.id))._meta.rascunho;
    assert.equal(salvo.respostas.p1, 'Resposta reconhecida fictícia');
    assert.equal(salvo.observacoes.p1, 'Escrita enquanto a voz é processada');
    assert.equal(campo.disabled, false); assert.equal(observacao.disabled, false);
    assert.equal(microfone.parentElement.dataset.estado, 'pronto');
  } finally { processamento.resolver({ estado: 'cancelado' }); c.banco.fechar(); }
});

test('Abertura manual sem resultado inicial consulta e mostra pendentes', async () => {
  const c = await contexto();
  try {
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, c.adaptar);
    const carga = coordenarCargaInicial({ carregar: painel.carregar, listar: () => c.adaptar.listar(), mostrarErro: painel.mostrarErro });
    carga.receber({ content: [] });
    await carga.iniciar();
    assert.equal(raiz.querySelector('[data-pendentes]').hidden, false);
    assert.equal(raiz.querySelector('[data-pendentes]').descendentes().filter(item => item.tag === 'button').length, 2);
  } finally { c.banco.fechar(); }
});

test('Resultado recebido durante a abertura prevalece sobre a lista tardia', async () => {
  const c = await contexto();
  try {
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, c.adaptar);
    let liberar;
    const lista = new Promise(resolver => { liberar = resolver; });
    const carga = coordenarCargaInicial({ carregar: painel.carregar, listar: () => lista, mostrarErro: painel.mostrarErro });
    const iniciando = carga.iniciar();
    carga.receber(c.A);
    liberar(await c.adaptar.listar());
    await iniciando;
    assert.equal(raiz.querySelector('[data-titulo]').textContent, 'A');
    assert.equal(raiz.querySelector('[data-formulario]').hidden, false);
  } finally { c.banco.fechar(); }
});

test('Abertura sem conteúdo utilizável informa erro em vez de permanecer vazia', async () => {
  const erros = [];
  const carga = coordenarCargaInicial({ carregar: () => assert.fail('Não deve carregar conteúdo ausente.'), listar: async () => ({ content: [] }), mostrarErro: erro => erros.push(erro) });
  await carga.iniciar();
  assert.equal(erros.length, 1);
  assert.match(erros[0], /não devolveu o conteúdo/);
});

test('Preparação ambígua não pode ser descongelada por leitura antiga', async () => {
  const c = await contexto();
  try {
    await c.adaptar.salvar(c.A.structuredContent.id, 1, { respostas: { p1: 'A' } });
    const leituraAntiga = await c.adaptar.ler(c.A.structuredContent.id);
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, { ...c.adaptar, preparar: async (...args) => { await c.adaptar.preparar(...args); throw new Error('Resposta perdida'); } });
    painel.carregar(leituraAntiga); await raiz.querySelectorAll('[data-entrega]')[0].disparar('click');
    painel.carregar(leituraAntiga);
    assert.equal(entrada(raiz).disabled, true); assert.equal(raiz.querySelector('[data-retomar]').hidden, false);
    assert.ok((await c.adaptar.ler(c.A.structuredContent.id))._meta.preparacao);
  } finally { c.banco.fechar(); }
});
test('Retomada de preparação ambígua não adota versão gravada por outra janela', async () => {
  const c = await contexto();
  try {
    await c.adaptar.salvar(c.A.structuredContent.id, 1, { respostas: { p1: 'A' } });
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, { ...c.adaptar, preparar: async (...args) => { await c.adaptar.preparar(...args); throw new Error('Resposta perdida'); } });
    painel.carregar(await c.adaptar.ler(c.A.structuredContent.id)); await raiz.querySelectorAll('[data-entrega]')[0].disparar('click');
    const preparado = await c.adaptar.ler(c.A.structuredContent.id);
    const versao = await c.adaptar.retomar(c.A.structuredContent.id, preparado._meta.preparacao.token);
    await c.adaptar.salvar(c.A.structuredContent.id, versao, { respostas: { p1: 'Outra janela' }, observacoes: { p1: 'Observação da outra janela' } });
    await raiz.querySelector('[data-retomar]').disparar('click');
    entrada(raiz).value = 'A seguinte'; entrada(raiz).events.input[0](); await aguardarFila();
    const salvo = await c.adaptar.ler(c.A.structuredContent.id);
    assert.equal(salvo._meta.rascunho.respostas.p1, 'Outra janela'); assert.equal(salvo._meta.rascunho.observacoes.p1, 'Observação da outra janela');
    assert.equal(raiz.querySelector('[data-erro]').hidden, false); assert.ok(raiz.querySelector('[data-recuperacao]'));
  } finally { c.banco.fechar(); }
});

for (const manterLocal of [false, true]) test('Conflito permite escolha explícita de ' + (manterLocal ? 'guardar texto local' : 'usar versão salva'), async () => {
  const c = await contexto();
  try {
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, c.adaptar); painel.carregar(c.A);
    await c.adaptar.salvar(c.A.structuredContent.id, 1, { respostas: { p1: 'Outra janela' } });
    entrada(raiz).value = 'Texto local preservado'; entrada(raiz).events.input[0](); await aguardarFila();
    assert.equal(entrada(raiz).value, 'Texto local preservado');
    const botao = raiz.querySelector('[data-recuperacao]').children.find(item => item.textContent === (manterLocal ? 'Guardar meu preenchimento' : 'Usar versão salva'));
    await botao.disparar('click');
    const esperado = manterLocal ? 'Texto local preservado' : 'Outra janela';
    assert.equal((await c.adaptar.ler(c.A.structuredContent.id))._meta.rascunho.respostas.p1, esperado);
    assert.equal(entrada(raiz).value, esperado); assert.equal(raiz.querySelector('[data-erro]').hidden, true);
  } finally { c.banco.fechar(); }
});

test('Resultado antigo não ressuscita formulário concluído depois de abrir outro', async () => {
  const c = await contexto();
  try {
    await c.adaptar.salvar(c.A.structuredContent.id, 1, { respostas: { p1: 'A' } });
    const antigo = await c.adaptar.ler(c.A.structuredContent.id);
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, { ...c.adaptar, entregar: async () => 'Confirmação fictícia' });
    painel.carregar(antigo); await raiz.querySelectorAll('[data-entrega]')[0].disparar('click'); painel.carregar(c.B); painel.carregar(antigo);
    assert.equal(raiz.querySelector('[data-titulo]').textContent, 'B'); await assert.rejects(c.adaptar.ler(c.A.structuredContent.id), /não encontrado/);
  } finally { c.banco.fechar(); }
});

test('Preparação com resposta perdida congela a tela e permite retomada conferida', async () => {
  const c = await contexto();
  try {
    await c.adaptar.salvar(c.A.structuredContent.id, 1, { respostas: { p1: 'A' } });
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, { ...c.adaptar, preparar: async (...args) => { await c.adaptar.preparar(...args); throw new Error('Resposta fictícia perdida'); } });
    painel.carregar(await c.adaptar.ler(c.A.structuredContent.id)); await raiz.querySelectorAll('[data-entrega]')[0].disparar('click');
    assert.equal(entrada(raiz).disabled, true); assert.equal(raiz.querySelector('[data-retomar]').hidden, false);
    assert.ok((await c.adaptar.ler(c.A.structuredContent.id))._meta.preparacao);
    await raiz.querySelector('[data-retomar]').disparar('click');
    assert.equal(entrada(raiz).disabled, false); assert.equal((await c.adaptar.ler(c.A.structuredContent.id))._meta.preparacao, null);
  } finally { c.banco.fechar(); }
});

test('Falha reiterada na limpeza nunca libera edição de respostas entregues', async () => {
  const c = await contexto();
  try {
    await c.adaptar.salvar(c.A.structuredContent.id, 1, { respostas: { p1: 'Texto enviado' } });
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, { ...c.adaptar, entregar: async () => 'Confirmado', concluir: async () => { throw new Error('Limpeza fictícia falhou'); } });
    painel.carregar(await c.adaptar.ler(c.A.structuredContent.id)); await raiz.querySelectorAll('[data-entrega]')[0].disparar('click');
    await raiz.querySelector('[data-limpar]').disparar('click'); assert.equal(entrada(raiz).disabled, true);
    entrada(raiz).value = 'Tentativa programática'; entrada(raiz).events.input[0](); await aguardarFila();
    assert.equal((await c.adaptar.ler(c.A.structuredContent.id))._meta.rascunho.respostas.p1, 'Texto enviado');
  } finally { c.banco.fechar(); }
});

for (const durante of [false, true]) test('Salvamento permanece em A quando B é solicitado ' + (durante ? 'durante a operação' : 'antes da fila'), async () => {
  const c = await contexto(); const pausa = promessaControlada(); const inicio = promessaControlada();
  try {
    const raiz = criarDomTeste();
    const painel = montarInterface(raiz, { ...c.adaptar, salvar: async (...args) => { inicio.resolver(); if (durante) await pausa.promessa; return c.adaptar.salvar(...args); } });
    painel.carregar(c.A); entrada(raiz).value = 'Resposta fictícia exclusiva de A'; entrada(raiz).events.input[0]();
    if (durante) await inicio.promessa;
    painel.carregar(c.B); pausa.resolver(); await aguardarFila();
    assert.equal((await c.adaptar.ler(c.A.structuredContent.id))._meta.rascunho.respostas.p1, 'Resposta fictícia exclusiva de A');
    assert.equal((await c.adaptar.ler(c.B.structuredContent.id))._meta.rascunho.respostas.p1, undefined);
    assert.equal(raiz.querySelector('[data-titulo]').textContent, 'B');
    assert.equal(entrada(raiz).value, '');
  } finally { c.banco.fechar(); }
});

for (const fase of ['preparar', 'entregar', 'concluir']) test('Trocar para B durante ' + fase + ' não altera nem exclui B', async () => {
  const c = await contexto(); const pausa = promessaControlada(); const inicio = promessaControlada();
  try {
    const respostaA = { respostas: { p1: 'A preenchido' } }; const respostaB = { respostas: { p1: 'B preenchido' } };
    await c.adaptar.salvar(c.A.structuredContent.id, 1, respostaA);
    await c.adaptar.preparar(c.B.structuredContent.id, 1, respostaB);
    const raiz = criarDomTeste(); const chamadas = [];
    const adaptar = { ...c.adaptar, entregar: async () => 'Entrega fictícia confirmada' };
    const original = adaptar[fase];
    adaptar[fase] = async (...args) => { inicio.resolver(); await pausa.promessa; if (fase === 'concluir') chamadas.push(args[0]); return original(...args); };
    const painel = montarInterface(raiz, adaptar);
    painel.carregar(await c.adaptar.ler(c.A.structuredContent.id));
    const envio = raiz.querySelectorAll('[data-entrega]')[0].disparar('click');
    await inicio.promessa; painel.carregar(await c.adaptar.ler(c.B.structuredContent.id)); pausa.resolver(); await envio;
    await assert.rejects(c.adaptar.ler(c.A.structuredContent.id), /não encontrado/);
    assert.equal((await c.adaptar.ler(c.B.structuredContent.id))._meta.rascunho.respostas.p1, 'B preenchido');
    assert.equal(raiz.querySelector('[data-titulo]').textContent, 'B');
    assert.equal(raiz.querySelector('[data-sucesso]').hidden, true);
    if (fase === 'concluir') assert.deepEqual(chamadas, [c.A.structuredContent.id]);
  } finally { c.banco.fechar(); }
});

test('Leitura atrasada de um pendente não substitui um formulário mais recente', async () => {
  const c = await contexto(); const pausa = promessaControlada();
  try {
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, { ...c.adaptar, ler: async id => { await pausa.promessa; return c.adaptar.ler(id); } });
    painel.carregar({ _meta: { pendentes: [{ id: c.A.structuredContent.id, titulo: 'A' }] } });
    const clique = raiz.querySelector('[data-pendentes]').children.find(item => item.tag === 'button').disparar('click');
    painel.carregar(c.B); pausa.resolver(); await clique;
    assert.equal(raiz.querySelector('[data-titulo]').textContent, 'B');
  } finally { c.banco.fechar(); }
});

test('Erro de leitura aparece na lista visível, mesmo com formulário oculto', async () => {
  const raiz = criarDomTeste();
  const painel = montarInterface(raiz, { origem: 'Teste', capacidades: () => ({}), ler: async () => { throw new Error('Rascunho não encontrado'); } });
  painel.carregar({ _meta: { pendentes: [{ id: 'ausente', titulo: 'Rascunho removido' }] } });
  await raiz.querySelector('[data-pendentes]').children.find(item => item.tag === 'button').disparar('click');
  const aviso = raiz.querySelector('[data-erro-pendentes]');
  assert.equal(raiz.querySelector('[data-formulario]').hidden, true);
  assert.equal(raiz.querySelector('[data-pendentes]').hidden, false);
  assert.equal(aviso.hidden, false); assert.match(aviso.textContent, /não encontrado/);
});

test('Lista permite abrir o rascunho além do centésimo sem repetir resultados', async () => {
  const c = await contexto();
  try {
    for (let i = 0; i < 99; i += 1) await chamarFerramenta('criar_formulario', { titulo: 'Fictício ' + i, perguntas: ['Texto'] }, c.dono, c.banco);
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, c.adaptar);
    painel.carregar(await chamarFerramenta('abrir_painel', {}, c.dono, c.banco));
    const lista = raiz.querySelector('[data-pendentes]');
    await lista.children.find(item => item.textContent === 'Carregar mais formulários').disparar('click');
    const nomes = lista.children.filter(item => item.tag === 'button' && item.textContent !== 'Carregar mais formulários').map(item => item.textContent);
    assert.equal(nomes.length, 101); assert.equal(new Set(nomes).size, 101);
    await lista.children.find(item => item.textContent === 'A').disparar('click');
    assert.equal(raiz.querySelector('[data-titulo]').textContent, 'A');
  } finally { c.banco.fechar(); }
});

test('Falha de salvamento mantém texto e bloqueia troca antes de confirmação', async () => {
  const c = await contexto();
  try {
    const raiz = criarDomTeste();
    const painel = montarInterface(raiz, { ...c.adaptar, salvar: async () => { throw new Error('Falha fictícia de armazenamento'); } });
    painel.carregar(c.A); entrada(raiz).value = 'Texto ainda não guardado'; entrada(raiz).events.input[0](); painel.carregar(c.B); await aguardarFila();
    assert.equal(raiz.querySelector('[data-titulo]').textContent, 'A');
    assert.equal(entrada(raiz).value, 'Texto ainda não guardado');
    assert.equal(raiz.querySelector('[data-erro]').hidden, false);
  } finally { c.banco.fechar(); }
});

test('versão antiga é conciliada com campo remoto independente sem perder o foco', async () => {
  const c = await contexto();
  try {
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, c.adaptar); painel.carregar(c.A);
    const campo = entrada(raiz); campo.focus();
    await c.adaptar.salvar(c.A.structuredContent.id, 1, { observacoes: { p1: 'Observação da outra aba' }, gerais: 'Geral remoto' });
    campo.value = 'Minha resposta'; await campo.disparar('input'); await aguardarFila();
    const salvo = await c.adaptar.ler(c.A.structuredContent.id);
    assert.equal(salvo._meta.versao, 3);
    assert.equal(salvo._meta.rascunho.respostas.p1, 'Minha resposta');
    assert.equal(salvo._meta.rascunho.observacoes.p1, 'Observação da outra aba');
    assert.equal(raiz.querySelector('#pd-obs-p1').value, 'Observação da outra aba');
    assert.equal(raiz.querySelector('#pd-observacoes-gerais').value, 'Geral remoto');
    assert.equal(document.activeElement, entrada(raiz));
    assert.equal(raiz.querySelector('[data-erro]').hidden, true);
  } finally { c.banco.fechar(); }
});

test('fila de digitação rápida conserva a conciliação anterior e a última edição local', async () => {
  const c = await contexto();
  try {
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, c.adaptar); painel.carregar(c.A);
    await c.adaptar.salvar(c.A.structuredContent.id, 1, { observacoes: { p1: 'Remoto' } });
    const campo = entrada(raiz);
    for (const valor of ['M', 'Mi', 'Minha resposta completa']) { campo.value = valor; campo.events.input[0](); }
    await aguardarFila();
    const salvo = (await c.adaptar.ler(c.A.structuredContent.id))._meta.rascunho;
    assert.equal(salvo.respostas.p1, 'Minha resposta completa'); assert.equal(salvo.observacoes.p1, 'Remoto');
    assert.equal(entrada(raiz).value, 'Minha resposta completa');
    assert.equal(raiz.querySelector('[data-erro]').hidden, true);
  } finally { c.banco.fechar(); }
});

test('guardar preenchimento em conflito não apaga observação independente da outra aba', async () => {
  const c = await contexto();
  try {
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, c.adaptar); painel.carregar(c.A);
    await c.adaptar.salvar(c.A.structuredContent.id, 1, { respostas: { p1: 'Resposta remota' }, observacoes: { p1: 'Observação remota' } });
    entrada(raiz).value = 'Resposta local'; await entrada(raiz).disparar('input'); await aguardarFila();
    assert.match(raiz.querySelector('[data-erro]').textContent, /alterada de formas diferentes/);
    await raiz.querySelector('[data-recuperacao]').children.find(item => item.textContent === 'Guardar meu preenchimento').disparar('click');
    const salvo = (await c.adaptar.ler(c.A.structuredContent.id))._meta.rascunho;
    assert.equal(salvo.respostas.p1, 'Resposta local'); assert.equal(salvo.observacoes.p1, 'Observação remota');
    assert.equal(raiz.querySelector('#pd-obs-p1').value, 'Observação remota');
    assert.equal(raiz.querySelector('[data-erro]').hidden, true);
  } finally { c.banco.fechar(); }
});

test('resposta perdida da gravação pode ser conferida pela leitura sem regravar conteúdo igual', async () => {
  const c = await contexto(); let perder = true;
  try {
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, { ...c.adaptar, salvar: async (...args) => {
      const versao = await c.adaptar.salvar(...args);
      if (perder) { perder = false; throw new Error('Resposta perdida após gravação'); }
      return versao;
    } }); painel.carregar(c.A);
    entrada(raiz).value = 'Texto salvo'; await entrada(raiz).disparar('input'); await aguardarFila();
    assert.equal(raiz.querySelector('[data-erro]').hidden, false);
    await entrada(raiz).disparar('input'); await aguardarFila();
    const salvo = await c.adaptar.ler(c.A.structuredContent.id);
    assert.equal(salvo._meta.versao, 2); assert.equal(salvo._meta.rascunho.respostas.p1, 'Texto salvo');
    assert.equal(raiz.querySelector('[data-erro]').hidden, true);
  } finally { c.banco.fechar(); }
});

test('segunda corrida interrompe a tentativa automática e preserva a escolha antes de novos cliques', async () => {
  const c = await contexto(); let chamadas = 0;
  try {
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, { ...c.adaptar, salvar: async (...args) => {
      chamadas += 1;
      const remoto = await c.adaptar.ler(args[0]);
      remoto._meta.rascunho.observacoes.p1 = 'Remoto ' + chamadas;
      await c.adaptar.salvar(args[0], remoto._meta.versao, remoto._meta.rascunho);
      return c.adaptar.salvar(...args);
    } }); painel.carregar(c.A);
    entrada(raiz).value = 'Local'; await entrada(raiz).disparar('input'); await aguardarFila();
    assert.equal(chamadas, 2); assert.match(raiz.querySelector('[data-erro]').textContent, /mudou novamente/);
    entrada(raiz).value = 'Local seguinte'; await entrada(raiz).disparar('input'); await aguardarFila();
    assert.equal(chamadas, 2); assert.equal(entrada(raiz).value, 'Local seguinte');
    assert.equal((await c.adaptar.ler(c.A.structuredContent.id))._meta.rascunho.respostas.p1, undefined);
  } finally { c.banco.fechar(); }
});

test('conciliação não modifica formulário em entrega por outra aba', async () => {
  const c = await contexto();
  try {
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, c.adaptar); painel.carregar(c.A);
    await c.adaptar.preparar(c.A.structuredContent.id, 1, { respostas: { p1: 'Em entrega' } });
    entrada(raiz).value = 'Local preservado'; await entrada(raiz).disparar('input'); await aguardarFila();
    assert.match(raiz.querySelector('[data-erro]').textContent, /em entrega em outra aba/);
    assert.equal(entrada(raiz).value, 'Local preservado');
    const remoto = await c.adaptar.ler(c.A.structuredContent.id);
    assert.ok(remoto._meta.preparacao); assert.equal(remoto._meta.rascunho.respostas.p1, 'Em entrega');
  } finally { c.banco.fechar(); }
});

test('campo remoto adotado pode ser editado depois, inclusive com digitação enfileirada', async () => {
  const c = await contexto(); const pausa = promessaControlada(); const iniciou = promessaControlada();
  let pausar = false;
  try {
    const raiz = criarDomTeste(); const painel = montarInterface(raiz, { ...c.adaptar, salvar: async (...args) => {
      if (pausar) { pausar = false; iniciou.resolver(); await pausa.promessa; }
      return c.adaptar.salvar(...args);
    } }); painel.carregar(c.A);
    await c.adaptar.salvar(c.A.structuredContent.id, 1, { observacoes: { p1: 'Remoto' } });
    entrada(raiz).value = 'Local'; await entrada(raiz).disparar('input'); await aguardarFila();
    assert.equal(raiz.querySelector('#pd-obs-p1').value, 'Remoto');
    pausar = true;
    entrada(raiz).value = 'Local editado'; entrada(raiz).events.input[0](); await iniciou.promessa;
    const observacao = raiz.querySelector('#pd-obs-p1');
    for (const texto of ['Remoto com', 'Remoto com minha edição']) { observacao.value = texto; observacao.events.input[0](); }
    pausa.resolver(); await aguardarFila();
    const salvo = (await c.adaptar.ler(c.A.structuredContent.id))._meta.rascunho;
    assert.equal(salvo.respostas.p1, 'Local editado'); assert.equal(salvo.observacoes.p1, 'Remoto com minha edição');
    assert.equal(raiz.querySelector('[data-erro]').hidden, true);
  } finally { pausa.resolver(); c.banco.fechar(); }
});

test('conciliação durante ditado adia redesenho e conserva destino, texto e campo remoto', async () => {
  const c = await contexto(); const processamento = promessaControlada();
  try {
    const raiz = criarDomTeste();
    const painel = montarInterface(raiz, { ...c.adaptar, ditado: async pedido => {
      if (pedido.acao === 'iniciar') return { sessao: 'ditado-isolado', estado: 'gravando' };
      if (pedido.acao === 'consultar') return processamento.promessa;
      return { estado: 'concluido' };
    } }); painel.carregar(c.A);
    const campo = entrada(raiz), microfone = raiz.querySelectorAll('[data-ditado]').find(item => item.attrs['aria-label'] === 'Ditar resposta da pergunta 1');
    const captura = microfone.disparar('click'); await aguardarFila();
    await c.adaptar.salvar(c.A.structuredContent.id, 1, { observacoes: { p1: 'Remoto durante voz' } });
    const gerais = raiz.querySelector('#pd-observacoes-gerais'); gerais.value = 'Geral local'; await gerais.disparar('input'); await aguardarFila();
    assert.equal(entrada(raiz), campo); assert.equal(campo.isConnected, true);
    processamento.resolver({ estado: 'concluido', texto: 'Texto reconhecido de teste' }); await captura; await aguardarFila();
    const salvo = (await c.adaptar.ler(c.A.structuredContent.id))._meta.rascunho;
    assert.equal(salvo.respostas.p1, 'Texto reconhecido de teste');
    assert.equal(salvo.observacoes.p1, 'Remoto durante voz'); assert.equal(salvo.gerais, 'Geral local');
    assert.equal(entrada(raiz).value, 'Texto reconhecido de teste');
    assert.equal(raiz.querySelector('#pd-obs-p1').value, 'Remoto durante voz');
  } finally { processamento.resolver({ estado: 'cancelado' }); c.banco.fechar(); }
});
