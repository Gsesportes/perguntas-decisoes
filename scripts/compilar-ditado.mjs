import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const origem = new URL('../native/', import.meta.url);
if (!process.env.WINDIR) throw new Error('A compilação do microfone requer Windows.');
const executavel = fileURLToPath(new URL('CapturaMicrofone.exe', origem));
const argumentos = ['/nologo', '/utf8output', '/target:exe', '/platform:anycpu', '/out:' + executavel, '/r:System.Web.Extensions.dll', fileURLToPath(new URL('CapturaMicrofone.cs', origem))];
const compilador = join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const chave = hash(Buffer.concat([await readFile(new URL('CapturaMicrofone.cs', origem)), await readFile(compilador), Buffer.from(JSON.stringify(argumentos))]));
const registro = new URL('../.local/compilacao-microfone.json', import.meta.url);
let anterior;
try { anterior = JSON.parse(await readFile(registro, 'utf8')); }
catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
let bytesAnteriores;
try { bytesAnteriores = await readFile(executavel); }
catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
if (anterior?.chave === chave && bytesAnteriores && anterior.sha256 === hash(bytesAnteriores)) {
  console.log(JSON.stringify({ compilado: false, reutilizado: true, sha256: anterior.sha256, captura_executada: false }));
  process.exit(0);
}
const resultado = spawnSync(compilador, argumentos, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
if (resultado.error || resultado.status !== 0) throw new Error('Compilação do microfone não confirmada: ' + (resultado.error?.message ?? resultado.stdout + resultado.stderr));
const sha256 = hash(await readFile(executavel));
await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
await writeFile(registro, JSON.stringify({ chave, sha256 }));
console.log(JSON.stringify({ compilado: true, sha256, captura_executada: false }));
