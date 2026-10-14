import { ErroFormulario } from './formulario.mjs';

function registro(linha) {
  const resultado = { id: linha.id, versao: linha.versao, formulario: JSON.parse(linha.definicao), rascunho: JSON.parse(linha.rascunho), entrega: linha.entrega ? JSON.parse(linha.entrega) : null };
  Object.defineProperty(resultado, 'dono', { value: linha.dono });
  return resultado;
}
export const escopoFormatos = dono => JSON.stringify(['perguntas-formatos-v1', dono]);

export class Repositorio {
  constructor(banco) { this.banco = banco; }
  async criar(dono, formulario, rascunho) {
    const id = crypto.randomUUID();
    await this.banco.prepare('INSERT INTO formularios (id,dono,definicao,rascunho,criado_em) VALUES (?,?,?,?,?)').bind(id, formulario.formato === 2 ? escopoFormatos(dono) : dono, JSON.stringify(formulario), JSON.stringify(rascunho), new Date().toISOString()).run();
    return this.ler(dono, id);
  }
  async ler(dono, id) {
    const linha = await this.banco.prepare('SELECT * FROM formularios WHERE id=? AND dono IN (?,?)').bind(id, dono, escopoFormatos(dono)).first();
    if (!linha) throw new ErroFormulario('Formulário não encontrado ou acesso não autorizado.', 'nao_encontrado');
    return registro(linha);
  }
  async listar(dono, cursor) {
    const filtro = cursor ? ' AND (criado_em<? OR (criado_em=? AND id<?))' : '';
    const valores = cursor ? [dono, escopoFormatos(dono), cursor.criado_em, cursor.criado_em, cursor.id] : [dono, escopoFormatos(dono)];
    const linhas = await this.banco.prepare(`SELECT id,definicao,criado_em FROM formularios WHERE dono IN (?,?)${filtro} ORDER BY criado_em DESC,id DESC LIMIT 101`).bind(...valores).all();
    const pagina = linhas.results.slice(0, 100);
    const ultima = pagina.at(-1);
    return { pendentes: pagina.map(linha => ({ id: linha.id, titulo: JSON.parse(linha.definicao).titulo })), proximaPagina: linhas.results.length > 100 ? { criado_em: ultima.criado_em, id: ultima.id } : null };
  }
  async salvar(dono, id, versao, rascunho) {
    const origem = await this.ler(dono, id);
    const resultado = await this.banco.prepare('UPDATE formularios SET rascunho=?,versao=versao+1 WHERE id=? AND dono=? AND versao=? AND entrega IS NULL RETURNING *').bind(JSON.stringify(rascunho), id, origem.dono, versao).first();
    if (!resultado) throw new ErroFormulario('O formulário mudou em outra janela ou está em entrega. Reabra antes de continuar.', 'conflito');
    return registro(resultado);
  }
  async preparar(dono, id, versao, rascunho, entrega) {
    const atual = await this.ler(dono, id);
    if (atual.entrega && atual.entrega.token === entrega.token) return atual;
    if (atual.versao !== versao) throw new ErroFormulario('O formulário mudou. Reabra antes de enviar.', 'conflito');
    if (atual.entrega) throw new ErroFormulario('Existe outra preparação. Confira a conversa e retome a edição antes de enviar.', 'conflito');
    const resultado = await this.banco.prepare('UPDATE formularios SET rascunho=?,entrega=?,versao=versao+1 WHERE id=? AND dono=? AND versao=? AND entrega IS NULL RETURNING *').bind(JSON.stringify(rascunho), JSON.stringify(entrega), id, atual.dono, versao).first();
    if (!resultado) throw new ErroFormulario('O formulário mudou durante a entrega.', 'conflito');
    return registro(resultado);
  }
  async concluir(dono, id, token) {
    const atual = await this.ler(dono, id);
    if (!atual.entrega || atual.entrega.token !== token) throw new ErroFormulario('Confirmação de entrega inválida. O progresso foi preservado.', 'confirmacao_invalida');
    const resultado = await this.banco.prepare('DELETE FROM formularios WHERE id=? AND dono=? AND versao=?').bind(id, atual.dono, atual.versao).run();
    if (resultado.meta.changes !== 1) throw new ErroFormulario('Não foi possível encerrar a retenção do formulário.', 'conflito');
  }
  async retomar(dono, id, token) {
    const atual = await this.ler(dono, id);
    if (!atual.entrega || atual.entrega.token !== token) throw new ErroFormulario('Preparação de entrega inválida.', 'confirmacao_invalida');
    const resultado = await this.banco.prepare('UPDATE formularios SET entrega=NULL,versao=versao+1 WHERE id=? AND dono=? AND versao=? RETURNING *').bind(id, atual.dono, atual.versao).first();
    if (!resultado) throw new ErroFormulario('O formulário mudou durante a retomada.', 'conflito');
    return registro(resultado);
  }
}
