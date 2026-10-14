// Compara conteúdo, sem depender da ordem das propriedades de objetos JSON.
export function conteudoIgual(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const chaves = Object.keys(a);
  return chaves.length === Object.keys(b).length && chaves.every(chave => Object.hasOwn(b, chave) && conteudoIgual(a[chave], b[chave]));
}

// Campos sem alteração local seguem o servidor. Um conflito exige escolha humana.
export function conciliarRascunhos(base, local, salvo, { preferirLocal = false } = {}) {
  const conflitos = [];
  function escolher(anterior, atual, remoto, campo, pergunta) {
    if (conteudoIgual(atual, anterior)) return remoto;
    if (conteudoIgual(remoto, anterior) || conteudoIgual(atual, remoto)) return atual;
    if (!preferirLocal) conflitos.push({ campo, ...(pergunta ? { pergunta } : {}) });
    return atual;
  }
  const rascunho = { respostas: {}, observacoes: {}, gerais: '', pagina: local.pagina ?? 0 };
  if (local.itens_por_pagina !== undefined) rascunho.itens_por_pagina = local.itens_por_pagina;
  for (const campo of ['respostas', 'observacoes']) {
    const normalizar = valor => campo === 'observacoes' && valor === '' ? undefined : valor;
    const chaves = new Set([base, local, salvo].flatMap(item => Object.keys(item[campo] ?? {})));
    const entradas = [];
    for (const chave of chaves) {
      const valores = [base, local, salvo].map(item => normalizar(Object.hasOwn(item[campo] ?? {}, chave) ? item[campo][chave] : undefined));
      const valor = escolher(...valores, campo, chave);
      if (valor !== undefined) entradas.push([chave, structuredClone(valor)]);
    }
    rascunho[campo] = Object.fromEntries(entradas);
  }
  rascunho.gerais = escolher(base.gerais ?? '', local.gerais ?? '', salvo.gerais ?? '', 'gerais');
  return { rascunho, conflitos };
}

export function perguntasAlteradas(anterior, atual) {
  return new Set(['respostas', 'observacoes'].flatMap(campo => [...new Set([...Object.keys(anterior[campo]), ...Object.keys(atual[campo])])]
    .filter(id => !conteudoIgual(anterior[campo][id], atual[campo][id]))));
}
