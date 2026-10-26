# Groups 'On the Bar' — Firefox

Extensão para Firefox Desktop que mantém grupos de abas acessíveis pela barra de favoritos, mesmo depois que as abas são fechadas.

## Novidades da 3.0.10

- **Identidade persistente não é mais inferida por conteúdo:** um grupo nativo sem vínculo runtime positivo (`windowId + groupId`) nunca reaproveita automaticamente o ID de uma entidade fechada só porque título, cor, URLs e Containers coincidem. Na ambiguidade, a entidade antiga permanece intacta e o grupo nativo recebe um novo ID persistente.
- O mesmo princípio vale tanto para auto-pin/reconciliação quanto para `pinNativeGroup`: alterações posteriores do novo grupo não podem sobrescrever o snapshot da entidade fechada coincidente.
- A restauração explícita da lixeira continua podendo validar o `windowId + groupId` já registrado na própria entrada antes de religar a instância ainda aberta; `snapshotMatchesSavedGroup()` não é mais usado para descobrir identidade de grupos fechados.
- O antigo reparo heurístico de snapshots legados vazios foi removido. Um estado antigo ambíguo é preservado e o grupo nativo observado recebe outra identidade, priorizando integridade sobre deduplicação automática.
- Nenhuma nova permissão, host permission, formato de Sync, telemetria, endpoint ou código remoto foi adicionado. Os LOWs documentados na reauditoria da 3.0.9 permanecem deliberadamente fora deste delta mínimo.

## Novidades da 3.0.9

- **Identidade persistente acima de heurística de conteúdo:** dois grupos com IDs diferentes não são mais fundidos ou apagados só porque têm o mesmo nome, cor e URLs. Se um estado inconsistente apontar dois IDs para o mesmo grupo nativo, a extensão apenas destaca o vínculo secundário e preserva as duas entidades.
- **Exclusões remotas ganham uma janela local de segurança:** o `deletedAt` original continua preservado como metadado, mas o dispositivo que acabou de receber a lápide mantém a sua última cópia local recuperável por 30 dias a partir da chegada. A exclusão não ressuscita automaticamente o grupo.
- **Proteção contra relógio futuro no Sync:** registros remotos com `updatedAt` mais de 24 horas à frente do relógio local são ignorados em vez de dominar a convergência. Estados locais já contaminados por timestamps muito futuros são saneados e republicados com uma revisão normal.
- **Arquivamento cross-device não fecha trabalho ativo:** se outro computador arquivar um grupo que está aberto neste Firefox, o grupo local permanece aberto e desarquivado e publica uma revisão posterior. A operação remota não fecha as abas em uso.
- **Event page mais conservadora:** uma única `tabGroups.query()` sem o grupo não desfaz mais `saved.live`. A ausência precisa persistir por 30 segundos antes de o vínculo runtime ser destacado, e o início da janela de observação do lifecycle é preservado em `storage.session` entre wakes da event page quando essa API está disponível.
- **Sync pendente endurecido:** registros remotos fragmentados não deixam mais `syncPending=true` sem `syncRevision`; depois de uma falha real, o retry respeita 30 segundos de backoff, sem atrasar gravações normais quando o Sync está saudável.
- **`keepAtTop` sem laço autoalimentado:** se o Firefox recusar tanto `tabGroups.move` quanto o fallback por abas, a mesma geometria não é tentada continuamente a cada `onMoved`; uma nova tentativa só ocorre depois do backoff ou de uma mudança real de layout.
- **Integridade compatível no wire:** os hashes FNV-1a de 32 bits continuam presentes para clientes v3 antigos, e a 3.0.9 adiciona um segundo fingerprint de 64 bits verificado por clientes novos. Tombstones novos omitem `deletedAt` quando ele é idêntico a `updatedAt`, reduzindo a cota sem alterar a leitura por clientes compatíveis.
- **Compactação segura de tombstones antigos:** quando o Sync passa de 260 itens ou aproximadamente 56 KiB, lápides com pelo menos 30 dias são copiadas para marcadores v2 compactos e exatos. A lápide v1 original permanece por mais 7 dias antes de ser removida, dando tempo para o novo marcador se propagar. O arquivo v2 continua bloqueando um grupo republicado por um Firefox antigo; uma recuperação posterior cria uma nova identidade em vez de apagar o histórico de exclusão do ID antigo.
- O sentinel interno `/empty/<groupId>` deixa de ser considerado URL restaurável fora do decoder de Sync, mensagens com remetente explicitamente externo são rejeitadas e os nove idiomas agora avisam quando a restauração do backup pode salvar e fechar grupos abertos.
- Nenhuma nova permissão, host permission, telemetria, endpoint ou código remoto foi adicionado. A antiga v3.0.8 experimental do bug `/toggle/` não foi incorporada nesta release.

## Novidades da 3.0.7

- Correção exclusiva do **instalador visual do Windows**: `Visual-Common.ps1` agora aceita corretamente a lista de perfis inicialmente vazia ao descobrir perfis do Firefox no Windows PowerShell. Isso elimina o erro `Não é possível associar o argumento ao parâmetro 'List' porque ele é uma coleção vazia.` observado no instalador 3.0.6.
- A correção foi validada manualmente em Windows com o instalador real. O runtime de grupos (`background.js`, `sync-store.js`, popup, Containers e lógica de Sync/Sessions) permanece funcionalmente inalterado em relação à candidata 3.0.6 aprovada; além do versionamento, o XPI muda apenas o assistente visual e o pacote Windows incorporado.

## Base funcional herdada da 3.0.6

- A prévia das abas mostra `domínio (título da aba)`, por exemplo `chatgpt.com (Plugin - Plugin - Group Tabs Novo)`. O título continua sendo apenas metadado local de interface.
- Ao fechar, desagrupar ou mover para fora a última aba de um grupo salvo, a entidade persistente do GOTB não é apagada: ela passa a **Fechado** e guarda uma aba neutra `about:blank`.
- A permissão `sessions`, introduzida na linha 3.0.x, continua sendo usada somente enquanto uma remoção nativa de grupo está sendo classificada. `sessions.getRecentlyClosed()` distingue o **Save and close group** nativo — que não entra em Recently Closed no Firefox 155 medido — de fechamento/Delete real.
- A 3.0.6 endurece essa classificação para evitar falsos positivos destrutivos: uma entrada de Recently Closed só pode esvaziar um grupo quando é atribuída de forma **única** a um `tabs.onRemoved` observado e essa remoção é comprovadamente **terminal para a geração atual do grupo**. Uma aba fechada antes, enquanto o mesmo grupo ainda tinha outras abas, não pode ser reutilizada para classificar um Save and close posterior.
- O lifecycle local das abas mantém somente evidência transitória em memória e registra uma geração efêmera para cada `windowId/groupId`. Se o Firefox restaurar um grupo reutilizando o mesmo `groupId`, a nova instância recebe outra geração e não herda markers, pendências ou autorização destrutiva da instância anterior. Uma observação posterior de que o grupo continuou vivo também invalida remoções de abas anteriores como prova terminal.
- A 3.0.6 também revalida essa geração **no momento em que uma tarefa atrasada finalmente vai alterar o estado** e novamente antes de finalizar uma pendência. Se `tabGroups.onRemoved` da geração N ficou parado na fila serial e o Firefox já restaurou o mesmo `groupId` como geração N+1, a tarefa antiga é descartada antes de tocar `saved.live`, criar pending, gravar `about:blank` ou publicar `intentionallyEmpty` no Sync.
- URLs duplicadas, mesma janela, múltiplos grupos pendentes, informação ausente, lacuna de evento ou qualquer outra ambiguidade preservam o último snapshot real. Se uma aba desaparecer sem que o evento correspondente tenha sido observado, uma Session compatível é tratada como ambígua em vez de ser atribuída ao grupo salvo.
- Move-out, A → B e **Ungroup tabs** usam proveniência positiva de membership: a extensão registra `oldGroupId` **e a geração de origem** e só aceita a mudança como evidência destrutiva se souber que a aba saiu especificamente da mesma geração do grupo cujo `tabGroups.onRemoved` foi observado. Uma aba homônima ou um marker de uma restauração anterior não servem como prova.
- Races de `sessions.onChanged` foram endurecidas: ao criar uma pendência a extensão consulta Recently Closed imediatamente; um `onChanged` sem match não consome outras pendências; e o instante de referência é capturado quando o evento público é observado, não depois de esperar a fila serial.
- **Save and close group** do próprio Firefox preserva o último snapshot real do GOTB. Fechar a janela/navegador e **Salvar e fechar** pela extensão também continuam preservando o snapshot.
- O comando nativo **Delete group** e o fechamento manual da última aba continuam indistinguíveis pela API pública no Firefox 155 medido. Por segurança contra perda de dados, ambos deixam a entidade persistente do GOTB fechada/vazia; para apagar definitivamente o grupo salvo, use **Excluir grupo** no GOTB.
- O estado de **vazio intencional** continua marcado explicitamente no registro sincronizado para não ser confundido com `about:blank` transitório de restauração.
- Para atualização gradual com a v3.0.0 real, o wire do Firefox Sync continua usando `https://grupos-na-barra.invalid/empty/<groupId>` como sentinel reservado e exclusivo do grupo. A v3.0.0 aceita essa forma como URL restaurável e não ressuscita a URL removida; a v3.0.6 converte o sentinel de volta para `about:blank`, inclusive se um peer antigo o republicar sem conhecer `intentionallyEmpty`.
- Grupos vazios intencionais continuam entidades distintas mesmo quando têm o mesmo nome e a mesma cor; eles não entram na deduplicação heurística por conteúdo.

## O que ela faz

- Salva um grupo nativo do Firefox com nome, cor, URLs e o container de cada aba.
- Cria um atalho permanente na barra de favoritos.
- O atalho funciona como alternância: abre o grupo fechado ou salva e fecha o grupo aberto.
- Oferece o comando **Salvar e fechar**, mantendo o atalho visível.
- Atualiza automaticamente o conteúdo salvo enquanto as abas, o nome ou a cor do grupo mudam.
- Sincroniza nome, cor, ícone, estado de arquivo, preferência de topo, URLs e containers dos grupos entre computadores pela própria conta Mozilla.
- Mantém IDs de janelas, abas e favoritos separados em cada computador, evitando referências inválidas entre sistemas.
- Permite editar nome, cor e ícone, remover e recolocar o atalho ou excluir o grupo salvo.
- Permite escolher um ícone opcional sincronizado para cada grupo; **Sem ícone** é representado no painel por um círculo vazado e continua sem símbolo no atalho.
- Pode manter grupos escolhidos no topo da ordem de abas, imediatamente depois das abas realmente fixadas, em barras verticais ou horizontais; grupos fixados podem ser reordenados por arrastar e soltar ou pelo teclado.
- Fixa automaticamente todo grupo aberto ou criado no Firefox; não é necessário abrir o painel primeiro.
- Usa um marcador Unicode invisível para associar cada atalho à cor do grupo.
- Com o complemento visual para macOS, Windows ou Linux, mostra o atalho como um chip colorido e o ícone opcional também no cabeçalho nativo do grupo, tanto em abas verticais quanto horizontais.
- No modo claro, o complemento visual alinha as cores nativas dos grupos e da paleta do editor às cores dos chips; cada grupo pode optar por **Cores mais escuras** para manter a tonalidade mais profunda do Firefox. O modo escuro permanece inalterado.
- Inclui um assistente visual no painel para detectar o sistema, baixar o pacote correto e orientar instalação, remoção e teste.
- Intercepta o clique antes da navegação, sem recarregar nem substituir a página atual.
- Preserva a última lista válida enquanto abas restauradas ainda aparecem como `about:blank`, evitando que uma abertura lenta apague as URLs do grupo.
- Reconecta grupos recriados pelo Firefox usando nome, cor e URLs, evitando atalhos duplicados.
- Remove automaticamente bookmarks duplicados e só apaga um atalho desconhecido quando recebe uma exclusão sincronizada explícita.
- Solicita que o botão de gerenciamento seja colocado na barra superior do Firefox na primeira instalação.
- Adiciona **Adicionar N abas a um grupo** ao menu de contexto das abas: a seleção múltipla pode virar um grupo novo ou entrar em qualquer grupo aberto da mesma janela.
- Também adiciona **Fixar este grupo na barra de favoritos** ao menu de contexto de uma aba agrupada.
- O mesmo menu de contexto oferece **Modificar grupo…** para abrir diretamente a edição de nome, cor e ícone a partir de qualquer aba agrupada.
- Reúne os grupos em uma única lista, com filtros **Todos**, **Abertos**, **Fechados**, **Arquivados** e **Lixeira**.
- Arquivar salva e fecha o grupo, remove seu atalho da barra e o mantém fora de **Todos** por padrão; um controle local permite incluir os arquivados quando desejado.
- Excluir envia o grupo para uma lixeira local recuperável por 30 dias. O Firefox Sync recebe apenas a lápide mínima de exclusão, evitando duplicar as URLs da lixeira dentro da cota de 100 KiB.
- A lixeira permite restaurar ou apagar permanentemente um grupo; ações em massa permitem desarquivar, enviar todos os arquivados para a lixeira e esvaziá-la com confirmação.
- Um botão de olho em cada grupo mostra 3, 5, 7 ou 9 abas, conforme a preferência local, sem aumentar o payload sincronizado; títulos de páginas continuam locais.
- No filtro **Todos**, os grupos marcados para permanecer no topo têm prioridade global e respeitam a ordem definida pela pessoa; entre os demais, aparecem primeiro os abertos na janela atual, depois os de outras janelas e, por fim, os fechados.
- Identifica cada grupo com **Nesta janela**, **Outra janela** ou **Fechado**.
- Detecta o idioma do Firefox e inclui inglês, espanhol, português do Brasil, chinês simplificado, japonês, coreano, alemão, francês e russo, com inglês como fallback e escolha manual persistente.
- Inclui preferências persistentes de acessibilidade: quatro tamanhos de texto, alto contraste e redução de animações.
- Permite fechar todas as caixas modais pelo botão **X**, pela tecla `Esc` ou por um clique no fundo, devolvendo o foco ao controle que abriu a caixa.
- Mantém idioma, acessibilidade, fixação automática e o assistente visual organizados em controles compactos no cabeçalho.
- Mostra o convite do visual de chip somente até ele ser dispensado ou o assistente ser aberto; o acesso permanente continua em **Configurações**.
- Atualiza o painel automaticamente quando abas, grupos, favoritos ou dados sincronizados mudam; não há botão manual de recarregar.
- Mantém o último snapshot válido quando a última aba de um grupo é fixada e o Firefox remove o grupo nativo.
- Mostra o uso real dos 100 KiB disponíveis à extensão no Firefox Sync.
- A faixa de estado do Firefox Sync pode ser recolhida até uma pequena alça central; essa preferência é local e permanece depois de fechar o Firefox.
- Mantém localmente os últimos 20 erros de tarefas em segundo plano, marca o botão da extensão quando existe erro não lido e permite copiar ou baixar um JSON de diagnóstico sem URLs, títulos de abas, nomes de grupos, favoritos ou histórico. Nada é enviado automaticamente.
- Mantém no Sync uma cópia rolante anterior quando ela cabe junto dos dados atuais, sem deixar o backup bloquear a sincronização principal.
- Exporta pela engrenagem um JSON portátil com grupos, abas, containers, cores, ícones, atalhos e preferências.

Os dados operacionais continuam no perfil local. Quando **Complementos** está habilitado no Firefox Sync, a extensão também grava nome, cor, URLs e o identificador do container das abas no `storage.sync` da própria conta Mozilla; títulos de páginas, cookies e IDs locais de janelas, abas ou bookmarks nunca são sincronizados. Ela não usa site ou servidor do desenvolvedor. O manifesto declara `browsingActivity` e `bookmarksInfo` para que o Firefox mostre esse envio de forma transparente no consentimento de instalação, conforme a [regra oficial de dados do AMO](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

O Firefox exige a permissão `cookies` para aceitar `tabs.create({ cookieStoreId })`. A extensão usa essa permissão somente para reabrir a aba no mesmo container; não chama `browser.cookies` e não possui permissão de host para sites reais, portanto não lê, altera nem exporta cookies. Se o container salvo não existir naquele computador, a URL é restaurada no container padrão em vez de ser descartada.

A permissão `sessions` é usada somente para consultar `sessions.getRecentlyClosed()` enquanto uma remoção nativa de grupo está pendente de classificação. As entradas retornadas são comparadas em memória com eventos transitórios de `tabs.onRemoved`; a 3.0.6 exige atribuição única e falha para o lado conservador quando há URLs duplicadas ou qualquer ambiguidade. A extensão não pede `history`, não grava a lista de sessões fechadas e não envia essa lista ao Firefox Sync nem a qualquer servidor. Como `sessions` foi adicionada nesta linha 3.0.x, o Firefox pode pedir aprovação adicional ao atualizar a extensão a partir de uma versão que ainda não possuía essa permissão.

## Requisitos

- Firefox Desktop 142 ou mais recente.
- Barra de favoritos visível. Se ela estiver oculta, use **Exibir → Barras de ferramentas → Barra de favoritos → Sempre mostrar**.
- Para usar os mesmos grupos em mais de um computador, instale a extensão em cada um e habilite **Complementos** e **Favoritos** em **Configurações → Sync**.

## Instalação para teste

O pacote fornecido não é assinado pela Mozilla. No Firefox comum, carregue-o temporariamente assim:

1. Extraia `groups-on-the-bar-firefox-source-v3.0.10.zip`.
2. Abra `about:debugging#/runtime/this-firefox`.
3. Clique em **Carregar extensão temporária…**.
4. Selecione o arquivo `manifest.json` dentro da pasta extraída.
5. O botão **Groups 'On the Bar'** deve aparecer na barra superior. Se o Firefox já tiver memorizado uma posição antiga, abra o menu de extensões, clique com o botão direito em **Groups 'On the Bar'** e escolha **Fixar na barra de ferramentas** uma única vez.

A instalação temporária é removida quando o Firefox fecha. Para uma instalação permanente no Firefox comum, o código precisa receber a assinatura gratuita da Mozilla pelo AMO. Depois de assinado, o `.xpi` pode ser instalado normalmente e não exige mais `about:debugging`. O `.xpi` incluído aqui serve para validação e desenvolvimento e continua sem assinatura.

## Uso

1. Crie ou abra um grupo de abas normalmente no Firefox.
2. A extensão detecta o grupo e cria automaticamente um atalho com o nome do grupo na barra de favoritos.
3. Clique no atalho enquanto o grupo estiver aberto para salvá-lo e fechá-lo.
4. Clique no mesmo atalho novamente para restaurar o grupo.

O painel acessível pelo botão da barra superior continua disponível para editar, visualizar abas, ordenar grupos fixados, arquivar, restaurar ou administrar os grupos.

O botão de idioma fica no cabeçalho do painel e oferece os nove idiomas suportados. O botão **Aa** abre as opções de acessibilidade: texto pequeno, padrão, grande ou muito grande, alto contraste e redução de animações. A engrenagem reúne a fixação automática, o backup, a exportação JSON e o acesso permanente ao assistente visual. Idioma, acessibilidade, filtro e dispensa do convite visual permanecem salvos neste perfil do Firefox.

Ao editar um grupo, é possível escolher **Sem ícone**, mostrado no painel como um círculo vazado, ou um dos quinze ícones incluídos. A cor do grupo também colore o ícone. O botão de alfinete de cada ficha ativa **Manter grupo no topo**; isso mantém o grupo imediatamente depois das abas realmente fixadas, sem transformar o grupo em uma aba fixada. Ao fixar mais de um grupo, surge uma alça para reordená-los. A ordem é persistente, sincronizada e também pode ser ajustada com as setas do teclado quando a alça está em foco. O botão de marcador ao lado administra separadamente o atalho na barra de favoritos.

O botão de olho expande temporariamente a ficha e mostra 3, 5, 7 ou 9 nomes de abas, conforme o controle em **Configurações → Prévia das abas**, mais a contagem restante. Esses títulos e favicons vêm somente do armazenamento local ou do cache local do Firefox. Em um grupo recebido pela primeira vez em outro computador, a extensão usa um rótulo derivado da URL até que esse Firefox conheça os títulos reais.

Ao excluir um grupo aberto, o painel pede confirmação porque as abas continuam abertas e o vínculo salvo é removido. Grupos fechados ou arquivados vão diretamente para a **Lixeira** sem uma confirmação extra. A cópia recuperável fica somente em `storage.local` por 30 dias; por isso ela não ocupa os 100 KiB do Firefox Sync. **Restaurar** recria o grupo salvo e o atalho quando ele existia. Quando a exclusão veio de outro dispositivo ou o ID antigo já foi compactado, a restauração usa um novo ID persistente para preservar simultaneamente a recuperação do usuário e a barreira contra ressurreição do ID excluído. **Apagar para sempre** remove a cópia recuperável local.

Na barra de ações acima dos filtros, **Todos** mostra o controle para incluir arquivados. Em **Arquivados**, aparecem **Desarquivar tudo** e **Apagar todos**; em **Lixeira**, aparece **Esvaziar lixeira**. As operações destrutivas em massa exigem confirmação.

Para modificar o grupo a partir da própria barra de abas, clique com o botão direito em qualquer aba agrupada e escolha **Modificar grupo…**. O popup abre diretamente na paleta de nome, cores e ícones; a mudança é aplicada ao grupo nativo aberto e ao atalho da barra de favoritos.

O Firefox não permite que uma aba realmente fixada continue dentro de um grupo. Se a última aba for fixada, o grupo nativo desaparece, mas a extensão conserva o grupo salvo como fechado e não desfaz a fixação escolhida pela pessoa.

### Agrupar várias abas rapidamente

1. Selecione as abas com `⌘` + clique no macOS ou `Ctrl` + clique no Windows e Linux. Use `Shift` + clique para selecionar um intervalo.
2. Clique com o botão direito em uma das abas selecionadas.
3. Abra **Adicionar N abas a um grupo**.
4. Escolha **Criar novo grupo** ou o nome de um grupo já aberto na mesma janela.

Ao criar um grupo novo, a extensão escolhe automaticamente um nome sequencial e uma cor ainda não usada, quando possível. Nome e cor podem ser alterados normalmente depois. Abas fixadas ficam fora da operação para que o Firefox não as desafixe silenciosamente.

## Sincronização entre computadores

A versão 3.0.0 mantém as migrações automáticas de todos os formatos anteriores. Cada grupo é dividido em registros pequenos para respeitar os limites do Firefox Sync; edições concorrentes usam uma versão determinística, e exclusões são sincronizadas sem confundir um bookmark que chegou antes dos dados da extensão com um bookmark abandonado.

Para configurar uma segunda máquina:

1. Entre na mesma conta Mozilla.
2. Ative **Complementos** e **Favoritos** em **Configurações → Sync**.
3. Instale a versão 3.0.0 ou superior da extensão nesse Firefox.
4. Use **Sincronizar agora** se quiser evitar a espera normal do Firefox Sync.

Os grupos fechados aparecem no painel da extensão e os atalhos chegam pela sincronização de Favoritos. Sem a extensão instalada na segunda máquina, o bookmark pode aparecer, mas não consegue abrir ou fechar o grupo. O complemento visual também precisa ser instalado uma vez em cada computador; o assistente detecta macOS, Windows ou Linux automaticamente.

O painel mostra **Firefox Sync OK** quando não há erro nem gravação local pendente no `storage.sync`; isso não confirma que o servidor Mozilla ou outro computador já recebeu os dados, pois essa entrega é controlada pelo Firefox. Ao lado, a barra com o disco mostra quantos dos 100 KiB reservados à extensão estão ocupados. Se o limite for atingido, o grupo continua salvo e funcional no computador atual, mas fica marcado como pendente. A API permite até 100 KiB no total, 8 KiB por item e 512 itens por extensão. Consulte a [documentação oficial do `storage.sync`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/sync).

A faixa do Sync pode ser recolhida pela pequena seta central. O estado recolhido é armazenado apenas neste Firefox. Se surgir erro de Sync ou um diagnóstico novo enquanto a faixa estiver fechada, a alça recebe um indicador vermelho.

Em **Configurações → Diagnóstico**, a extensão mantém no máximo 20 falhas recentes detectadas nas operações em segundo plano. O relatório pode ser copiado ou baixado manualmente como JSON e informa versão da extensão, Firefox, sistema, contexto técnico, código e stack sanitizada, além de contagens do Sync. URLs, títulos de abas, nomes de grupos, favoritos e histórico não entram no relatório, e a extensão não possui envio automático de telemetria para o desenvolvedor.

Antes de publicar uma alteração sincronizada, a extensão tenta guardar uma cópia compacta do estado anterior. Essa cópia inclui nome, cor, ícone, containers e URLs, não inclui títulos de páginas e só é atualizada depois de pelo menos 15 minutos para não ser substituída por vários eventos da mesma ação. Ela usa no máximo aproximadamente 96 KiB junto dos dados atuais; se faltar espaço, a cópia é descartada antes dos grupos principais. Em **Configurações → Backup dos grupos**, a restauração mescla a cópia com os grupos atuais, não exclui grupos extras e fecha somente os grupos abertos afetados para impedir que as abas atuais sobrescrevam as URLs restauradas.

**Exportar JSON** cria uma cópia manual mais completa e legível, incluindo títulos e URLs das abas, containers, nome, cor, ícone, arquivamento, preferência de topo, presença do atalho e configurações da interface. O arquivo é baixado localmente e não é enviado a um servidor.

Se o painel não aparecer corretamente, clique com o botão direito no ícone **Groups 'On the Bar'** e escolha **Abrir assistente visual**. O mesmo assistente também pode ser aberto em `about:addons`, em **Grupos 'On the Bar' → Preferências**.

Se o grupo já estava salvo e fechado pelo próprio Firefox antes da instalação, reabra-o uma vez pelo menu de grupos do navegador. Assim que ele estiver aberto, a extensão poderá importá-lo e manter o novo atalho acessível na barra.

Ao clicar no atalho, a extensão bloqueia imediatamente a navegação para o endereço de comando e abre ou fecha o grupo em segundo plano. A aba em que você já estava não é usada como página intermediária e não precisa ser recarregada. Os atalhos das versões anteriores são migrados automaticamente.

## Visual em chip no Firefox Desktop

Uma WebExtension não pode ocultar o favicon nem aplicar fundo colorido a um item da barra de favoritos. Para reproduzir o chip visual, abra o painel da extensão, clique em **Visual de chip** e siga o assistente. Ele detecta macOS, Windows ou Linux e libera o pacote correspondente. Os três ZIPs estão incorporados dentro do próprio `.xpi`; o download não depende de site ou servidor externo.

Em todos os sistemas, feche completamente o Firefox antes da instalação, extraia o ZIP e mantenha os arquivos juntos. Depois:

- macOS: abra `Instalar-visual.command` pelo menu de contexto.
- Windows: execute `Instalar-visual.cmd`.
- Linux: execute `./instalar-visual.sh` em um terminal.

Cada pacote inclui um removedor equivalente. Os instaladores leem os perfis registrados e também examinam as pastas de perfil diretamente, depois criam um estilo separado e fazem backup de qualquer `userChrome.css` ou `user.js` que precisem alterar. Se a detecção automática falhar, macOS e Windows abrem um seletor de pasta; no Linux, informe como argumento o caminho exibido em `about:support` → **Pasta do perfil**. São reconhecidas instalações normais, Firefox ESR, Flatpak, Snap e Microsoft Store.

Depois de atualizar a extensão, os atalhos antigos com emoji são migrados automaticamente para o novo nome invisivelmente marcado. Sem o complemento visual, eles aparecem como favoritos normais; com o complemento, aparecem como chips na cor correta, sem o globo e com o ícone opcional escolhido para o grupo.

## Limites conhecidos do Firefox

- Uma WebExtension instalada normalmente não pode desenhar vários “chips” personalizados dentro da interface nativa da barra de favoritos. O complemento visual usa `userChrome.css`, uma personalização avançada e não garantida pela Mozilla que pode precisar de ajuste após mudanças futuras na interface.
- O endereço `grupos-na-barra.invalid` é somente um identificador interno dos atalhos. A extensão cancela a navegação antes que a aba seja substituída; não existe um site ou servidor associado a esse endereço.
- A API pública do Firefox expõe grupos enquanto eles estão abertos, mas não entrega às extensões a lista estruturada de grupos nativos que já foram salvos e fechados. Por isso, cada grupo antigo precisa ser reaberto uma única vez para ser importado.
- A restauração guarda as URLs, não o histórico interno, rolagem ou conteúdo de formulários de cada aba.
- Abas em containers são reabertas no mesmo `cookieStoreId`. Em outro computador onde esse container não exista, a página abre no container padrão para não desaparecer.
- Páginas protegidas do Firefox, como `about:config`, `about:addons` e `about:debugging`, não podem ser abertas por extensões e são ignoradas. O painel informa quantas abas não puderam ser salvas.
- A sincronização de dados da extensão depende da opção **Complementos**; a dos atalhos depende da opção **Favoritos**. Ambas precisam estar habilitadas.
- O Firefox Sync não é instantâneo: o navegador sincroniza periodicamente ou quando o usuário escolhe **Sincronizar agora**.
- O Firefox limita o armazenamento sincronizado de cada extensão. Grupos que não couberem continuam disponíveis somente no perfil local, com aviso no painel.
- Janelas privativas não são usadas, para evitar que grupos privados sejam persistidos.

## Build reproduzível

A versão de publicação é construída somente com Python 3.10 ou mais recente e a biblioteca padrão; não há npm, bundler, minificador, transpiler ou download durante o build.

```bash
python3 build.py --check-reproducible
node --test tests/*.test.js
```

O primeiro comando gera em `dist/` o XPI, o ZIP de código-fonte e os três pacotes visuais. Todos os ZIPs usam timestamp fixo, ordem estável e permissões normalizadas. A opção `--check-reproducible` cria cada arquivo uma segunda vez e exige igualdade byte a byte.

Os fontes legíveis dos instaladores visuais ficam em `visual-src/`; os arquivos `.zipdata` dentro de `visual/` são gerados por `build.py` e são os mesmos bytes dos ZIPs separados. Consulte também `AMO_REVIEW_NOTES.md` e `PRIVACY.md`.

## Validação

Executada para a versão 3.0.10:

```text
manifesto JSON e estrutura do XPI: aprovados
node --check: camada de Sync, preferências, background, popup e páginas internas aprovados
testes automatizados: migração, URLs pendentes, recuperação local, falha parcial, reparo do Sync, dois dispositivos, round trip real v3.0.10→v3.0.0→v3.0.10, Save and close/Delete/última aba via Sessions, remoção anterior da mesma geração seguida de Save and close, remoção anterior com múltiplas abas restantes, close/Delete terminal após remoção anterior, restauração com reutilização do mesmo groupId, proveniência oldGroupId+geração para move-out/A→B/Ungroup, ordem inversa de membership preservada conservadoramente, URL duplicada na mesma janela, Recently Closed de outra aba, duas pendências homônimas, onChanged antes do pending, onChanged sem match, atraso serial >500 ms, remoção stale geração N bloqueada na fila seguida de restauração N+1 com o mesmo groupId, finalizador stale bloqueado seguido de restauração N+1, reabertura/edição durante pending, backup rolante, exportação JSON, concorrência, cotas, identidade fechada versus novo grupo nativo idêntico (auto-pin e pin manual), bookmarks, abertura/fechamento, lixeira/restauração/exclusão permanente, ações em massa, ordem persistente dos grupos fixados, diagnóstico local, agrupamento de seleção múltipla, filtros, idiomas e acessibilidade aprovados
```

## Arquivos principais

- `manifest.json`: manifesto e permissões.
- `sync-store.js`: formato fragmentado e versionado usado no Firefox Sync.
- `ui-preferences.js`: idiomas e preferências persistentes de interface e acessibilidade.
- `translations-extra.js`: traduções completas dos seis idiomas adicionais.
- `background.js`: estado local, migração, convergência, abertura e fechamento dos grupos.
- `popup/`: interface de gerenciamento.
- `visual/`: assistente visual interno e somente os três pacotes gerados da versão atual.
- `visual-src/`: fontes legíveis dos instaladores opcionais de macOS, Windows e Linux.
- `build.py`: build determinístico do XPI, source ZIP e pacotes visuais.
- `PRIVACY.md`: descrição de dados locais e transmitidos pelo Firefox Sync.
- `AMO_REVIEW_NOTES.md`: instruções e justificativas para revisão no AMO.
- `launcher/`: compatibilidade temporária com atalhos criados por versões anteriores.
- `tests/background.test.js`: testes automatizados com APIs do Firefox simuladas.
- `groups-on-the-bar-visual-macos-v3.0.10.zip`: instalador reversível para macOS.
- `groups-on-the-bar-visual-windows-v3.0.10.zip`: instalador reversível para Windows.
- `groups-on-the-bar-visual-linux-v3.0.10.zip`: instalador reversível para Linux.
