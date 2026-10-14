# Perguntas e decisões

Plugin local para reunir perguntas e classificações no painel lateral do Codex desktop.

![Logo](assets/logo-verde.png)

## Requisitos

Windows, Node.js 24 ou superior disponível pelo comando `node` e Codex desktop com plugins, MCP Apps e OpenAI Extensions. A instalação e o início do MCP foram conferidos na CLI 0.162.0-alpha.17.2. ChatGPT web, celular e nuvem não integram esta versão; outros anfitriões podem oferecer apenas parte das entregas.

## Instalação rápida em outro PC

A fonte local está na versão 0.4.5, com os formatos adicionais e ajustes após teste de uso. O pacote público abaixo continua na versão 0.3.5 e ainda não contém esses formatos nem o ditado local. Construir e instalar a fonte segue as instruções seguintes; isso não comprova recarga de um painel já aberto.

1. Instale o Codex desktop e [Node.js 24 ou superior](https://nodejs.org/en/download).
2. Na página do projeto no GitHub, abra **Releases** e baixe **perguntas-decisoes-instalar-0.3.5.zip**.
3. Extraia o ZIP inteiro e abra **Instalar.cmd** dentro da pasta extraída.
4. Depois da confirmação, selecione **Perguntas e decisões** no menu `@` do Codex.

O pacote está construído e não exige npm ou compilação. O instalador confere os requisitos, conserva o catálogo na pasta local do perfil e registra o plugin e seu servidor. Não reinicia o aplicativo e não apaga rascunhos. Se faltar Node ou Codex, mostra a causa e encerra.

Instalar arquivos não confirma que uma conexão já aberta carregou a versão nova. Fechar somente a aba pode não atualizar o servidor. Para conferir os requisitos sem instalar, execute `Instalar.cmd --verificar`.

Se houver um catálogo do mesmo plugin registrado em outra pasta, a instalação para de forma visível para preservar o registro existente. Esse caso requer o fluxo de atualização da instalação anterior.

## Construir e conferir a fonte

Abra um terminal na pasta do projeto:

```powershell
node --version
npm ci
npm run verificar
npm run package:desktop
npm run verificar:desktop
```

O diagnóstico inicia o comando do próprio manifesto com banco isolado. Confere protocolo, duas ferramentas visíveis e retomada. Isso não comprova abertura ou entrega na interface nativa.

## Instalar no Codex

Depois de construir, no Windows:

```powershell
node scripts/instalar-desktop.mjs
```

O instalador usa a CLI compatível fornecida pelo aplicativo, registra o catálogo e instala no perfil. O projeto não inclui nem altera o executável do Codex.

Na fonte em validação, os componentes ficam em `%LOCALAPPDATA%/PerguntasDecisoes/componentes/<versão>`. O plugin fornece seu próprio servidor MCP, cujo capturador usa essa cópia fora do cache descartável. O instalador não cria uma segunda conexão global para a mesma ferramenta. Atualizar conserva componentes anteriores para conexões que ainda os utilizam. Não são respostas nem histórico de áudio. A correção ainda não integra o ZIP público 0.3.5.

Os caminhos do perfil são resolvidos no computador; nenhum caminho pessoal faz parte do pacote distribuído. No catálogo pronto, `Instalar.cmd` executa esse mesmo instalador a partir da pasta extraída, sem etapa de construção. Uma versão existente com conteúdo diferente é recusada, preservando seus arquivos; alterações dos componentes precisam de nova versão.

Selecione **Perguntas e decisões** no menu `@` da conversa. Para abrir manualmente: **Ferramentas → Mais ferramentas → Plugins e MCPs → Perguntas e decisões**. A localização do menu depende da versão do aplicativo.

A renovação de conexões antigas depende do aplicativo. Salve os trabalhos antes de decidir reabrir o Codex. Nenhum script deste projeto reinicia o aplicativo.

## Uso pelo agente

Chame `criar_formulario` com alternativas comuns:

```json
{"titulo":"Classificação","perguntas":["Item A","Item B","Item C"],"tipo":"unica","opcoes":["Aprovar","Ajustar","Deixar pendente"]}
```

Para misturar tipos:

```json
{"perguntas":[{"texto":"Concorda?","tipo":"sim_nao"},{"texto":"Sua nota","tipo":"nota","min":1,"max":5},"O que deseja acrescentar?"]}
```

As duas ferramentas visíveis são `criar_formulario` e `abrir_painel`. Ao criar, o modelo recebe identificador e quantidade; perguntas, rascunhos e operações internas ficam nos metadados da interface. As respostas entram no contexto quando a pessoa escolhe entregá-las.

Para medir os bytes das definições:

```powershell
node --input-type=module -e "import { FERRAMENTAS } from './src/servidor.mjs'; console.log(new TextEncoder().encode(JSON.stringify(FERRAMENTAS.filter(f => f._meta?.ui?.visibility?.[0] !== 'app'))).length)"
```

Bytes não são tokens. Interface construída e rascunhos não são repetidos na definição das ferramentas.

## Preencher e entregar

- Seis perguntas por página. Anterior conserva conteúdo; Próximo exige respostas da página.
- Sim/não, escolha única, múltipla, texto, nota, escala, número, data e hora; a partir da fonte 0.4.0, também tabela, ordenação, imagens, pontos, intervalo e lista.
- Data_hora reúne duas colunas, Data e Hora, na mesma pergunta, com uma observação comum. A partir de 0.4.5, valores inválidos são recusados durante a edição e uma parte válida pode ser guardada enquanto a outra está pendente. A entrega exige as duas. Não há conversão para UTC ou adição de fuso.
- Ordenação aguarda a confirmação do salvamento antes de mostrar sucesso e conserva a indicação ao reabrir. Pontos mostram o saldo e atualizam o máximo por critério; uma digitação acima do saldo é recusada imediatamente, com aviso e manutenção do último valor aceito.
- Estrelas ficam em sequência clicável, preenchem até a nota escolhida e mostram o resumo numérico abaixo. A escolha continua sendo um número e observações permanecem livres.
- Alternativas visíveis em um clique; observações individuais e gerais opcionais.
- Entregas somente na última página.
- **Enviar ao chat:** solicita mensagem com o conjunto completo.
- **Inserir como anotação:** adiciona texto ao contexto do campo de mensagem, para acompanhar o que a pessoa escrever.
- **Anexar arquivo TXT:** adiciona recurso incorporado `text/plain`, com nome `respostas.txt`, ao contexto do campo de mensagem. A aparência depende do aplicativo; não equivale necessariamente a upload convencional.
- Modalidades não anunciadas ficam indisponíveis. Falhas são visíveis; entrega ambígua exige conferir a conversa antes de reenviar ou retomar.
- Trocas durante salvamento ou entrega aguardam a operação original. Não há seleção automática de outra conversa principal.
- Conflitos entre janelas conservam o texto local e oferecem duas escolhas explícitas: usar a versão salva ou guardar seu preenchimento sobre a versão atual. A confirmação perdida de uma preparação é conferida por sua chave antes de retomar.
- A lista oferece cem pendentes por vez e **Carregar mais formulários**.

## Formatos adicionais na fonte 0.4.2

Os nove tipos anteriores e seus rascunhos são preservados. Os formatos novos, apresentações e condições exigem servidor e painel 0.4.0. O servidor novo consulta formulários legados e avançados; conexões antigas não recebem os avançados para evitar controles incorretos. Essa evolução ainda não integra o ZIP público 0.3.5.

Classificação compacta, com observação e microfone por item, seis itens por página:

```json
{"titulo":"Classificar itens","tipo":"tabela","opcoes":["Aprovar","Ajustar","Rejeitar"],"perguntas":["Item A","Item B","Item C"]}
```

Exemplos de objetos para a lista `perguntas`:

```json
[
  {"texto":"Classifique este grupo","tipo":"tabela","itens":["Item A","Item B"],"opcoes":["Aprovar","Ajustar"]},
  {"texto":"Ordene as prioridades","tipo":"ordenacao","opcoes":["Clareza","Qualidade","Velocidade"]},
  {"texto":"Escolha a imagem","tipo":"imagens","opcoes":[{"texto":"Ícone","imagem":"assets/icone-128.png"},{"texto":"Logo","imagem":"assets/logo-verde.png"}]},
  {"texto":"Distribua a importância","tipo":"pontos","itens":["Clareza","Velocidade"],"total":100},
  {"texto":"Duração aceitável","tipo":"intervalo","min":0,"max":60,"unidade":"minutos"},
  {"texto":"Adicione sugestões","tipo":"lista","min_itens":1,"max_itens":20},
  {"texto":"Avalie com estrelas","tipo":"nota","visual":"estrelas"},
  {"texto":"Avalie com emojis","tipo":"escala","visual":"emojis"},
  {"texto":"Escolha na barra","tipo":"escala","visual":"barra","min":0,"max":100}
]
```

- Tabela agrupada expande cada item em uma pergunta, com IDs `pN_iM`; a forma curta conserva `pN`. Até 200 linhas por grupo e 1000 perguntas no formulário completo.
- Ordenação aceita de 2 a 100 alternativas distintas. Mova com Subir/Descer ou confirme a ordem apresentada; a ordem inicial não conta como resposta automática.
- Imagens aceitam de 2 a 20 alternativas. Cada imagem local deve ter até 1 MiB e formato PNG, JPEG ou WebP confirmado pelos bytes. A leitura privada usa somente referências declaradas naquele formulário; erro é visível. URLs remotas não são aceitas na versão local.
- Pontos aceitam de 2 a 30 critérios. O total padrão é 100, inteiro entre 1 e 1000000. Rascunhos parciais podem ser guardados; a entrega exige soma exata. Valores não distribuídos são zero.
- Intervalo permite guardar um extremo sozinho ou uma faixa ainda invertida; para entregar, preencha os dois valores com mínimo menor ou igual ao máximo, dentro dos limites e passo.
- Lista aceita de 1 a 200 entradas, com padrão máximo de 50 e até 2000 caracteres por entrada. Linhas vazias são preservadas no rascunho e excluídas da entrega conforme o aviso do controle.
- Estrelas usam valores inteiros até dez, com padrão de 1 a 5; emojis usam cinco níveis de 1 a 5. Barra permite mais valores conforme min/max/passo, sem preencher resposta automaticamente.
- Parâmetros incompatíveis são recusados, em vez de produzir uma pergunta diferente silenciosamente.

Pergunta condicional, usando referência estável à pergunta anterior:

```json
{"perguntas":[{"texto":"Quer detalhar?","tipo":"sim_nao"},{"texto":"Descreva o detalhe","se":{"pergunta":"p1","igual":"Sim"}}]}
```

Condições podem consultar escolha simples, múltipla, imagens, notas, escalas ou números. Na seleção múltipla, a condição verifica se a opção está marcada. Perguntas ocultas conservam preenchimento no rascunho e ficam fora de pendências, progresso e entrega; ao reaparecer, recuperam o texto. A origem de uma condição também precisa estar visível. Referências futuras, ao próprio campo e valores incompatíveis são recusados. A numeração dos itens permanece estável; a paginação considera somente perguntas visíveis.

Durante ditado, destino, perguntas que controlam condições, navegação e entrega permanecem protegidos. Outros campos e os controles seguros de edição de respostas podem ser usados. Observações continuam opcionais e livres em todos os formatos.

## Ditado local nos campos

Implementação em validação: a fala humana já produziu texto em resposta, observação individual e observações gerais no painel nativo, com entrega do conjunto ao chat. A fonte 0.3.6-ditado.6 acrescenta indicação animada, edição dos outros campos durante o processamento e até quatro tarefas de reconhecimento com o mesmo modelo; essas mudanças ainda dependem de prova na interface atualizada. Os botões usam reconhecimento local; a integração com o ditado nativo do Codex ainda não foi comprovada. O ZIP público 0.3.5 não contém esta evolução.

No Windows, respostas de texto, observações individuais e observações gerais têm um pequeno botão de microfone dentro do campo. Clique, aguarde o quadrado de parada com pulso e fale. Clique novamente para parar e transcrever; o limite por trecho é de sessenta segundos. O indicador giratório informa início, parada solicitada e processamento. O botão × ou a tecla Esc descarta o trecho. Depois de confirmar o início, outros campos continuam editáveis; o destino, a navegação e a entrega aguardam o ditado. A fala reconhecida é acrescentada ao texto existente e permanece editável antes da entrega.

Prepare o reconhecimento uma vez por computador, pela fonte:

```powershell
npm run preparar:ditado
```

No catálogo instalado, também pode ser executado o arquivo `server/preparar-ditado.mjs` com `node --use-system-ca`. O preparo baixa o motor CPU whisper.cpp v1.9.2 e o modelo Whisper base multilíngue, cerca de 150 MB, verificando os hashes. Não usa chave de API ou cobrança por minuto. Motor e modelo ficam em `%LOCALAPPDATA%/PerguntasDecisoes/voz` e conservam suas licenças MIT.

O reconhecimento usa português e roda no computador. Áudio passa somente por memória e canais locais entre processos, sem WAV temporário ou envio à internet. Texto reconhecido passa a integrar o rascunho existente; falhas e conflitos preservam o campo e aparecem na interface. A navegação e a entrega aguardam o término do ditado. Os comandos intermediários são privados do painel.

O ditado nativo do editor do Codex não foi encontrado como capacidade pública para plugins na [referência oficial](https://developers.openai.com/plugins/reference). Esta implementação usa reconhecimento próprio; não apresenta esse motor como o recurso nativo do aplicativo.

Fontes do motor e modelo: [whisper.cpp](https://github.com/ggml-org/whisper.cpp/tree/v1.9.2), [Whisper](https://github.com/openai/whisper).

## Armazenamento e limites

Rascunhos ficam em `%LOCALAPPDATA%/PerguntasDecisoes/rascunhos.sqlite`, fora do pacote e associados ao perfil Windows. O registro é removido após confirmação. Não há histórico próprio de entregas nem armazenamento remoto.

Limites individuais: até 1.000 perguntas; título de 200 caracteres; pergunta de 6.000; alternativa de 300; resposta e observação de 16.000; de 2 a 100 alternativas distintas; até 21 posições inteiras para nota ou escala.

Limites agregados em UTF-8: definição normalizada de 400.000 bytes; rascunho de 1.000.000; chamada MCP de 2.000.000 com margem de 4.096 para o envelope. Excesso não é truncado: a recusa fica visível e o texto permanece na tela. Reduza o conteúdo e confirme **Progresso guardado** antes de fechar; o banco mantém o último salvamento confirmado.

O transporte reserva 8.000.000 bytes para recusar chamadas acima do limite de uso. Mensagens acima dessa reserva violam o protocolo e podem encerrar a conexão.

O Worker HTTP é experimental e confia na identidade de um gateway autenticado. `npm run dev` é uma conferência em loopback; o projeto não fornece autenticação para expor esse servidor diretamente à internet.

## Distribuição

`npm run preparar:publicacao` gera `publicacao/perguntas-decisoes` por lista explícita de inclusão, verifica a cópia e recusa destinos já existentes ou links simbólicos. Publique somente essa cópia conferida; a pasta de desenvolvimento pode conter registros privados.

A cópia permite executar os mesmos comandos de construção. Dependências são instaladas por `npm ci`. Avisos e licenças das bibliotecas são preservados em `THIRD_PARTY_NOTICES.txt` no pacote.

A demonstração fictícia fica em `dist/web/inline.html`; exige anfitrião compatível para enviar mensagem e não instala o plugin.

[Contrato público](docs/specs/contrato-publico.md).

## Licença

[MIT](https://opensource.org/license/mit), conforme LICENSE. As bibliotecas conservam suas licenças e atribuições próprias.
