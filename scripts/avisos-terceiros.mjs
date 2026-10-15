import { readFile, readdir } from 'node:fs/promises';
export async function avisosTerceiros(raiz) {
  const lock = JSON.parse(await readFile(new URL('package-lock.json', raiz), 'utf8'));
  const blocos = ['Licenças e atribuições das dependências de execução\nAs licenças próprias das bibliotecas permanecem aplicáveis.'];
  blocos.push('Heroicons 2.2.0 — ícone Star\nOrigem: https://github.com/tailwindlabs/heroicons/tree/v2.2.0\n' + await readFile(new URL('docs/licencas/heroicons-LICENSE.md', raiz), 'utf8'));
  for (const [caminho, pacote] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
    if (!caminho || pacote.dev) continue;
    const pasta = new URL(caminho + '/', raiz);
    let nomes;
    try { nomes = await readdir(pasta); } catch (erro) { if (erro.code === 'ENOENT' && pacote.optional) continue; throw erro; }
    const licencas = nomes.filter(nome => /^(licen[cs]e|copying|copyright)([.-]|$)/i.test(nome));
    if (!licencas.length && caminho === 'node_modules/@cfworker/json-schema' && pacote.version === '4.1.1' && pacote.license === 'MIT') {
      blocos.push('@cfworker/json-schema @ 4.1.1\nLicença do commit publicado: https://github.com/cfworker/cfworker/tree/5409fdc2bd144f68e8b28c61c71fcb16600000a6\nAvisos suplementares de código derivado: https://github.com/cfworker/cfworker/blob/53401039978aaacc5961d6fc0f2c64f7927ea260/THIRD_PARTY_NOTICES.md');
      for (const nome of ['cfworker-LICENSE.md', 'cfworker-THIRD_PARTY_NOTICES.md']) blocos.push(await readFile(new URL('docs/licencas/' + nome, raiz), 'utf8'));
      continue;
    }
    if (!licencas.length) throw new Error('Licença da dependência não encontrada: ' + caminho);
    blocos.push(caminho.replace(/^node_modules\//, '') + ' @ ' + pacote.version + '\nLicença declarada: ' + (pacote.license ?? 'Consulte o texto'));
    for (const nome of licencas) blocos.push(await readFile(new URL(nome, pasta), 'utf8'));
  }
  return blocos.join('\n\n--------------------\n\n') + '\n';
}
