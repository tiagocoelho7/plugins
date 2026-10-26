#!/bin/bash

set -u
set -o pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=visual-common.sh
source "$script_dir/visual-common.sh"

gnb_assert_firefox_closed
[[ -f "$script_dir/grupos-na-barra.css" ]] || gnb_fail "O arquivo grupos-na-barra.css precisa ficar ao lado deste instalador."

profile_dir="$(gnb_resolve_firefox_profile "${1:-}")" || gnb_fail "Nenhum perfil foi encontrado automaticamente. Abra about:support, use “Pasta do perfil” e execute novamente. Você também pode arrastar a pasta do perfil sobre este instalador."
chrome_dir="$profile_dir/chrome"
user_chrome="$chrome_dir/userChrome.css"
style_target="$chrome_dir/grupos-na-barra.css"
user_js="$profile_dir/user.js"
timestamp="$(date +%Y%m%d-%H%M%S)"
import_line='@import url("grupos-na-barra.css");'
preference_line='user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);'

mkdir -p "$chrome_dir" || gnb_fail "Não foi possível criar a pasta chrome no perfil."
cp -p "$script_dir/grupos-na-barra.css" "$style_target" || gnb_fail "Não foi possível copiar o estilo visual."

if [[ ! -f "$user_chrome" ]]; then
  printf '%s\n' "$import_line" > "$user_chrome" || gnb_fail "Não foi possível criar userChrome.css."
elif ! grep -Fqx "$import_line" "$user_chrome"; then
  gnb_backup_file "$user_chrome" "$timestamp" || gnb_fail "Não foi possível criar o backup de userChrome.css."
  temporary_css="$(mktemp "${TMPDIR:-/tmp}/gnb-userChrome.XXXXXX")" || gnb_fail "Não foi possível criar um arquivo temporário."
  {
    printf '%s\n\n' "$import_line"
    command cat "$user_chrome"
  } > "$temporary_css" || gnb_fail "Não foi possível preparar userChrome.css."
  mv "$temporary_css" "$user_chrome" || gnb_fail "Não foi possível atualizar userChrome.css."
fi

if [[ ! -f "$user_js" ]]; then
  printf '%s\n' "$preference_line" > "$user_js" || gnb_fail "Não foi possível ativar o carregamento do estilo."
elif grep -Eq '^[[:space:]]*user_pref\("toolkit\.legacyUserProfileCustomizations\.stylesheets"[[:space:]]*,[[:space:]]*false[[:space:]]*\);' "$user_js" ||
     ! grep -Eq '^[[:space:]]*user_pref\("toolkit\.legacyUserProfileCustomizations\.stylesheets"[[:space:]]*,[[:space:]]*true[[:space:]]*\);' "$user_js"; then
  gnb_backup_file "$user_js" "$timestamp" || gnb_fail "Não foi possível criar o backup de user.js."
  temporary_js="$(mktemp "${TMPDIR:-/tmp}/gnb-userJs.XXXXXX")" || gnb_fail "Não foi possível criar um arquivo temporário."
  awk -v replacement="$preference_line" '
    BEGIN { written = 0 }
    /^[[:space:]]*user_pref\("toolkit\.legacyUserProfileCustomizations\.stylesheets"[[:space:]]*,/ {
      if (!written) print replacement
      written = 1
      next
    }
    { print }
    END {
      if (!written) {
        if (NR > 0) print ""
        print replacement
      }
    }
  ' "$user_js" > "$temporary_js" || gnb_fail "Não foi possível preparar user.js."
  mv "$temporary_js" "$user_js" || gnb_fail "Não foi possível atualizar user.js."
fi

printf '\nVisual instalado com sucesso.\n'
printf 'Perfil: %s\n' "$profile_dir"
printf '\nAbra novamente o Firefox para aplicar o chip colorido.\n'
gnb_pause_before_exit
