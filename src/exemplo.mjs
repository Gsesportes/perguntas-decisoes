import { normalizarFormulario, rascunhoVazio } from './formulario.mjs';

export const FORMULARIO_EXEMPLO = normalizarFormulario({
  titulo: 'Perguntas e decisões',
  perguntas: [
    { texto: 'A proposta atende ao objetivo?', tipo: 'sim_nao' },
    { texto: 'Qual prioridade vem primeiro?', tipo: 'unica', opcoes: ['Clareza', 'Agilidade', 'Detalhamento'] },
    { texto: 'Quais critérios devem ser considerados?', tipo: 'multipla', opcoes: ['Facilidade de uso', 'Tempo necessário', 'Qualidade do resultado'] },
    { texto: 'O que você gostaria de acrescentar à proposta?', tipo: 'texto' },
    ...['Item A', 'Item B', 'Item C', 'Item D'].map(texto => ({ texto, tipo: 'unica', opcoes: ['Aprovar', 'Ajustar', 'Deixar pendente'] })),
    { texto: 'Qual nota você dá à facilidade de uso? (exemplo)', tipo: 'nota', min: 1, max: 5 },
    { texto: 'Qual o grau de prioridade? (exemplo)', tipo: 'escala', min: 0, max: 10 },
    { texto: 'Quantos itens deseja avaliar por vez? (exemplo)', tipo: 'numero', min: 1, max: 100 },
    { texto: 'Quando deseja retomar a avaliação? (exemplo)', tipo: 'data' }
  ]
});

export const RASCUNHO_EXEMPLO = rascunhoVazio();
