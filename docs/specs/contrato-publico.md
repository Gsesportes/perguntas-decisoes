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
- Tipos legados: sim/não, escolha única, múltipla, texto, nota, escala, número, data e hora. Fonte 0.4.0 acrescenta tabela, ordenação, imagens, pontos, intervalo e lista; estrelas, emojis, barra e condições são definidos integralmente em formatos-avancados.md.
- Rascunhos legados conservam seu escopo; recursos novos usam escopo interno separado no mesmo banco. O servidor novo consulta ambos. Conexões antigas não devem interpretar os formatos novos; nenhuma migração destrutiva ou perda de respostas é permitida.
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
- O MCP portátil resolve o servidor por `${PLUGIN_ROOT}/server/servidor.mjs` e usa `${PLUGIN_DATA}` como diretório de trabalho persistente. A forma `.` é recusada pelo carregador Agent Plugins do Codex. O aceite exige que o próprio Codex reconheça e inicie o servidor; as variáveis são resolvidas pelo anfitrião.
- Na abertura manual sem resultado inicial utilizável, consultar os pendentes pela operação privada após conectar. Um resultado de formulário recebido durante a consulta prevalece sobre a lista tardia. Falha ou ausência de conteúdo devolvido deve produzir erro visível, sem permanecer em uma tela vazia.
- Instalação distribuída por GitHub com catálogo pronto e Instalar.cmd. Requer Windows, Node 24 e Codex desktop; o instalador verifica os requisitos antes de copiar arquivos, preserva registros existentes e não reinicia o aplicativo.
- O servidor MCP é fornecido pelo próprio plugin, sem registrar uma segunda conexão global para a mesma ferramenta. Componentes nativos ficam versionados em pasta própria do perfil, fora do cache descartável de plugins. Atualizações conservam versões anteriores; não substituir arquivos de uma mesma versão por conteúdo diferente. Conferir marcadores de propriedade e recusar links simbólicos. Vínculos legados existentes exigem conferência de propriedade antes de remoção; não remover conexões de terceiros.
- Instalação e escrita do vínculo não comprovam recarga da conexão já aberta. Informar essa fronteira; não prometer que fechar somente a aba atualiza o servidor nem orientar um botão de atualização que não foi confirmado.
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

- 2026-10-14 — Fonte local 0.4.2 acrescenta tabela, ordenação, imagens locais, pontos, intervalo, lista, apresentações de notas e condições. Observações e tipos legados conservados; dados avançados isolados de servidores antigos no mesmo banco. Servidor usa PLUGIN_ROOT e PLUGIN_DATA; capturador e assets internos usam componentes persistentes. Lint, 81 testes e protocolo real em banco isolado passaram; carregador oficial iniciou 0.4.2. Após nova mensagem, recurso ativo da conversa conferido em 0.4.2 e exibição do formulário confirmada pela pessoa usuária. Automação visual indisponível: cliques e entrega nativa dos novos formatos não confirmados. Sem publicação remota.

- 2026-10-12 — Fonte local 0.3.6-ditado.6 melhora os estados do microfone, permite editar outros campos durante o reconhecimento e ajusta paralelismo mantendo modelo e qualidade configurada. Instalador deixa de criar conexão global duplicada; vínculos legados não foram removidos automaticamente. Lint e 61 verificações passaram, sem publicação. Teste real anterior confirmou resposta, observações individuais e gerais e envio ao chat; alterações da iteração 6 ainda não foram verificadas no painel porque a conexão ativa permanece na iteração 5. Detalhes no contrato de ditado e evidência privada.

- 2026-10-06 — Contrato neutro 0.3.5: salvamento e entrega associados à origem, erros visíveis, paginação, limites agregados, comando portátil e exemplos fictícios. Evidências operacionais ficam em acervo interno separado.
- 2026-10-07 — Preparação GitHub para outro computador: catálogo pronto, instalador Windows com verificação de requisitos, proteção de pasta/registro existente e conferência do vínculo MCP. Código do formulário e layout preservados.
- 2026-10-12 — Preparada implementação experimental de ditado local em português nas respostas de texto e observações, por captura em memória e Whisper local. Contrato específico em ditado-nos-campos.md; nova versão instalada localmente, sem publicação. Reconhecimento e inserção pelo painel nativo ainda dependem de prova real, separada dos testes de código e protocolo.
- 2026-10-12 — Corrigido vínculo de instalação para componentes versionados no perfil, fora do cache descartável; versões anteriores e conteúdo de uma mesma versão são preservados. Preparação atômica da pasta, marcadores e recusa de links ou conteúdo divergente. Lint e 54 verificações passaram; servidor real da cópia persistente iniciou em banco isolado. A instalação não comprova recarga de conexões antigas, e o instalador deixou de prometer que fechar somente a aba seria suficiente. Fonte local sem publicação; fala real no painel continua pendente no contrato específico.
- 2026-10-12 — Manifesto corrigido para `cwd: "./"`, após rejeição confirmada pelo carregador real do Codex. MCP próprio reconhecido e iniciado pelo leitor e consulta oficiais na iteração completa 0.3.6-ditado.5. Abertura manual consulta pendentes se não receber resultado inicial utilizável, respeita resultado concorrente e informa falhas. Lint e 57 verificações passaram; conexão desta conversa e fala real no painel ainda dependem da prova nativa. Layout e dados preservados, sem reinício, novo chat ou publicação.

## Notas de desenho

O Worker HTTP experimental é separado do transporte local. Sua publicação exige autenticação e hospedagem próprias.

## Verificação

Executar `npm run verificar`, `npm run package:desktop`, `npm run verificar:desktop` e `npm run auditar:publicacao`. Conferência visual e entrega nativa devem ser relatadas separadamente.
