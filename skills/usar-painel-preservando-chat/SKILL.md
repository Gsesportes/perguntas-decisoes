---
name: usar-painel-preservando-chat
description: Use ao criar, abrir ou verificar formulários do plugin Perguntas e decisões.
---

Use a barra lateral direita como apresentação principal e padrão. Crie com `criar_formulario` e reabra com `abrir_painel`.

Somente quando a pessoa usuária pedir explicitamente o formulário dentro da conversa, crie com `criar_formulario_no_chat` ou reabra com `abrir_no_chat`. O modo inline é opcional e não substitui o padrão lateral. Para trocar a apresentação de um formulário existente, use seu mesmo id; não crie outro formulário.

As duas apresentações compartilham respostas, observações e progresso. Confira o modo efetivamente confirmado pelo aplicativo; não declare a apresentação solicitada como comprovada quando o anfitrião não a confirmar.

Não use `navigate_to_codex_page`, navegação do aplicativo ou ativação de janela para ajudar a abertura ou verificar o painel. Mudar de conversa exige pedido explícito da pessoa usuária.

Observe a aba MCP existente. Se precisar confirmar o foco, combine um teste com a pessoa usuária e registre o que foi observado, sem forçar a troca.
