export class ElementoTeste {
  constructor(tag = 'div') { this.tag = tag; this.attrs = {}; this.dataset = {}; this.children = []; this.events = {}; this.hidden = false; this.disabled = false; this.value = ''; this.checked = false; this.textContent = ''; }
  get textContent() { return this.conteudoTexto; }
  get className() { return this.attrs.class ?? ''; }
  get id() { return this.attrs.id ?? ''; }
  set className(valor) { this.attrs.class = valor; }
  get valueAsNumber() { return this.value === '' ? NaN : Number(this.value); }
  set textContent(valor) { this.conteudoTexto = valor; for (const item of this.children ?? []) if (item instanceof ElementoTeste) item.parentElement = null; this.children = []; }
  setAttribute(chave, valor) { this.attrs[chave] = String(valor); if (chave === 'value') this.value = String(valor); if (chave.startsWith('data-')) this.dataset[chave.slice(5)] = String(valor); }
  removeAttribute(chave) { delete this.attrs[chave]; }
  append(...itens) { for (const item of itens) { if (item instanceof ElementoTeste) { if (item.parentElement) item.parentElement.children.splice(item.parentElement.children.indexOf(item), 1); item.parentElement = this; } this.children.push(item); } }
  before(item) { const pai = this.parentElement; if (!pai) throw new Error('Elemento de teste sem pai.'); item.parentElement = pai; pai.children.splice(pai.children.indexOf(this), 0, item); }
  replaceChildren(...itens) { for (const item of this.children) if (item instanceof ElementoTeste) item.parentElement = null; this.children = []; this.append(...itens); }
  get isConnected() { let raiz = this; while (raiz.parentElement) raiz = raiz.parentElement; return raiz === document.raiz; }
  dispatchEvent(evento) { evento.target = this; for (const funcao of this.events[evento.type] ?? []) funcao(evento); }
  addEventListener(nome, funcao) { (this.events[nome] ??= []).push(funcao); }
  async disparar(nome, detalhes = {}) { for (const funcao of this.events[nome] ?? []) await funcao({ target: this, preventDefault() {}, ...detalhes }); }
  descendentes() { return this.children.flatMap(item => item instanceof ElementoTeste ? [item, ...item.descendentes()] : []); }
  corresponde(seletor) {
    if (seletor === 'input:checked') return this.tag === 'input' && this.checked;
    if (seletor.startsWith('#')) return this.attrs.id === seletor.slice(1);
    if (seletor.startsWith('.')) return this.className.split(/\s+/).includes(seletor.slice(1));
    const atributo = /^(\w+)?\[([\w-]+)(?:="([^"]*)")?\]$/.exec(seletor);
    if (atributo) return (!atributo[1] || atributo[1] === this.tag) && Object.hasOwn(this.attrs, atributo[2]) && (atributo[3] === undefined || this.attrs[atributo[2]] === atributo[3]);
    return this.tag === seletor;
  }
  querySelectorAll(seletor) {
    const partes = seletor.split(',').map(item => item.trim());
    if (partes.some(item => item.startsWith('form '))) return this.querySelector('form').descendentes().filter(item => partes.some(parte => item.corresponde(parte.replace(/^form /, ''))));
    return this.descendentes().filter(item => partes.some(parte => item.corresponde(parte)));
  }
  querySelector(seletor) { return this.querySelectorAll(seletor)[0]; }
  scrollIntoView() {}
  focus() { document.activeElement = this; }
}
export function criarDomTeste() {
  globalThis.document = { createElement: tag => new ElementoTeste(tag), createTextNode: texto => texto };
  globalThis.window = { addEventListener() {}, Event: class { constructor(type) { this.type = type; } } };
  const raiz = new ElementoTeste(); const formulario = new ElementoTeste('form'); formulario.setAttribute('data-formulario', ''); raiz.append(formulario);
  document.raiz = raiz;
  document.getElementById = id => raiz.querySelector('#' + id);
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
