export const LIMITE_ENTRADA_MCP = 2000000;
export const LIMITE_BUFFER_TRANSPORTE = 8000000;
export const LIMITE_FORMULARIO = 400000;
export const LIMITE_RASCUNHO = 1000000;

export function tamanhoJson(valor) {
  return new TextEncoder().encode(JSON.stringify(valor)).length;
}
