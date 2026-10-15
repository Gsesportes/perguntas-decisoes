import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { availableParallelism } from 'node:os';
import { Repositorio } from './repositorio.mjs';

export const FERRAMENTA_DITADO = { name: 'controlar_ditado', description: 'Operação privada de ditado local vinculada a um campo.', inputSchema: { type: 'object', properties: { acao: { enum: ['iniciar', 'consultar', 'parar', 'cancelar', 'descartar'] }, sessao: { type: 'string' }, destino: { type: 'object' } }, required: ['acao'], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, _meta: { ui: { visibility: ['app'] } } };
export function validarDestino(destino) {
  if (!destino || typeof destino !== 'object' || Array.isArray(destino) || Object.keys(destino).some(chave => !['id', 'versao', 'campo', 'pergunta'].includes(chave))) throw new Error('Destino do ditado inválido.');
  if (typeof destino.id !== 'string' || !destino.id || !Number.isInteger(destino.versao) || !['resposta', 'observacao', 'gerais'].includes(destino.campo)) throw new Error('Formulário, versão e campo são obrigatórios.');
  if (destino.id.length > 100 || (destino.pergunta && (typeof destino.pergunta !== 'string' || destino.pergunta.length > 100))) throw new Error('Destino excede o limite.');
  if (destino.campo !== 'gerais' && (typeof destino.pergunta !== 'string' || !destino.pergunta)) throw new Error('Pergunta do ditado obrigatória.');
}
export function validarRegistroDestino(registro, destino, original) {
  if (registro.entrega || (original === undefined && registro.versao !== destino.versao)) throw new Error('O formulário mudou ou está em entrega. O campo foi preservado; o ditado não foi aplicado.');
  if (destino.campo !== 'gerais') {
    const pergunta = registro.formulario.perguntas.find(item => item.id === destino.pergunta);
    if (!pergunta || (destino.campo === 'resposta' && pergunta.tipo !== 'texto')) throw new Error('Ditado indisponível para esse campo.');
  }
  const texto = destino.campo === 'gerais' ? registro.rascunho.gerais ?? '' : (destino.campo === 'resposta' ? registro.rascunho.respostas : registro.rascunho.observacoes)[destino.pergunta] ?? '';
  if (original !== undefined && texto !== original) throw new Error('O campo de destino mudou em outra janela. O texto existente foi preservado; o ditado não foi aplicado.');
  return texto;
}
export function empacotarWav(pcm) {
  if (!Buffer.isBuffer(pcm) || !pcm.length || pcm.length % 2 || pcm.length > 1952000) throw new Error('Áudio PCM inválido.');
  const cabecalho = Buffer.alloc(44);
  cabecalho.write('RIFF'); cabecalho.writeUInt32LE(36 + pcm.length, 4); cabecalho.write('WAVE', 8);
  cabecalho.write('fmt ', 12); cabecalho.writeUInt32LE(16, 16); cabecalho.writeUInt16LE(1, 20); cabecalho.writeUInt16LE(1, 22);
  cabecalho.writeUInt32LE(16000, 24); cabecalho.writeUInt32LE(32000, 28); cabecalho.writeUInt16LE(2, 32); cabecalho.writeUInt16LE(16, 34);
  cabecalho.write('data', 36); cabecalho.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([cabecalho, pcm]);
}
async function resumo(arquivo) {
  const hash = createHash('sha256');
  for await (const bloco of createReadStream(arquivo)) hash.update(bloco);
  return hash.digest('hex');
}
async function obterMotor() {
  const base = process.env.PERGUNTAS_DIRETORIO_VOZ ?? (process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'PerguntasDecisoes', 'voz'));
  if (!base) throw new Error('Diretório local de voz não encontrado.');
  let manifesto;
  try { manifesto = JSON.parse(await readFile(join(base, 'motor.json'), 'utf8')); }
  catch (erro) { throw new Error('Ditado local ainda não está preparado. Execute preparar-ditado.mjs. ' + erro.message); }
  const caminho = nome => {
    if (typeof nome !== 'string' || isAbsolute(nome)) throw new Error('Caminho de voz inválido.');
    const absoluto = resolve(base, nome);
    if (relative(resolve(base), absoluto).startsWith('..')) throw new Error('Caminho de voz fora do diretório próprio.');
    return absoluto;
  };
  const executavel = caminho(manifesto.executavel), modelo = caminho(manifesto.modelo);
  if (manifesto.versao !== '1.9.2' || manifesto.sha256_modelo !== '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe') throw new Error('Modelo de ditado não reconhecido.');
  if (await resumo(modelo) !== manifesto.sha256_modelo || await resumo(executavel) !== manifesto.sha256_executavel) throw new Error('Integridade do motor ou modelo não confirmada.');
  await stat(executavel);
  return { executavel, modelo };
}
function capturar(sessao, executavel, duracao = 60000) {
  const filho = spawn(executavel, [String(duracao)], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  sessao.capturador = filho;
  let texto = '', resultado, falha, diagnostico = '';
  let limite = setTimeout(() => { falha = 'O microfone não iniciou no prazo.'; filho.kill(); }, 30000);
  filho.stdout.setEncoding('utf8');
  return new Promise(resolver => {
    filho.on('error', erro => { falha = erro.message; });
    filho.stdin.on('error', erro => { if (!sessao.cancelado) falha = 'Canal de captura interrompido: ' + erro.message; });
    filho.stderr.on('data', bloco => { diagnostico = (diagnostico + bloco.toString()).slice(-2000); });
    filho.stdout.on('data', bloco => {
      texto += bloco;
      if (Buffer.byteLength(texto) > 3000000) { falha = 'Resposta do gravador excedeu o limite.'; filho.kill(); return; }
      let fim;
      while ((fim = texto.indexOf('\n')) >= 0) {
        const linha = texto.slice(0, fim).trim(); texto = texto.slice(fim + 1);
        if (!linha) continue;
        try {
          const mensagem = JSON.parse(linha);
          if (mensagem.evento === 'gravando') {
            sessao.estado = 'gravando';
            clearTimeout(limite); limite = setTimeout(() => { falha = 'Captura excedeu sessenta segundos.'; filho.kill(); }, duracao + 7000);
          } else if (mensagem.evento === 'concluido') resultado = mensagem.resultado;
          else throw new Error('Evento desconhecido.');
        } catch (erro) { falha = 'Resposta de captura inválida: ' + erro.message; filho.kill(); }
      }
    });
    filho.on('close', codigo => {
      clearTimeout(limite); clearTimeout(sessao.limiteParada);
      sessao.capturador = null;
      if (texto.trim()) falha ??= 'Resultado de captura incompleto.';
      if (codigo !== 0 && !(codigo === 2 && sessao.cancelado)) falha ??= resultado?.erro ?? (diagnostico || 'Captura não confirmada.');
      if (!resultado?.dispositivo_fechado && !sessao.cancelado) falha ??= 'O microfone não confirmou a liberação.';
      const pcm = resultado?.audio_base64 ? Buffer.from(resultado.audio_base64, 'base64') : null;
      if (resultado) delete resultado.audio_base64;
      resolver({ pcm, metricas: resultado, erro: falha });
    });
  });
}
export function argumentosReconhecimento({ modelo, tarefas = availableParallelism() }) {
  // A entrada '-' também vira o nome de saída padrão no whisper.cpp 1.9.2.
  // No Windows isso seleciona CON e desativa o retorno pelo pipe. Um prefixo
  // explícito mantém o retorno normal; sem -otxt/-oj nenhum arquivo é criado.
  const paralelismo = Math.max(1, Math.min(4, Math.floor(tarefas) || 1));
  return ['-m', modelo, '-l', 'pt', '-f', '-', '-nt', '-np', '-ng', '-t', String(paralelismo), '-sns', '-of', 'ditado-local'];
}
function reconhecer(sessao, motor, wav) {
  const filho = spawn(motor.executavel, argumentosReconhecimento(motor), { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  sessao.transcritor = filho;
  let texto = '', diagnostico = '', falha;
  const limite = setTimeout(() => { falha = 'A transcrição excedeu dois minutos.'; filho.kill(); }, 120000);
  filho.stdout.setEncoding('utf8');
  return new Promise((resolver, rejeitar) => {
    filho.on('error', erro => { falha = erro.message; });
    filho.stdout.on('data', bloco => { texto += bloco; if (Buffer.byteLength(texto) > 64000) { falha = 'Texto reconhecido excedeu o limite.'; filho.kill(); } });
    filho.stderr.on('data', bloco => { diagnostico = (diagnostico + bloco.toString()).slice(-3000); });
    filho.stdin.on('error', erro => { if (!sessao.cancelado) falha = 'Áudio não recebido pelo motor: ' + erro.message; });
    filho.stdin.end(wav, () => wav.fill(0));
    filho.on('close', codigo => {
      clearTimeout(limite); wav.fill(0); sessao.transcritor = null;
      if (sessao.cancelado) { rejeitar(new Error('Ditado cancelado.')); return; }
      if (falha || codigo !== 0) { rejeitar(new Error(falha ?? 'Transcrição não confirmada: ' + diagnostico)); return; }
      const limpo = texto.trim();
      if (!limpo) { rejeitar(new Error('O motor terminou sem devolver texto. O campo foi preservado.')); return; }
      if (/^\[(?:BLANK_AUDIO|silence)\]$/i.test(limpo)) { rejeitar(new Error('Nenhuma fala foi reconhecida. O campo foi preservado.')); return; }
      resolver(limpo);
    });
  });
}
export function criarServicoDitado({ banco, dono, executavel = fileURLToPath(new URL('../native/CapturaMicrofone.exe', import.meta.url)), prepararMotor = obterMotor, capturarAudio = capturar }) {
  const repositorio = new Repositorio(banco);
  const sessoes = new Map();
  let motorPreparado;
  let encerrado = false;
  function conferirServicoAberto() {
    if (encerrado) throw new Error('O serviço de ditado foi encerrado.');
  }
  async function conferirDestino(destino, original) {
    validarDestino(destino);
    const registro = await repositorio.ler(dono, destino.id);
    return validarRegistroDestino(registro, destino, original);
  }
  function parar(sessao, cancelar) {
    if (cancelar) sessao.cancelado = true;
    if (sessao.capturador && !sessao.capturador.stdin.destroyed) {
      sessao.capturador.stdin.write(cancelar ? 'cancelar\n' : 'parar\n');
      clearTimeout(sessao.limiteParada);
      sessao.limiteParada = setTimeout(() => sessao.capturador?.kill(), 3000);
    }
    if (cancelar) sessao.transcritor?.kill();
  }
  async function executar(sessao, motor) {
    let pcm;
    try {
      const captura = await capturarAudio(sessao, executavel);
      pcm = captura.pcm; sessao.metricas = captura.metricas;
      if (sessao.cancelado) return;
      if (captura.erro) throw new Error(captura.erro);
      if (!pcm || !captura.metricas?.sinal_detectado || captura.metricas.rms < 0.00015) throw new Error('Nenhum som suficiente foi detectado. O campo foi preservado.');
      sessao.estado = 'transcrevendo';
      const inicioTranscricao = Date.now();
      const wav = empacotarWav(pcm); pcm.fill(0); pcm = null;
      const texto = await reconhecer(sessao, motor, wav);
      sessao.metricas.transcricao_ms = Date.now() - inicioTranscricao;
      if (!sessao.cancelado) { await conferirDestino(sessao.destino, sessao.original); sessao.texto = texto; }
    } catch (erro) { if (!sessao.cancelado) sessao.erro = erro.message; }
    finally {
      pcm?.fill(0); clearTimeout(sessao.limiteParada);
      sessao.estado = sessao.cancelado ? 'cancelado' : 'concluido';
      sessao.fim = Date.now();
    }
  }
  const limpeza = globalThis.setInterval(() => {
    for (const [id, sessao] of sessoes) {
      if (!sessao.fim && Date.now() - sessao.contato > 15000) parar(sessao, true);
      if (sessao.fim && Date.now() - sessao.fim > 60000) sessoes.delete(id);
    }
  }, 2000);
  limpeza.unref();
  return {
    async controlar(entrada) {
      conferirServicoAberto();
      if (Buffer.byteLength(JSON.stringify(entrada)) > 4096) throw new Error('Operação de ditado excede o limite.');
      if (!entrada || Object.keys(entrada).some(chave => !['acao', 'sessao', 'destino'].includes(chave))) throw new Error('Operação de ditado inválida.');
      if (entrada.acao === 'iniciar') {
        if (entrada.sessao) throw new Error('Início não aceita sessão externa.');
        const original = await conferirDestino(entrada.destino);
        conferirServicoAberto();
        if ([...sessoes.values()].some(item => !item.fim)) throw new Error('Já existe um ditado ativo.');
        motorPreparado ??= prepararMotor().catch(erro => { motorPreparado = null; throw erro; });
        const motor = await motorPreparado;
        conferirServicoAberto();
        if ([...sessoes.values()].some(item => !item.fim)) throw new Error('Já existe um ditado ativo.');
        const id = crypto.randomUUID();
        const sessao = { destino: structuredClone(entrada.destino), original, estado: 'iniciando', contato: Date.now(), cancelado: false };
        sessoes.set(id, sessao);
        void executar(sessao, motor);
        return { sessao: id, estado: sessao.estado, limite_segundos: 60 };
      }
      if (!['consultar', 'parar', 'cancelar', 'descartar'].includes(entrada.acao) || entrada.destino || typeof entrada.sessao !== 'string') throw new Error('Operação ou sessão de ditado inválida.');
      const sessao = sessoes.get(entrada.sessao);
      if (!sessao) throw new Error('Ditado desconhecido ou expirado.');
      sessao.contato = Date.now();
      if (entrada.acao === 'parar') parar(sessao, false);
      if (entrada.acao === 'cancelar') parar(sessao, true);
      const resultado = { estado: sessao.estado, ...(sessao.texto && !sessao.cancelado ? { texto: sessao.texto } : {}), ...(sessao.erro ? { erro: sessao.erro } : {}), ...(sessao.metricas ? { metricas: sessao.metricas } : {}) };
      if (entrada.acao === 'descartar') {
        if (!sessao.fim) throw new Error('Ditado ainda ativo.');
        sessoes.delete(entrada.sessao);
      }
      return resultado;
    },
    fechar() {
      if (encerrado) return;
      encerrado = true;
      globalThis.clearInterval(limpeza);
      for (const sessao of sessoes.values()) parar(sessao, true);
    }
  };
}

