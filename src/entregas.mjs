function confirmarResultado(resultado) {
  if (resultado?.isError === true) throw new Error('O aplicativo recusou a entrega.');
}

export function capacidadesEntrega(aplicativo, extensoes) {
  const capacidades = aplicativo?.getHostCapabilities?.() ?? {};
  return {
    chat: Boolean(capacidades.message?.text && (extensoes?.message || aplicativo?.sendMessage)),
    anotacao: Boolean(extensoes?.modelContext),
    arquivo: Boolean(extensoes?.modelContext)
  };
}

export async function entregarNoAplicativo(modo, entrega, aplicativo, extensoes) {
  if (!capacidadesEntrega(aplicativo, extensoes)[modo]) throw new Error('Este aplicativo não anunciou suporte a essa entrega. O progresso foi preservado.');
  if (modo === 'chat') {
    const parametros = { role: 'user', content: [{ type: 'text', text: entrega.texto }] };
    const resultado = extensoes.message ? await extensoes.message.send(parametros) : await aplicativo.sendMessage(parametros);
    confirmarResultado(resultado);
    return 'Respostas enviadas à conversa.';
  }
  if (modo === 'anotacao') {
    const resultado = await extensoes.modelContext.update({ content: [{ type: 'text', text: entrega.texto, _meta: { 'openai/title': 'Respostas do formulário' } }] });
    confirmarResultado(resultado);
    if (!resultado?.updateId) throw new Error('O aplicativo não confirmou a inserção da anotação.');
    return 'Anotação inserida no campo de mensagem. Você pode acrescentar sua mensagem antes de enviar.';
  }
  if (modo === 'arquivo') {
    const resultado = await extensoes.modelContext.update({ content: [{ type: 'resource', resource: { uri: `respostas://${entrega.id}/respostas.txt`, mimeType: 'text/plain', text: entrega.texto } }] });
    confirmarResultado(resultado);
    if (!resultado?.updateId) throw new Error('O aplicativo não confirmou a anexação do arquivo.');
    return 'Arquivo respostas.txt anexado ao campo de mensagem.';
  }
  throw new Error('Modo de entrega desconhecido.');
}
