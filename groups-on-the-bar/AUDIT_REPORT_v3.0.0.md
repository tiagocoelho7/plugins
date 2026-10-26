# Auditoria final — Groups 'On the Bar' v3.0.0

**Data da auditoria:** 31 de agosto de 2026  
**Base auditada:** v2.9.9  
**Resultado compilado:** v3.0.0  
**Escopo:** WebExtension, estado local, Firefox Sync, bookmarks, grupos nativos, popup, páginas internas, internacionalização, acessibilidade, instaladores visuais de macOS/Windows/Linux, manifesto, permissões, privacidade, empacotamento e reconstrução para revisão do AMO.

## Parecer executivo

Não encontrei código malicioso, minerador, adware, telemetria oculta, execução remota, injeção em páginas, biblioteca de terceiros ou tentativa de acessar cookies. A extensão não possui content scripts nem permissão ampla para sites reais.

A auditoria encontrou problemas reais de privacidade, confiabilidade e empacotamento na candidata 2.9.9. Eles foram corrigidos antes da compilação 3.0.0. Depois das correções, não ficou nenhum bloqueador conhecido para o envio ao AMO.

A conclusão correta é **candidata de lançamento pronta para a validação externa do AMO**, e não garantia de aprovação: a validação automatizada e a eventual revisão humana da Mozilla ainda são etapas externas obrigatórias.

## Achados de alta severidade corrigidos

### 1. Consultas de favicon a terceiros não declaradas

O popup possuía fallback para serviços de favicon do Google e DuckDuckGo. Ao abrir a prévia, isso poderia transmitir domínios visitados a terceiros e contradizia a declaração de que a extensão não usa servidores externos.

**Correção:** todos os serviços externos foram removidos. A v3.0.0 usa somente a referência segura entregue pelo Firefox, os esquemas locais de favicon do navegador e um fallback visual local. Um teste estático impede a reintrodução desses domínios ou de outras URLs de rede no runtime.

### 2. Alterações pendentes do Firefox Sync podiam ficar sem nova tentativa

Depois de uma falha transitória, um registro local podia permanecer marcado como pendente sem uma nova tentativa automática suficientemente confiável. Também não havia reparo explícito quando um registro completo desaparecia do `storage.sync` sem lápide de exclusão.

**Correção:** foi adicionado controle local da última tentativa, repetição com intervalo mínimo, reparo de registros ausentes e nova tentativa na inicialização e ao abrir o painel. Exclusões continuam sendo reconhecidas somente por lápides versionadas, evitando transformar uma falha parcial em perda silenciosa.

### 3. Pacote-fonte pouco adequado para reconstrução do AMO

O runtime continha ZIPs visuais antigos e binários incorporados sem todas as fontes legíveis lado a lado. Isso aumentava o XPI, criava arquivos redundantes e tornava a reconstrução mais difícil para um revisor.

**Correção:** versões antigas foram removidas. A fonte dos três instaladores passou para `visual-src/`, foi criado `build.py` sem dependências externas e o pacote-fonte agora reconstrói o XPI e os três ZIPs visuais. Todos os arquivos ZIP usam ordem, timestamp, permissões e armazenamento sem compressão fixos, tornando a saída byte a byte reprodutível entre versões diferentes de zlib.

## Achados de média severidade corrigidos

1. **IDs de registros sincronizados sem limite rígido:** agora só são aceitos IDs no formato seguro e com até 128 caracteres; chaves hostis ou anormalmente grandes são ignoradas ou rejeitadas.
2. **Favicons persistidos de forma problemática:** URLs de favicon deixaram de ser gravadas junto das abas. Isso evita dados quebrados por truncamento, crescimento do `storage.local` e referências remotas persistentes.
3. **Estado inconsistente ao falhar o fechamento:** o vínculo `live` agora só é removido depois que o Firefox confirma a remoção das abas. Uma falha não transforma um grupo ainda aberto em “fechado” no estado interno.
4. **Relatório de diagnóstico podia expor caminhos locais:** URLs, caminhos `file:///`, caminhos POSIX e caminhos Windows — inclusive com espaços — são sanitizados antes de qualquer relatório exportável.
5. **Instalador Linux aceitava Firefox aberto:** instalação e remoção agora abortam se um processo Firefox estiver em execução, igual aos outros sistemas.
6. **Backups de instalador podiam colidir no mesmo segundo:** os nomes agora ganham sufixo incremental quando necessário.
7. **Controles previamente desativados eram reativados pelo estado de “ocupado”:** cada controle recupera exatamente seu estado anterior.
8. **Janela alternativa de edição estava menor que o popup atual:** o fallback foi atualizado para 500 × 720 pixels.
9. **Títulos podiam conter controles de direção e caracteres invisíveis perigosos:** controles C0/C1 e bidi foram removidos, mantendo Unicode legítimo e truncando por ponto de código.
10. **Reconhecimento do launcher legado era permissivo demais:** agora compara protocolo, host e caminho exatos.
11. **Elementos clonados do template dependiam somente do JavaScript para nome acessível:** os botões passaram a ter rótulos estáticos seguros, posteriormente refinados com o nome do grupo.
12. **CSP implícita:** o manifesto agora declara `script-src 'self'; object-src 'none'` explicitamente.

## Revisão de permissões

| Permissão | Uso comprovado | Parecer |
|---|---|---|
| `bookmarks` | criar, atualizar, mover, reconciliar e remover os atalhos | necessária |
| `tabs` | ler URLs/títulos/grupos, abrir, fechar, mover e restaurar abas | necessária |
| `cookies` | requisito do Firefox para `tabs.create({ cookieStoreId })`; não há chamada a `browser.cookies` | necessária para containers |
| `tabGroups` | ler, criar, atualizar, mover e acompanhar grupos nativos | necessária |
| `storage` | estado local, preferências e `storage.sync` | necessária |
| `menus` | comandos no menu de contexto das abas e do botão da extensão | necessária |
| `webRequest` + `webRequestBlocking` | cancelar exclusivamente o URL interno do bookmark antes que substitua a aba atual | necessária para o mecanismo atual |
| `https://grupos-na-barra.invalid/*` | único host permitido; endereço reservado usado apenas como comando interno e imediatamente cancelado | escopo estreito |

Não há `<all_urls>`, `history`, `downloads`, `nativeMessaging`, `management`, `proxy`, `clipboardRead`, `clipboardWrite`, `unlimitedStorage` ou acesso a navegação privada.

## Privacidade e dados

- O estado completo permanece no perfil local.
- O Firefox Sync recebe nome do grupo, cor, ícone, organização, URLs e `cookieStoreId`, sem títulos de páginas, favicons, cookies, IDs locais de abas/janelas/bookmarks ou diagnósticos.
- A transmissão ocorre somente pela infraestrutura `storage.sync` da conta Mozilla; não há endpoint do desenvolvedor.
- O manifesto declara `browsingActivity` e `bookmarksInfo` como dados necessários, coerentes com a funcionalidade principal de sincronização.
- O diagnóstico é local, limitado a 20 registros, sanitizado e exportado somente por ação explícita.
- O arquivo `PRIVACY.md` acompanha o pacote-fonte.

## Segurança do código

A varredura confirmou ausência de:

- `eval`, `new Function`, scripts remotos ou código baixado;
- `innerHTML`, `outerHTML`, `insertAdjacentHTML` ou `document.write`;
- `fetch`, XHR, WebSocket, EventSource ou `sendBeacon` no runtime;
- content scripts e injeção em páginas;
- chamadas a `browser.cookies`;
- comandos de rede nos instaladores (`curl`, `wget`, `Invoke-WebRequest` etc.);
- `sudo`, exclusão recursiva ampla ou escrita fora do perfil escolhido;
- links simbólicos dentro dos artefatos ZIP;
- scripts ou referências externas nos SVGs.

## Validação executada

- **22/22 testes Node aprovados**.
- Suíte Node repetida **cinco vezes consecutivas**, sem falha intermitente.
- **5.000** round trips determinísticos do formato de Sync, com corrupção de fragmentos e entradas hostis.
- Simulação de instalação, reinstalação, remoção e segunda remoção dos pacotes POSIX em perfis descartáveis com espaços no caminho.
- Auditoria estrutural/reprodutível que:
  - reconstrói todos os artefatos duas vezes;
  - compara os hashes;
  - extrai o pacote-fonte e reconstrói novamente;
  - compara os ZIPs visuais embutidos com os distribuídos separadamente;
  - rejeita caminhos ZIP inseguros, duplicados e links simbólicos;
  - confirma que o XPI contém somente os 38 arquivos de runtime previstos.
- Sintaxe de todos os JavaScript validada com Node.
- Sintaxe dos scripts Bash/command validada com `bash -n`.
- Todos os JSON analisados.
- Seis CSS analisados sem erro sintático.
- Todos os SVGs analisados e verificados contra conteúdo executável/referências externas.
- Paridade dos arquivos `_locales` em nove idiomas.
- Auditoria estrutural de HTML: IDs únicos, nenhum script inline/remoto e controles com nome acessível.
- Integridade dos ZIPs e SHA-256 de todos os artefatos.

## Limitações da auditoria

1. **O validador oficial `web-ext lint` não estava disponível neste ambiente e a instalação por npm não concluiu por indisponibilidade de rede.** O upload ao AMO executará o validador oficial; qualquer aviso dele deve ser tratado antes de continuar.
2. **Não havia Firefox gráfico instalado neste ambiente.** A regressão visual real foi coberta pelos testes manuais já realizados na v2.9.9; a v3.0.0 altera principalmente segurança, Sync, empacotamento e confiabilidade.
3. **PowerShell não estava instalado.** Os scripts Windows foram revisados estaticamente e empacotados de forma reprodutível, mas não foram executados aqui. Os scripts POSIX foram executados contra perfis descartáveis.
4. **As lápides de exclusão são mantidas indefinidamente.** Isso maximiza a proteção contra ressurreição por computadores que ficaram offline, mas centenas de exclusões distintas ao longo da vida podem pressionar a cota de 512 itens/100 KiB do Sync. A extensão preserva os grupos locais e sinaliza o erro; uma futura versão pode migrar para um ledger compacto.
5. **A resolução de conflitos usa relógio de parede mais revisão determinística.** Relógios extremamente incorretos entre computadores podem influenciar qual edição vence.
6. **Debounces curtos do background são temporizadores de event page.** Se o Firefox descarregar a página entre eventos, a reconciliação de inicialização/popup repara o estado, mas a atualização pode ser adiada.

## Conclusão

**Bloqueadores conhecidos após as correções: 0.**

A v3.0.0 está tecnicamente preparada para ser enviada como candidata ao AMO, acompanhada do XPI, pacote-fonte, notas ao revisor e política de privacidade. A próxima etapa é o upload no Developer Hub, leitura dos avisos do validador oficial e obtenção da assinatura da Mozilla.
