import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { ErroFormulario } from './erros.mjs';
import { validarTamanhoChamada } from './formulario.mjs';

export const FERRAMENTA_COPIA = {
  name: 'copiar_respostas',
  inputSchema: { type: 'object', properties: { texto: { type: 'string', minLength: 1, maxLength: 2000000 } }, required: ['texto'], additionalProperties: false },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  _meta: { ui: { visibility: ['app'] } }
};

// Texto entra pelo pipe, nunca como parte do programa executado.
const PROGRAMA_COPIA = `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$textoPerguntas = [Console]::In.ReadToEnd()
Set-Clipboard -Value $textoPerguntas -ErrorAction Stop
$textoConferido = Get-Clipboard -Raw -ErrorAction Stop
if ($textoConferido -cne $textoPerguntas) { throw 'A área de transferência não confirmou o texto completo.' }
[Console]::Out.Write('{"copiado":true}')
`;

export async function copiarNoWindows(entrada, { executar = execFile, plataforma = process.platform } = {}) {
  validarTamanhoChamada('copiar_respostas', entrada);
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada) || Object.keys(entrada).some(chave => chave !== 'texto') || typeof entrada.texto !== 'string' || !entrada.texto || entrada.texto.includes('\0')) throw new ErroFormulario('Texto inválido para a área de transferência.');
  if (plataforma !== 'win32' || !process.env.SystemRoot) throw new ErroFormulario('A integração local de cópia requer Windows.');
  const executavel = join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  return new Promise((resolver, rejeitar) => {
    const filho = executar(executavel, ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-Command', PROGRAMA_COPIA], { windowsHide: true, timeout: 10000, maxBuffer: 8192, encoding: 'utf8' }, (erro, saida) => {
      if (erro) { rejeitar(new ErroFormulario('Não foi possível confirmar a cópia no Windows. Tente novamente; suas respostas continuam disponíveis.')); return; }
      try {
        const resultado = JSON.parse(saida);
        if (resultado.copiado !== true) throw new Error('Confirmação ausente.');
        resolver({ copiado: true });
      } catch { rejeitar(new ErroFormulario('O Windows não confirmou a cópia. Suas respostas continuam disponíveis.')); }
    });
    filho.stdin.on('error', () => rejeitar(new ErroFormulario('Não consegui enviar o texto à área de transferência.')));
    filho.stdin.end(entrada.texto, 'utf8');
  });
}
