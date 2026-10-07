import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { userInfo } from 'node:os';

export function abrirArmazenamentoDesktop(opcoes = {}) {
  const base = opcoes.diretorio ?? (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'PerguntasDecisoes') : null);
  if (!base) throw new Error('A pasta local do perfil Windows não foi encontrada. Nenhum banco foi aberto.');
  const diretorio = resolve(base);
  mkdirSync(diretorio, { recursive: true, mode: 0o700 });
  const caminho = join(diretorio, 'rascunhos.sqlite');
  const banco = new DatabaseSync(caminho);
  banco.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const versao = banco.prepare('PRAGMA user_version').get().user_version;
  if (versao > 1) { banco.close(); throw new Error('O banco foi criado por uma versão mais nova. Os rascunhos foram preservados.'); }
  try {
    if (versao === 0) {
      const existe = banco.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='formularios'").get();
      banco.exec('BEGIN IMMEDIATE');
      if (!existe) banco.exec(readFileSync(new URL('../migracoes/0001_rascunhos.sql', import.meta.url), 'utf8'));
      banco.exec('PRAGMA user_version=1; COMMIT;');
    }
  } catch (erro) {
    if (banco.isTransaction) banco.exec('ROLLBACK');
    banco.close();
    throw new Error(`Não foi possível preparar o armazenamento local. ${erro.message}`);
  }
  const DB = {
    prepare(sql) {
      return { bind(...valores) {
        const consulta = banco.prepare(sql);
        return {
          async first() { return consulta.get(...valores) ?? null; },
          async all() { return { results: consulta.all(...valores) }; },
          async run() { const resultado = consulta.run(...valores); return { meta: { changes: Number(resultado.changes) } }; }
        };
      } };
    }
  };
  let fechado = false;
  return { DB, dono: `windows:${userInfo().username}`, caminho, fechar() { if (!fechado) { banco.close(); fechado = true; } } };
}
