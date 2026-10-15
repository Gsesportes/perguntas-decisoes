import test from 'node:test';
import assert from 'node:assert/strict';
import { criarServicoDitado } from '../src/ditado-desktop.mjs';
import { ajustarApresentacao } from '../src/exibicao.mjs';
import { montarInterface } from '../src/interface.mjs';
import { chamarFerramenta } from '../src/servidor.mjs';
import { bancoLocal } from '../scripts/banco-local.mjs';
import { criarDomTeste, aguardarFila, promessaControlada } from './apoio-dom.mjs';

async function destinoFicticio() {
  const banco = bancoLocal(), dono = 'perfil-ciclo-ficticio';
  const criado = await chamarFerramenta('criar_formulario', { perguntas: ['Texto fictício'] }, dono, banco);
  return { banco, dono, destino: { id: criado.structuredContent.id, versao: 1, campo: 'resposta', pergunta: 'p1' } };
}

test('R1: preparo concluído depois de fechar não pode solicitar captura', async () => {
  const c = await destinoFicticio(), iniciouPreparo = promessaControlada(), motor = promessaControlada();
  let capturas = 0;
  const servico = criarServicoDitado({ ...c, prepararMotor: () => { iniciouPreparo.resolver(); return motor.promessa; }, capturarAudio: async () => { capturas += 1; return { pcm: null, erro: 'Captura fictícia sem dispositivo' }; } });
  try {
    const inicio = servico.controlar({ acao: 'iniciar', destino: c.destino }).then(valor => ({ valor }), erro => ({ erro }));
    await iniciouPreparo.promessa; servico.fechar(); motor.resolver({});
    const resultado = await inicio;
    assert.equal(capturas, 0); assert.match(resultado.erro?.message ?? '', /encerrado/);
  } finally { motor.resolver({}); servico.fechar(); c.banco.fechar(); }
});

test('R1: serviço já encerrado recusa início sem preparar motor nem capturar', async () => {
  const c = await destinoFicticio(); let preparos = 0, capturas = 0;
  const servico = criarServicoDitado({ ...c, prepararMotor: async () => { preparos += 1; return {}; }, capturarAudio: async () => { capturas += 1; return { pcm: null }; } });
  try {
    servico.fechar(); servico.fechar();
    await assert.rejects(servico.controlar({ acao: 'iniciar', destino: c.destino }), /encerrado/);
    assert.equal(preparos, 0); assert.equal(capturas, 0);
  } finally { servico.fechar(); c.banco.fechar(); }
});

test('R1: fechar durante a validação do destino impede até o preparo posterior', async () => {
  const c = await destinoFicticio(), iniciouLeitura = promessaControlada(), leitura = promessaControlada(); let preparos = 0, capturas = 0;
  const banco = { prepare(sql) { let consulta = c.banco.prepare(sql); return { bind(...args) { consulta = consulta.bind(...args); return this; }, async first() { iniciouLeitura.resolver(); await leitura.promessa; return consulta.first(); } }; } };
  const servico = criarServicoDitado({ banco, dono: c.dono, prepararMotor: async () => { preparos += 1; return {}; }, capturarAudio: async () => { capturas += 1; return { pcm: null }; } });
  try {
    const inicio = servico.controlar({ acao: 'iniciar', destino: c.destino }).then(valor => ({ valor }), erro => ({ erro }));
    await iniciouLeitura.promessa; servico.fechar(); leitura.resolver();
    const resultado = await inicio;
    assert.equal(preparos, 0); assert.equal(capturas, 0); assert.match(resultado.erro?.message ?? '', /encerrado/);
  } finally { leitura.resolver(); servico.fechar(); c.banco.fechar(); }
});

test('R1: serviço aberto continua solicitando uma captura com as dependências controladas', async () => {
  const c = await destinoFicticio(); let capturas = 0;
  const servico = criarServicoDitado({ ...c, prepararMotor: async () => ({}), capturarAudio: async () => { capturas += 1; return { pcm: null, erro: 'Captura fictícia sem dispositivo' }; } });
  try {
    const inicio = await servico.controlar({ acao: 'iniciar', destino: c.destino });
    assert.ok(inicio.sessao); assert.equal(capturas, 1);
  } finally { servico.fechar(); c.banco.fechar(); }
});

async function paginasCondicionais(substituicoes = {}) {
  const banco = bancoLocal(), dono = 'perfil-paginas-ficticio';
  const criado = await chamarFerramenta('criar_formulario', { perguntas: [
    { texto: 'Mostrar perguntas extras?', tipo: 'sim_nao' },
    ...Array.from({ length: 6 }, (_, i) => ({ texto: `Extra ${i + 1}`, tipo: 'texto', se: { pergunta: 'p1', igual: 'Sim' } })),
    { texto: 'Texto independente', tipo: 'texto' }
  ] }, dono, banco);
  const id = criado.structuredContent.id;
  const chamar = (nome, entrada) => chamarFerramenta(nome, entrada, dono, banco);
  const ler = () => chamar('ler_formulario', { id });
  const salvar = async (identificador, versao, rascunho) => (await chamar('salvar_rascunho', { id: identificador, versao, rascunho }))._meta.versao;
  await salvar(id, 1, { respostas: { p1: 'Sim', ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`p${i + 2}`, `Texto ${i + 1}`])), p8: 'Antes' }, observacoes: { p7: 'Observação que ficará oculta', p8: 'Observação independente' }, gerais: 'Geral inicial', pagina: 1, itens_por_pagina: 6 });
  const raiz = criarDomTeste();
  montarInterface(raiz, { origem: 'Teste isolado da revisão', conexao: 'Sem aplicativo nativo', capacidades: () => ({}), ler: () => ler(), salvar, ...substituicoes }).carregar(await ler());
  async function ocultarRemotamente(conflito = false, alterarGerais = true) {
    const atual = await ler(), rascunho = structuredClone(atual._meta.rascunho);
    rascunho.respostas.p1 = 'Não'; rascunho.pagina = 0;
    if (alterarGerais) rascunho.gerais = 'Geral remoto';
    if (conflito) rascunho.respostas.p8 = 'Resposta remota';
    await salvar(id, atual._meta.versao, rascunho);
  }
  return { banco, raiz, ler, ocultarRemotamente };
}

for (const explicito of [false, true]) test('R2: redução remota de páginas conserva texto no ' + (explicito ? 'Guardar meu preenchimento' : 'salvamento automático'), async () => {
  const c = await paginasCondicionais();
  try {
    assert.equal(c.raiz.querySelector('[data-pagina]').textContent, 'Página 2 de 2');
    await c.ocultarRemotamente(explicito);
    const campo = c.raiz.querySelector('[name="p8"]'); campo.value = 'Nova resposta local'; await campo.disparar('input'); await aguardarFila();
    if (explicito) {
      assert.match(c.raiz.querySelector('[data-erro]').textContent, /alterada de formas diferentes/);
      await c.raiz.querySelector('[data-recuperacao]').children.find(item => item.textContent === 'Guardar meu preenchimento').disparar('click');
    }
    const salvo = (await c.ler())._meta.rascunho;
    assert.equal(salvo.respostas.p1, 'Não'); assert.equal(salvo.respostas.p8, 'Nova resposta local'); assert.equal(salvo.pagina, 0);
    assert.equal(salvo.respostas.p7, 'Texto 6'); assert.equal(salvo.observacoes.p7, 'Observação que ficará oculta'); assert.equal(salvo.gerais, 'Geral remoto');
    assert.equal(c.raiz.querySelector('[data-pagina]').textContent, 'Página 1 de 1'); assert.equal(c.raiz.querySelector('[name="p8"]').value, 'Nova resposta local');
    assert.equal(c.raiz.querySelector('[name="p7"]'), undefined); assert.equal(c.raiz.querySelector('[data-erro]').hidden, true);
    const novoCampo = c.raiz.querySelector('[name="p8"]'); novoCampo.value = 'Edição seguinte'; await novoCampo.disparar('input'); await aguardarFila();
    assert.equal((await c.ler())._meta.rascunho.respostas.p8, 'Edição seguinte');
  } finally { c.banco.fechar(); }
});

test('R2: posição interna continua válida com redesenho adiado durante ditado', async () => {
  const retorno = promessaControlada();
  const c = await paginasCondicionais({ ditado: async entrada => entrada.acao === 'iniciar' ? { sessao: 'voz-ficticia', estado: 'gravando' } : entrada.acao === 'consultar' ? retorno.promessa : { estado: 'concluido' } });
  try {
    const campo = c.raiz.querySelector('[name="p8"]');
    const mic = c.raiz.querySelectorAll('[data-ditado]').find(item => item.attrs['aria-label'] === 'Ditar resposta da pergunta 8');
    const gravacao = mic.disparar('click'); await aguardarFila();
    await c.ocultarRemotamente(false, false);
    const gerais = c.raiz.querySelector('#pd-observacoes-gerais'); gerais.value = 'Geral local durante ditado'; await gerais.disparar('input'); await aguardarFila();
    const obs = c.raiz.querySelector('#pd-obs-p8'); obs.value = 'Outra edição durante ditado'; await obs.disparar('input'); await aguardarFila();
    assert.equal(campo.isConnected, true);
    retorno.resolver({ estado: 'concluido', texto: 'Texto reconhecido fictício' }); await gravacao; await aguardarFila();
    const salvo = (await c.ler())._meta.rascunho;
    assert.equal(salvo.respostas.p8, 'Antes Texto reconhecido fictício'); assert.equal(salvo.observacoes.p8, 'Outra edição durante ditado'); assert.equal(salvo.gerais, 'Geral local durante ditado'); assert.equal(salvo.pagina, 0);
    assert.equal(c.raiz.querySelector('[data-pagina]').textContent, 'Página 1 de 1'); assert.equal(c.raiz.querySelector('[data-erro]').hidden, true);
  } finally { retorno.resolver({ estado: 'cancelado' }); c.banco.fechar(); }
});

for (const [apresentacao, inicial, esperado] of [['chat', 'fullscreen', 'inline'], ['lateral', 'inline', 'fullscreen']]) {
  test('R3: confirmação de ' + esperado + ' no contexto prevalece sobre resposta perdida', async () => {
    let contexto = { displayMode: inicial, availableDisplayModes: ['inline', 'fullscreen'] }, pedidos = 0;
    const aplicativo = { getHostContext: () => contexto, requestDisplayMode: async () => { pedidos += 1; contexto = { ...contexto, displayMode: esperado }; throw new Error('Resposta de exibição perdida'); } };
    assert.equal(await ajustarApresentacao(aplicativo, apresentacao), esperado); assert.equal(pedidos, 1);
  });
  test('R3: contexto confirmado de ' + esperado + ' prevalece sobre resposta anterior ao evento', async () => {
    let contexto = { displayMode: inicial, availableDisplayModes: ['inline', 'fullscreen'] }, pedidos = 0;
    const aplicativo = { getHostContext: () => contexto, requestDisplayMode: async () => { pedidos += 1; contexto = { ...contexto, displayMode: esperado }; return { mode: inicial }; } };
    assert.equal(await ajustarApresentacao(aplicativo, apresentacao), esperado); assert.equal(pedidos, 1);
  });
}
