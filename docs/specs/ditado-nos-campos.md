---
titulo: 'Ditado nos campos de resposta e observação'
tipo: 'funcionalidade'
criado: '2026-10-12'
estado: 'em-validacao-no-formulario-completo'
contexto: []
---

## Intenção

Implementar “a transcrição nos campos de resposta e observação, sem mudar o layout nem reiniciar o app, e teste de verdade no painel do plugin”. Esta etapa amplia o protótipo de captura já comprovado; as exclusões de transcrição daquele protótipo permanecem como histórico da etapa anterior.

## Fronteiras e restrições

- Windows e Codex desktop; preservar a identidade do plugin, o armazenamento de rascunhos e as entregas existentes.
- Ditado em português, local, por Whisper base multilíngue e whisper.cpp v1.9.2 CPU. Download inicial verificado por SHA-256; nenhum envio de áudio, API paga ou reaproveitamento de credenciais do aplicativo.
- Modelo e motor em diretório próprio do perfil, fora do cache do plugin. Não instalar dependência global.
- Captura PCM mono de 16 bits e 16000 Hz em memória, limitada a sessenta segundos. Parar confirma o trecho; cancelar descarta. Um único ditado por conexão e mutex por sessão Windows.
- Liberar microfone antes da inferência. Usar stdin binário para o motor, sem criar WAV, arquivo de transcrição ou histórico de áudio.
- No whisper.cpp 1.9.2, usar prefixo lógico de saída diferente de '-' e não habilitar formatos de arquivo. Isso conserva o retorno do texto pelo pipe no Windows, evitando a saída CON. Código de saída zero com texto vazio é erro da integração, sem atribuir automaticamente falta de fala ao usuário.
- Acrescentar texto às respostas de tipo texto, observações individuais e observações gerais. Não converter fala em escolhas, datas, números ou notas por inferência.
- Fixar formulário, pergunta, campo e valor original ao iniciar. Bloquear navegação e entrega durante o ditado; não aplicar retorno atrasado a outro campo ou a texto alterado.
- Preservar o texto existente. Validar limites antes de aplicar; excesso deve ser erro visível, sem truncamento.
- Acrescentar somente controles pequenos de microfone dentro dos campos existentes. Preservar posições, dimensões, paginação, cores e botões de entrega.
- Comandos de ditado privados da interface; áudio e transcrição intermediária fora do contexto do agente. O texto só integra a conversa pelas entregas já existentes e solicitadas pelo usuário.
- Não reiniciar o aplicativo, não criar chat, não encerrar processos de outros agentes nem executar recarga global de MCPs pelo agente. Confirmar os controles presentes na interface antes de orientar reconexão e alinhar qualquer reinício do motor compartilhado. O usuário informou que não existe Atualizar MCPs na sua interface; não repetir essa orientação. Usar instalação suportada do próprio pacote; não editar cache à mão.
- Componentes executáveis e servidor vinculados pelo instalador ficam versionados em pasta própria do perfil, fora do cache descartável. Conservar versões anteriores e recusar sobrescrita de uma versão por bytes diferentes. Isso não equivale a atualizar a conexão já carregada.
- Não apresentar reconhecimento próprio como microfone nativo do Codex. Reutilização do ditado do anfitrião exige uma capacidade pública confirmada; aparência de botão, permissão genérica de microfone e código privado do aplicativo não comprovam essa integração.
- Prova exige fala real no painel MCP nativo, texto reconhecido no campo certo, revisão e persistência do rascunho. Compilação, lint, áudio sintetizado e testes de unidade são verificações complementares.
- Usar a tela principal completa do plugin, com perguntas, observações, paginação e entregas existentes. Um diagnóstico separado de áudio não satisfaz a apresentação nem o aceite solicitado.

## Matriz de entradas, saídas e fronteiras

| Situação | Resultado |
|---|---|
| Clique no microfone de resposta de texto | Iniciar sessão vinculada àquela resposta |
| Clique no microfone de observação | Iniciar sessão vinculada àquela observação |
| Parar | Fechar dispositivo, transcrever e acrescentar texto revisável |
| Cancelar ou fechar a interface | Interromper processo próprio e descartar áudio e texto intermediário |
| Silêncio ou reconhecimento vazio | Informar ausência de fala reconhecida; preservar o campo |
| Motor encerra com código zero, mas não devolve texto | Informar falha de retorno do motor; não tratar como prova de silêncio |
| Modelo ou motor ausente | Erro visível com orientação de preparo; não iniciar captura |
| Texto maior que o limite | Recusar inserção sem truncar ou apagar texto anterior |
| Outra captura ativa | Recusar a segunda |
| Troca de formulário ou versão durante a operação | Preservar campo e informar conflito |
| Falha, prazo ou saída inesperada do motor | Encerrar somente o filho próprio; erro visível |
| Versão anterior ainda carregada | Relatar estado real; não declarar navegador externo como painel nativo |

Durante a gravação, o controle existente mostra um quadrado de parada. Após erro, o rodapé mostra Ditado não aplicado. A mudança de desenho usa o mesmo botão, posição e dimensões; não altera o layout.

## Mapa dos arquivos

- `native/CapturaMicrofone.cs`: captura WinMM com áudio em memória, parada e cancelamento separados.
- `src/ditado-desktop.mjs`: controlador de captura e reconhecimento, prazos e sessões privadas.
- `src/ditado-interface.mjs`: microfones e proteção do destino.
- `src/interface.mjs` e `src/aplicativo.mjs`: ligação ao rascunho e chamadas MCP.
- `src/servidor-desktop.mjs`: operações privadas de ditado.
- `web/painel.html`: controles posicionados dentro dos campos existentes.
- `scripts/preparar-ditado.mjs`: download local com hashes e atribuições.
- `scripts/empacotar-desktop.mjs`: componente nativo e versão do pacote.
- `testes/ditado.test.mjs`: limites e proteção do destino sem áudio fictício como prova.
- `docs/evidencias/ditado-20261012/`: checklist, relatório e capturas reais.

## Tarefas e aceite

- [x] Ler contratos, pesquisa, código e prova de captura anterior.
- [x] Preparar e verificar motor e modelo locais.
- [x] Implementar captura, parada, cancelamento e transcrição sem arquivo de áudio.
- [x] Integrar respostas de texto e todas as observações mantendo a estrutura e os estilos base; conferência visual pendente.
- [ ] Conferir limites, concorrência, retenção e erros.
- [x] Construir e instalar somente o próprio plugin.
- [x] Preservar os componentes usados por novas conexões fora do cache descartável; conexão antiga ainda depende de reconexão pelo aplicativo.
- [x] Criar formulário real de dez perguntas, com todos os tipos, observações e duas páginas.
- [x] Abrir esse formulário na tela principal completa; abertura estrutural conferida no painel MCP nativo.
- [ ] Testar fala real na resposta e observação pelo painel MCP nativo.
- [ ] Verificar persistência, texto prévio e revisão manual.
- [x] Executar lint e testes apropriados.
- [x] Registrar evidências, arquivos e histórico parcial em Git local; conclusão depende da prova nativa.

## Verificação

Distinguir captura, reconhecimento, inserção no campo, salvamento e entrega. Conferir cada etapa; não enviar formulários reais nem publicar no GitHub nesta rodada.

## Histórico de mudanças

- 2026-10-12 — Escopo autorizado; iniciada implementação local de ditado preservando layout e aplicativo aberto.
- 2026-10-12 — Implementados captura até sessenta segundos, parada, cancelamento, transcrição local em memória e microfones nos campos. Motor v1.9.2 e modelo base preparados com hashes; versão 0.3.6-ditado.2 construída e instalada. Lint, 51 verificações e protocolo em banco isolado aprovados. A conexão ativa continuou no diagnóstico anterior mesmo após seleção do plugin; fala real, inserção e validação visual da nova interface permanecem pendentes. Sem reinício do aplicativo, recarga global ou publicação. Evidências em docs/evidencias/ditado-20261012/RELATORIO.md.
- 2026-10-12 — Conferência posterior à instalação da iteração 2 continuou retornando o diagnóstico anterior. Fonte registrada em branch local e auditada sem referências particulares; provas privadas preservadas separadamente. Próxima tentativa depende de nova mensagem comum nesta conversa, sem garantia antecipada de recarga; aceite de fala real permanece aberto.
- 2026-10-12 — Usuário exigiu a tela completa do plugin. Corrigido vínculo principal que apontava para arquivo ausente da 0.3.5, com erro confirmado no log. Criado pelo MCP real o formulário Perguntas e decisões — teste completo, com identificador registrado na evidência privada, dez perguntas de todos os tipos, duas páginas, versão de rascunho 1 e nenhuma resposta pré-selecionada. Usuário informou recarga de MCPs; a execução ativa ainda não dispõe do cliente principal pronto. Abertura visual e teste de fala permanecem pendentes; não criar nova versão isolada de áudio nem duplicar o formulário.
- 2026-10-12 — Após reinício informado pelo próprio usuário, aberta e conferida estruturalmente a tela principal completa, com perguntas, escolhas e microfones. Primeira tentativa de ditado no campo falhou ao abrir o dispositivo (código WinMM 1); aberturas diretas sem captura passaram. Repetição manual solicitada; reconhecimento, inserção, persistência e correção do status de erro permanecem pendentes. Captura de tela indisponível por timeout da automação; nenhum novo reinício do aplicativo ou mudança de permissões executado pelo agente.
- 2026-10-12 — Componente instalado capturou e encerrou 261 ms por execução direta, sem reconhecimento ou retenção, enquanto a repetição de fala no painel aguardava resposta. Comparações de permissões, identidade de pacote e integridade dos processos não explicaram a diferença; causa não atribuída por hipótese. Corrigida na fonte a mensagem do rodapé após falha, com lint e 21 verificações aprovados; correção de texto ainda não instalada na aba em teste. Transcrição real nos campos permanece sem aceite.
- 2026-10-12 — Usuário confirmou fala sem texto no formulário completo. Reproduzido retorno vazio do whisper.cpp 1.9.2 no Windows com entrada stdin e saída especial CON; corrigidos os argumentos de produção com prefixo lógico de saída, sem formato de arquivo. Frase sintetizada localmente passou a retornar texto em 7151 ms; isso não equivale à fala humana no painel. Iteração 0.3.6-ditado.3 inclui status de erro corrigido e ícone de parada no botão existente, com layout preservado, lint e 52 verificações aprovados. Pacote instalado pelo CLI oficial e vínculo temporário de diagnóstico retirado. Recurso MCP da conexão ativa ainda identifica a iteração 2; reconexão suportada e prova humana de inserção, revisão e persistência permanecem pendentes. Nenhum reinício do aplicativo, novo chat ou publicação. Evidências e arquivos em docs/evidencias/ditado-20261012/RELATORIO.md.
- 2026-10-12 — Usuário reportou ENOENT do capturador da iteração 2 e ausência de Atualizar MCPs. Confirmada remoção da pasta antiga enquanto conexões ainda a utilizavam. Instalador corrigido para componentes versionados fora do cache; versão 0.3.6-ditado.3 preservada e vínculo próprio atualizado pelo CLI. Servidor real iniciou nessa cópia em banco isolado; configuração externa ao vínculo permaneceu igual, lint e 54 verificações passaram. A conexão desta conversa continua falhando; fala humana no painel segue pendente. Pesquisa da referência pública e do aplicativo não encontrou acesso suportado ao ditado nativo por plugins. Orientação de Atualizar MCPs retirada; nenhum reinício, novo chat, edição manual do cache ou publicação executado. Relatório registra evidências, arquivos e limite da prova.

