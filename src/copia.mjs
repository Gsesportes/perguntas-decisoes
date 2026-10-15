export async function copiarTexto(texto, { area = globalThis.navigator?.clipboard, copiarLocal } = {}) {
  if (typeof texto !== 'string' || !texto) throw new Error('Não há respostas prontas para copiar.');
  if (typeof area?.writeText === 'function') {
    try {
      await area.writeText(texto);
      return 'Respostas copiadas para a área de transferência.';
    } catch {
      // A integração local é anunciada no retorno quando o navegador recusa.
    }
  }
  if (copiarLocal) {
    const resultado = await copiarLocal(texto);
    if (resultado?.copiado !== true) throw new Error('A cópia não foi confirmada pelo computador.');
    return 'Respostas copiadas para a área de transferência pela integração local do computador.';
  }
  throw new Error('O aplicativo não permitiu copiar para a área de transferência. O formulário continua disponível.');
}
