import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function bancoLocal(caminho = ':memory:') {
  const banco = new DatabaseSync(caminho);
  const existe = banco.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='formularios'").get();
  if (!existe) banco.exec(readFileSync(new URL('../migracoes/0001_rascunhos.sql', import.meta.url), 'utf8'));
  return {
    fechar: () => banco.close(),
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
}
