#!/bin/bash

set -u
set -o pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=visual-common.sh
source "$script_dir/visual-common.sh"

gnb_assert_firefox_closed
profile_dir="$(gnb_resolve_firefox_profile "${1:-}")" || gnb_fail "Nenhum perfil foi encontrado automaticamente. Execute novamente informando a pasta do perfil."
chrome_dir="$profile_dir/chrome"
user_chrome="$chrome_dir/userChrome.css"
style_target="$chrome_dir/grupos-na-barra.css"
timestamp="$(date +%Y%m%d-%H%M%S)"
import_line='@import url("grupos-na-barra.css");'

if [[ -f "$user_chrome" ]]; then
  gnb_backup_file "$user_chrome" "$timestamp" || gnb_fail "Não foi possível criar o backup de userChrome.css."
  temporary_css="$(mktemp "${TMPDIR:-/tmp}/gnb-userChrome.XXXXXX")" || gnb_fail "Não foi possível criar um arquivo temporário."
  awk -v line="$import_line" '
    {
      candidate = $0
      sub(/^[[:space:]]+/, "", candidate)
      sub(/[[:space:]]+$/, "", candidate)
      if (candidate != line) print
    }
  ' "$user_chrome" > "$temporary_css" || gnb_fail "Não foi possível preparar userChrome.css."
  mv "$temporary_css" "$user_chrome" || gnb_fail "Não foi possível atualizar userChrome.css."
fi

if [[ -f "$style_target" ]]; then
  rm "$style_target" || gnb_fail "Não foi possível remover grupos-na-barra.css."
fi

printf '\nVisual removido com sucesso.\n'
printf 'Perfil: %s\n' "$profile_dir"
printf '\nA preferência de userChrome.css foi mantida para não quebrar outros estilos.\n'
printf 'Abra novamente o Firefox para concluir.\n'
gnb_pause_before_exit
