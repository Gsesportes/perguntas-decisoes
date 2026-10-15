---
titulo: 'Cópia das respostas e integração das apresentações'
tipo: 'funcionalidade'
criado: '2026-10-14'
estado: 'implementado-reteste-nativo-pendente'
contexto: []
---

## Intenção

Atender ao pedido de copiar as respostas para a área de transferência, incluindo a tela final depois do envio. Incorporar as melhorias do PR #1 à fonte atual, preservando formatos, observações, ditado, proteção de concorrência e validação. O PR é uma contribuição anterior; não substituir a fonte atual pela versão antiga.

## Fronteiras e restrições

- Versão completa 0.5.0. Preservar logo, cores, tipografia, organização e seis perguntas por página. Aplicar apenas os espaçamentos compactos do PR e os controles necessários à cópia. Sem reiniciar o Codex, criar chat, mudar a conversa principal ou publicar no GitHub nesta etapa.
- Copiar na última página, junto às entregas, e na tela de sucesso depois de enviar, anotar ou anexar. Texto completo, legível, com perguntas visíveis, respostas e observações individuais e gerais, na ordem do formulário. Não usar texto compacto interno nem copiar dados ocultos por condições.
- Antes do envio, a cópia exige formulário completo e salvamentos conferidos. Copiar não prepara entrega, não envia mensagem, não anexa arquivo, não altera respostas e não remove o rascunho. Desabilitar enquanto houver ditado, envio ou cópia em andamento. Sucesso somente depois de confirmação real da escrita na área de transferência; falha visível, permitindo retentar.
- Depois do envio, usar em memória somente o texto do conjunto entregue enquanto essa tela permanecer aberta. O registro continua sendo removido do banco pela confirmação de entrega. Não recriar rascunho nem persistir cópia em arquivo, log ou configuração. Ao carregar outro formulário, limpar a referência temporária. A área de transferência pertence ao sistema e conserva o texto até outra cópia substituí-lo, independentemente da remoção do rascunho.
- Usar a API de área de transferência do navegador quando permitida. Declarar clipboardWrite nos metadados do recurso MCP, conforme SDK instalado; o anfitrião pode recusar. No desktop, oferecer operação privada de cópia pelo Windows, com texto em entrada padrão, comando estático, limite de tamanho, tempo máximo e janela oculta. Verificar escrita por leitura local e devolver somente confirmação, sem devolver o conteúdo copiado. Se a API do navegador falhar e a integração local concluir, informar essa via no retorno da interface. Nunca simular cópia nem exibir sucesso sem execução.
- PR de origem: https://github.com/Gsesportes/perguntas-decisoes/pull/1, revisão aed3c731f05fd00c073483394c69559b0fef8cff, base 245ee44802cb67e12d6dfd70f38085f6a6254b0a. Adaptar a contribuição à versão atual: URI versionada, versão única de package.json, novos formatos e operações privadas preservados. Integração na fonte local, sem fechar ou mesclar o PR remoto.
- Quatro comandos visíveis, conforme o PR: criar_formulario e abrir_painel mantêm painel lateral por padrão; criar_formulario_no_chat e abrir_no_chat oferecem apresentação dentro do chat somente quando solicitada. Ambos usam os mesmos registros, IDs, respostas e observações. Operação de copiar e demais operações de edição continuam privadas da interface. Manter descrições curtas e orçamento conjunto explícito de até 5000 bytes; a ampliação corresponde às duas apresentações aprovadas.
- Dois recursos versionados: painel prefere fullscreen; chat prefere inline. Conservar aliases estáveis anteriores somente para leitura. O modo esperado é conferido após conectar; aviso separado dos erros de preenchimento permanece após carregar, paginar ou listar, e desaparece somente quando o anfitrião confirma o modo. A carga inicial de pendentes continua funcionando mesmo se a negociação visual falhar após conexão.
- Preservar fontes e testes do PR que sejam pertinentes, adaptando as expectativas ao catálogo completo atual. Não reduzir a demonstração anterior a três perguntas nem remover cobertura dos formatos existentes apenas para acompanhar um exemplo do PR.
- Catálogo pronto sincronizável explicitamente com o pacote construído. Conferência compara os arquivos declarados do catálogo distribuído com o pacote final e verifica versão real do servidor contra manifesto. Divergência causa falha visível; não reparar silenciosamente durante conferência. Preservar a proteção de componentes de versões já instaladas.
- O compilador nativo conserva um registro privado em .local contendo hashes da fonte, compilador, argumentos e executável. Reutilizar apenas quando todos conferirem; recompilar quando qualquer um mudar ou o registro estiver ausente. Isso evita gerar um binário diferente a cada verificação sem mudança da fonte. Em uma cópia de desenvolvimento nova, sincronizar explicitamente o catálogo depois da primeira construção. Comparar arquivos binários byte a byte e normalizar somente finais de linha de arquivos textuais.
- Fonte pública sem nomes pessoais, caminhos do perfil, respostas reais, banco, capturas ou credenciais. Teste de código, protocolo, área de transferência real e clique no painel são evidências distintas.

## Matriz de entradas, saídas e fronteiras

| Situação | Resultado |
|---|---|
| Copiar formulário completo antes do envio | Escrever conjunto e conservar rascunho editável |
| Copiar com resposta faltante ou faixa invertida | Aviso, sem escrever conjunto incompleto |
| Copiar depois de envio confirmado e limpeza | Usar texto entregue em memória, sem recriar registro |
| Falha da cópia | Aviso e nova tentativa disponível |
| Cópia enquanto há ditado ou entrega | Controle indisponível |
| Outro formulário carregado | Cópia final anterior indisponível |
| Navegador sem permissão, Windows disponível | Copiar pela integração local e informar essa via |
| Nenhuma via disponível | Erro visível, sem sucesso fictício |
| Alternar painel e chat | Mesmo ID e preenchimento preservados |
| Anfitrião recusa modo solicitado | Aviso persistente; conteúdo continua carregando |
| Catálogo pronto divergente | Conferência recusa e orienta sincronização explícita |

## Tarefas e aceite

- [x] Implementar cópia antes e depois da entrega, com erros e retenção em memória.
- [x] Incorporar as apresentações e os espaçamentos do PR sem reverter formatos recentes.
- [x] Incorporar sincronização explícita e conferência do catálogo.
- [x] Lint, 134 testes, construção e protocolo entre apresentações.
- [x] Testar escrita e releitura reais na área de transferência do Windows, antes e depois de limpar o registro fictício; conteúdo anterior restaurado.
- [x] Instalar versão completa 0.5.0 e conferir versão efetivamente carregada nesta conversa: ainda 0.4.6.
- [x] Carregar a interface 0.5.0 nesta conversa; exibição do formulário e botão Copiar confirmada pela pessoa em 2026-10-15.
- [ ] Exercitar Copiar no painel real antes e depois da entrega.
- [x] Auditar fonte pública e registrar alterações em Git local, sem publicação remota.

## Histórico de mudanças

- 2026-10-15 — Conexão da conversa redisponibilizada com os dois recursos e quatro ferramentas da versão 0.5.0. A ferramenta da própria conversa solicitou abrir o formulário curto já criado; a pessoa confirmou título, versão 0.5.0 e botão Copiar no painel. A leitura automatizada de tela não dispõe de superfícies nesta sessão; confirmação de exibição é humana. Testes de clique em Copiar antes e depois do envio ainda aguardam execução da pessoa, sem reabrir o registro depois da entrega.

- 2026-10-14 — Nova tentativa de abertura recebeu ainda recurso 0.4.6. Renovado somente o plugin próprio pela desinstalação oficial e reinstalação 0.5.0, sem reiniciar o Codex. Dez rascunhos anteriores conferidos por ID, versão e estado de entrega; habilitação específica da conexão própria reposta com preservação semântica das demais configurações. Criado pela versão 0.5.0 um formulário de uma pergunta e observações, sem respostas, no perfil real. Ferramentas retiradas do contexto durante a renovação; abertura ainda aguarda nova seleção do plugin. Criação pelo protocolo não foi apresentada como painel aberto.

- 2026-10-14 — Implementada e instalada a fonte completa 0.5.0. Cópia na última página e na tela final, permissão do navegador e integração Windows privada com confirmação por releitura; nenhuma preparação, envio ou limpeza causada pela cópia. Adaptadas as melhorias do PR #1, revisão aed3c731f05fd00c073483394c69559b0fef8cff: lateral padrão, chat opcional, mesmo ID entre apresentações, aviso persistente, espaçamentos compactos e catálogo sincronizável/conferido. Mantidos versão única, URIs versionadas, formatos, ditado e concorrência atuais. Lint, 134 testes, comando distribuído e protocolo passaram. Cópia Windows real confirmada com Unicode e linhas, antes e depois da limpeza de dados fictícios; conteúdo anterior restaurado. Esta conversa ainda serve 0.4.6 e a automação de tela falha antes de executar; clique no painel 0.5.0 permanece pendente. Sem reinício do Codex, novo chat ou alteração remota do PR.

- 2026-10-14 — Escopo definido a partir do pedido de cópia e da revisão atual do PR #1; implementação e provas pendentes.
