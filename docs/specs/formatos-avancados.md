---
titulo: 'Formatos adicionais de perguntas e condições'
tipo: 'funcionalidade'
criado: '2026-10-14'
estado: 'implementado-reteste-nativo-pendente'
contexto: []
---

## Intenção

Acrescentar todos os formatos apresentados e aprovados: tabela de classificação, ordenação, escolha por imagens, distribuição de pontos, intervalo numérico, lista livre, estrelas, emojis, barra deslizante e perguntas condicionais. Preservar os nove tipos atuais, observações livres, o painel, ditado existente e entregas. Estrutura documental baseada no contrato público existente; o diretório global de templates citado nas instruções não existe neste ambiente.

## Fronteiras e restrições

- Windows e Codex desktop, mantendo identidade, logo, cores, cabeçalho, navegação e botões de entrega do plugin. Novos controles ficam dentro das perguntas. Não reiniciar o aplicativo, criar chat, selecionar outra conversa nem encerrar outros agentes.
- Versão 0.4.2, compatível com definições e respostas antigas. O banco continua no perfil. Formulários com recursos novos usam um escopo interno separado no mesmo banco: o servidor novo consulta ambos; servidores antigos consultam somente os legados. Não alterar ou apagar rascunhos antigos nem fazer uma versão antiga interpretar dados estruturados desconhecidos.
- Servidor com argumento absoluto resolvido por PLUGIN_ROOT e diretório de trabalho PLUGIN_DATA. Capturador e assets internos são lidos das cópias persistentes da respectiva versão. Um processo ainda conectado não depende de arquivos já removidos do cache descartável para essas operações.
- Continuar com duas ferramentas visíveis, definição compacta menor que 3500 bytes, dados da interface nos metadados e limites agregados existentes. Operação privada de imagens fica disponível somente ao aplicativo.
- Todos os formatos preservam observações opcionais por pergunta e observações gerais. Linhas de tabela preservam observação por item com o ditado existente. As respostas estruturadas não são inferidas da fala; o ditado de respostas de tipo texto e das observações mantém seu comportamento.
- Tabela: `tipo: tabela`, `itens` de 1 a 200 textos e `opcoes` comuns de 2 a 10 alternativas. Expandir em linhas de escolha única, com grupo e identificadores estáveis `pN_iM`; seis linhas/perguntas por página, alternativas visíveis em um clique. A forma curta aceita `tipo: tabela` comum e perguntas textuais, com IDs `pN`. Itens da tabela contam no limite total de 1000 perguntas.
- Ordenação: `tipo: ordenacao`, de 2 a 100 alternativas textuais distintas. Resposta é uma permutação completa. Mostrar ordem inicial como proposta sem respondê-la automaticamente; mover com botões Subir/Descer ou confirmar explicitamente a ordem atual. Sem exigir arrastar ou abrir menus.
- Imagens: `tipo: imagens`, de 2 a 20 opções com `texto` e `imagem`. Resposta é o texto único da alternativa escolhida. Referências são arquivos raster locais absolutos, assets relativos do pacote ou imagens incorporadas PNG/JPEG/WebP. A operação privada recebe formulário, pergunta e opção, confere o dono e lê somente a referência declarada. Máximo de 1 MiB por imagem, formato verificado pelos bytes, nenhum arquivo de imagem copiado para o banco. Links remotos são recusados nesta versão local; erro de imagem é visível. Não executar SVG, HTML ou URLs de script.
- Pontos: `tipo: pontos`, de 2 a 30 `itens`, `total` inteiro entre 1 e 1000000, padrão 100. Resposta mapeia identificadores de item para números inteiros não negativos. Rascunho pode ter soma diferente do total; conclusão exige soma exata. Zeros inicialmente exibidos não criam resposta antes de interação. Mostrar soma e total no próprio controle.
- Intervalo: `tipo: intervalo`, limites e passo numéricos, `unidade` opcional de até 40 caracteres. Resposta com `min` e `max`; rascunho pode ter apenas um limite ou ordem temporariamente invertida, mas entrega exige os dois valores e mínimo menor ou igual ao máximo. Valores devem respeitar limites e passo. Não preencher extremos automaticamente.
- Lista: `tipo: lista`, `min_itens` padrão 1 e `max_itens` padrão 50, entre 1 e 200. Adicionar e remover entradas; até 2000 caracteres por entrada. Rascunho preserva linhas vazias; a interface informa que elas não entram na entrega. Conclusão exige a quantidade mínima de entradas preenchidas; saída entrega as entradas não vazias na mesma ordem, sem alterar seus textos.
- `visual` em nota/escala: botoes, estrelas, emojis ou barra. Estrelas usam valores inteiros até dez, padrão de 1 a 5; emojis têm cinco níveis de 1 a 5. Barra também pode apresentar número e usa os limites e passo declarados; padrão de escala em barra de 0 a 100. Nenhuma apresentação atribui resposta antes da ação humana. Barra permite confirmar o mínimo, inclusive zero, com clique ou teclado.
- Condição: `se: {pergunta: pN, igual: valor}`. Referência apenas a pergunta anterior, de escolha simples, múltipla, imagem ou número/nota/escala. Escolha múltipla usa pertencimento. Referências ausentes, futuras, ao próprio campo e valores incompatíveis são recusados. Uma origem oculta não ativa descendentes. Sem executar expressões ou código.
- Perguntas ocultas preservam respostas e observações no rascunho, mas ficam fora de progresso, pendências e entrega. Paginar as perguntas visíveis em blocos de seis; a numeração permanece estável. Antes de alterar a estrutura durante ditado, proteger os controles que governam condições; outros campos e controles seguros de edição continuam utilizáveis. Não aplicar ditado a campo removido.
- Todos os formatos geram texto legível e conteúdo compacto, com itens, ordem, faixas, pontuação e observações correspondentes; nunca `[object Object]`.
- Sem hospedagem adicional, nova conta, dependência global ou publicação remota nesta etapa. Dados e evidências privados permanecem fora da cópia pública.

## Ajustes após o teste humano — 0.4.4

Esta seção registra a iteração anterior. Para data/hora e confirmação da ordem, prevalecem as regras de 0.4.5 abaixo.

- Evidência recebida pelo aplicativo: respostas dos novos formatos e dos nove tipos antigos chegaram organizadas à conversa. O título do formulário menciona 0.4.1 e não comprova a versão do processo que o exibiu. O teste identificou ausência de retorno claro no botão de confirmar ordem, necessidade de limitar pontos durante a edição e preferência por rever a apresentação das estrelas.
- Ordenação: confirmar sem movimentar deve persistir a permutação inicial como resposta humana, atualizar o progresso e mostrar confirmação no próprio controle. Após confirmar, o botão informa “Ordem confirmada”; mover novamente informa a alteração e permite confirmar outra vez. A indicação de confirmação registra a escolha humana; o estado global continua responsável por confirmar ou recusar o salvamento. Não prometer gravação antes da resposta do servidor.
- Pontos no painel: máximo disponível por critério é o total menos os valores dos demais. Atualizar os limites e mostrar o saldo durante a edição. Recusar imediatamente uma nova digitação que exceda o saldo, seja negativa ou fracionada; preservar o último valor aceito e informar a recusa no próprio controle. Permitir limpar ou reduzir valores. Rascunhos antigos acima do total continuam abrindo: permitir reduções para corrigir o excesso, sem reescrever os outros critérios. A validação do servidor continua permitindo rascunho parcial e exigindo soma exata na entrega.
- Novo tipo data_hora: uma pergunta, um campo nativo de data e horário e uma observação comum com ditado. Resposta local no formato AAAA-MM-DDTHH:mm, com calendário real, ano entre 0001 e 9999 e hora de 00:00 a 23:59. Não converter para UTC nem assumir fuso adicional. Entrega legível DD/MM/AAAA às HH:mm; conteúdo compacto conserva a resposta local original. Sem resposta ou preenchimento incompleto deixa a pergunta pendente. Formato 3 e escopo próprio: versões até 0.4.2 não listam nem abrem esses formulários. O servidor novo lê os formatos legados, 2 e 3, sem migração ou reescrita; data e hora existentes ficam preservadas.
- Estrelas: três imagens independentes apresentadas; a pessoa selecionou a primeira. Recriar a sequência de estrelas clicáveis, com preenchimento até a nota escolhida e resumo numérico abaixo. Preservar resposta numérica, mínimo e máximo atuais, seleção zero quando permitida, navegação por teclado, observação e ditado. Nenhuma nota inicial automática. Usar ícone de biblioteca com licença distribuída; demais alternativas são somente propostas históricas. Correções de ordem, pontos e data_hora não dependem de mudança de organização do painel.
- Outras combinações: apresentar como propostas para avaliação, sem acrescentar automaticamente um construtor genérico ou novos tipos não escolhidos.
- Instalar somente a versão completa 0.4.4, conservar componentes de versões anteriores, rascunhos e restrições de foco. Sem reinício do Codex, novo chat ou publicação remota.

## Correção do reteste humano — 0.4.5

- Data_hora deve apresentar duas colunas na mesma pergunta: Data e Hora, com inputs nativos date e time, observação comum e tipos declarados nos atributos. Validar calendário real, ano 0001–9999, horário 00:00–23:59 e minuto inteiro. Letras e valores incompatíveis são recusados durante a edição com aviso visível e preservação do último valor válido; entrada nativa incompleta fica pendente.
- Resposta conserva o texto local AAAA-MM-DDTHH:mm. Rascunho pode guardar apenas uma parte válida como AAAA-MM-DDT ou THH:mm; entrega exige ambas. Nenhuma conversão de fuso. Novos formulários com esse controle usam formato 4 e escopo próprio, que servidores anteriores não leem. Um formulário de formato 3 é promovido atomicamente ao formato 4 no primeiro salvamento ou preparação pela versão nova, preservando IDs, conteúdo e proteção de concorrência. Sem alteração de outros formatos nem migração em leitura.
- Confirmar ordem deve aguardar o resultado real do salvamento. Enquanto confirma, bloquear ações locais de ordenação; mostrar sucesso somente com confirmação do servidor e falha visível se ele recusar. Ao reabrir uma resposta já guardada, manter indicação de ordem confirmada; nova movimentação permite confirmar novamente. A fila global continua preservando erros, dados de origem e edição dos demais campos.
- Cada versão usa URI de interface própria para solicitar seu conteúdo ao aplicativo. O endereço estável anterior continua legível como alias de compatibilidade; ferramentas anunciam somente a URI da versão atual. Exibir a versão junto à origem do painel. Isso torna distinguível uma aba antiga; a abertura real ainda exige prova no aplicativo, sem presumir sucesso pelo recurso servido.
- Preservar estrelas selecionadas, pontos, tipos anteriores, paginação, observações, ditado e foco da conversa. Sem reiniciar o Codex, criar chat ou publicar. A renovação, quando necessária, será restrita ao plugin próprio e seus dados serão preservados.

## Recuperação de concorrência e faixa — 0.4.6

- Evidência humana: a confirmação da ordem recebe recusa de versão, repete a mesma versão antiga e não se recupera. Uma faixa com mínimo 11 e máximo 4 permanece no rascunho; o avanço informa incorretamente apenas que falta uma resposta.
- Preservar a proteção de concorrência do servidor. O painel guarda uma base confirmada e compara cada resposta, observação e observações gerais com a versão atual. Alterações em campos diferentes podem ser conciliadas automaticamente; valores iguais também não constituem conflito. Nunca substituir silenciosamente duas alterações diferentes no mesmo campo. A ordem dos itens é parte da resposta.
- Na recusa identificada pelo código de conflito, ler a versão atual e fazer no máximo uma nova tentativa automática. Se houver entrega em preparação, mudança incompatível do formulário ou novo conflito, preservar o preenchimento e informar o impedimento. Não reutilizar indefinidamente a versão recusada. A fila deve conservar edições posteriores e respostas recebidas de outra aba; sucesso depende de gravação confirmada ou leitura que comprove conteúdo idêntico já salvo.
- Conflito real oferece as escolhas existentes. “Guardar meu preenchimento” prefere a escolha local somente nos campos disputados e conserva campos remotos sem alteração local. “Usar versão salva” carrega a versão confirmada. Nenhuma escolha é tomada pela pessoa usuária. Não trocar a conversa, perder o foco de edição ou remover destino de ditado durante a conciliação.
- Intervalo mantém duas colunas e o contrato de rascunhos antigos. Durante nova edição, o mínimo fica limitado pelo máximo informado e o máximo pelo mínimo. Recusar imediatamente uma nova inversão, valor fora dos limites ou do passo; preservar o último valor aceito e mostrar aviso no próprio controle. Rascunho antigo invertido abre intacto e aceita limpeza ou mudanças que reduzam a diferença até corrigir. Nunca inverter, limitar ou preencher valores automaticamente.
- Ao avançar ou entregar, uma faixa invertida recebe mensagem específica com os valores mínimo e máximo. Uma faixa parcial informa qual limite falta. Os demais formatos, seis perguntas por página, observações, ditado e entregas permanecem com o comportamento documentado.
- Conferir fonte, protocolo e aplicativo separadamente. Sem reinício do Codex, outro chat, publicação remota ou substituição dos componentes de versões já instaladas.

## Matriz de entradas, saídas e fronteiras

Conferência posterior do pacote 0.4.3 detectou uma etiqueta antiga de versão na interface antes da instalação. Pacote final passa a 0.4.4: painel e servidor importam uma única versão do package.json. Componentes 0.4.3 já preparados foram preservados e não instalados; nenhum conteúdo de versão existente foi sobrescrito.

| Situação | Resultado |
|---|---|
| Formulário antigo | Abrir, guardar e entregar como antes |
| Novo formato consultado por servidor antigo | Não listado nem aberto pelo escopo legado |
| Tabela com cinquenta itens | Cinquenta linhas com observações, nove páginas |
| Ordem inicial não confirmada | Pergunta pendente |
| Ordenação com item repetido ou ausente | Recusa |
| Imagem ausente ou inválida | Aviso visível, sem imagem substituta |
| Imagem de formulário de outro dono | Recusa antes da leitura do arquivo |
| Pontos não totalizam o orçamento | Guardar rascunho, bloquear conclusão |
| Intervalo incompleto ou invertido | Guardar estado editável, bloquear conclusão |
| Lista com linhas vazias | Preservar no rascunho, omitir as vazias da entrega conforme aviso |
| Condição deixa de ser satisfeita | Ocultar pergunta e conservar dados locais, sem enviar |
| Condição volta a ser satisfeita | Restaurar preenchimento anterior |
| Ditado em andamento | Proteger destino, condições, navegação e entrega |
| Falha no salvamento ou excesso | Preservar texto e mostrar erro |
| Entrega confirmada | Encerrar somente o rascunho confirmado |

## Mapa dos arquivos

- `src/formulario.mjs` e módulo de formatos: definições, validação, condições e entrega.
- `src/servidor.mjs`: contrato MCP compacto e compatível.
- `src/repositorio.mjs`: isolamento de formulários avançados e acesso aos legados.
- `src/interface.mjs`, módulo de controles e `web/painel.html`: novos controles no painel existente.
- `src/imagens-desktop.mjs`, `src/servidor-desktop.mjs` e `src/aplicativo.mjs`: imagens locais privadas.
- `testes/`: casos de regressão, persistência, condições, limites e tipos novos.
- `docs/evidencias/formatos-20261014/`: tarefa, lista de arquivos e prova separada de protocolo e interface.

## Tarefas e aceite

- [x] Ler contratos, código, skills e restrições; escopo aprovado pelo usuário.
- [x] Implementar formatos, condições e validação com compatibilidade.
- [x] Implementar controles, apresentação de notas e imagens privadas.
- [x] Validar salvamento, retorno, isolamento entre versões e entrega legível pelo protocolo real, em banco isolado.
- [x] Executar lint e regressões; auditoria da cópia pública registrada na evidência da tarefa.
- [x] Construir e instalar o plugin completo 0.4.2; início por carregador oficial conferido.
- [ ] Conferir os controles na interface MCP nativa sem reiniciar o aplicativo.
- [x] Preparar evidências, lista de arquivos e histórico para o registro local da tarefa.

## Verificação

Testes complementam a prova de uso; não equivalem a clique real no painel. Validar explicitamente a versão ativa, os novos controles, escolhas, ordenação, somas, intervalo, lista, condições e retorno ao chat. Preservar e reabrir um formulário antigo. Não declarar atualização do painel baseada somente na instalação.

Em 2026-10-14, lint, construção, verificação do comando distribuído e 81 testes passaram. Duas versões reais do servidor preservaram os nove tipos legados e exercitaram respostas estruturadas, imagens, preparação e confirmação em banco isolado. O carregador oficial iniciou 0.4.2. A conexão da conversa serviu inicialmente o recurso 0.4.1 e, após uma nova resposta da pessoa usuária, passou a servir 0.4.2. Um formulário completo com 21 itens foi criado pela ferramenta da própria conversa; a pessoa confirmou sua exibição com os 20 itens inicialmente visíveis, pois uma pergunta é condicional. A automação nativa falhou antes de ler a tela com erro de gravação dos assets do kernel; cliques reais e entrega dos novos formatos no painel não estão confirmados.

## Histórico de mudanças

- 2026-10-14 — Recebida entrega real pelo aplicativo MCP do formulário curto com ordenação, pontos, avaliação e data/hora. Leitura diagnóstica confirmou ausência do registro concluído no banco. A mensagem não informou versão de origem; a conexão da conversa continuou anunciando 0.4.5. Evidência confirma recebimento dos quatro formatos e encerramento do rascunho, sem comprovar recarga para 0.4.6, recuperação de concorrência ou validação do intervalo, ausente desse formulário. Reteste específico permanece pendente.

- 2026-10-14 — Correção 0.4.6 após capturas humanas de conflito da ordem e faixa invertida: metadado de erro preservado no transporte; conciliação por campo com base confirmada, uma nova tentativa e escolha explícita para alterações diferentes. Recuperação conserva campos remotos independentes, digitação enfileirada e destino do ditado. Intervalo atualiza limites entre campos, recusa nova inversão e valores inválidos, preserva rascunhos antigos para correção e informa o motivo específico no avanço. Lint, 106 testes, construção, comando distribuído e protocolo isolado 0.4.5/0.4.6 passaram. Instalação oficial 0.4.6 e início pelo leitor independente confirmados, sem reiniciar o Codex. Esta conversa ainda serviu interface 0.4.5; reteste nativo da correção permanece pendente. Sem escrita de respostas humanas ou publicação remota.

- 2026-10-14 — Correção 0.4.5 após relato humano: Data e Hora em duas colunas com tipos nativos e validação durante a edição; rascunhos parciais válidos e formato 4, com promoção atômica do formato 3 somente em escrita. Confirmação da ordem aguarda confirmação real do salvamento, informa falha e permanece identificada ao reabrir. Interface anuncia URI por versão, conserva alias e exibe versão na origem. Lint, construção, 90 testes, comando distribuído e protocolo real entre 0.4.4 e 0.4.5 passaram. Plugin próprio desinstalado e reinstalado em 0.4.5 sem reiniciar o Codex; dados preservados. Conexão desta execução removida na reinstalação e ainda não redisponibilizada após resposta pelo cartão; abertura e reteste nativos continuam pendentes. Automação de tela e Windows falharam antes de executar ações.

- 2026-10-14 — Entrega humana recebida pelo MCP com respostas dos formatos novos e antigos e observações sobre ordem, pontos e estrelas. Apresentadas três imagens; primeira escolhida e implementada. Fonte final 0.4.4 acrescenta data_hora com formato 3, limites dinâmicos de pontos e confirmação visível da ordem. Versão única do pacote usada no painel e nos servidores; diagnóstico verifica coerência. Lint, construção, 87 testes e protocolo entre 0.3.6-ditado.6, 0.4.2 e 0.4.4 passaram. 0.4.4 instalada sem reiniciar o aplicativo; conexão desta conversa ainda reportou 0.4.2. Validação visual e reteste nativo dos ajustes pendentes, com conferência visual marcada como bloqueada.

- 2026-10-14 — Escopo completo aprovado; especificados formatos, apresentações, condições, isolamento de dados novos e preservação dos tipos existentes. Implementação e prova operacional pendentes.
- 2026-10-14 — Implementados seis formatos, estrelas, emojis, barra e condições na fonte 0.4.2; tipos anteriores, observações, ditado e layout preservados no código. Corrigidos contraste das estrelas, preferência pelo catálogo construído, argumentos portáteis, diretório de trabalho persistente e leitura de assets da cópia persistente. Lint, 81 testes, comando distribuído e protocolo entre versões passaram. Instalação conferida separadamente da conexão ativa. Validação visual nativa e entrega real dos novos formatos permanecem pendentes por falha da automação; sem reinício do aplicativo, novo chat ou publicação remota.
- 2026-10-14 — Recurso ativo da conversa confirmado em 0.4.2 após nova resposta humana; ferramenta da conversa criou formulário completo e a pessoa confirmou sua exibição com 20 itens inicialmente visíveis. Auditoria da cópia pública: 61 fontes, 13 gerados anteriores e zero referências pessoais detectadas. Interação e entrega nativas completas ainda não confirmadas; evidência e fonte preparadas para registro Git local.
