# Visual em chip — Groups 'On the Bar'

Este complemento transforma os atalhos criados pela extensão **Groups 'On the Bar' 3.0.0 ou superior** em chips coloridos e mostra o ícone opcional também no cabeçalho do grupo nas barras de abas vertical e horizontal.

## Instalar no Windows

1. Feche completamente o Firefox.
2. Mantenha todos os arquivos extraídos juntos.
3. Clique duas vezes em `Instalar-visual.cmd`.
4. Se o Windows pedir confirmação, escolha executar.
5. Quando aparecer **Visual instalado com sucesso**, pressione uma tecla e abra novamente o Firefox.

O instalador encontra o perfil usado mais recentemente, incluindo instalações tradicionais e a versão da Microsoft Store. Ele lê `profiles.ini` e também examina diretamente as pastas de perfil. Se a detecção automática falhar, abre um seletor para você indicar a pasta mostrada em `about:support` → **Pasta do perfil**. Depois, cria a pasta `chrome`, preserva outros estilos e faz backup antes de alterar `userChrome.css` ou `user.js`.

## Remover

Feche o Firefox e abra `Remover-visual.cmd`. O removedor apaga somente o estilo do Groups 'On the Bar' e sua linha de importação. A preferência que permite `userChrome.css` permanece ativada para não quebrar outras personalizações.

## Se o Windows bloquear o arquivo

Clique com o botão direito no ZIP antes de extrair, abra **Propriedades**, marque **Desbloquear** se essa opção aparecer e extraia novamente. O instalador não precisa de acesso de administrador e não se conecta à internet.

## Limite do Firefox

O Firefox não oferece uma API oficial para extensões alterarem o desenho dos favoritos. O chip usa `userChrome.css`, uma personalização avançada que pode precisar de ajuste depois de futuras mudanças na interface.
