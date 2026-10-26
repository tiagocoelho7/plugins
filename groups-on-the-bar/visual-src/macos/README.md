# Visual em chip — Groups 'On the Bar'

Este complemento visual transforma os atalhos criados pela extensão **Groups 'On the Bar' 3.0.0 ou superior** em chips e mostra o ícone opcional também no cabeçalho do grupo nas barras de abas vertical e horizontal.

## Instalar no macOS

1. Feche todas as janelas do Firefox.
2. Mantenha todos os arquivos desta pasta juntos.
3. Clique com o botão direito em `Instalar-visual.command` e escolha **Abrir**.
4. Confirme **Abrir** se o macOS mostrar um aviso.
5. Pressione Return quando o instalador terminar e abra o Firefox novamente.
6. Recarregue a extensão 3.0.10 em `about:debugging` se ainda estiver usando a versão temporária.

O instalador lê os perfis registrados e também examina diretamente a pasta `Profiles`, o que cobre registros ausentes ou desatualizados. Se a detecção automática falhar, ele abre um seletor para você indicar a pasta mostrada em `about:support` → **Pasta do perfil**. Depois, cria a pasta `chrome` quando necessário, preserva outros estilos e faz backup do `userChrome.css` ou `user.js` antes de alterá-los.

Se precisar escolher sem o seletor, arraste a pasta do perfil sobre `Instalar-visual.command`.

## Remover

Feche o Firefox e abra `Remover-visual.command`. O script remove apenas o estilo **Groups 'On the Bar'** e sua linha de importação. Ele mantém habilitada a preferência de estilos personalizados para não quebrar outras personalizações.

## Observação importante

O Firefox não oferece uma API oficial para uma extensão alterar o desenho dos favoritos. Por isso, o chip usa `userChrome.css`, uma personalização avançada do Firefox Desktop. Ela pode precisar de ajuste depois de futuras mudanças na interface do navegador.

Este complemento é destinado ao Firefox Desktop no macOS; ele não funciona no Firefox para iPad.
