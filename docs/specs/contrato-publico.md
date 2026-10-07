---
titulo: 'Plugin de perguntas e decisões — contrato público'
tipo: 'funcionalidade'
criado: '2026-10-06'
estado: 'fonte-verificada'
iteracao_revisao: 1
contexto: []
---

## Intenção

Reunir perguntas e classificações em uma interface local, preservando respostas e observações e entregando o conjunto ao aplicativo por ação explícita.

## Fronteiras e restrições

- Windows, Node.js 24 ou superior, Codex desktop com MCP Apps e OpenAI Extensions.
- Seis perguntas por página, Anterior e Próximo; avanço condicionado ao preenchimento.
- Tipos: sim/não, escolha única, múltipla, texto, nota, escala, número, data e hora.
- Alternativas visíveis em um clique e observações individuais e gerais opcionais.
- Três entregas somente na última página, conforme capacidades: mensagem, anotação no contexto do compositor ou recurso incorporado TXT.
- Não selecionar outra conversa para criar, abrir ou verificar um formulário.
- Dados temporários no perfil Windows. Remover somente o registro de entrega confirmada, pelo token correto.
- Troca solicitada aguarda salvamentos e operações. Erro de salvamento preserva texto na tela e bloqueia troca.
- Versões protegem concorrência; entregas ambíguas não são reenviadas automaticamente.
- A resposta de cada mutação contém sua própria versão e preparação, sem adotar uma gravação posterior. Conflitos oferecem escolhas explícitas; preparação ambígua exige conferir a mesma chave de operação. Leituras antigas não reabrem registros já concluídos.
- Duas ferramentas visíveis; operações internas e paginação com visibilidade do aplicativo.
- Pendentes em páginas de cem, por data e identificador, com acesso aos restantes.
- Limites agregados: definição 400.000 bytes; rascunho 1.000.000; entrada 2.000.000 com margem de envelope. Limites individuais do README subordinados aos totais.
- Reserva de transporte 8.000.000 bytes para recusa controlada; não truncar texto.
- Pacote resolve Node no destino e diagnóstico inicia o comando do manifesto.
- Instalação distribuída por GitHub com catálogo pronto e Instalar.cmd. Requer Windows, Node 24 e Codex desktop; o instalador verifica os requisitos antes de copiar arquivos, preserva registros existentes e não reinicia o aplicativo.
- Fonte pública e produtos sem respostas reais, nomes particulares, caminhos pessoais, rascunhos, credenciais, capturas ou histórico privado.
- Layout, logo, cores, tipografia e organização preservados.

## Matriz de entradas, saídas e fronteiras

| Situação | Resultado |
|---|---|
| Página incompleta | Aviso e permanência |
| Não ou zero | Resposta válida |
| Janela concorrente | Recusa sem sobrescrita |
| Troca durante salvar | Guardar no registro original e depois abrir o solicitado |
| Troca durante preparar, entregar ou concluir | Encerrar somente o registro confirmado |
| Falha no salvamento | Manter texto e exigir confirmação antes de trocar |
| Entrega ambígua | Manter preparação e orientar conferência |
| Rascunho removido depois da listagem | Aviso na lista visível |
| Mais de cem pendentes | Acesso às próximas páginas |
| Excesso de tamanho | Recusa sem truncar ou apagar |
| Modalidade não anunciada | Ação desabilitada |
| Recebimento confirmado | Excluir somente o registro pelo token |

## Mapa dos arquivos

- `src/interface.mjs`: interface e coordenação das operações.
- `src/formulario.mjs` e `src/limites.mjs`: tipos, validações e limites.
- `src/repositorio.mjs`: armazenamento, versões e paginação.
- `src/servidor.mjs` e `src/servidor-desktop.mjs`: ferramentas, recursos e stdio.
- `src/armazenamento-desktop.mjs`: SQLite no perfil Windows.
- `src/aplicativo.mjs` e `src/entregas.mjs`: integração com o aplicativo.
- `src/exemplo.mjs` e `src/inline.mjs`: demonstração fictícia sem respostas iniciais.
- `web/` e `assets/`: estrutura e identidade.
- `scripts/`, `testes/`, `migracoes/` e `skills/`: construção, regressão, schema e instruções.
- `README.md`, `LICENSE` e `package*.json`: uso, licença e dependências.
- `Instalar.cmd` e `scripts/instalar-desktop.mjs`: instalação do catálogo pronto e conferência sem mutação pelo modo --verificar.

## Tarefas e aceite

Exigir lint, regressões pertinentes, construção, conferência do comando distribuído e auditoria da cópia pública. Esses controles não comprovam entrega nativa. Declaração de teste no aplicativo deve identificar versão, modalidades exercitadas e limites da prova.

Web, celular, nuvem e sistemas operacionais diferentes não estão validados por este contrato.

## Histórico de mudanças

- 2026-10-06 — Contrato neutro 0.3.5: salvamento e entrega associados à origem, erros visíveis, paginação, limites agregados, comando portátil e exemplos fictícios. Evidências operacionais ficam em acervo interno separado.
- 2026-10-07 — Preparação GitHub para outro computador: catálogo pronto, instalador Windows com verificação de requisitos, proteção de pasta/registro existente e conferência do vínculo MCP. Código do formulário e layout preservados.

## Notas de desenho

O Worker HTTP experimental é separado do transporte local. Sua publicação exige autenticação e hospedagem próprias.

## Verificação

Executar `npm run verificar`, `npm run package:desktop`, `npm run verificar:desktop` e `npm run auditar:publicacao`. Conferência visual e entrega nativa devem ser relatadas separadamente.
