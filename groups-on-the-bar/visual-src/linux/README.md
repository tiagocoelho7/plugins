# Visual em chip — Groups 'On the Bar'

Este complemento transforma os atalhos criados pela extensão **Groups 'On the Bar' 3.0.0 ou superior** em chips coloridos e mostra o ícone opcional também no cabeçalho do grupo nas barras de abas vertical e horizontal.

## Instalar no Linux

1. Extraia o ZIP.
2. Clique duas vezes em `instalar-visual.sh` e escolha **Executar no terminal**.
3. Quando aparecer **Visual instalado com sucesso**, feche completamente o Firefox e abra-o novamente.

Se o gerenciador de arquivos abrir o script como texto, abra um terminal dentro da pasta extraída e execute exatamente a linha abaixo, **sem crases antes ou depois**:

```bash
./instalar-visual.sh
```

Se o sistema tiver removido a permissão de execução durante a extração, rode `chmod +x instalar-visual.sh remover-visual.sh` uma vez.

O instalador encontra automaticamente perfis em `~/.config/mozilla/firefox`, além de Firefox normal, Firefox ESR, Flatpak, Developer Edition via Flatpak e Snap. Ele lê `profiles.ini` e também examina diretamente as pastas de perfil, usando o perfil atualizado mais recentemente. Depois, cria a pasta `chrome`, preserva outros estilos e faz backup antes de alterar `userChrome.css` ou `user.js`.

Se a detecção automática falhar, o instalador tenta abrir um seletor visual de pasta. Como última alternativa, abra `about:support`, copie **Pasta do perfil** e execute:

```bash
./instalar-visual.sh "/caminho/da/pasta-do-perfil"
```

## Remover

Feche o Firefox e execute `./remover-visual.sh`. O removedor apaga somente o estilo do Groups 'On the Bar' e sua linha de importação. A preferência que permite `userChrome.css` permanece ativada para não quebrar outras personalizações.

## Limite do Firefox

O Firefox não oferece uma API oficial para extensões alterarem o desenho dos favoritos. O chip usa `userChrome.css`, uma personalização avançada que pode precisar de ajuste depois de futuras mudanças na interface.
