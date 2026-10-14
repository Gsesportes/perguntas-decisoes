import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';

const diretorio = process.env.PERGUNTAS_DIRETORIO_VOZ ?? (process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'PerguntasDecisoes', 'voz'));
if (!diretorio) throw new Error('Diretório local do perfil não encontrado.');
await mkdir(diretorio, { recursive: true });
const motor = { url: 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip', nome: 'whisper-v1.9.2.zip', sha256: '49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a' };
const modelo = { url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin', nome: 'ggml-base.bin', sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe' };
async function hash(arquivo) {
  const resumo = createHash('sha256');
  for await (const bloco of createReadStream(arquivo)) resumo.update(bloco);
  return resumo.digest('hex');
}
async function obter(item) {
  const destino = join(diretorio, item.nome);
  try {
    if (await hash(destino) !== item.sha256) throw new Error('Arquivo existente tem hash diferente: ' + item.nome);
    console.log('Já verificado: ' + item.nome);
    return destino;
  } catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
  console.log('Baixando e verificando: ' + item.nome);
  const temporario = destino + '.' + randomUUID() + '.parcial';
  try {
    const resposta = await globalThis.fetch(item.url, { signal: globalThis.AbortSignal.timeout(600000) });
    if (!resposta.ok || !resposta.body) throw new Error('Download recusado: HTTP ' + resposta.status);
    await pipeline(Readable.fromWeb(resposta.body), createWriteStream(temporario, { flags: 'wx' }));
    if (await hash(temporario) !== item.sha256) throw new Error('Integridade não confirmada: ' + item.nome);
    await rename(temporario, destino);
    return destino;
  } catch (erro) {
    try { await unlink(temporario); } catch (falha) { if (falha.code !== 'ENOENT') console.error('Não foi possível limpar o download parcial:', falha.message); }
    throw erro;
  }
}
const zip = await obter(motor);
const caminhoModelo = await obter(modelo);
const pastaMotor = join(diretorio, 'whisper-v1.9.2');
await mkdir(pastaMotor, { recursive: true });
if (!(await readdir(pastaMotor)).length) {
  await new Promise((resolver, rejeitar) => {
    const filho = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:PERGUNTAS_ZIP -DestinationPath $env:PERGUNTAS_MOTOR -ErrorAction Stop'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, PERGUNTAS_ZIP: zip, PERGUNTAS_MOTOR: pastaMotor } });
    let erro = '';
    filho.stderr.on('data', bloco => { erro += bloco.toString(); });
    filho.on('error', rejeitar);
    filho.on('close', codigo => codigo === 0 ? resolver() : rejeitar(new Error('Extração não confirmada: ' + erro)));
  });
}
const arquivos = await readdir(pastaMotor, { recursive: true });
const executaveis = arquivos.filter(nome => nome.endsWith('whisper-cli.exe'));
if (executaveis.length !== 1) throw new Error('Executável único do motor não encontrado.');
const caminhoExecutavel = join(pastaMotor, executaveis[0]);
const manifesto = { versao: '1.9.2', executavel: relative(diretorio, caminhoExecutavel), modelo: relative(diretorio, caminhoModelo), sha256_modelo: modelo.sha256, sha256_zip_motor: motor.sha256, sha256_executavel: await hash(caminhoExecutavel), idioma: 'pt', processamento: 'local' };
await writeFile(join(diretorio, 'motor.json'), JSON.stringify(manifesto, null, 2) + '\n');
const licenca = await globalThis.fetch('https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.2/LICENSE', { signal: globalThis.AbortSignal.timeout(30000) });
if (!licenca.ok) throw new Error('Não foi possível obter a atribuição do motor.');
await writeFile(join(diretorio, 'LICENSE-whisper.cpp.txt'), await licenca.text());
const licencaModelo = await globalThis.fetch('https://raw.githubusercontent.com/openai/whisper/main/LICENSE', { signal: globalThis.AbortSignal.timeout(30000) });
if (!licencaModelo.ok) throw new Error('Não foi possível obter a atribuição do modelo.');
await writeFile(join(diretorio, 'LICENSE-modelo-Whisper.txt'), await licencaModelo.text());
await readFile(caminhoExecutavel);
console.log(JSON.stringify({ preparado: true, versao: manifesto.versao, modelo: 'base multilíngue', hashes_conferidos: true, audio_capturado: false }));

