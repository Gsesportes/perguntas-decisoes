import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarFormulario, validarRascunho, montarEntrega, perguntasVisiveis, POR_PAGINA } from '../src/formulario.mjs';
import { chamarFerramenta } from '../src/servidor.mjs';
import { bancoLocal } from '../scripts/banco-local.mjs';
import { montarInterface } from '../src/interface.mjs';
import { criarDomTeste, aguardarFila } from './apoio-dom.mjs';

const formulario = perguntas => normalizarFormulario({ perguntas });
test('tabela com cinquenta itens conserva ordem, observações e nove páginas', () => {
  const f = formulario([{ texto: 'Classificação', tipo: 'tabela', itens: Array.from({ length: 50 }, (_, i) => `Item ${i + 1}`), opcoes: ['Aprovar', 'Ajustar'] }]);
  assert.equal(f.formato, 2); assert.equal(f.perguntas.length, 50);
  assert.equal(Math.ceil(f.perguntas.length / POR_PAGINA), 9);
  assert.equal(f.perguntas[49].id, 'p1_i50');
  const respostas = Object.fromEntries(f.perguntas.map(p => [p.id, 'Aprovar']));
  const entrega = montarEntrega(f, { respostas, observacoes: { p1_i50: 'Última observação' } });
  assert.match(entrega.texto, /Classificação — Item 50/); assert.match(entrega.texto, /Última observação/);
  const curta = normalizarFormulario({ perguntas: ['A', 'B'], tipo: 'tabela', opcoes: ['Sim', 'Não'] });
  assert.deepEqual(curta.perguntas.map(p => p.id), ['p1', 'p2']);
});
test('tabela expandida respeita limite global sem perder itens', () => {
  const tabela = { texto: 'Tabela', tipo: 'tabela', itens: Array.from({ length: 200 }, (_, i) => String(i)), opcoes: ['A', 'B'] };
  assert.throws(() => formulario(Array.from({ length: 6 }, () => tabela)), /1000/);
});
test('ordenação exige ação e uma permutação completa', () => {
  const f = formulario([{ texto: 'Prioridades', tipo: 'ordenacao', opcoes: ['Clareza', 'Velocidade', 'Qualidade'] }]);
  assert.deepEqual(validarRascunho(f, {}).pendentes, ['p1']);
  for (const resposta of [['Clareza'], ['Clareza', 'Clareza', 'Qualidade'], ['Clareza', 'Velocidade', 'Inventada']]) assert.throws(() => validarRascunho(f, { respostas: { p1: resposta } }), /Ordenação/);
  const entrega = montarEntrega(f, { respostas: { p1: ['Qualidade', 'Clareza', 'Velocidade'] } });
  assert.match(entrega.texto, /1\. Qualidade\n2\. Clareza\n3\. Velocidade/);
});
test('pontos guardam distribuição parcial, mas só entregam soma exata', () => {
  const f = formulario([{ texto: 'Pesos', tipo: 'pontos', itens: ['Clareza', 'Velocidade'], total: 100 }]);
  for (const resposta of [{ i1: 40 }, { i1: 80, i2: 60 }]) { assert.deepEqual(validarRascunho(f, { respostas: { p1: resposta } }).pendentes, ['p1']); assert.throws(() => montarEntrega(f, { respostas: { p1: resposta } }), /Faltam/); }
  assert.throws(() => validarRascunho(f, { respostas: { p1: { i1: -1 } } }), /Pontos/);
  assert.throws(() => validarRascunho(f, { respostas: { p1: { desconhecido: 100 } } }), /inválida/);
  const entrega = montarEntrega(f, { respostas: { p1: { i1: 100 } } });
  assert.deepEqual(entrega.compacto.respostas[0][1], { i1: 100, i2: 0 });
  assert.match(entrega.texto, /Velocidade: 0 pontos/); assert.ok(!entrega.texto.includes('[object Object]'));
});
test('intervalo mantém estado parcial e não entrega faixa invertida', () => {
  const f = formulario([{ texto: 'Duração', tipo: 'intervalo', min: 0, max: 60, unidade: 'minutos' }]);
  for (const resposta of [{ min: 15 }, { min: 40, max: 20 }]) { assert.deepEqual(validarRascunho(f, { respostas: { p1: resposta } }).pendentes, ['p1']); assert.throws(() => montarEntrega(f, { respostas: { p1: resposta } }), /Faltam/); }
  assert.throws(() => validarRascunho(f, { respostas: { p1: { min: -1, max: 30 } } }), /numérico/);
  assert.match(montarEntrega(f, { respostas: { p1: { min: 15, max: 30 } } }).texto, /De 15 a 30 minutos/);
});
test('lista preserva rascunho e entrega só entradas preenchidas, na ordem', () => {
  const f = formulario([{ texto: 'Sugestões', tipo: 'lista', min_itens: 2, max_itens: 4 }]);
  const r = validarRascunho(f, { respostas: { p1: [' Primeira ', '', 'Segunda', '   '] } });
  assert.deepEqual(r.rascunho.respostas.p1, [' Primeira ', '', 'Segunda', '   ']);
  const e = montarEntrega(f, r.rascunho);
  assert.deepEqual(e.compacto.respostas[0][1], [' Primeira ', 'Segunda']);
  assert.throws(() => montarEntrega(f, { respostas: { p1: ['Uma'] } }), /Faltam/);
  assert.throws(() => validarRascunho(f, { respostas: { p1: ['a'.repeat(2001)] } }), /Lista/);
});
test('apresentações não mudam tipos antigos e recusam configurações incoerentes', () => {
  assert.equal(formulario([{ texto: 'Nota', tipo: 'nota' }]).formato, undefined);
  const f = formulario([{ texto: 'Estrelas', tipo: 'nota', visual: 'estrelas' }, { texto: 'Emojis', tipo: 'escala', visual: 'emojis' }, { texto: 'Barra', tipo: 'escala', visual: 'barra' }]);
  assert.deepEqual(f.perguntas.map(p => [p.min, p.max]), [[1, 5], [1, 5], [0, 100]]);
  assert.deepEqual(validarRascunho(f, {}).pendentes, ['p1', 'p2', 'p3']);
  assert.throws(() => formulario([{ texto: 'Inválido', tipo: 'texto', visual: 'estrelas' }]), /Apresentação/);
  assert.throws(() => formulario([{ texto: 'Inválido', tipo: 'nota', visual: 'emojis', max: 10 }]), /Emojis/);
  assert.throws(() => formulario([{ texto: 'Tipo ausente', opcoes: ['A', 'B'] }]), /não pertence/);
});
test('condições consideram origem visível e mantêm os dados ocultos fora da entrega', () => {
  const f = formulario([{ texto: 'Recursos', tipo: 'multipla', opcoes: ['A', 'B'] }, { texto: 'Confirmar?', tipo: 'sim_nao', se: { pergunta: 'p1', igual: 'A' } }, { texto: 'Detalhe', se: { pergunta: 'p2', igual: 'Sim' } }]);
  const rascunho = { respostas: { p1: ['B'], p2: 'Sim', p3: 'Detalhe guardado' }, observacoes: { p3: 'Observação guardada' } };
  assert.deepEqual(perguntasVisiveis(f, rascunho.respostas).map(p => p.id), ['p1']);
  assert.equal(validarRascunho(f, rascunho).rascunho.respostas.p3, 'Detalhe guardado');
  assert.ok(!montarEntrega(f, rascunho).texto.includes('guardad'));
  rascunho.respostas.p1 = ['A'];
  assert.deepEqual(perguntasVisiveis(f, rascunho.respostas).map(p => p.id), ['p1', 'p2', 'p3']);
  assert.match(montarEntrega(f, rascunho).texto, /Observação guardada/);
});
test('condições recusam referências futuras, ciclos e valores incompatíveis', () => {
  assert.throws(() => formulario([{ texto: 'Futura', se: { pergunta: 'p2', igual: 'Sim' } }, { texto: 'Origem', tipo: 'sim_nao' }]), /anterior/);
  assert.throws(() => formulario([{ texto: 'Própria', tipo: 'sim_nao', se: { pergunta: 'p1', igual: 'Sim' } }]), /anterior/);
  assert.throws(() => formulario([{ texto: 'Origem', tipo: 'sim_nao' }, { texto: 'Destino', se: { pergunta: 'p1', igual: 'Talvez' } }]), /condição inválido/);
  assert.throws(() => formulario([{ texto: 'Origem' }, { texto: 'Destino', se: { pergunta: 'p1', igual: 'Texto' } }]), /origem de escolha/);
});
test('dados avançados ficam fora do escopo legado, com acesso normal pelo servidor novo', async () => {
  const banco = bancoLocal(), dono = 'perfil-formatos';
  try {
    const antigo = await chamarFerramenta('criar_formulario', { perguntas: ['Texto antigo'] }, dono, banco);
    const novo = await chamarFerramenta('criar_formulario', { perguntas: [{ texto: 'Lista', tipo: 'lista' }] }, dono, banco);
    const composto = await chamarFerramenta('criar_formulario', { perguntas: [{ texto: 'Quando?', tipo: 'data_hora' }] }, dono, banco);
    const legados = await banco.prepare('SELECT id FROM formularios WHERE dono=?').bind(dono).all();
    assert.deepEqual(legados.results.map(r => r.id), [antigo.structuredContent.id]);
    const { escopoFormatos } = await import('../src/repositorio.mjs');
    const versaoIntermediaria = await banco.prepare('SELECT id FROM formularios WHERE dono IN (?,?)').bind(dono, escopoFormatos(dono)).all();
    assert.ok(versaoIntermediaria.results.some(r => r.id === novo.structuredContent.id));
    assert.ok(!versaoIntermediaria.results.some(r => r.id === composto.structuredContent.id));
    assert.equal((await chamarFerramenta('listar_pendentes', {}, dono, banco))._meta.pendentes.length, 3);
    await assert.rejects(chamarFerramenta('ler_formulario', { id: novo.structuredContent.id }, 'outro-perfil', banco), /acesso não autorizado/);
    const r = await chamarFerramenta('salvar_rascunho', { id: novo.structuredContent.id, versao: 1, rascunho: { respostas: { p1: ['Item'] } } }, dono, banco);
    const e = await chamarFerramenta('preparar_entrega', { id: novo.structuredContent.id, versao: r._meta.versao, rascunho: { respostas: { p1: ['Item'] } } }, dono, banco);
    await chamarFerramenta('confirmar_entrega', { id: novo.structuredContent.id, token: e._meta.entrega.token }, dono, banco);
    assert.equal((await chamarFerramenta('ler_formulario', { id: antigo.structuredContent.id }, dono, banco))._meta.formulario.perguntas[0].tipo, 'texto');
  } finally { banco.fechar(); }
});

async function painelTeste(perguntas) {
  const banco = bancoLocal(), dono = 'perfil-interface-formatos';
  const criado = await chamarFerramenta('criar_formulario', { perguntas }, dono, banco);
  const raiz = criarDomTeste(), entregas = [];
  const adaptador = {
    origem: 'Verificação isolada', conexao: 'Sem aplicativo nativo', capacidades: () => ({ chat: true, anotacao: true, arquivo: true }),
    salvar: async (id, versao, rascunho) => (await chamarFerramenta('salvar_rascunho', { id, versao, rascunho }, dono, banco))._meta.versao,
    preparar: async (id, versao, rascunho) => { const r = await chamarFerramenta('preparar_entrega', { id, versao, rascunho }, dono, banco); return { ...r._meta.entrega, versao: r._meta.versao }; },
    entregar: async (modo, entrega) => { entregas.push(entrega); return 'Entrega fictícia'; },
    concluir: (id, token) => chamarFerramenta('confirmar_entrega', { id, token }, dono, banco)
  };
  montarInterface(raiz, adaptador).carregar(criado);
  const ler = async () => (await chamarFerramenta('ler_formulario', { id: criado.structuredContent.id }, dono, banco))._meta.rascunho;
  return { banco, raiz, entregas, ler };
}
async function selecionar(raiz, nome, valor) {
  const controles = raiz.querySelectorAll('input').filter(c => c.attrs.name === nome);
  for (const controle of controles) controle.checked = controle.attrs.value === String(valor);
  const selecionado = controles.find(c => c.checked);
  assert.ok(selecionado); await selecionado.disparar('change'); await aguardarFila();
}
test('controles de ordem, pontos e faixa persistem valores e impedem envio incompleto', async () => {
  const c = await painelTeste([{ texto: 'Ordem', tipo: 'ordenacao', opcoes: ['A', 'B'] }, { texto: 'Pesos', tipo: 'pontos', itens: ['A', 'B'] }, { texto: 'Faixa', tipo: 'intervalo', min: 0, max: 100 }]);
  try {
    assert.equal(Object.keys((await c.ler()).respostas).length, 0);
    const descer = c.raiz.querySelectorAll('button').find(b => b.attrs['aria-label'] === 'Descer A');
    await descer.disparar('click'); await aguardarFila();
    assert.deepEqual((await c.ler()).respostas.p1, ['B', 'A']);
    for (const [id, valor] of [['p2-i1', '40'], ['p2-i2', '60'], ['p3-min', '15']]) { const campo = c.raiz.querySelector('#' + id); campo.value = valor; await campo.disparar('input'); }
    await aguardarFila(); await c.raiz.querySelectorAll('[data-entrega]')[0].disparar('click');
    assert.equal(c.entregas.length, 0);
    const max = c.raiz.querySelector('#p3-max'); max.value = '30'; await max.disparar('input'); await aguardarFila();
    assert.deepEqual((await c.ler()).respostas.p3, { min: 15, max: 30 });
    await c.raiz.querySelectorAll('[data-entrega]')[0].disparar('click');
    assert.equal(c.entregas.length, 1); assert.ok(!c.entregas[0].texto.includes('[object Object]'));
  } finally { c.banco.fechar(); }
});
test('confirmar a ordem inicial persiste a escolha e dá retorno visível, com nova confirmação após mover', async () => {
  const c = await painelTeste([{ texto: 'Prioridades', tipo: 'ordenacao', opcoes: ['Clareza', 'Qualidade'] }]);
  try {
    const confirmar = c.raiz.querySelector('[data-confirmar-ordem]');
    assert.deepEqual((await c.ler()).respostas, {});
    await confirmar.disparar('click'); await aguardarFila();
    assert.deepEqual((await c.ler()).respostas.p1, ['Clareza', 'Qualidade']);
    assert.equal(confirmar.textContent, 'Ordem confirmada'); assert.equal(confirmar.disabled, true);
    assert.match(c.raiz.querySelector('[data-progresso]').textContent, /^1 de 1/);
    const descer = c.raiz.querySelectorAll('button').find(b => b.attrs['aria-label'] === 'Descer Clareza');
    await descer.disparar('click'); await aguardarFila();
    assert.equal(confirmar.disabled, false); assert.equal(confirmar.textContent, 'Confirmar esta ordem');
    assert.deepEqual((await c.ler()).respostas.p1, ['Qualidade', 'Clareza']);
    await confirmar.disparar('click'); await aguardarFila();
    assert.equal(confirmar.textContent, 'Ordem confirmada');
  } finally { c.banco.fechar(); }
});

test('pontos restringem saldo por critério e recusam excesso, frações e negativos durante a edição', async () => {
  const c = await painelTeste([{ texto: 'Pesos', tipo: 'pontos', itens: ['Clareza', 'Qualidade', 'Velocidade'], total: 100 }]);
  try {
    const primeiro = c.raiz.querySelector('#p1-i1'), segundo = c.raiz.querySelector('#p1-i2'), terceiro = c.raiz.querySelector('#p1-i3');
    assert.deepEqual((await c.ler()).respostas, {});
    primeiro.value = '60'; await primeiro.disparar('input'); await aguardarFila();
    assert.equal(segundo.attrs.max, '40'); assert.equal(terceiro.attrs.max, '40');
    segundo.value = '50'; await segundo.disparar('input'); await aguardarFila();
    assert.equal(segundo.value, '0'); assert.deepEqual((await c.ler()).respostas.p1, { i1: 60 });
    assert.equal(c.raiz.querySelector('[data-aviso-pontos]').hidden, false);
    assert.match(c.raiz.querySelector('[data-aviso-pontos]').textContent, /40 pontos disponíveis/);
    segundo.value = '40'; await segundo.disparar('input'); await aguardarFila();
    assert.equal(terceiro.attrs.max, '0'); assert.equal(c.raiz.querySelector('[data-aviso-pontos]').hidden, true);
    for (const valor of ['-1', '0.5', '1']) { terceiro.value = valor; await terceiro.disparar('input'); await aguardarFila(); assert.equal(terceiro.value, '0'); }
    assert.deepEqual((await c.ler()).respostas.p1, { i1: 60, i2: 40 });
    primeiro.value = '50'; await primeiro.disparar('input'); await aguardarFila();
    assert.equal(terceiro.attrs.max, '10');
    terceiro.value = '10'; await terceiro.disparar('input'); await aguardarFila();
    assert.deepEqual((await c.ler()).respostas.p1, { i1: 50, i2: 40, i3: 10 });
    await c.raiz.querySelectorAll('[data-entrega]')[0].disparar('click');
    assert.equal(c.entregas.length, 1); assert.match(c.entregas[0].texto, /Velocidade: 10 pontos/);
  } finally { c.banco.fechar(); }
});

test('rascunho antigo com excesso de pontos conserva valores e permite reduções graduais', async () => {
  const { montarControleFormato } = await import('../src/controles-formatos.mjs');
  const raiz = criarDomTeste(), respostas = [];
  const pergunta = formulario([{ texto: 'Pesos', tipo: 'pontos', itens: ['A', 'B'] }]).perguntas[0];
  const controle = montarControleFormato({ pergunta, resposta: { i1: 80, i2: 60 }, alterar: valor => respostas.push(valor), podeEditar: () => true });
  raiz.querySelector('form').append(controle);
  const campo = raiz.querySelector('#p1-i1');
  assert.equal(campo.value, 80); assert.equal(campo.attrs.max, '40');
  assert.match(raiz.querySelector('[data-aviso-pontos]').textContent, /rascunho ultrapassa/);
  campo.value = '70'; await campo.disparar('input');
  assert.deepEqual(respostas.at(-1), { i1: 70, i2: 60 });
  campo.value = '75'; await campo.disparar('input'); assert.equal(campo.value, '70');
  campo.value = '40'; await campo.disparar('input');
  assert.deepEqual(respostas.at(-1), { i1: 40, i2: 60 });
  assert.equal(raiz.querySelector('[data-aviso-pontos]').hidden, true);
});

test('data e hora juntas preservam horário local, calendário e observação em uma resposta', () => {
  const f = formulario([{ texto: 'Quando?', tipo: 'data_hora' }]);
  assert.equal(f.formato, 3); assert.equal(f.perguntas.length, 1);
  assert.deepEqual(validarRascunho(f, {}).pendentes, ['p1']);
  for (const resposta of ['2026-02-30T20:27', '2026-10-15T24:00', '2026-10-15', '0000-01-01T00:00', '2026-10-15T20:27Z', '2026-10-15T20:27:10']) assert.throws(() => validarRascunho(f, { respostas: { p1: resposta } }), /Data/);
  for (const resposta of ['0001-01-01T00:00', '2024-02-29T23:59', '9999-12-31T23:59']) assert.deepEqual(validarRascunho(f, { respostas: { p1: resposta } }).pendentes, []);
  const e = montarEntrega(f, { respostas: { p1: '2026-10-15T20:27' }, observacoes: { p1: 'Horário escolhido' } });
  assert.match(e.texto, /15\/10\/2026 às 20:27/); assert.match(e.texto, /Horário escolhido/);
  assert.deepEqual(e.compacto.respostas, [['p1', '2026-10-15T20:27', 'Horário escolhido']]);
});

test('campo único de data e hora persiste a resposta e mantém uma observação comum', async () => {
  const c = await painelTeste([{ texto: 'Quando?', tipo: 'data_hora' }]);
  try {
    const campo = c.raiz.querySelector('#pd-resposta-p1'); assert.equal(campo.type, 'datetime-local');
    campo.value = '2026-10-15T20:27'; await campo.disparar('input');
    const observacao = c.raiz.querySelector('#pd-obs-p1'); observacao.value = 'Observação do compromisso'; await observacao.disparar('input'); await aguardarFila();
    const r = await c.ler(); assert.equal(r.respostas.p1, '2026-10-15T20:27'); assert.equal(r.observacoes.p1, 'Observação do compromisso');
    assert.match(c.raiz.querySelector('[data-progresso]').textContent, /^1 de 1/);
  } finally { c.banco.fechar(); }
});

test('lista adiciona, remove e mantém cada entrada separada', async () => {
  const c = await painelTeste([{ texto: 'Sugestões', tipo: 'lista', max_itens: 2 }]);
  try {
    const lista = c.raiz.querySelector('.pd-lista-livre');
    let campos = lista.querySelectorAll('textarea'); campos[0].value = 'Primeira'; await campos[0].disparar('input');
    const adicionar = c.raiz.querySelector('[data-adicionar-item]'); await adicionar.disparar('click');
    campos = lista.querySelectorAll('textarea'); campos[1].value = 'Segunda'; await campos[1].disparar('input'); await aguardarFila();
    assert.equal(adicionar.disabled, true); assert.deepEqual((await c.ler()).respostas.p1, ['Primeira', 'Segunda']);
    await lista.querySelectorAll('button')[0].disparar('click'); await aguardarFila();
    assert.deepEqual((await c.ler()).respostas.p1, ['Segunda']); assert.equal(adicionar.disabled, false);
  } finally { c.banco.fechar(); }
});
test('estrelas, emojis e barra preservam zero sem resposta automática', async () => {
  const c = await painelTeste([{ texto: 'Estrelas', tipo: 'nota', visual: 'estrelas' }, { texto: 'Emojis', tipo: 'nota', visual: 'emojis' }, { texto: 'Barra', tipo: 'escala', visual: 'barra' }]);
  try {
    assert.equal(Object.keys((await c.ler()).respostas).length, 0);
    await selecionar(c.raiz, 'p1', 4); await selecionar(c.raiz, 'p2', 5);
    assert.equal(c.raiz.querySelector('[data-valor-estrelas]').textContent, '4 de 5 estrelas');
    assert.equal(c.raiz.querySelectorAll('[data-estrela]').filter(icone => icone.dataset.preenchida === 'true').length, 4);
    const barra = c.raiz.querySelector('#pd-barra-p3'); await barra.disparar('click'); await aguardarFila();
    assert.deepEqual((await c.ler()).respostas, { p1: 4, p2: 5, p3: 0 });
  } finally { c.banco.fechar(); }
});
test('interface oculta, conserva e restaura respostas condicionais sem perder outros campos', async () => {
  const c = await painelTeste([{ texto: 'Detalhar?', tipo: 'sim_nao' }, { texto: 'Detalhe', se: { pergunta: 'p1', igual: 'Sim' } }, 'Sempre visível']);
  try {
    assert.equal(c.raiz.querySelector('#pd-resposta-p2'), undefined);
    const permanente = c.raiz.querySelector('#pd-resposta-p3'); permanente.value = 'Preservado'; await permanente.disparar('input'); permanente.focus();
    await selecionar(c.raiz, 'p1', 'Sim');
    assert.equal(c.raiz.querySelector('#pd-resposta-p3'), permanente);
    const detalhe = c.raiz.querySelector('#pd-resposta-p2'); detalhe.value = 'Detalhe guardado'; await detalhe.disparar('input'); await aguardarFila();
    await selecionar(c.raiz, 'p1', 'Não'); assert.equal(c.raiz.querySelector('#pd-resposta-p2'), undefined);
    assert.equal((await c.ler()).respostas.p2, 'Detalhe guardado');
    await selecionar(c.raiz, 'p1', 'Sim'); assert.equal(c.raiz.querySelector('#pd-resposta-p2').value, 'Detalhe guardado');
  } finally { c.banco.fechar(); }
});

test('estrelas preservam zero e mínimo personalizado sem selecionar valores indisponíveis', async () => {
  const c = await painelTeste([{ texto: 'Zero permitido', tipo: 'nota', visual: 'estrelas', min: 0, max: 5 }, { texto: 'Mínimo dois', tipo: 'nota', visual: 'estrelas', min: 2, max: 5 }]);
  try {
    await selecionar(c.raiz, 'p1', 0);
    assert.equal((await c.ler()).respostas.p1, 0);
    const segunda = c.raiz.querySelector('[data-id="p2"]');
    const primeiraEstrela = segunda.querySelectorAll('input').find(campo => campo.attrs.value === '1');
    assert.equal(primeiraEstrela.disabled, true); primeiraEstrela.checked = true; await primeiraEstrela.disparar('change'); await aguardarFila();
    assert.equal((await c.ler()).respostas.p2, undefined);
    await selecionar(c.raiz, 'p2', 4);
    assert.equal((await c.ler()).respostas.p2, 4);
    assert.equal(segunda.querySelectorAll('[data-estrela]').filter(icone => icone.dataset.preenchida === 'true').length, 4);
  } finally { c.banco.fechar(); }
});
