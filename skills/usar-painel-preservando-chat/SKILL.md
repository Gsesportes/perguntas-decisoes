---
name: usar-painel-preservando-chat
description: Use ao criar, abrir ou verificar formulários do plugin Perguntas e decisões.
---

Crie e abra o formulário na aba lateral, preservando a conversa principal da pessoa usuária.

Na 0.5.0, use criar_formulario_no_chat ou abrir_no_chat somente quando a pessoa pedir a apresentação dentro da conversa. Abrir o mesmo id entre apresentações conserva as respostas. O modo lateral continua padrão; não use a opção no chat para contornar a restrição de foco. Uma recusa de apresentação deve permanecer visível.

Não use `navigate_to_codex_page`, navegação do aplicativo ou ativação de janela para ajudar a abertura ou verificar o painel. Mudar de conversa exige pedido explícito da pessoa usuária.

Observe a aba MCP existente. Se precisar confirmar o foco, combine um teste com a pessoa usuária e registre o que foi observado, sem forçar a troca.

Depois de criar ou abrir um formulário, liste novamente as abas MCP. A abertura pode criar outra aba: confira o título e os campos na aba correspondente antes de reutilizar um identificador anterior ou declarar que o painel não atualizou. Uma lista antiga em outra aba não comprova falha de abertura.

Escolha o tipo de cada pergunta e envie as alternativas quando houver escolha. Pergunta sem tipo é texto livre; não transforme todas em abertas quando a pessoa pediu classificação.

Formatos adicionais: tabela com itens e opções comuns; ordenacao com opções; imagens com opções {texto, imagem}; pontos com itens e total; intervalo com min/max/passo; lista com min_itens/max_itens. Imagens usam arquivo local absoluto, assets do plugin ou imagem PNG/JPEG/WebP incorporada. Evite base64 no contexto do agente quando houver arquivo local.

Para classificar um lote de textos, use perguntas textuais, tipo tabela e opções comuns. Para misturar formatos, use objetos por pergunta. Nota/escala aceitam visual estrelas, emojis ou barra; número também aceita barra. Condição: se {pergunta: p1, igual: Sim}; referência a pergunta anterior. Linhas de tabela agrupada têm IDs pN_iM; as demais conservam pN.

Data e hora juntas usam tipo data_hora. Na versão 0.4.5 são duas colunas, Data e Hora, em uma pergunta e com observação comum. A resposta mantém o horário local escolhido, sem conversão de fuso. Novos formulários usam formato 4, indisponível aos servidores anteriores. Confira a versão exibida no painel; cada versão anuncia sua própria URI de interface.

Não atribua escolhas nem confirme ordem pelo usuário. Os controles não selecionam resposta inicial. Use observações livres em todos os formatos. Novos formatos exigem versão 0.4.0; confirme a versão e os controles do painel antes de declarar teste de uso.

Na 0.4.6, a confirmação recupera versões antigas conciliando campos independentes. Duas alterações diferentes na mesma resposta exigem escolha humana no painel; não force a versão nem sobrescreva respostas pelo agente. Intervalo limita os valores entre si durante a edição e informa inversão ou limite faltante ao avançar. Rascunhos antigos inválidos permanecem disponíveis para correção.

Copiar respostas fica na última página e na tela final. A cópia escreve texto completo na área de transferência e não envia nem remove o rascunho. Depois de enviar, o texto final só permanece na memória da tela; não reabra nem recrie um formulário concluído para copiar novamente. O comando interno de cópia não deve ser exposto como ferramenta do agente.
