import { normalizarFormulario, rascunhoVazio } from './formulario.mjs';

export const FORMULARIO_EXEMPLO = normalizarFormulario({
  titulo: 'Exemplo: perguntas no chat',
  perguntas: [
    { texto: 'Você prefere responder às perguntas aqui na conversa?', tipo: 'sim_nao' },
    { texto: 'Qual nota você dá à facilidade de uso?', tipo: 'nota', min: 1, max: 5 },
    { texto: 'O que você ajustaria neste formulário?', tipo: 'texto' }
  ]
});

export const RASCUNHO_EXEMPLO = rascunhoVazio();
