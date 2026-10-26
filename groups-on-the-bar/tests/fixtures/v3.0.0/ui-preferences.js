"use strict";

(() => {
  const STORAGE_KEY = "gruposNaBarraUiPreferences";
  const LANGUAGES = ["en", "es", "pt-BR", "zh-CN", "ja", "ko", "de", "fr", "ru"];
  const FONT_SIZES = ["small", "default", "large", "extra-large"];
  const FILTERS = ["all", "open", "closed", "archived", "trash"];
  const DEFAULTS = Object.freeze({
    language: null,
    fontSize: "default",
    highContrast: false,
    reduceMotion: false,
    groupFilter: "all",
    includeArchivedInAll: false,
    panelViewLimit: 3,
    previewTabCount: 3,
    syncCollapsed: false,
    visualPromoDismissed: false
  });

  const MESSAGES = {
    "pt-BR": {
      "app.name": "Grupos 'On the Bar'",
      "app.subtitle": "Seus grupos sempre por perto",
      "button.refresh": "Atualizar grupos",
      "button.settings": "Configurações",
      "button.language": "Idioma",
      "button.accessibility": "Acessibilidade",
      "button.close": "Fechar",
      "saved.heading": "Grupos salvos",
      "saved.infoLabel": "Sobre os grupos salvos",
      "saved.description": "Abra, feche, atualize ou remova os atalhos.",
      "saved.emptyTitle": "Nenhum grupo salvo",
      "saved.emptyText": "Abra um grupo de abas do Firefox uma vez para importá-lo automaticamente.",
      "filter.label": "Filtrar grupos",
      "filter.all": "Todos",
      "filter.open": "Abertos",
      "filter.closed": "Fechados",
      "filter.emptyOpenTitle": "Nenhum grupo aberto",
      "filter.emptyOpenText": "Os grupos salvos abertos aparecerão aqui.",
      "filter.emptyClosedTitle": "Nenhum grupo fechado",
      "filter.emptyClosedText": "Todos os grupos salvos estão abertos.",
      "status.currentWindow": "Nesta janela",
      "status.otherWindow": "Outra janela",
      "status.closed": "Fechado",
      "tabs.one": "{count} aba",
      "tabs.many": "{count} abas",
      "tabs.skippedOne": "{count} não restaurável",
      "tabs.skippedMany": "{count} não restauráveis",
      "action.open": "Abrir grupo",
      "action.close": "Salvar e fechar",
      "action.edit": "Editar grupo",
      "action.pin": "Fixar atalho na barra",
      "action.unpin": "Remover atalho da barra",
      "action.delete": "Excluir grupo salvo",
      "notice.noResponse": "A extensão não respondeu.",
      "notice.closed": "“{title}” foi salvo e fechado.",
      "notice.pinned": "“{title}” foi fixado na barra.",
      "notice.unpinned": "Atalho removido da barra.",
      "notice.deleted": "“{title}” foi excluído dos grupos salvos.",
      "notice.updated": "Nome e cor atualizados.",
      "notice.autoPinOn": "Novos grupos serão fixados automaticamente.",
      "notice.autoPinOff": "Fixação automática desativada.",
      "confirm.deleteOpen": "O grupo continuará aberto, mas deixará de ser acompanhado. Excluir o grupo salvo?",
      "confirm.deleteClosed": "Excluir este grupo salvo e seu atalho?",
      "sync.preparingTitle": "Preparando os dados locais…",
      "sync.preparingText": "O Firefox controla o envio à conta Mozilla e aos outros computadores.",
      "sync.unavailableTitle": "Firefox Sync indisponível",
      "sync.unavailableText": "Os grupos continuam salvos somente neste computador.",
      "sync.localOnlyTitle": "Alguns grupos estão somente neste computador",
      "sync.errorText": "Ocorreu um erro local. Seus grupos continuam preservados neste computador.",
      "sync.pendingTitle": "Sincronização pendente",
      "sync.pendingOne": "{count} alteração aguardando o Firefox Sync.",
      "sync.pendingMany": "{count} alterações aguardando o Firefox Sync.",
      "sync.readyTitle": "Pronto localmente para o Firefox Sync",
      "sync.readyText": "Nenhum erro local detectado. O Firefox controla o envio aos outros computadores.",
      "error.operationFailed": "Não foi possível concluir a operação.",
      "error.groupMissing": "Esse grupo não existe mais.",
      "error.noRestorableTabs": "Esse grupo não possui abas que a extensão possa restaurar.",
      "error.syncFailed": "Não foi possível preparar os dados para o Firefox Sync.",
      "autoPin.title": "Fixar novos grupos automaticamente",
      "autoPin.text": "Todo grupo criado passa a aparecer na barra.",
      "visual.title": "Visual de chip",
      "visual.text": "Instalar, conferir ou remover no Desktop",
      "visual.dismiss": "Ocultar sugestão do visual de chip",
      "settings.title": "Configurações",
      "settings.text": "Preferências permanentes deste Firefox.",
      "edit.title": "Editar grupo",
      "edit.text": "O atalho e o grupo aberto serão atualizados juntos.",
      "edit.name": "Nome",
      "edit.color": "Cor",
      "edit.cancel": "Cancelar",
      "edit.save": "Salvar",
      "language.title": "Escolher idioma",
      "language.text": "A escolha ficará salva neste Firefox.",
      "language.pt-BR": "Português (Brasil)",
      "language.en": "English",
      "language.es": "Español",
      "access.title": "Acessibilidade",
      "access.text": "Ajuste a leitura e o movimento da interface.",
      "access.fontTitle": "Tamanho do texto",
      "access.font.small": "Pequeno",
      "access.font.default": "Padrão",
      "access.font.large": "Grande",
      "access.font.extra-large": "Muito grande",
      "access.contrastTitle": "Alto contraste",
      "access.contrastText": "Reforça contornos, textos e botões.",
      "access.motionTitle": "Reduzir animações",
      "access.motionText": "Remove transições e movimentos decorativos.",
      "access.reset": "Restaurar padrão", "access.confirmReset": "Restaurar as configurações de acessibilidade para o padrão?",
      "color.grey": "Cinza",
      "color.blue": "Azul",
      "color.red": "Vermelho",
      "color.yellow": "Amarelo",
      "color.green": "Verde",
      "color.pink": "Rosa",
      "color.purple": "Roxo",
      "color.cyan": "Ciano",
      "color.orange": "Laranja",
      "menu.addGeneric": "Adicionar abas a um grupo",
      "menu.pinnedOne": "Aba fixada não pode ser agrupada",
      "menu.pinnedMany": "Abas fixadas não podem ser agrupadas",
      "menu.addPartial": "Adicionar {eligible} de {total} abas a um grupo (fixadas ficam fora)",
      "menu.addOne": "Adicionar esta aba a um grupo",
      "menu.addMany": "Adicionar {count} abas a um grupo",
      "menu.newGroup": "Criar novo grupo",
      "menu.pinGroup": "Fixar este grupo na barra de favoritos",
      "menu.openVisual": "Abrir assistente visual",
      "group.untitled": "Grupo sem nome",
      "group.defaultName": "Grupo {number}",
      "launcher.updatingTitle": "Atualizando grupo…",
      "launcher.updatingText": "Só um instante enquanto o grupo é aberto ou salvo e fechado.",
      "launcher.retry": "Tentar novamente",
      "launcher.invalidTitle": "Atalho inválido",
      "launcher.invalidText": "Abra o painel Grupos 'On the Bar' e crie o atalho novamente.",
      "launcher.openError": "Não foi possível abrir o grupo.",
      "launcher.closedTitle": "Grupo salvo e fechado",
      "launcher.closedText": "O atalho continua disponível na barra de favoritos.",
      "launcher.partialTitle": "Grupo aberto com ressalvas",
      "launcher.partialText": "{count} aba(s) interna(s) do Firefox não puderam ser restauradas.",
      "launcher.failedTitle": "Não foi possível abrir",
      "visualAssistant.subtitle": "Assistente visual",
      "visualAssistant.close": "Fechar",
      "visualAssistant.eyebrow": "Visual opcional para Firefox Desktop",
      "visualAssistant.heroTitle": "Transforme os atalhos em chips coloridos",
      "visualAssistant.heroText": "O instalador remove o globo, usa a cor real de cada grupo e mantém somente o nome. A abertura e o fechamento dos grupos continuam sob controle da extensão.",
      "visualAssistant.previewLabel": "Exemplo do resultado visual",
      "visualAssistant.previewCaption": "Sem ícone de globo ou emoji",
      "visualAssistant.checking": "Verificando seu sistema…",
      "visualAssistant.checkingText": "O pacote será liberado quando a verificação terminar.",
      "visualAssistant.guided": "Instalação guiada",
      "visualAssistant.fourSteps": "Quatro passos",
      "visualAssistant.step1Title": "Baixe o pacote visual",
      "visualAssistant.step1Text": "Ele já está incluído nesta extensão e não acessa nenhum servidor.",
      "visualAssistant.waiting": "Aguardando detecção do sistema",
      "visualAssistant.downloadStarted": "Download iniciado. Abra o ZIP na pasta Downloads.",
      "visualAssistant.step2Title": "Extraia o ZIP",
      "visualAssistant.step2Text": "Mantenha os arquivos extraídos juntos. O instalador usa a folha de estilo incluída na mesma pasta.",
      "visualAssistant.step3Title": "Encerre completamente o Firefox",
      "visualAssistant.step3Text": "O assistente mostrará a instrução correta para seu sistema.",
      "visualAssistant.step4Title": "Execute o instalador e reinicie",
      "visualAssistant.step4Text": "A instrução será adaptada ao seu sistema operacional.",
      "visualAssistant.temporaryTitle": "Nesta versão temporária",
      "visualAssistant.temporaryText": "Ao reiniciar o Firefox, carregue novamente o mesmo manifest.json em about:debugging. Na versão assinada pelo Firefox, essa etapa deixa de existir.",
      "visualAssistant.removeSummary": "Como remover o visual",
      "visualAssistant.removeDefault": "O pacote inclui um removedor que preserva outras personalizações do Firefox.",
      "visualAssistant.troubleshootSummary": "Se o chip não aparecer",
      "visualAssistant.restartDefault": "Confirme que o Firefox foi encerrado completamente antes da instalação.",
      "visualAssistant.reloadHelp": "Depois de instalar o visual, encerre completamente e abra novamente o Firefox.",
      "visualAssistant.installerDefault": "Confira as instruções do README incluído no pacote.",
      "visualAssistant.otherSystemSummary": "Baixar para outro sistema",
      "visualAssistant.otherSystemText": "Os três pacotes ficam incorporados nesta extensão. Escolha manualmente se estiver preparando a instalação para outro computador.",
      "visualAssistant.privacy": "O assistente funciona localmente. Ele não envia seus grupos, favoritos ou histórico para nenhum servidor.",
      "visualAssistant.detected": "{name} detectado — pacote compatível",
      "visualAssistant.downloadFor": "Baixar instalador para {name}",
      "visualAssistant.detectedUnsupported": "{name} detectado",
      "visualAssistant.unsupportedText": "O visual automático está disponível para Firefox Desktop no macOS, Windows e Linux.",
      "visualAssistant.chooseBelow": "Escolha um pacote abaixo",
      "visualAssistant.unknownSystem": "Sistema não identificado",
      "visualAssistant.unsupportedSystem": "Sistema não compatível",
      "platform.mac.description": "O pacote contém instalador e removedor para o perfil padrão do Firefox.",
      "platform.mac.quitTitle": "Encerre completamente o Firefox",
      "platform.mac.quitDescription": "Use ⌘ + Q. Fechar apenas a janela não aplica a mudança.",
      "platform.mac.installerTitle": "Abra o instalador e reinicie",
      "platform.mac.installerDescription": "Clique com o botão direito em Instalar-visual.command, escolha Abrir e confirme. Depois, abra novamente o Firefox.",
      "platform.mac.removeDescription": "Feche o Firefox e abra Remover-visual.command, incluído no ZIP. Ele remove somente o estilo do Grupos 'On the Bar'.",
      "platform.mac.restartHelp": "Confirme que usou ⌘ + Q antes de executar o instalador.",
      "platform.mac.installerHelp": "Se o macOS bloquear o script, use clique direito → Abrir, em vez de clique duplo.",
      "platform.win.description": "Compatível com o Firefox tradicional e com a versão da Microsoft Store.",
      "platform.win.quitTitle": "Feche todas as janelas do Firefox",
      "platform.win.quitDescription": "No menu do Firefox, escolha Sair antes de executar o instalador.",
      "platform.win.installerTitle": "Execute o instalador e reinicie",
      "platform.win.installerDescription": "Clique duas vezes em Instalar-visual.cmd, aguarde a confirmação e abra novamente o Firefox.",
      "platform.win.removeDescription": "Feche o Firefox e execute Remover-visual.cmd. Ele remove somente o estilo do Grupos 'On the Bar'.",
      "platform.win.restartHelp": "Confirme que não há nenhuma janela ou processo do Firefox aberto.",
      "platform.win.installerHelp": "Se o Windows bloquear o arquivo, consulte a seção Desbloquear no README do pacote.",
      "platform.linux.description": "Compatível com instalações normais, Flatpak e Snap do Firefox.",
      "platform.linux.quitTitle": "Feche completamente o Firefox",
      "platform.linux.quitDescription": "Encerre todas as janelas do Firefox antes de abrir o terminal.",
      "platform.linux.installerTitle": "Execute o instalador no terminal",
      "platform.linux.installerDescription": "Dentro da pasta extraída, execute ./instalar-visual.sh e depois abra novamente o Firefox.",
      "platform.linux.removeDescription": "Feche o Firefox e execute ./remover-visual.sh. Ele remove somente o estilo do Grupos 'On the Bar'.",
      "platform.linux.restartHelp": "Confirme que nenhum processo firefox ou firefox-bin continua em execução.",
      "platform.linux.installerHelp": "Se faltar permissão, execute chmod +x instalar-visual.sh remover-visual.sh uma vez."
    },
    en: {
      "app.name": "Groups 'On the Bar'", "app.subtitle": "Your groups always close at hand",
      "button.refresh": "Refresh groups", "button.settings": "Settings", "button.language": "Language", "button.accessibility": "Accessibility", "button.close": "Close",
      "saved.heading": "Saved groups", "saved.infoLabel": "About saved groups", "saved.description": "Open, close, update, or remove shortcuts.",
      "saved.emptyTitle": "No saved groups", "saved.emptyText": "Open a Firefox tab group once to import it automatically.",
      "filter.label": "Filter groups", "filter.all": "All", "filter.open": "Open", "filter.closed": "Closed",
      "filter.emptyOpenTitle": "No open groups", "filter.emptyOpenText": "Open saved groups will appear here.",
      "filter.emptyClosedTitle": "No closed groups", "filter.emptyClosedText": "All saved groups are open.",
      "status.currentWindow": "This window", "status.otherWindow": "Other window", "status.closed": "Closed",
      "tabs.one": "{count} tab", "tabs.many": "{count} tabs", "tabs.skippedOne": "{count} not restorable", "tabs.skippedMany": "{count} not restorable",
      "action.open": "Open group", "action.close": "Save and close", "action.edit": "Edit group", "action.pin": "Pin shortcut to the bar", "action.unpin": "Remove shortcut from the bar", "action.delete": "Delete saved group",
      "notice.noResponse": "The extension did not respond.", "notice.closed": "“{title}” was saved and closed.", "notice.pinned": "“{title}” was pinned to the bar.", "notice.unpinned": "Shortcut removed from the bar.", "notice.deleted": "“{title}” was removed from saved groups.", "notice.updated": "Name and color updated.", "notice.autoPinOn": "New groups will be pinned automatically.", "notice.autoPinOff": "Automatic pinning disabled.",
      "confirm.deleteOpen": "The group will remain open but will no longer be tracked. Delete the saved group?", "confirm.deleteClosed": "Delete this saved group and its shortcut?",
      "sync.preparingTitle": "Preparing local data…", "sync.preparingText": "Firefox controls delivery to your Mozilla account and other computers.", "sync.unavailableTitle": "Firefox Sync unavailable", "sync.unavailableText": "Groups remain saved on this computer only.", "sync.localOnlyTitle": "Some groups are only on this computer", "sync.errorText": "A local error occurred. Your groups remain preserved on this computer.", "sync.pendingTitle": "Sync pending", "sync.pendingOne": "{count} change is waiting for Firefox Sync.", "sync.pendingMany": "{count} changes are waiting for Firefox Sync.", "sync.readyTitle": "Locally ready for Firefox Sync", "sync.readyText": "No local errors detected. Firefox controls delivery to other computers.",
      "error.operationFailed": "The operation could not be completed.", "error.groupMissing": "This group no longer exists.", "error.noRestorableTabs": "This group has no tabs the extension can restore.", "error.syncFailed": "The data could not be prepared for Firefox Sync.",
      "autoPin.title": "Automatically pin new groups", "autoPin.text": "Every new group will appear on the bar.", "visual.title": "Chip appearance", "visual.text": "Install, check, or remove on Desktop", "visual.dismiss": "Hide the chip appearance suggestion", "settings.title": "Settings", "settings.text": "Persistent preferences for this Firefox.",
      "edit.title": "Edit group", "edit.text": "The shortcut and open group will be updated together.", "edit.name": "Name", "edit.color": "Color", "edit.cancel": "Cancel", "edit.save": "Save",
      "language.title": "Choose language", "language.text": "Your choice will be saved in this Firefox.", "language.pt-BR": "Português (Brasil)", "language.en": "English", "language.es": "Español",
      "access.title": "Accessibility", "access.text": "Adjust reading and interface motion.", "access.fontTitle": "Text size", "access.font.small": "Small", "access.font.default": "Default", "access.font.large": "Large", "access.font.extra-large": "Extra large", "access.contrastTitle": "High contrast", "access.contrastText": "Strengthens outlines, text, and buttons.", "access.motionTitle": "Reduce motion", "access.motionText": "Removes decorative transitions and movement.", "access.reset": "Restore defaults", "access.confirmReset": "Restore accessibility settings to their defaults?",
      "color.grey": "Gray", "color.blue": "Blue", "color.red": "Red", "color.yellow": "Yellow", "color.green": "Green", "color.pink": "Pink", "color.purple": "Purple", "color.cyan": "Cyan", "color.orange": "Orange",
      "menu.addGeneric": "Add tabs to a group", "menu.pinnedOne": "A pinned tab cannot be grouped", "menu.pinnedMany": "Pinned tabs cannot be grouped", "menu.addPartial": "Add {eligible} of {total} tabs to a group (pinned tabs stay out)", "menu.addOne": "Add this tab to a group", "menu.addMany": "Add {count} tabs to a group", "menu.newGroup": "Create new group", "menu.pinGroup": "Pin this group to the bookmarks bar", "menu.openVisual": "Open appearance assistant", "group.untitled": "Untitled group", "group.defaultName": "Group {number}",
      "launcher.updatingTitle": "Updating group…", "launcher.updatingText": "One moment while the group is opened or saved and closed.", "launcher.retry": "Try again", "launcher.invalidTitle": "Invalid shortcut", "launcher.invalidText": "Open Groups 'On the Bar' and create the shortcut again.", "launcher.openError": "Could not open the group.", "launcher.closedTitle": "Group saved and closed", "launcher.closedText": "The shortcut remains available on the bookmarks bar.", "launcher.partialTitle": "Group opened with limitations", "launcher.partialText": "{count} internal Firefox tab(s) could not be restored.", "launcher.failedTitle": "Could not open",
      "visualAssistant.subtitle": "Appearance assistant", "visualAssistant.close": "Close", "visualAssistant.eyebrow": "Optional appearance for Firefox Desktop", "visualAssistant.heroTitle": "Turn shortcuts into colored chips", "visualAssistant.heroText": "The installer removes the globe, uses each group's real color, and keeps only its name. Opening and closing groups remains under the extension's control.", "visualAssistant.previewLabel": "Example of the visual result", "visualAssistant.previewCaption": "No globe icon or emoji", "visualAssistant.checking": "Checking your system…", "visualAssistant.checkingText": "The package will be enabled when detection finishes.", "visualAssistant.guided": "Guided installation", "visualAssistant.fourSteps": "Four steps", "visualAssistant.step1Title": "Download the appearance package", "visualAssistant.step1Text": "It is already included in this extension and does not access any server.", "visualAssistant.waiting": "Waiting for system detection", "visualAssistant.downloadStarted": "Download started. Open the ZIP in your Downloads folder.", "visualAssistant.step2Title": "Extract the ZIP", "visualAssistant.step2Text": "Keep the extracted files together. The installer uses the stylesheet in the same folder.", "visualAssistant.step3Title": "Quit Firefox completely", "visualAssistant.step3Text": "The assistant will show the correct instructions for your system.", "visualAssistant.step4Title": "Run the installer and restart", "visualAssistant.step4Text": "The instructions will adapt to your operating system.", "visualAssistant.temporaryTitle": "In this temporary version", "visualAssistant.temporaryText": "After restarting Firefox, load the same manifest.json again in about:debugging. This step disappears in the signed Firefox version.", "visualAssistant.removeSummary": "How to remove the appearance", "visualAssistant.removeDefault": "The package includes an uninstaller that preserves other Firefox customizations.", "visualAssistant.troubleshootSummary": "If the chip does not appear", "visualAssistant.restartDefault": "Confirm that Firefox was completely closed before installation.", "visualAssistant.reloadHelp": "After installing the appearance, quit Firefox completely and open it again.", "visualAssistant.installerDefault": "Check the README instructions included in the package.", "visualAssistant.otherSystemSummary": "Download for another system", "visualAssistant.otherSystemText": "All three packages are embedded in this extension. Choose manually when preparing installation for another computer.", "visualAssistant.privacy": "The assistant works locally. It does not send your groups, bookmarks, or history to any server.", "visualAssistant.detected": "{name} detected — compatible package", "visualAssistant.downloadFor": "Download installer for {name}", "visualAssistant.detectedUnsupported": "{name} detected", "visualAssistant.unsupportedText": "Automatic appearance is available for Firefox Desktop on macOS, Windows, and Linux.", "visualAssistant.chooseBelow": "Choose a package below", "visualAssistant.unknownSystem": "Unidentified system", "visualAssistant.unsupportedSystem": "Unsupported system",
      "platform.mac.description": "The package includes an installer and uninstaller for the default Firefox profile.", "platform.mac.quitTitle": "Quit Firefox completely", "platform.mac.quitDescription": "Use ⌘ + Q. Closing only the window does not apply the change.", "platform.mac.installerTitle": "Open the installer and restart", "platform.mac.installerDescription": "Right-click Instalar-visual.command, choose Open, and confirm. Then open Firefox again.", "platform.mac.removeDescription": "Close Firefox and open Remover-visual.command from the ZIP. It removes only the Groups 'On the Bar' style.", "platform.mac.restartHelp": "Confirm that you used ⌘ + Q before running the installer.", "platform.mac.installerHelp": "If macOS blocks the script, use right-click → Open instead of double-clicking.",
      "platform.win.description": "Compatible with standard Firefox and the Microsoft Store version.", "platform.win.quitTitle": "Close every Firefox window", "platform.win.quitDescription": "Choose Exit from the Firefox menu before running the installer.", "platform.win.installerTitle": "Run the installer and restart", "platform.win.installerDescription": "Double-click Instalar-visual.cmd, wait for confirmation, and open Firefox again.", "platform.win.removeDescription": "Close Firefox and run Remover-visual.cmd. It removes only the Groups 'On the Bar' style.", "platform.win.restartHelp": "Confirm that no Firefox window or process is running.", "platform.win.installerHelp": "If Windows blocks the file, see the Unblock section in the package README.",
      "platform.linux.description": "Compatible with standard, Flatpak, and Snap Firefox installations.", "platform.linux.quitTitle": "Close Firefox completely", "platform.linux.quitDescription": "Close every Firefox window before opening the terminal.", "platform.linux.installerTitle": "Run the installer in the terminal", "platform.linux.installerDescription": "Inside the extracted folder, run ./instalar-visual.sh and then open Firefox again.", "platform.linux.removeDescription": "Close Firefox and run ./remover-visual.sh. It removes only the Groups 'On the Bar' style.", "platform.linux.restartHelp": "Confirm that no firefox or firefox-bin process is still running.", "platform.linux.installerHelp": "If permission is missing, run chmod +x instalar-visual.sh remover-visual.sh once."
    },
    es: {
      "app.name": "Grupos 'On the Bar'", "app.subtitle": "Tus grupos siempre a mano",
      "button.refresh": "Actualizar grupos", "button.settings": "Configuración", "button.language": "Idioma", "button.accessibility": "Accesibilidad", "button.close": "Cerrar",
      "saved.heading": "Grupos guardados", "saved.infoLabel": "Acerca de los grupos guardados", "saved.description": "Abre, cierra, actualiza o elimina los accesos directos.",
      "saved.emptyTitle": "No hay grupos guardados", "saved.emptyText": "Abre una vez un grupo de pestañas de Firefox para importarlo automáticamente.",
      "filter.label": "Filtrar grupos", "filter.all": "Todos", "filter.open": "Abiertos", "filter.closed": "Cerrados",
      "filter.emptyOpenTitle": "No hay grupos abiertos", "filter.emptyOpenText": "Los grupos guardados abiertos aparecerán aquí.",
      "filter.emptyClosedTitle": "No hay grupos cerrados", "filter.emptyClosedText": "Todos los grupos guardados están abiertos.",
      "status.currentWindow": "En esta ventana", "status.otherWindow": "Otra ventana", "status.closed": "Cerrado",
      "tabs.one": "{count} pestaña", "tabs.many": "{count} pestañas", "tabs.skippedOne": "{count} no restaurable", "tabs.skippedMany": "{count} no restaurables",
      "action.open": "Abrir grupo", "action.close": "Guardar y cerrar", "action.edit": "Editar grupo", "action.pin": "Fijar acceso directo en la barra", "action.unpin": "Quitar acceso directo de la barra", "action.delete": "Eliminar grupo guardado",
      "notice.noResponse": "La extensión no respondió.", "notice.closed": "“{title}” se guardó y cerró.", "notice.pinned": "“{title}” se fijó en la barra.", "notice.unpinned": "Acceso directo eliminado de la barra.", "notice.deleted": "“{title}” se eliminó de los grupos guardados.", "notice.updated": "Nombre y color actualizados.", "notice.autoPinOn": "Los grupos nuevos se fijarán automáticamente.", "notice.autoPinOff": "Fijación automática desactivada.",
      "confirm.deleteOpen": "El grupo seguirá abierto, pero dejará de estar supervisado. ¿Eliminar el grupo guardado?", "confirm.deleteClosed": "¿Eliminar este grupo guardado y su acceso directo?",
      "sync.preparingTitle": "Preparando los datos locales…", "sync.preparingText": "Firefox controla el envío a tu cuenta Mozilla y a otros equipos.", "sync.unavailableTitle": "Firefox Sync no disponible", "sync.unavailableText": "Los grupos siguen guardados solo en este equipo.", "sync.localOnlyTitle": "Algunos grupos están solo en este equipo", "sync.errorText": "Se produjo un error local. Tus grupos siguen protegidos en este equipo.", "sync.pendingTitle": "Sincronización pendiente", "sync.pendingOne": "{count} cambio está esperando Firefox Sync.", "sync.pendingMany": "{count} cambios están esperando Firefox Sync.", "sync.readyTitle": "Listo localmente para Firefox Sync", "sync.readyText": "No se detectaron errores locales. Firefox controla el envío a otros equipos.",
      "error.operationFailed": "No se pudo completar la operación.", "error.groupMissing": "Este grupo ya no existe.", "error.noRestorableTabs": "Este grupo no tiene pestañas que la extensión pueda restaurar.", "error.syncFailed": "No se pudieron preparar los datos para Firefox Sync.",
      "autoPin.title": "Fijar automáticamente los grupos nuevos", "autoPin.text": "Cada grupo nuevo aparecerá en la barra.", "visual.title": "Aspecto de chip", "visual.text": "Instalar, comprobar o eliminar en Desktop", "visual.dismiss": "Ocultar la sugerencia del aspecto de chip", "settings.title": "Configuración", "settings.text": "Preferencias permanentes de este Firefox.",
      "edit.title": "Editar grupo", "edit.text": "El acceso directo y el grupo abierto se actualizarán juntos.", "edit.name": "Nombre", "edit.color": "Color", "edit.cancel": "Cancelar", "edit.save": "Guardar",
      "language.title": "Elegir idioma", "language.text": "La elección se guardará en este Firefox.", "language.pt-BR": "Português (Brasil)", "language.en": "English", "language.es": "Español",
      "access.title": "Accesibilidad", "access.text": "Ajusta la lectura y el movimiento de la interfaz.", "access.fontTitle": "Tamaño del texto", "access.font.small": "Pequeño", "access.font.default": "Predeterminado", "access.font.large": "Grande", "access.font.extra-large": "Muy grande", "access.contrastTitle": "Alto contraste", "access.contrastText": "Refuerza contornos, textos y botones.", "access.motionTitle": "Reducir animaciones", "access.motionText": "Elimina transiciones y movimientos decorativos.", "access.reset": "Restaurar valores predeterminados", "access.confirmReset": "¿Restaurar la configuración de accesibilidad a los valores predeterminados?",
      "color.grey": "Gris", "color.blue": "Azul", "color.red": "Rojo", "color.yellow": "Amarillo", "color.green": "Verde", "color.pink": "Rosa", "color.purple": "Morado", "color.cyan": "Cian", "color.orange": "Naranja",
      "menu.addGeneric": "Añadir pestañas a un grupo", "menu.pinnedOne": "Una pestaña fijada no puede agruparse", "menu.pinnedMany": "Las pestañas fijadas no pueden agruparse", "menu.addPartial": "Añadir {eligible} de {total} pestañas a un grupo (las fijadas quedan fuera)", "menu.addOne": "Añadir esta pestaña a un grupo", "menu.addMany": "Añadir {count} pestañas a un grupo", "menu.newGroup": "Crear grupo nuevo", "menu.pinGroup": "Fijar este grupo en la barra de marcadores", "menu.openVisual": "Abrir asistente visual", "group.untitled": "Grupo sin nombre", "group.defaultName": "Grupo {number}",
      "launcher.updatingTitle": "Actualizando grupo…", "launcher.updatingText": "Un momento mientras el grupo se abre o se guarda y cierra.", "launcher.retry": "Intentar de nuevo", "launcher.invalidTitle": "Acceso directo no válido", "launcher.invalidText": "Abre Grupos 'On the Bar' y crea de nuevo el acceso directo.", "launcher.openError": "No se pudo abrir el grupo.", "launcher.closedTitle": "Grupo guardado y cerrado", "launcher.closedText": "El acceso directo sigue disponible en la barra de marcadores.", "launcher.partialTitle": "Grupo abierto con limitaciones", "launcher.partialText": "No se pudieron restaurar {count} pestaña(s) interna(s) de Firefox.", "launcher.failedTitle": "No se pudo abrir",
      "visualAssistant.subtitle": "Asistente visual", "visualAssistant.close": "Cerrar", "visualAssistant.eyebrow": "Aspecto opcional para Firefox Desktop", "visualAssistant.heroTitle": "Convierte los accesos directos en chips de colores", "visualAssistant.heroText": "El instalador elimina el globo, usa el color real de cada grupo y conserva solo el nombre. La apertura y el cierre de los grupos siguen bajo el control de la extensión.", "visualAssistant.previewLabel": "Ejemplo del resultado visual", "visualAssistant.previewCaption": "Sin icono de globo ni emoji", "visualAssistant.checking": "Comprobando tu sistema…", "visualAssistant.checkingText": "El paquete se habilitará cuando termine la detección.", "visualAssistant.guided": "Instalación guiada", "visualAssistant.fourSteps": "Cuatro pasos", "visualAssistant.step1Title": "Descarga el paquete visual", "visualAssistant.step1Text": "Ya está incluido en esta extensión y no accede a ningún servidor.", "visualAssistant.waiting": "Esperando la detección del sistema", "visualAssistant.downloadStarted": "Descarga iniciada. Abre el ZIP en la carpeta Descargas.", "visualAssistant.step2Title": "Extrae el ZIP", "visualAssistant.step2Text": "Mantén juntos los archivos extraídos. El instalador usa la hoja de estilos incluida en la misma carpeta.", "visualAssistant.step3Title": "Cierra Firefox por completo", "visualAssistant.step3Text": "El asistente mostrará la instrucción correcta para tu sistema.", "visualAssistant.step4Title": "Ejecuta el instalador y reinicia", "visualAssistant.step4Text": "La instrucción se adaptará a tu sistema operativo.", "visualAssistant.temporaryTitle": "En esta versión temporal", "visualAssistant.temporaryText": "Al reiniciar Firefox, vuelve a cargar el mismo manifest.json en about:debugging. En la versión firmada por Firefox, este paso desaparece.", "visualAssistant.removeSummary": "Cómo eliminar el aspecto", "visualAssistant.removeDefault": "El paquete incluye un eliminador que conserva otras personalizaciones de Firefox.", "visualAssistant.troubleshootSummary": "Si el chip no aparece", "visualAssistant.restartDefault": "Confirma que Firefox se cerró por completo antes de la instalación.", "visualAssistant.reloadHelp": "Después de instalar el aspecto, cierra Firefox por completo y vuelve a abrirlo.", "visualAssistant.installerDefault": "Consulta las instrucciones del README incluido en el paquete.", "visualAssistant.otherSystemSummary": "Descargar para otro sistema", "visualAssistant.otherSystemText": "Los tres paquetes están incorporados en esta extensión. Elige manualmente si preparas la instalación para otro equipo.", "visualAssistant.privacy": "El asistente funciona localmente. No envía tus grupos, marcadores ni historial a ningún servidor.", "visualAssistant.detected": "{name} detectado — paquete compatible", "visualAssistant.downloadFor": "Descargar instalador para {name}", "visualAssistant.detectedUnsupported": "{name} detectado", "visualAssistant.unsupportedText": "El aspecto automático está disponible para Firefox Desktop en macOS, Windows y Linux.", "visualAssistant.chooseBelow": "Elige un paquete abajo", "visualAssistant.unknownSystem": "Sistema no identificado", "visualAssistant.unsupportedSystem": "Sistema no compatible",
      "platform.mac.description": "El paquete incluye instalador y eliminador para el perfil predeterminado de Firefox.", "platform.mac.quitTitle": "Cierra Firefox por completo", "platform.mac.quitDescription": "Usa ⌘ + Q. Cerrar solo la ventana no aplica el cambio.", "platform.mac.installerTitle": "Abre el instalador y reinicia", "platform.mac.installerDescription": "Haz clic derecho en Instalar-visual.command, elige Abrir y confirma. Después, vuelve a abrir Firefox.", "platform.mac.removeDescription": "Cierra Firefox y abre Remover-visual.command, incluido en el ZIP. Solo elimina el estilo de Grupos 'On the Bar'.", "platform.mac.restartHelp": "Confirma que usaste ⌘ + Q antes de ejecutar el instalador.", "platform.mac.installerHelp": "Si macOS bloquea el script, usa clic derecho → Abrir en vez de doble clic.",
      "platform.win.description": "Compatible con Firefox tradicional y con la versión de Microsoft Store.", "platform.win.quitTitle": "Cierra todas las ventanas de Firefox", "platform.win.quitDescription": "En el menú de Firefox, elige Salir antes de ejecutar el instalador.", "platform.win.installerTitle": "Ejecuta el instalador y reinicia", "platform.win.installerDescription": "Haz doble clic en Instalar-visual.cmd, espera la confirmación y vuelve a abrir Firefox.", "platform.win.removeDescription": "Cierra Firefox y ejecuta Remover-visual.cmd. Solo elimina el estilo de Grupos 'On the Bar'.", "platform.win.restartHelp": "Confirma que no hay ninguna ventana ni proceso de Firefox abierto.", "platform.win.installerHelp": "Si Windows bloquea el archivo, consulta la sección Desbloquear del README del paquete.",
      "platform.linux.description": "Compatible con instalaciones normales, Flatpak y Snap de Firefox.", "platform.linux.quitTitle": "Cierra Firefox por completo", "platform.linux.quitDescription": "Cierra todas las ventanas de Firefox antes de abrir la terminal.", "platform.linux.installerTitle": "Ejecuta el instalador en la terminal", "platform.linux.installerDescription": "Dentro de la carpeta extraída, ejecuta ./instalar-visual.sh y después vuelve a abrir Firefox.", "platform.linux.removeDescription": "Cierra Firefox y ejecuta ./remover-visual.sh. Solo elimina el estilo de Grupos 'On the Bar'.", "platform.linux.restartHelp": "Confirma que no sigue activo ningún proceso firefox o firefox-bin.", "platform.linux.installerHelp": "Si falta permiso, ejecuta chmod +x instalar-visual.sh remover-visual.sh una vez."
    }
  };

  const extraMessages = globalThis.GruposExtraMessages || {};
  for (const language of ["zh-CN", "ja", "ko", "de", "fr", "ru"]) {
    MESSAGES[language] = { ...MESSAGES.en, ...(extraMessages[language] || {}) };
  }

  const LANGUAGE_NAMES = Object.freeze({
    "language.en": "English",
    "language.zh-CN": "简体中文",
    "language.ja": "日本語",
    "language.ko": "한국어",
    "language.de": "Deutsch",
    "language.fr": "Français",
    "language.es": "Español",
    "language.pt-BR": "Português (Brasil)",
    "language.ru": "Русский"
  });
  for (const dictionary of Object.values(MESSAGES)) {
    Object.assign(dictionary, LANGUAGE_NAMES);
  }

  const FEATURE_MESSAGES = {
    "pt-BR": {
      "sync.infoLabel": "Sobre o estado do Firefox Sync",
      "edit.icon": "Ícone",
      "edit.color": "Cor do grupo e do ícone",
      "action.keepAtTop": "Manter grupo no topo",
      "action.stopKeepingAtTop": "Parar de manter o grupo no topo",
      "notice.keptAtTop": "“{title}” será mantido no topo, depois das abas fixadas.",
      "notice.keepAtTopOff": "O grupo não será mais mantido no topo.",
      "notice.updated": "Nome, ícone e cor atualizados.",
      "icon.none": "Sem ícone",
      "icon.folder": "Pasta",
      "icon.star": "Estrela",
      "icon.chat": "Conversa",
      "icon.briefcase": "Trabalho",
      "icon.book": "Livro",
      "icon.code": "Código",
      "icon.globe": "Mundo",
      "icon.shopping": "Compras",
      "icon.music": "Música",
      "icon.heart": "Coração",
      "icon.idea": "Ideia",
      "visualAssistant.reloadHelp": "Depois de instalar o visual, encerre completamente e abra novamente o Firefox."
    },
    en: {
      "sync.infoLabel": "About Firefox Sync status",
      "edit.icon": "Icon",
      "edit.color": "Group and icon color",
      "action.keepAtTop": "Keep group at the top",
      "action.stopKeepingAtTop": "Stop keeping the group at the top",
      "notice.keptAtTop": "“{title}” will stay at the top, after pinned tabs.",
      "notice.keepAtTopOff": "The group will no longer be kept at the top.",
      "notice.updated": "Name, icon, and color updated.",
      "icon.none": "No icon",
      "icon.folder": "Folder",
      "icon.star": "Star",
      "icon.chat": "Chat",
      "icon.briefcase": "Work",
      "icon.book": "Book",
      "icon.code": "Code",
      "icon.globe": "World",
      "icon.shopping": "Shopping",
      "icon.music": "Music",
      "icon.heart": "Heart",
      "icon.idea": "Idea",
      "visualAssistant.reloadHelp": "After installing the appearance, quit Firefox completely and open it again."
    },
    "zh-CN": {
      "sync.infoLabel": "关于 Firefox 同步状态",
      "edit.icon": "图标",
      "edit.color": "分组和图标颜色",
      "action.keepAtTop": "将分组保持在顶部",
      "action.stopKeepingAtTop": "停止将分组保持在顶部",
      "notice.keptAtTop": "“{title}”将保持在固定标签页之后的顶部。",
      "notice.keepAtTopOff": "该分组将不再保持在顶部。",
      "notice.updated": "名称、图标和颜色已更新。",
      "icon.none": "无图标",
      "icon.folder": "文件夹",
      "icon.star": "星标",
      "icon.chat": "对话",
      "icon.briefcase": "工作",
      "icon.book": "书籍",
      "icon.code": "代码",
      "icon.globe": "世界",
      "icon.shopping": "购物",
      "icon.music": "音乐",
      "icon.heart": "爱心",
      "icon.idea": "想法",
      "visualAssistant.reloadHelp": "安装外观后，请完全退出 Firefox，然后重新打开。"
    },
    ja: {
      "sync.infoLabel": "Firefox Sync の状態について",
      "edit.icon": "アイコン",
      "edit.color": "グループとアイコンの色",
      "action.keepAtTop": "グループを上部に固定",
      "action.stopKeepingAtTop": "グループの上部固定を解除",
      "notice.keptAtTop": "「{title}」は固定タブの後ろの上部に配置されます。",
      "notice.keepAtTopOff": "グループを上部に固定しないようにしました。",
      "notice.updated": "名前、アイコン、色を更新しました。",
      "icon.none": "アイコンなし",
      "icon.folder": "フォルダー",
      "icon.star": "スター",
      "icon.chat": "チャット",
      "icon.briefcase": "仕事",
      "icon.book": "本",
      "icon.code": "コード",
      "icon.globe": "世界",
      "icon.shopping": "買い物",
      "icon.music": "音楽",
      "icon.heart": "ハート",
      "icon.idea": "アイデア",
      "visualAssistant.reloadHelp": "外観をインストールしたら、Firefox を完全に終了してから開き直してください。"
    },
    ko: {
      "sync.infoLabel": "Firefox Sync 상태 정보",
      "edit.icon": "아이콘",
      "edit.color": "그룹 및 아이콘 색상",
      "action.keepAtTop": "그룹을 맨 위에 유지",
      "action.stopKeepingAtTop": "그룹을 맨 위에 유지하지 않기",
      "notice.keptAtTop": "“{title}” 그룹은 고정 탭 다음의 맨 위에 유지됩니다.",
      "notice.keepAtTopOff": "그룹을 더 이상 맨 위에 유지하지 않습니다.",
      "notice.updated": "이름, 아이콘 및 색상을 업데이트했습니다.",
      "icon.none": "아이콘 없음",
      "icon.folder": "폴더",
      "icon.star": "별",
      "icon.chat": "대화",
      "icon.briefcase": "업무",
      "icon.book": "책",
      "icon.code": "코드",
      "icon.globe": "세계",
      "icon.shopping": "쇼핑",
      "icon.music": "음악",
      "icon.heart": "하트",
      "icon.idea": "아이디어",
      "visualAssistant.reloadHelp": "외관을 설치한 뒤 Firefox를 완전히 종료하고 다시 여세요."
    },
    de: {
      "sync.infoLabel": "Über den Firefox-Sync-Status",
      "edit.icon": "Symbol",
      "edit.color": "Farbe für Gruppe und Symbol",
      "action.keepAtTop": "Gruppe oben halten",
      "action.stopKeepingAtTop": "Gruppe nicht mehr oben halten",
      "notice.keptAtTop": "„{title}“ bleibt oben, direkt nach angehefteten Tabs.",
      "notice.keepAtTopOff": "Die Gruppe wird nicht mehr oben gehalten.",
      "notice.updated": "Name, Symbol und Farbe aktualisiert.",
      "icon.none": "Kein Symbol",
      "icon.folder": "Ordner",
      "icon.star": "Stern",
      "icon.chat": "Chat",
      "icon.briefcase": "Arbeit",
      "icon.book": "Buch",
      "icon.code": "Code",
      "icon.globe": "Welt",
      "icon.shopping": "Einkaufen",
      "icon.music": "Musik",
      "icon.heart": "Herz",
      "icon.idea": "Idee",
      "visualAssistant.reloadHelp": "Beende Firefox nach der Installation vollständig und öffne es erneut."
    },
    fr: {
      "sync.infoLabel": "À propos de l’état de Firefox Sync",
      "edit.icon": "Icône",
      "edit.color": "Couleur du groupe et de l’icône",
      "action.keepAtTop": "Garder le groupe en haut",
      "action.stopKeepingAtTop": "Ne plus garder le groupe en haut",
      "notice.keptAtTop": "« {title} » restera en haut, après les onglets épinglés.",
      "notice.keepAtTopOff": "Le groupe ne sera plus maintenu en haut.",
      "notice.updated": "Nom, icône et couleur mis à jour.",
      "icon.none": "Sans icône",
      "icon.folder": "Dossier",
      "icon.star": "Étoile",
      "icon.chat": "Discussion",
      "icon.briefcase": "Travail",
      "icon.book": "Livre",
      "icon.code": "Code",
      "icon.globe": "Monde",
      "icon.shopping": "Achats",
      "icon.music": "Musique",
      "icon.heart": "Cœur",
      "icon.idea": "Idée",
      "visualAssistant.reloadHelp": "Après l’installation de l’apparence, quittez complètement Firefox puis rouvrez-le."
    },
    es: {
      "sync.infoLabel": "Acerca del estado de Firefox Sync",
      "edit.icon": "Icono",
      "edit.color": "Color del grupo y del icono",
      "action.keepAtTop": "Mantener el grupo arriba",
      "action.stopKeepingAtTop": "Dejar de mantener el grupo arriba",
      "notice.keptAtTop": "“{title}” permanecerá arriba, después de las pestañas fijadas.",
      "notice.keepAtTopOff": "El grupo dejará de mantenerse arriba.",
      "notice.updated": "Nombre, icono y color actualizados.",
      "icon.none": "Sin icono",
      "icon.folder": "Carpeta",
      "icon.star": "Estrella",
      "icon.chat": "Conversación",
      "icon.briefcase": "Trabajo",
      "icon.book": "Libro",
      "icon.code": "Código",
      "icon.globe": "Mundo",
      "icon.shopping": "Compras",
      "icon.music": "Música",
      "icon.heart": "Corazón",
      "icon.idea": "Idea",
      "visualAssistant.reloadHelp": "Después de instalar el aspecto, cierra Firefox por completo y vuelve a abrirlo."
    },
    ru: {
      "sync.infoLabel": "О состоянии Firefox Sync",
      "edit.icon": "Значок",
      "edit.color": "Цвет группы и значка",
      "action.keepAtTop": "Держать группу вверху",
      "action.stopKeepingAtTop": "Не держать группу вверху",
      "notice.keptAtTop": "Группа «{title}» останется вверху после закреплённых вкладок.",
      "notice.keepAtTopOff": "Группа больше не будет удерживаться вверху.",
      "notice.updated": "Название, значок и цвет обновлены.",
      "icon.none": "Без значка",
      "icon.folder": "Папка",
      "icon.star": "Звезда",
      "icon.chat": "Чат",
      "icon.briefcase": "Работа",
      "icon.book": "Книга",
      "icon.code": "Код",
      "icon.globe": "Мир",
      "icon.shopping": "Покупки",
      "icon.music": "Музыка",
      "icon.heart": "Сердце",
      "icon.idea": "Идея",
      "visualAssistant.reloadHelp": "После установки оформления полностью закройте Firefox и откройте его снова."
    }
  };
  for (const [language, dictionary] of Object.entries(FEATURE_MESSAGES)) {
    Object.assign(MESSAGES[language], dictionary);
  }

  const VISUAL_ICON_MESSAGES = {
    "pt-BR": {
      "visualAssistant.heroText": "O instalador remove o globo, usa a cor real de cada grupo e mostra o ícone opcional escolhido. A abertura e o fechamento continuam sob controle da extensão.",
      "visualAssistant.previewCaption": "Sem o globo padrão; o ícone do grupo é opcional"
    },
    en: {
      "visualAssistant.heroText": "The installer removes the globe, uses each group's real color, and shows the optional icon you choose. Opening and closing remain under the extension's control.",
      "visualAssistant.previewCaption": "No default globe; the group icon is optional"
    },
    "zh-CN": {
      "visualAssistant.heroText": "安装程序会移除地球图标，使用每个标签组的实际颜色，并显示您选择的可选图标。打开和关闭仍由扩展控制。",
      "visualAssistant.previewCaption": "无默认地球图标；分组图标可选"
    },
    ja: {
      "visualAssistant.heroText": "インストーラーは地球アイコンを消し、各グループの実際の色と選択した任意のアイコンを表示します。開閉は引き続き拡張機能が管理します。",
      "visualAssistant.previewCaption": "標準の地球アイコンなし。グループアイコンは任意"
    },
    ko: {
      "visualAssistant.heroText": "설치 프로그램은 지구본 아이콘을 제거하고 각 그룹의 실제 색상과 선택한 아이콘을 표시합니다. 열기와 닫기는 계속 확장 기능이 관리합니다.",
      "visualAssistant.previewCaption": "기본 지구본 없음; 그룹 아이콘은 선택 사항"
    },
    de: {
      "visualAssistant.heroText": "Das Installationsprogramm entfernt das Globus-Symbol, verwendet die echte Gruppenfarbe und zeigt das optional gewählte Symbol. Öffnen und Schließen bleiben unter Kontrolle der Erweiterung.",
      "visualAssistant.previewCaption": "Kein Standardglobus; das Gruppensymbol ist optional"
    },
    fr: {
      "visualAssistant.heroText": "Le programme d’installation retire le globe, utilise la couleur réelle du groupe et affiche l’icône facultative choisie. L’ouverture et la fermeture restent contrôlées par l’extension.",
      "visualAssistant.previewCaption": "Sans globe par défaut ; l’icône du groupe est facultative"
    },
    es: {
      "visualAssistant.heroText": "El instalador elimina el globo, usa el color real del grupo y muestra el icono opcional elegido. La apertura y el cierre siguen bajo el control de la extensión.",
      "visualAssistant.previewCaption": "Sin globo predeterminado; el icono del grupo es opcional"
    },
    ru: {
      "visualAssistant.heroText": "Установщик удаляет значок глобуса, использует настоящий цвет группы и показывает выбранный необязательный значок. Открытием и закрытием по-прежнему управляет расширение.",
      "visualAssistant.previewCaption": "Без стандартного глобуса; значок группы необязателен"
    }
  };
  for (const [language, dictionary] of Object.entries(VISUAL_ICON_MESSAGES)) {
    Object.assign(MESSAGES[language], dictionary);
  }

  const ARCHIVE_MESSAGES = {
    "pt-BR": {
      "filter.archived": "Arquivados",
      "filter.includeArchived": "Incluir arquivados em Todos",
      "filter.includeArchivedInfoLabel": "Sobre os arquivados em Todos",
      "filter.includeArchivedInfo": "Desligado por padrão para listas grandes. Arquivados continuam disponíveis no filtro próprio.",
      "filter.emptyArchivedTitle": "Nenhum grupo arquivado",
      "filter.emptyArchivedText": "Grupos arquivados ficam guardados sem ocupar a lista principal.",
      "filter.emptyAllTitle": "Nenhum grupo ativo",
      "filter.emptyAllText": "Os grupos arquivados estão no filtro Arquivados ou podem ser incluídos em Todos.",
      "status.archived": "Arquivado",
      "action.archive": "Arquivar grupo",
      "action.unarchive": "Restaurar grupo do arquivo",
      "notice.archived": "“{title}” foi salvo, fechado e arquivado.",
      "notice.unarchived": "“{title}” voltou aos grupos fechados.",
      "icon.home": "Casa",
      "icon.camera": "Câmera",
      "icon.plane": "Viagem",
      "icon.game": "Jogo"
    },
    en: {
      "filter.archived": "Archived",
      "filter.includeArchived": "Include archived in All",
      "filter.includeArchivedInfoLabel": "About archived groups in All",
      "filter.includeArchivedInfo": "Off by default for large lists. Archived groups remain available in their own filter.",
      "filter.emptyArchivedTitle": "No archived groups",
      "filter.emptyArchivedText": "Archived groups stay saved without filling the main list.",
      "filter.emptyAllTitle": "No active groups",
      "filter.emptyAllText": "Archived groups are in the Archived filter or can be included in All.",
      "status.archived": "Archived",
      "action.archive": "Archive group",
      "action.unarchive": "Restore archived group",
      "notice.archived": "“{title}” was saved, closed, and archived.",
      "notice.unarchived": "“{title}” returned to closed groups.",
      "icon.home": "Home",
      "icon.camera": "Camera",
      "icon.plane": "Travel",
      "icon.game": "Game"
    },
    "zh-CN": {
      "filter.archived": "已归档",
      "filter.includeArchived": "在“全部”中包含已归档",
      "filter.includeArchivedInfoLabel": "关于“全部”中的已归档分组",
      "filter.includeArchivedInfo": "为避免列表过长，此选项默认关闭。已归档分组仍可在专用筛选器中查看。",
      "filter.emptyArchivedTitle": "没有已归档分组",
      "filter.emptyArchivedText": "已归档分组会保留，但不会占用主列表。",
      "filter.emptyAllTitle": "没有活动分组",
      "filter.emptyAllText": "已归档分组可在“已归档”筛选器中查看，也可以包含在“全部”中。",
      "status.archived": "已归档",
      "action.archive": "归档分组",
      "action.unarchive": "恢复已归档分组",
      "notice.archived": "“{title}”已保存、关闭并归档。",
      "notice.unarchived": "“{title}”已恢复到已关闭分组。",
      "icon.home": "主页",
      "icon.camera": "相机",
      "icon.plane": "旅行",
      "icon.game": "游戏"
    },
    ja: {
      "filter.archived": "アーカイブ",
      "filter.includeArchived": "すべてにアーカイブを含める",
      "filter.includeArchivedInfoLabel": "すべてに表示するアーカイブについて",
      "filter.includeArchivedInfo": "大きな一覧を避けるため初期設定はオフです。アーカイブは専用フィルターで確認できます。",
      "filter.emptyArchivedTitle": "アーカイブされたグループはありません",
      "filter.emptyArchivedText": "アーカイブしたグループはメイン一覧を埋めずに保存されます。",
      "filter.emptyAllTitle": "有効なグループはありません",
      "filter.emptyAllText": "アーカイブは専用フィルターで表示するか、すべてに含められます。",
      "status.archived": "アーカイブ済み",
      "action.archive": "グループをアーカイブ",
      "action.unarchive": "アーカイブから復元",
      "notice.archived": "「{title}」を保存して閉じ、アーカイブしました。",
      "notice.unarchived": "「{title}」を閉じたグループに戻しました。",
      "icon.home": "ホーム",
      "icon.camera": "カメラ",
      "icon.plane": "旅行",
      "icon.game": "ゲーム"
    },
    ko: {
      "filter.archived": "보관됨",
      "filter.includeArchived": "전체에 보관된 그룹 포함",
      "filter.includeArchivedInfoLabel": "전체의 보관된 그룹 정보",
      "filter.includeArchivedInfo": "목록이 길어지는 것을 막기 위해 기본값은 꺼짐입니다. 보관된 그룹은 전용 필터에서 계속 볼 수 있습니다.",
      "filter.emptyArchivedTitle": "보관된 그룹이 없습니다",
      "filter.emptyArchivedText": "보관된 그룹은 기본 목록을 채우지 않고 저장됩니다.",
      "filter.emptyAllTitle": "활성 그룹이 없습니다",
      "filter.emptyAllText": "보관된 그룹은 보관됨 필터에서 보거나 전체에 포함할 수 있습니다.",
      "status.archived": "보관됨",
      "action.archive": "그룹 보관",
      "action.unarchive": "보관된 그룹 복원",
      "notice.archived": "“{title}” 그룹을 저장하고 닫은 뒤 보관했습니다.",
      "notice.unarchived": "“{title}” 그룹을 닫힌 그룹으로 복원했습니다.",
      "icon.home": "홈",
      "icon.camera": "카메라",
      "icon.plane": "여행",
      "icon.game": "게임"
    },
    de: {
      "filter.archived": "Archiviert",
      "filter.includeArchived": "Archivierte in Alle einbeziehen",
      "filter.includeArchivedInfoLabel": "Über archivierte Gruppen in Alle",
      "filter.includeArchivedInfo": "Für große Listen standardmäßig deaktiviert. Archivierte Gruppen bleiben im eigenen Filter verfügbar.",
      "filter.emptyArchivedTitle": "Keine archivierten Gruppen",
      "filter.emptyArchivedText": "Archivierte Gruppen bleiben gespeichert, ohne die Hauptliste zu füllen.",
      "filter.emptyAllTitle": "Keine aktiven Gruppen",
      "filter.emptyAllText": "Archivierte Gruppen stehen im Filter Archiviert oder können in Alle einbezogen werden.",
      "status.archived": "Archiviert",
      "action.archive": "Gruppe archivieren",
      "action.unarchive": "Archivierte Gruppe wiederherstellen",
      "notice.archived": "„{title}“ wurde gespeichert, geschlossen und archiviert.",
      "notice.unarchived": "„{title}“ ist wieder bei den geschlossenen Gruppen.",
      "icon.home": "Zuhause",
      "icon.camera": "Kamera",
      "icon.plane": "Reise",
      "icon.game": "Spiel"
    },
    fr: {
      "filter.archived": "Archivés",
      "filter.includeArchived": "Inclure les archivés dans Tous",
      "filter.includeArchivedInfoLabel": "À propos des groupes archivés dans Tous",
      "filter.includeArchivedInfo": "Désactivé par défaut pour les longues listes. Les groupes archivés restent disponibles dans leur filtre.",
      "filter.emptyArchivedTitle": "Aucun groupe archivé",
      "filter.emptyArchivedText": "Les groupes archivés restent enregistrés sans encombrer la liste principale.",
      "filter.emptyAllTitle": "Aucun groupe actif",
      "filter.emptyAllText": "Les groupes archivés sont dans le filtre Archivés ou peuvent être inclus dans Tous.",
      "status.archived": "Archivé",
      "action.archive": "Archiver le groupe",
      "action.unarchive": "Restaurer le groupe archivé",
      "notice.archived": "« {title} » a été enregistré, fermé et archivé.",
      "notice.unarchived": "« {title} » est revenu dans les groupes fermés.",
      "icon.home": "Maison",
      "icon.camera": "Appareil photo",
      "icon.plane": "Voyage",
      "icon.game": "Jeu"
    },
    es: {
      "filter.archived": "Archivados",
      "filter.includeArchived": "Incluir archivados en Todos",
      "filter.includeArchivedInfoLabel": "Acerca de los grupos archivados en Todos",
      "filter.includeArchivedInfo": "Desactivado de forma predeterminada para listas grandes. Los grupos archivados siguen disponibles en su filtro.",
      "filter.emptyArchivedTitle": "No hay grupos archivados",
      "filter.emptyArchivedText": "Los grupos archivados permanecen guardados sin llenar la lista principal.",
      "filter.emptyAllTitle": "No hay grupos activos",
      "filter.emptyAllText": "Los grupos archivados están en el filtro Archivados o se pueden incluir en Todos.",
      "status.archived": "Archivado",
      "action.archive": "Archivar grupo",
      "action.unarchive": "Restaurar grupo archivado",
      "notice.archived": "“{title}” se guardó, cerró y archivó.",
      "notice.unarchived": "“{title}” volvió a los grupos cerrados.",
      "icon.home": "Casa",
      "icon.camera": "Cámara",
      "icon.plane": "Viaje",
      "icon.game": "Juego"
    },
    ru: {
      "filter.archived": "Архив",
      "filter.includeArchived": "Включать архивные во Все",
      "filter.includeArchivedInfoLabel": "Об архивных группах во Все",
      "filter.includeArchivedInfo": "По умолчанию выключено для больших списков. Архивные группы остаются доступны в отдельном фильтре.",
      "filter.emptyArchivedTitle": "Нет архивных групп",
      "filter.emptyArchivedText": "Архивные группы сохраняются, не заполняя основной список.",
      "filter.emptyAllTitle": "Нет активных групп",
      "filter.emptyAllText": "Архивные группы доступны в фильтре Архив или могут быть включены во Все.",
      "status.archived": "В архиве",
      "action.archive": "Архивировать группу",
      "action.unarchive": "Восстановить группу из архива",
      "notice.archived": "Группа «{title}» сохранена, закрыта и архивирована.",
      "notice.unarchived": "Группа «{title}» возвращена в закрытые.",
      "icon.home": "Дом",
      "icon.camera": "Камера",
      "icon.plane": "Путешествие",
      "icon.game": "Игра"
    }
  };
  for (const [language, dictionary] of Object.entries(ARCHIVE_MESSAGES)) {
    Object.assign(MESSAGES[language], dictionary);
  }

  const BACKUP_MESSAGES = {
    "pt-BR": {
      "action.editShort": "Editar",
      "filter.includeArchivedShort": "Show Archived",
      "action.archiveAllClosed": "Arquivar tudo",
      "confirm.archiveAllClosed": "Arquivar todos os grupos fechados?",
      "action.showMoreGroups": "Mostrar mais {count}",
      "panel.title": "Visualização do painel",
      "panel.text": "Ajuste a quantidade de informações mostradas na lista principal.",
      "panel.infoLabel": "Sobre a visualização do painel",
      "panel.info": "Define quantos grupos aparecem em Todos antes do botão +. Ilimitado mostra todos os grupos.",
      "panel.sliderLabel": "Quantidade de grupos mostrados em Todos",
      "panel.unlimited": "Ilimitado",
      "panel.previewTitle": "Prévia das abas",
      "panel.previewInfoLabel": "Sobre a prévia das abas",
      "panel.previewInfo": "Escolha quantas abas aparecem na prévia de cada grupo.",
      "panel.previewSliderLabel": "Quantidade de abas mostradas na prévia",
      "panel.previewFiveTitle": "Mostrar 5 abas na prévia",
      "panel.previewFiveText": "Desligado: mostra 3 abas. Ligado: mostra 5.",
      "panel.allUnlimitedTitle": "Lista “Todos” ilimitada",
      "panel.allUnlimitedText": "Desligado: mostra 15 grupos e um botão + para revelar mais.",
      "menu.modifyGroup": "Modificar grupo…",
      "sync.readyTitle": "Firefox Sync OK",
      "sync.readyText": "Nenhum erro local. {used} KiB de {total} KiB usados; o Firefox controla o envio aos outros computadores.",
      "sync.storageLabel": "Uso do armazenamento do Firefox Sync",
      "sync.storageUsage": "{percent}% usado: {used} KiB de {total} KiB",
      "backup.title": "Backup dos grupos",
      "backup.preparing": "Verificando o backup automático…",
      "backup.export": "Exportar JSON",
      "backup.restore": "Restaurar cópia anterior",
      "backup.available": "Cópia anterior: {count} grupos · {date}",
      "backup.waiting": "A cópia anterior será criada na próxima alteração sincronizada.",
      "backup.unavailable": "O Firefox Sync não está disponível neste perfil.",
      "backup.exported": "Backup JSON exportado com {count} grupos.",
      "backup.restored": "Cópia anterior restaurada: {count} grupos.",
      "backup.confirmRestore": "Restaurar a cópia anterior do Firefox Sync? Grupos abertos afetados serão salvos e fechados. Os grupos da cópia serão mesclados aos atuais; nenhum grupo extra será apagado."
    },
    en: {
      "action.editShort": "Edit",
      "filter.includeArchivedShort": "Show Archived",
      "action.archiveAllClosed": "Archive all",
      "confirm.archiveAllClosed": "Archive all closed groups?",
      "action.showMoreGroups": "Show {count} more",
      "panel.title": "Panel view",
      "panel.text": "Adjust how much information the main list shows.",
      "panel.infoLabel": "About Panel view",
      "panel.info": "Defines how many groups appear in All before the + button. Unlimited shows every group.",
      "panel.sliderLabel": "Number of groups shown in All",
      "panel.unlimited": "Unlimited",
      "panel.previewTitle": "Tab preview",
      "panel.previewInfoLabel": "About tab preview",
      "panel.previewInfo": "Choose how many tabs appear in each group preview.",
      "panel.previewSliderLabel": "Number of tabs shown in the preview",
      "panel.previewFiveTitle": "Show 5 tabs in preview",
      "panel.previewFiveText": "Off: shows 3 tabs. On: shows 5.",
      "panel.allUnlimitedTitle": "Unlimited “All” list",
      "panel.allUnlimitedText": "Off: shows 15 groups and a + button to reveal more.",
      "menu.modifyGroup": "Modify group…",
      "sync.readyTitle": "Firefox Sync OK",
      "sync.readyText": "No local errors. {used} KiB of {total} KiB used; Firefox controls delivery to other computers.",
      "sync.storageLabel": "Firefox Sync storage usage",
      "sync.storageUsage": "{percent}% used: {used} KiB of {total} KiB",
      "backup.title": "Group backup",
      "backup.preparing": "Checking the automatic backup…",
      "backup.export": "Export JSON",
      "backup.restore": "Restore previous copy",
      "backup.available": "Previous copy: {count} groups · {date}",
      "backup.waiting": "The previous copy will be created on the next synced change.",
      "backup.unavailable": "Firefox Sync is unavailable in this profile.",
      "backup.exported": "JSON backup exported with {count} groups.",
      "backup.restored": "Previous copy restored: {count} groups.",
      "backup.confirmRestore": "Restore the previous Firefox Sync copy? Affected open groups will be saved and closed. Groups in the copy will be merged with current groups; no extra group will be deleted."
    },
    "zh-CN": {
      "action.editShort": "编辑",
      "filter.includeArchivedShort": "显示已归档",
      "action.archiveAllClosed": "全部归档",
      "confirm.archiveAllClosed": "归档所有已关闭的组？",
      "action.showMoreGroups": "再显示 {count} 个",
      "panel.title": "面板显示",
      "panel.text": "调整主列表显示的信息量。",
      "panel.infoLabel": "关于面板视图",
      "panel.info": "定义“全部”中在 + 按钮之前显示多少个组。“无限”会显示所有组。",
      "panel.sliderLabel": "“全部”中显示的组数",
      "panel.unlimited": "无限",
      "panel.previewTitle": "标签页预览",
      "panel.previewInfoLabel": "关于标签页预览",
      "panel.previewInfo": "选择每个组预览中显示多少个标签页。",
      "panel.previewSliderLabel": "预览中显示的标签页数量",
      "panel.previewFiveTitle": "预览中显示 5 个标签页",
      "panel.previewFiveText": "关闭：显示 3 个。开启：显示 5 个。",
      "panel.allUnlimitedTitle": "“全部”列表不限量",
      "panel.allUnlimitedText": "关闭：显示 15 个组，并提供一个 + 按钮显示更多。",
      "menu.modifyGroup": "修改分组…",
      "sync.readyTitle": "Firefox Sync OK",
      "sync.readyText": "未检测到本地错误。已用 {used} KiB，共 {total} KiB；Firefox 负责发送到其他电脑。",
      "sync.storageLabel": "Firefox Sync 存储空间使用量",
      "sync.storageUsage": "已用 {percent}%：{used} KiB / {total} KiB",
      "backup.title": "分组备份",
      "backup.preparing": "正在检查自动备份…",
      "backup.export": "导出 JSON",
      "backup.restore": "恢复上一份副本",
      "backup.available": "上一份副本：{count} 个分组 · {date}",
      "backup.waiting": "下一次同步更改时会创建上一份副本。",
      "backup.unavailable": "此配置文件无法使用 Firefox Sync。",
      "backup.exported": "已导出包含 {count} 个分组的 JSON 备份。",
      "backup.restored": "已恢复上一份副本：{count} 个分组。",
      "backup.confirmRestore": "要恢复 Firefox Sync 的上一份副本吗？副本中的分组会与当前分组合并，不会删除其他分组。"
    },
    ja: {
      "action.editShort": "編集",
      "filter.includeArchivedShort": "アーカイブも表示",
      "action.archiveAllClosed": "すべてアーカイブ",
      "confirm.archiveAllClosed": "閉じたグループをすべてアーカイブしますか？",
      "action.showMoreGroups": "さらに {count} 件表示",
      "panel.title": "パネル表示",
      "panel.text": "メイン一覧に表示する情報量を調整します。",
      "panel.infoLabel": "パネル表示について",
      "panel.info": "「すべて」で + ボタンの前に表示するグループ数を指定します。無制限ではすべて表示します。",
      "panel.sliderLabel": "「すべて」に表示するグループ数",
      "panel.unlimited": "無制限",
      "panel.previewTitle": "タブプレビュー",
      "panel.previewInfoLabel": "タブプレビューについて",
      "panel.previewInfo": "各グループのプレビューに表示するタブ数を選びます。",
      "panel.previewSliderLabel": "プレビューに表示するタブ数",
      "panel.previewFiveTitle": "プレビューで 5 個のタブを表示",
      "panel.previewFiveText": "オフ: 3 個表示。オン: 5 個表示。",
      "panel.allUnlimitedTitle": "「すべて」を無制限表示",
      "panel.allUnlimitedText": "オフ: 15 グループまで表示し、さらに表示するには + ボタンを使います。",
      "menu.modifyGroup": "グループを変更…",
      "sync.readyTitle": "Firefox Sync OK",
      "sync.readyText": "ローカルエラーはありません。{total} KiB 中 {used} KiB を使用。ほかの端末への送信は Firefox が管理します。",
      "sync.storageLabel": "Firefox Sync ストレージ使用量",
      "sync.storageUsage": "{percent}% 使用：{used} KiB / {total} KiB",
      "backup.title": "グループのバックアップ",
      "backup.preparing": "自動バックアップを確認中…",
      "backup.export": "JSON を書き出す",
      "backup.restore": "前のコピーを復元",
      "backup.available": "前のコピー：{count} グループ · {date}",
      "backup.waiting": "次の同期変更時に前のコピーが作成されます。",
      "backup.unavailable": "このプロファイルでは Firefox Sync を利用できません。",
      "backup.exported": "{count} グループの JSON バックアップを書き出しました。",
      "backup.restored": "前のコピーを復元しました：{count} グループ。",
      "backup.confirmRestore": "Firefox Sync の前のコピーを復元しますか？コピー内のグループは現在のグループと統合され、ほかのグループは削除されません。"
    },
    ko: {
      "action.editShort": "편집",
      "filter.includeArchivedShort": "보관 항목 표시",
      "action.archiveAllClosed": "모두 보관",
      "confirm.archiveAllClosed": "닫힌 그룹을 모두 보관할까요?",
      "action.showMoreGroups": "{count}개 더 보기",
      "panel.title": "패널 보기",
      "panel.text": "메인 목록에 표시되는 정보량을 조정합니다.",
      "panel.infoLabel": "패널 보기 정보",
      "panel.info": "전체에서 + 버튼 앞에 표시할 그룹 수를 정합니다. 무제한은 모든 그룹을 표시합니다.",
      "panel.sliderLabel": "전체에 표시할 그룹 수",
      "panel.unlimited": "무제한",
      "panel.previewTitle": "탭 미리보기",
      "panel.previewInfoLabel": "탭 미리보기 정보",
      "panel.previewInfo": "각 그룹 미리보기에 표시할 탭 수를 선택합니다.",
      "panel.previewSliderLabel": "미리보기에 표시할 탭 수",
      "panel.previewFiveTitle": "미리보기에서 탭 5개 표시",
      "panel.previewFiveText": "끔: 3개 표시. 켬: 5개 표시.",
      "panel.allUnlimitedTitle": "“전체” 목록 무제한",
      "panel.allUnlimitedText": "끔: 15개 그룹만 표시하고 + 버튼으로 더 봅니다.",
      "menu.modifyGroup": "그룹 수정…",
      "sync.readyTitle": "Firefox Sync OK",
      "sync.readyText": "로컬 오류가 없습니다. {total} KiB 중 {used} KiB 사용. 다른 컴퓨터 전송은 Firefox가 관리합니다.",
      "sync.storageLabel": "Firefox Sync 저장 공간 사용량",
      "sync.storageUsage": "{percent}% 사용: {used} KiB / {total} KiB",
      "backup.title": "그룹 백업",
      "backup.preparing": "자동 백업 확인 중…",
      "backup.export": "JSON 내보내기",
      "backup.restore": "이전 사본 복원",
      "backup.available": "이전 사본: 그룹 {count}개 · {date}",
      "backup.waiting": "다음 동기화 변경 시 이전 사본이 생성됩니다.",
      "backup.unavailable": "이 프로필에서는 Firefox Sync를 사용할 수 없습니다.",
      "backup.exported": "그룹 {count}개의 JSON 백업을 내보냈습니다.",
      "backup.restored": "이전 사본을 복원했습니다: 그룹 {count}개.",
      "backup.confirmRestore": "Firefox Sync의 이전 사본을 복원할까요? 사본의 그룹은 현재 그룹과 병합되며 다른 그룹은 삭제되지 않습니다."
    },
    de: {
      "action.editShort": "Bearbeiten",
      "filter.includeArchivedShort": "Archivierte zeigen",
      "action.archiveAllClosed": "Alle archivieren",
      "confirm.archiveAllClosed": "Alle geschlossenen Gruppen archivieren?",
      "action.showMoreGroups": "{count} weitere anzeigen",
      "panel.title": "Panelansicht",
      "panel.text": "Passen Sie an, wie viele Informationen die Hauptliste zeigt.",
      "panel.infoLabel": "Über die Panelansicht",
      "panel.info": "Legt fest, wie viele Gruppen unter Alle vor der + Schaltfläche angezeigt werden. Unbegrenzt zeigt alle Gruppen.",
      "panel.sliderLabel": "Anzahl der unter Alle angezeigten Gruppen",
      "panel.unlimited": "Unbegrenzt",
      "panel.previewTitle": "Tab-Vorschau",
      "panel.previewInfoLabel": "Über die Tab-Vorschau",
      "panel.previewInfo": "Wählen Sie, wie viele Tabs in jeder Gruppenvorschau erscheinen.",
      "panel.previewSliderLabel": "Anzahl der in der Vorschau angezeigten Tabs",
      "panel.previewFiveTitle": "5 Tabs in der Vorschau anzeigen",
      "panel.previewFiveText": "Aus: 3 Tabs. Ein: 5 Tabs.",
      "panel.allUnlimitedTitle": "Unbegrenzte „Alle“-Liste",
      "panel.allUnlimitedText": "Aus: zeigt 15 Gruppen und eine + Schaltfläche zum Anzeigen weiterer Gruppen.",
      "menu.modifyGroup": "Gruppe bearbeiten…",
      "sync.readyTitle": "Firefox Sync OK",
      "sync.readyText": "Keine lokalen Fehler. {used} KiB von {total} KiB belegt; Firefox steuert die Übertragung auf andere Computer.",
      "sync.storageLabel": "Speichernutzung von Firefox Sync",
      "sync.storageUsage": "{percent}% belegt: {used} KiB von {total} KiB",
      "backup.title": "Gruppensicherung",
      "backup.preparing": "Automatische Sicherung wird geprüft…",
      "backup.export": "JSON exportieren",
      "backup.restore": "Vorherige Kopie wiederherstellen",
      "backup.available": "Vorherige Kopie: {count} Gruppen · {date}",
      "backup.waiting": "Die vorherige Kopie wird bei der nächsten synchronisierten Änderung erstellt.",
      "backup.unavailable": "Firefox Sync ist in diesem Profil nicht verfügbar.",
      "backup.exported": "JSON-Sicherung mit {count} Gruppen exportiert.",
      "backup.restored": "Vorherige Kopie wiederhergestellt: {count} Gruppen.",
      "backup.confirmRestore": "Vorherige Firefox-Sync-Kopie wiederherstellen? Die Gruppen der Kopie werden mit den aktuellen zusammengeführt; keine weiteren Gruppen werden gelöscht."
    },
    fr: {
      "action.editShort": "Modifier",
      "filter.includeArchivedShort": "Afficher archivés",
      "action.archiveAllClosed": "Tout archiver",
      "confirm.archiveAllClosed": "Archiver tous les groupes fermés ?",
      "action.showMoreGroups": "Afficher {count} de plus",
      "panel.title": "Affichage du panneau",
      "panel.text": "Ajustez la quantité d’informations affichées dans la liste principale.",
      "panel.infoLabel": "À propos de l’affichage du panneau",
      "panel.info": "Définit le nombre de groupes affichés dans Tous avant le bouton +. Illimité affiche tous les groupes.",
      "panel.sliderLabel": "Nombre de groupes affichés dans Tous",
      "panel.unlimited": "Illimité",
      "panel.previewTitle": "Aperçu des onglets",
      "panel.previewInfoLabel": "À propos de l’aperçu des onglets",
      "panel.previewInfo": "Choisissez combien d’onglets apparaissent dans l’aperçu de chaque groupe.",
      "panel.previewSliderLabel": "Nombre d’onglets affichés dans l’aperçu",
      "panel.previewFiveTitle": "Afficher 5 onglets dans l’aperçu",
      "panel.previewFiveText": "Désactivé : 3 onglets. Activé : 5 onglets.",
      "panel.allUnlimitedTitle": "Liste « Tous » illimitée",
      "panel.allUnlimitedText": "Désactivé : affiche 15 groupes puis un bouton + pour en révéler davantage.",
      "menu.modifyGroup": "Modifier le groupe…",
      "sync.readyTitle": "Firefox Sync OK",
      "sync.readyText": "Aucune erreur locale. {used} Kio utilisés sur {total} Kio ; Firefox gère l’envoi aux autres ordinateurs.",
      "sync.storageLabel": "Utilisation du stockage Firefox Sync",
      "sync.storageUsage": "{percent} % utilisés : {used} Kio sur {total} Kio",
      "backup.title": "Sauvegarde des groupes",
      "backup.preparing": "Vérification de la sauvegarde automatique…",
      "backup.export": "Exporter le JSON",
      "backup.restore": "Restaurer la copie précédente",
      "backup.available": "Copie précédente : {count} groupes · {date}",
      "backup.waiting": "La copie précédente sera créée lors de la prochaine modification synchronisée.",
      "backup.unavailable": "Firefox Sync n’est pas disponible dans ce profil.",
      "backup.exported": "Sauvegarde JSON exportée avec {count} groupes.",
      "backup.restored": "Copie précédente restaurée : {count} groupes.",
      "backup.confirmRestore": "Restaurer la copie Firefox Sync précédente ? Ses groupes seront fusionnés avec les groupes actuels ; aucun groupe supplémentaire ne sera supprimé."
    },
    es: {
      "action.editShort": "Editar",
      "filter.includeArchivedShort": "Mostrar archivados",
      "action.archiveAllClosed": "Archivar todo",
      "confirm.archiveAllClosed": "¿Archivar todos los grupos cerrados?",
      "action.showMoreGroups": "Mostrar {count} más",
      "panel.title": "Vista del panel",
      "panel.text": "Ajusta cuánta información muestra la lista principal.",
      "panel.infoLabel": "Acerca de la vista del panel",
      "panel.info": "Define cuántos grupos aparecen en Todos antes del botón +. Ilimitado muestra todos los grupos.",
      "panel.sliderLabel": "Cantidad de grupos mostrados en Todos",
      "panel.unlimited": "Ilimitado",
      "panel.previewTitle": "Vista previa de pestañas",
      "panel.previewInfoLabel": "Acerca de la vista previa de pestañas",
      "panel.previewInfo": "Elige cuántas pestañas aparecen en la vista previa de cada grupo.",
      "panel.previewSliderLabel": "Cantidad de pestañas mostradas en la vista previa",
      "panel.previewFiveTitle": "Mostrar 5 pestañas en la vista previa",
      "panel.previewFiveText": "Desactivado: muestra 3. Activado: muestra 5.",
      "panel.allUnlimitedTitle": "Lista “Todos” ilimitada",
      "panel.allUnlimitedText": "Desactivado: muestra 15 grupos y un botón + para revelar más.",
      "menu.modifyGroup": "Modificar grupo…",
      "sync.readyTitle": "Firefox Sync OK",
      "sync.readyText": "No hay errores locales. {used} KiB usados de {total} KiB; Firefox controla el envío a otros equipos.",
      "sync.storageLabel": "Uso del almacenamiento de Firefox Sync",
      "sync.storageUsage": "{percent}% usado: {used} KiB de {total} KiB",
      "backup.title": "Copia de los grupos",
      "backup.preparing": "Comprobando la copia automática…",
      "backup.export": "Exportar JSON",
      "backup.restore": "Restaurar copia anterior",
      "backup.available": "Copia anterior: {count} grupos · {date}",
      "backup.waiting": "La copia anterior se creará con el próximo cambio sincronizado.",
      "backup.unavailable": "Firefox Sync no está disponible en este perfil.",
      "backup.exported": "Copia JSON exportada con {count} grupos.",
      "backup.restored": "Copia anterior restaurada: {count} grupos.",
      "backup.confirmRestore": "¿Restaurar la copia anterior de Firefox Sync? Sus grupos se combinarán con los actuales; no se eliminará ningún grupo adicional."
    },
    ru: {
      "action.editShort": "Изменить",
      "filter.includeArchivedShort": "Показывать архив",
      "action.archiveAllClosed": "Архивировать все",
      "confirm.archiveAllClosed": "Архивировать все закрытые группы?",
      "action.showMoreGroups": "Показать ещё {count}",
      "panel.title": "Вид панели",
      "panel.text": "Настройте, сколько информации показывает основной список.",
      "panel.infoLabel": "О виде панели",
      "panel.info": "Определяет, сколько групп показывается в разделе «Все» до кнопки +. Без ограничений показывает все группы.",
      "panel.sliderLabel": "Количество групп в разделе «Все»",
      "panel.unlimited": "Без ограничений",
      "panel.previewTitle": "Превью вкладок",
      "panel.previewInfoLabel": "О превью вкладок",
      "panel.previewInfo": "Выберите, сколько вкладок показывать в превью каждой группы.",
      "panel.previewSliderLabel": "Количество вкладок в превью",
      "panel.previewFiveTitle": "Показывать 5 вкладок в превью",
      "panel.previewFiveText": "Выкл.: 3 вкладки. Вкл.: 5 вкладок.",
      "panel.allUnlimitedTitle": "Неограниченный список «Все»",
      "panel.allUnlimitedText": "Выкл.: показывает 15 групп и кнопку + для показа остальных.",
      "menu.modifyGroup": "Изменить группу…",
      "sync.readyTitle": "Firefox Sync OK",
      "sync.readyText": "Локальных ошибок нет. Использовано {used} КиБ из {total} КиБ; отправкой на другие компьютеры управляет Firefox.",
      "sync.storageLabel": "Использование хранилища Firefox Sync",
      "sync.storageUsage": "Использовано {percent}%: {used} КиБ из {total} КиБ",
      "backup.title": "Резервная копия групп",
      "backup.preparing": "Проверка автоматической копии…",
      "backup.export": "Экспорт JSON",
      "backup.restore": "Восстановить предыдущую копию",
      "backup.available": "Предыдущая копия: {count} групп · {date}",
      "backup.waiting": "Предыдущая копия будет создана при следующем синхронизированном изменении.",
      "backup.unavailable": "Firefox Sync недоступен в этом профиле.",
      "backup.exported": "Экспортирована JSON-копия: {count} групп.",
      "backup.restored": "Предыдущая копия восстановлена: {count} групп.",
      "backup.confirmRestore": "Восстановить предыдущую копию Firefox Sync? Группы из копии будут объединены с текущими; другие группы не будут удалены."
    }
  };
  for (const [language, dictionary] of Object.entries(BACKUP_MESSAGES)) {
    Object.assign(MESSAGES[language], dictionary);
  }

  const V270_MESSAGES = {
    en: {
      "filter.trash": "Trash", "filter.emptyTrashTitle": "Trash is empty", "filter.emptyTrashText": "Deleted groups stay here for 30 days.",
      "action.restore": "Restore", "action.deletePermanently": "Delete permanently", "action.previewTabs": "Show first tabs", "action.hidePreview": "Hide tab preview", "action.moveGroup": "Reorder pinned group", "action.moveUp": "Move pinned group up", "action.moveDown": "Move pinned group down",
      "action.unarchiveAll": "Unarchive all", "action.trashAllArchived": "Delete all", "action.emptyTrash": "Empty trash",
      "confirm.deletePermanently": "Delete this group permanently? This cannot be undone.", "confirm.unarchiveAll": "Unarchive all archived groups?", "confirm.trashAllArchived": "Move all archived groups to Trash?", "confirm.emptyTrash": "Permanently delete every group in Trash? This cannot be undone.",
      "trash.expiresDays": "{count} days left", "trash.expiresToday": "Expires today",
      "sync.collapse": "Hide Firefox Sync status", "sync.expand": "Show Firefox Sync status",
      "diagnostics.title": "Diagnostics", "diagnostics.text": "Local error history for troubleshooting.", "diagnostics.privacy": "The report does not include URLs, tab titles, group names, bookmarks, or history. Nothing is sent automatically.", "diagnostics.none": "No local errors recorded.", "diagnostics.count": "{count} error(s) recorded locally.", "diagnostics.open": "View diagnostics", "diagnostics.copy": "Copy JSON", "diagnostics.download": "Download JSON", "diagnostics.clear": "Clear log", "diagnostics.copied": "Diagnostic JSON copied.", "diagnostics.cleared": "Diagnostic log cleared.", "diagnostics.errorNotice": "An error was recorded.", "diagnostics.confirmClear": "Clear the local diagnostic log?"
    },
    es: {
      "filter.trash": "Papelera", "filter.emptyTrashTitle": "La papelera está vacía", "filter.emptyTrashText": "Los grupos eliminados permanecen aquí durante 30 días.",
      "action.restore": "Restaurar", "action.deletePermanently": "Eliminar para siempre", "action.previewTabs": "Mostrar primeras pestañas", "action.hidePreview": "Ocultar vista de pestañas", "action.moveGroup": "Reordenar grupo fijado", "action.moveUp": "Mover grupo fijado arriba", "action.moveDown": "Mover grupo fijado abajo",
      "action.unarchiveAll": "Desarchivar todo", "action.trashAllArchived": "Eliminar todo", "action.emptyTrash": "Vaciar papelera",
      "confirm.deletePermanently": "¿Eliminar este grupo para siempre? Esta acción no se puede deshacer.", "confirm.unarchiveAll": "¿Desarchivar todos los grupos archivados?", "confirm.trashAllArchived": "¿Mover todos los grupos archivados a la Papelera?", "confirm.emptyTrash": "¿Eliminar para siempre todos los grupos de la Papelera? Esta acción no se puede deshacer.",
      "trash.expiresDays": "Quedan {count} días", "trash.expiresToday": "Caduca hoy",
      "sync.collapse": "Ocultar estado de Firefox Sync", "sync.expand": "Mostrar estado de Firefox Sync",
      "diagnostics.title": "Diagnóstico", "diagnostics.text": "Historial local de errores para diagnóstico.", "diagnostics.privacy": "El informe no incluye URLs, títulos de pestañas, nombres de grupos, marcadores ni historial. Nada se envía automáticamente.", "diagnostics.none": "No hay errores locales registrados.", "diagnostics.count": "{count} error(es) guardado(s) localmente.", "diagnostics.open": "Ver diagnóstico", "diagnostics.copy": "Copiar JSON", "diagnostics.download": "Descargar JSON", "diagnostics.clear": "Borrar registro", "diagnostics.copied": "JSON de diagnóstico copiado.", "diagnostics.cleared": "Registro de diagnóstico borrado.", "diagnostics.errorNotice": "Se registró un error.", "diagnostics.confirmClear": "¿Borrar el registro local de diagnóstico?"
    },
    "pt-BR": {
      "filter.trash": "Lixeira", "filter.emptyTrashTitle": "A lixeira está vazia", "filter.emptyTrashText": "Os grupos apagados ficam aqui por 30 dias.",
      "action.restore": "Restaurar", "action.deletePermanently": "Apagar para sempre", "action.previewTabs": "Mostrar primeiras abas", "action.hidePreview": "Ocultar prévia das abas", "action.moveGroup": "Reordenar grupo fixado", "action.moveUp": "Mover grupo fixado para cima", "action.moveDown": "Mover grupo fixado para baixo",
      "action.unarchiveAll": "Desarquivar tudo", "action.trashAllArchived": "Apagar todos", "action.emptyTrash": "Esvaziar lixeira",
      "confirm.deletePermanently": "Apagar este grupo para sempre? Essa ação não pode ser desfeita.", "confirm.unarchiveAll": "Desarquivar todos os grupos arquivados?", "confirm.trashAllArchived": "Mover todos os grupos arquivados para a Lixeira?", "confirm.emptyTrash": "Apagar para sempre todos os grupos da Lixeira? Essa ação não pode ser desfeita.",
      "trash.expiresDays": "{count} dias restantes", "trash.expiresToday": "Expira hoje",
      "sync.collapse": "Esconder estado do Firefox Sync", "sync.expand": "Mostrar estado do Firefox Sync",
      "diagnostics.title": "Diagnóstico", "diagnostics.text": "Histórico local de erros para diagnóstico.", "diagnostics.privacy": "O relatório não inclui URLs, títulos de abas, nomes de grupos, favoritos nem histórico. Nada é enviado automaticamente.", "diagnostics.none": "Nenhum erro local registrado.", "diagnostics.count": "{count} erro(s) registrado(s) localmente.", "diagnostics.open": "Ver diagnóstico", "diagnostics.copy": "Copiar JSON", "diagnostics.download": "Baixar JSON", "diagnostics.clear": "Limpar registro", "diagnostics.copied": "JSON de diagnóstico copiado.", "diagnostics.cleared": "Registro de diagnóstico limpo.", "diagnostics.errorNotice": "Um erro foi registrado.", "diagnostics.confirmClear": "Limpar o registro local de diagnóstico?"
    },
    "zh-CN": {
      "filter.trash": "回收站", "filter.emptyTrashTitle": "回收站为空", "filter.emptyTrashText": "已删除的组会在此保留 30 天。",
      "action.restore": "恢复", "action.deletePermanently": "永久删除", "action.previewTabs": "显示前几个标签页", "action.hidePreview": "隐藏标签页预览", "action.moveGroup": "重新排序置顶组", "action.moveUp": "向上移动置顶组", "action.moveDown": "向下移动置顶组",
      "action.unarchiveAll": "全部取消归档", "action.trashAllArchived": "全部删除", "action.emptyTrash": "清空回收站",
      "confirm.deletePermanently": "永久删除此组？此操作无法撤销。", "confirm.unarchiveAll": "取消归档所有已归档的组？", "confirm.trashAllArchived": "将所有已归档的组移到回收站？", "confirm.emptyTrash": "永久删除回收站中的所有组？此操作无法撤销。",
      "trash.expiresDays": "剩余 {count} 天", "trash.expiresToday": "今天到期",
      "sync.collapse": "隐藏 Firefox Sync 状态", "sync.expand": "显示 Firefox Sync 状态",
      "diagnostics.title": "诊断", "diagnostics.text": "用于排查问题的本地错误记录。", "diagnostics.privacy": "报告不包含 URL、标签页标题、组名、书签或历史记录。不会自动发送任何内容。", "diagnostics.none": "没有记录本地错误。", "diagnostics.count": "本地记录了 {count} 个错误。", "diagnostics.open": "查看诊断", "diagnostics.copy": "复制 JSON", "diagnostics.download": "下载 JSON", "diagnostics.clear": "清除记录", "diagnostics.copied": "已复制诊断 JSON。", "diagnostics.cleared": "已清除诊断记录。", "diagnostics.errorNotice": "已记录一个错误。", "diagnostics.confirmClear": "清除本地诊断记录？"
    },
    ja: {
      "filter.trash": "ゴミ箱", "filter.emptyTrashTitle": "ゴミ箱は空です", "filter.emptyTrashText": "削除したグループは30日間ここに残ります。",
      "action.restore": "復元", "action.deletePermanently": "完全に削除", "action.previewTabs": "最初のタブを表示", "action.hidePreview": "タブのプレビューを隠す", "action.moveGroup": "固定グループを並べ替え", "action.moveUp": "固定グループを上へ移動", "action.moveDown": "固定グループを下へ移動",
      "action.unarchiveAll": "すべてアーカイブ解除", "action.trashAllArchived": "すべて削除", "action.emptyTrash": "ゴミ箱を空にする",
      "confirm.deletePermanently": "このグループを完全に削除しますか？元に戻せません。", "confirm.unarchiveAll": "すべてのアーカイブ済みグループを解除しますか？", "confirm.trashAllArchived": "すべてのアーカイブ済みグループをゴミ箱へ移動しますか？", "confirm.emptyTrash": "ゴミ箱内のすべてのグループを完全に削除しますか？元に戻せません。",
      "trash.expiresDays": "残り{count}日", "trash.expiresToday": "本日期限",
      "sync.collapse": "Firefox Sync の状態を隠す", "sync.expand": "Firefox Sync の状態を表示",
      "diagnostics.title": "診断", "diagnostics.text": "トラブルシューティング用のローカルエラー履歴です。", "diagnostics.privacy": "レポートにはURL、タブ名、グループ名、ブックマーク、履歴は含まれません。自動送信もありません。", "diagnostics.none": "ローカルエラーは記録されていません。", "diagnostics.count": "{count}件のエラーがローカルに記録されています。", "diagnostics.open": "診断を見る", "diagnostics.copy": "JSONをコピー", "diagnostics.download": "JSONをダウンロード", "diagnostics.clear": "ログを消去", "diagnostics.copied": "診断JSONをコピーしました。", "diagnostics.cleared": "診断ログを消去しました。", "diagnostics.errorNotice": "エラーが記録されました。", "diagnostics.confirmClear": "ローカル診断ログを消去しますか？"
    },
    ko: {
      "filter.trash": "휴지통", "filter.emptyTrashTitle": "휴지통이 비어 있습니다", "filter.emptyTrashText": "삭제한 그룹은 30일 동안 여기에 보관됩니다.",
      "action.restore": "복원", "action.deletePermanently": "영구 삭제", "action.previewTabs": "첫 탭 보기", "action.hidePreview": "탭 미리보기 숨기기", "action.moveGroup": "고정 그룹 순서 변경", "action.moveUp": "고정 그룹 위로 이동", "action.moveDown": "고정 그룹 아래로 이동",
      "action.unarchiveAll": "모두 보관 해제", "action.trashAllArchived": "모두 삭제", "action.emptyTrash": "휴지통 비우기",
      "confirm.deletePermanently": "이 그룹을 영구 삭제할까요? 되돌릴 수 없습니다.", "confirm.unarchiveAll": "보관된 모든 그룹을 해제할까요?", "confirm.trashAllArchived": "보관된 모든 그룹을 휴지통으로 옮길까요?", "confirm.emptyTrash": "휴지통의 모든 그룹을 영구 삭제할까요? 되돌릴 수 없습니다.",
      "trash.expiresDays": "{count}일 남음", "trash.expiresToday": "오늘 만료",
      "sync.collapse": "Firefox Sync 상태 숨기기", "sync.expand": "Firefox Sync 상태 보기",
      "diagnostics.title": "진단", "diagnostics.text": "문제 해결을 위한 로컬 오류 기록입니다.", "diagnostics.privacy": "보고서에는 URL, 탭 제목, 그룹 이름, 북마크 또는 기록이 포함되지 않습니다. 자동으로 전송되는 내용도 없습니다.", "diagnostics.none": "기록된 로컬 오류가 없습니다.", "diagnostics.count": "로컬에 오류 {count}개가 기록되어 있습니다.", "diagnostics.open": "진단 보기", "diagnostics.copy": "JSON 복사", "diagnostics.download": "JSON 다운로드", "diagnostics.clear": "기록 지우기", "diagnostics.copied": "진단 JSON을 복사했습니다.", "diagnostics.cleared": "진단 기록을 지웠습니다.", "diagnostics.errorNotice": "오류가 기록되었습니다.", "diagnostics.confirmClear": "로컬 진단 기록을 지울까요?"
    },
    de: {
      "filter.trash": "Papierkorb", "filter.emptyTrashTitle": "Papierkorb ist leer", "filter.emptyTrashText": "Gelöschte Gruppen bleiben hier 30 Tage.",
      "action.restore": "Wiederherstellen", "action.deletePermanently": "Endgültig löschen", "action.previewTabs": "Erste Tabs anzeigen", "action.hidePreview": "Tab-Vorschau ausblenden", "action.moveGroup": "Fixierte Gruppe neu anordnen", "action.moveUp": "Fixierte Gruppe nach oben", "action.moveDown": "Fixierte Gruppe nach unten",
      "action.unarchiveAll": "Alle wiederherstellen", "action.trashAllArchived": "Alle löschen", "action.emptyTrash": "Papierkorb leeren",
      "confirm.deletePermanently": "Diese Gruppe endgültig löschen? Dies kann nicht rückgängig gemacht werden.", "confirm.unarchiveAll": "Alle archivierten Gruppen wiederherstellen?", "confirm.trashAllArchived": "Alle archivierten Gruppen in den Papierkorb verschieben?", "confirm.emptyTrash": "Alle Gruppen im Papierkorb endgültig löschen? Dies kann nicht rückgängig gemacht werden.",
      "trash.expiresDays": "Noch {count} Tage", "trash.expiresToday": "Läuft heute ab",
      "sync.collapse": "Firefox-Sync-Status ausblenden", "sync.expand": "Firefox-Sync-Status anzeigen",
      "diagnostics.title": "Diagnose", "diagnostics.text": "Lokaler Fehlerverlauf zur Fehlerbehebung.", "diagnostics.privacy": "Der Bericht enthält keine URLs, Tab-Titel, Gruppennamen, Lesezeichen oder Chronik. Nichts wird automatisch gesendet.", "diagnostics.none": "Keine lokalen Fehler aufgezeichnet.", "diagnostics.count": "{count} Fehler lokal aufgezeichnet.", "diagnostics.open": "Diagnose anzeigen", "diagnostics.copy": "JSON kopieren", "diagnostics.download": "JSON herunterladen", "diagnostics.clear": "Protokoll löschen", "diagnostics.copied": "Diagnose-JSON kopiert.", "diagnostics.cleared": "Diagnoseprotokoll gelöscht.", "diagnostics.errorNotice": "Ein Fehler wurde aufgezeichnet.", "diagnostics.confirmClear": "Lokales Diagnoseprotokoll löschen?"
    },
    fr: {
      "filter.trash": "Corbeille", "filter.emptyTrashTitle": "La corbeille est vide", "filter.emptyTrashText": "Les groupes supprimés restent ici pendant 30 jours.",
      "action.restore": "Restaurer", "action.deletePermanently": "Supprimer définitivement", "action.previewTabs": "Afficher les premiers onglets", "action.hidePreview": "Masquer l’aperçu des onglets", "action.moveGroup": "Réordonner le groupe épinglé", "action.moveUp": "Monter le groupe épinglé", "action.moveDown": "Descendre le groupe épinglé",
      "action.unarchiveAll": "Tout désarchiver", "action.trashAllArchived": "Tout supprimer", "action.emptyTrash": "Vider la corbeille",
      "confirm.deletePermanently": "Supprimer définitivement ce groupe ? Cette action est irréversible.", "confirm.unarchiveAll": "Désarchiver tous les groupes archivés ?", "confirm.trashAllArchived": "Déplacer tous les groupes archivés vers la Corbeille ?", "confirm.emptyTrash": "Supprimer définitivement tous les groupes de la Corbeille ? Cette action est irréversible.",
      "trash.expiresDays": "Encore {count} jours", "trash.expiresToday": "Expire aujourd’hui",
      "sync.collapse": "Masquer l’état de Firefox Sync", "sync.expand": "Afficher l’état de Firefox Sync",
      "diagnostics.title": "Diagnostic", "diagnostics.text": "Historique local des erreurs pour le dépannage.", "diagnostics.privacy": "Le rapport ne contient ni URL, ni titres d’onglets, ni noms de groupes, ni marque-pages, ni historique. Rien n’est envoyé automatiquement.", "diagnostics.none": "Aucune erreur locale enregistrée.", "diagnostics.count": "{count} erreur(s) enregistrée(s) localement.", "diagnostics.open": "Voir le diagnostic", "diagnostics.copy": "Copier le JSON", "diagnostics.download": "Télécharger le JSON", "diagnostics.clear": "Effacer le journal", "diagnostics.copied": "JSON de diagnostic copié.", "diagnostics.cleared": "Journal de diagnostic effacé.", "diagnostics.errorNotice": "Une erreur a été enregistrée.", "diagnostics.confirmClear": "Effacer le journal de diagnostic local ?"
    },
    ru: {
      "filter.trash": "Корзина", "filter.emptyTrashTitle": "Корзина пуста", "filter.emptyTrashText": "Удалённые группы хранятся здесь 30 дней.",
      "action.restore": "Восстановить", "action.deletePermanently": "Удалить навсегда", "action.previewTabs": "Показать первые вкладки", "action.hidePreview": "Скрыть список вкладок", "action.moveGroup": "Изменить порядок закреплённой группы", "action.moveUp": "Переместить закреплённую группу вверх", "action.moveDown": "Переместить закреплённую группу вниз",
      "action.unarchiveAll": "Разархивировать все", "action.trashAllArchived": "Удалить все", "action.emptyTrash": "Очистить корзину",
      "confirm.deletePermanently": "Удалить эту группу навсегда? Это действие нельзя отменить.", "confirm.unarchiveAll": "Разархивировать все архивные группы?", "confirm.trashAllArchived": "Переместить все архивные группы в Корзину?", "confirm.emptyTrash": "Удалить навсегда все группы из Корзины? Это действие нельзя отменить.",
      "trash.expiresDays": "Осталось {count} дн.", "trash.expiresToday": "Истекает сегодня",
      "sync.collapse": "Скрыть статус Firefox Sync", "sync.expand": "Показать статус Firefox Sync",
      "diagnostics.title": "Диагностика", "diagnostics.text": "Локальная история ошибок для диагностики.", "diagnostics.privacy": "Отчёт не содержит URL, названий вкладок, имён групп, закладок или истории. Ничего не отправляется автоматически.", "diagnostics.none": "Локальных ошибок не записано.", "diagnostics.count": "Локально записано ошибок: {count}.", "diagnostics.open": "Открыть диагностику", "diagnostics.copy": "Копировать JSON", "diagnostics.download": "Скачать JSON", "diagnostics.clear": "Очистить журнал", "diagnostics.copied": "Диагностический JSON скопирован.", "diagnostics.cleared": "Журнал диагностики очищен.", "diagnostics.errorNotice": "Ошибка записана.", "diagnostics.confirmClear": "Очистить локальный журнал диагностики?"
    }
  };
  for (const [language, dictionary] of Object.entries(V270_MESSAGES)) {
    Object.assign(MESSAGES[language], dictionary);
  }

  const V291_MESSAGES = {
    "pt-BR": {
      "edit.darkerColors": "Cores mais escuras",
      "edit.darkerColorsInfoLabel": "Sobre as cores mais escuras",
      "edit.darkerColorsInfo": "Usa a paleta mais escura do Firefox para este grupo no modo claro."
    },
    en: {
      "edit.darkerColors": "Darker colors",
      "edit.darkerColorsInfoLabel": "About darker colors",
      "edit.darkerColorsInfo": "Uses the darker Firefox group palette for this group in light mode."
    },
    es: {
      "edit.darkerColors": "Colores más oscuros",
      "edit.darkerColorsInfoLabel": "Acerca de los colores más oscuros",
      "edit.darkerColorsInfo": "Usa la paleta más oscura de Firefox para este grupo en el modo claro."
    },
    "zh-CN": {
      "edit.darkerColors": "更深的颜色",
      "edit.darkerColorsInfoLabel": "关于更深的颜色",
      "edit.darkerColorsInfo": "在浅色模式下为此分组使用 Firefox 较深的分组配色。"
    },
    ja: {
      "edit.darkerColors": "濃い色",
      "edit.darkerColorsInfoLabel": "濃い色について",
      "edit.darkerColorsInfo": "ライトモードでこのグループに Firefox の濃いグループ色を使用します。"
    },
    ko: {
      "edit.darkerColors": "더 어두운 색상",
      "edit.darkerColorsInfoLabel": "더 어두운 색상 정보",
      "edit.darkerColorsInfo": "라이트 모드에서 이 그룹에 Firefox의 더 어두운 그룹 색상 팔레트를 사용합니다."
    },
    de: {
      "edit.darkerColors": "Dunklere Farben",
      "edit.darkerColorsInfoLabel": "Über dunklere Farben",
      "edit.darkerColorsInfo": "Verwendet im hellen Modus die dunklere Firefox-Gruppenpalette für diese Gruppe."
    },
    fr: {
      "edit.darkerColors": "Couleurs plus foncées",
      "edit.darkerColorsInfoLabel": "À propos des couleurs plus foncées",
      "edit.darkerColorsInfo": "Utilise la palette de groupes Firefox plus foncée pour ce groupe en mode clair."
    },
    ru: {
      "edit.darkerColors": "Более тёмные цвета",
      "edit.darkerColorsInfoLabel": "О более тёмных цветах",
      "edit.darkerColorsInfo": "Использует более тёмную палитру групп Firefox для этой группы в светлом режиме."
    }
  };
  for (const [language, dictionary] of Object.entries(V291_MESSAGES)) {
    Object.assign(MESSAGES[language], dictionary);
  }

  function detectLanguage() {
    let language = "";
    try {
      language = browser.i18n?.getUILanguage?.() || "";
    } catch (_error) {
      language = "";
    }
    if (!language && typeof navigator !== "undefined") {
      language = navigator.language || "";
    }
    const normalized = String(language).trim().toLowerCase().replaceAll("_", "-");
    if (normalized === "pt-br" || normalized === "pt") return "pt-BR";
    if (["zh-cn", "zh-hans", "zh-sg"].some((code) => normalized.startsWith(code))) {
      return "zh-CN";
    }
    for (const available of ["en", "ja", "ko", "de", "fr", "es", "ru"]) {
      if (normalized === available || normalized.startsWith(`${available}-`)) return available;
    }
    return "en";
  }

  function normalize(candidate = {}) {
    return {
      language: LANGUAGES.includes(candidate.language) ? candidate.language : detectLanguage(),
      fontSize: FONT_SIZES.includes(candidate.fontSize) ? candidate.fontSize : DEFAULTS.fontSize,
      highContrast: candidate.highContrast === true,
      reduceMotion: candidate.reduceMotion === true,
      groupFilter: FILTERS.includes(candidate.groupFilter) ? candidate.groupFilter : DEFAULTS.groupFilter,
      includeArchivedInAll: candidate.includeArchivedInAll === true,
      panelViewLimit:
        candidate.panelViewLimit === "unlimited" || [3, 5, 10].includes(Number(candidate.panelViewLimit))
          ? candidate.panelViewLimit === "unlimited" ? "unlimited" : Number(candidate.panelViewLimit)
          : candidate.allGroupsUnlimited === true
            ? "unlimited"
            : DEFAULTS.panelViewLimit,
      previewTabCount: [3, 5, 7, 9].includes(Number(candidate.previewTabCount))
        ? Number(candidate.previewTabCount)
        : candidate.previewFiveTabs === true
          ? 5
          : DEFAULTS.previewTabCount,
      syncCollapsed: candidate.syncCollapsed === true,
      visualPromoDismissed: candidate.visualPromoDismissed === true
    };
  }

  async function load() {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    return normalize(stored?.[STORAGE_KEY]);
  }

  async function save(changes) {
    const current = await load();
    const next = normalize({ ...current, ...changes });
    await browser.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  }

  function t(language, key, replacements = {}) {
    const dictionary = MESSAGES[LANGUAGES.includes(language) ? language : "en"];
    const template = dictionary[key] ?? MESSAGES.en[key] ?? MESSAGES["pt-BR"][key] ?? key;
    return String(template).replace(/\{([a-zA-Z0-9_-]+)\}/g, (_match, name) =>
      Object.hasOwn(replacements, name) ? String(replacements[name]) : `{${name}}`
    );
  }

  function applyToDocument(documentRef, preferences) {
    if (!documentRef?.documentElement) return;
    const clean = normalize(preferences);
    documentRef.documentElement.lang = clean.language;
    documentRef.documentElement.dataset.fontSize = clean.fontSize;
    documentRef.documentElement.dataset.highContrast = String(clean.highContrast);
    documentRef.documentElement.dataset.reduceMotion = String(clean.reduceMotion);
  }

  function translateDocument(documentRef, language) {
    documentRef.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(language, element.dataset.i18n);
    });
    documentRef.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = t(language, element.dataset.i18nTitle);
    });
    documentRef.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(language, element.dataset.i18nAriaLabel));
    });
  }

  globalThis.GruposUi = Object.freeze({
    STORAGE_KEY,
    LANGUAGES: [...LANGUAGES],
    FONT_SIZES: [...FONT_SIZES],
    FILTERS: [...FILTERS],
    DEFAULTS,
    MESSAGES,
    normalize,
    load,
    save,
    t,
    applyToDocument,
    translateDocument
  });
})();
