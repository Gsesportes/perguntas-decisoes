export class ErroFormulario extends Error {
  constructor(mensagem, codigo = 'entrada_invalida') {
    super(mensagem);
    this.name = 'ErroFormulario';
    this.codigo = codigo;
  }
}
