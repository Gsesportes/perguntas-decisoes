export class ElementoTeste {
  constructor(tag = 'div') { this.tag = tag; this.attrs = {}; this.dataset = {}; this.children = []; this.events = {}; this.hidden = false; this.disabled = false; this.value = ''; this.checked = false; this.textContent = ''; }
  get textContent() { return this.conteudoTexto; }
  set textContent(valor) { this.conteudoTexto = valor; for (const item of this.children ?? []) if (item instanceof ElementoTeste) item.parentElement = null; this.children = []; }
  setAttribute(chave, valor) { this.attrs[chave] = valor; if (chave.startsWith('data-')) this.dataset[chave.slice(5)] = valor; }
  removeAttribute(chave) { delete this.attrs[chave]; }
  append(...itens) { for (const item of itens) { if (item instanceof ElementoTeste) { if (item.parentElement) item.parentElement.children.splice(item.parentElement.children.indexOf(item), 1); item.parentElement = this; } this.children.push(item); } }
  before(item) { const pai = this.parentElement; if (!pai) throw new Error('Elemento de teste sem pai.'); item.parentElement = pai; pai.children.splice(pai.children.indexOf(this), 0, item); }
  replaceChildren(...itens) { for (const item of this.children) if (item instanceof ElementoTeste) item.parentElement = null; this.children = []; this.append(...itens); }
  get isConnected() { let raiz = this; while (raiz.parentElement) raiz = raiz.parentElement; return raiz === document.raiz; }
  dispatchEvent(evento) { evento.target = this; for (const funcao of this.events[evento.type] ?? []) funcao(evento); }
  addEventListener(nome, funcao) { (this.events[nome] ??= []).push(funcao); }
  async disparar(nome) { for (const funcao of this.events[nome] ?? []) await funcao({ target: this, preventDefault() {} }); }
  descendentes() { return this.children.flatMap(item => item instanceof ElementoTeste ? [item, ...item.descendentes()] : []); }
  corresponde(seletor) { if (seletor === 'input:checked') return this.tag === 'input' && this.checked; if (seletor.startsWith('#')) return this.attrs.id === seletor.slice(1); if (seletor.startsWith('[')) return Object.hasOwn(this.attrs, seletor.slice(1, -1)); return this.tag === seletor; }
  querySelectorAll(seletor) { if (seletor.includes('form ')) { const tipos = seletor.split(',').map(item => item.trim().replace('form ', '')); return this.querySelector('form').descendentes().filter(item => tipos.includes(item.tag)); } return this.descendentes().filter(item => item.corresponde(seletor)); }
  querySelector(seletor) { return this.querySelectorAll(seletor)[0]; }
  scrollIntoView() {}
}
export function criarDomTeste() {
  globalThis.document = { createElement: tag => new ElementoTeste(tag), createTextNode: texto => texto };
  globalThis.window = { addEventListener() {}, Event: class { constructor(type) { this.type = type; } } };
  const raiz = new ElementoTeste(); const formulario = new ElementoTeste('form'); formulario.setAttribute('data-formulario', ''); raiz.append(formulario);
  document.raiz = raiz;
  for (const nome of ['origem', 'erro', 'progresso', 'pagina', 'barra', 'anterior', 'proximo', 'entregas', 'gerais', 'conexao', 'retomar', 'estado', 'titulo', 'pendentes', 'sucesso', 'limpar', 'perguntas']) {
    const item = new ElementoTeste(['anterior', 'proximo', 'retomar', 'limpar'].includes(nome) ? 'button' : 'div'); item.setAttribute('data-' + nome, '');
    (['origem', 'titulo', 'pendentes', 'sucesso'].includes(nome) ? raiz : formulario).append(item);
  }
  const gerais = new ElementoTeste('textarea'); gerais.setAttribute('id', 'pd-observacoes-gerais'); formulario.append(gerais);
  for (const modo of ['chat', 'anotacao', 'arquivo']) { const botao = new ElementoTeste('button'); botao.setAttribute('data-entrega', modo); formulario.append(botao); }
  return raiz;
}
export const aguardarFila = async () => { for (let i = 0; i < 4; i += 1) await new Promise(resolve => setTimeout(resolve, 0)); };
export function promessaControlada() { let resolver; const promessa = new Promise(resolve => { resolver = resolve; }); return { promessa, resolver }; }
