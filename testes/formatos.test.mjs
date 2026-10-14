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
    const legados = await banco.prepare('SELECT id FROM formularios WHERE dono=?').bind(dono).all();
    assert.deepEqual(legados.results.map(r => r.id), [antigo.structuredContent.id]);
    assert.equal((await chamarFerramenta('listar_pendentes', {}, dono, banco))._meta.pendentes.length, 2);
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
