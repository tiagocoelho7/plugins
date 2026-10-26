#!/usr/bin/env bash

set -u
set -o pipefail

GNB_PROFILE_CANDIDATES=()
GNB_SEARCHED_ROOTS=()

gnb_fail() {
  printf '\nERRO: %s\n' "$1" >&2
  exit 1
}

gnb_assert_firefox_closed() {
  if command -v pgrep >/dev/null 2>&1 && {
    pgrep -x firefox >/dev/null 2>&1 || pgrep -x firefox-bin >/dev/null 2>&1 ||
    pgrep -x firefox-esr >/dev/null 2>&1
  }; then
    gnb_fail "Feche todas as janelas do Firefox antes de continuar."
  fi
}

gnb_array_contains() {
  local expected="$1"
  local current=""
  shift
  for current in "$@"; do
    [[ "$current" = "$expected" ]] && return 0
  done
  return 1
}

gnb_is_profile_dir() {
  local candidate="${1%/}"
  [[ -d "$candidate" ]] || return 1
  [[ -f "$candidate/prefs.js" || -f "$candidate/compatibility.ini" ||
     -f "$candidate/places.sqlite" || -d "$candidate/sessionstore-backups" ]]
}

gnb_add_candidate() {
  local candidate="${1%/}"
  [[ -n "$candidate" ]] || return 0
  gnb_is_profile_dir "$candidate" || return 0
  gnb_array_contains "$candidate" "${GNB_PROFILE_CANDIDATES[@]}" || GNB_PROFILE_CANDIDATES+=("$candidate")
}

gnb_add_searched_root() {
  local root="${1%/}"
  [[ -n "$root" ]] || return 0
  gnb_array_contains "$root" "${GNB_SEARCHED_ROOTS[@]}" || GNB_SEARCHED_ROOTS+=("$root")
}

gnb_resolve_stored_path() {
  local firefox_root="$1"
  local stored_path="$2"
  local is_relative="${3:-1}"
  if [[ "$is_relative" = "0" || "$stored_path" = /* ]]; then
    printf '%s' "$stored_path"
  else
    printf '%s/%s' "$firefox_root" "$stored_path"
  fi
}

gnb_collect_ini_candidates() {
  local firefox_root="$1"
  local profiles_ini="$firefox_root/profiles.ini"
  local record=""
  local relative=""
  local stored_path=""
  local candidate=""

  [[ -f "$profiles_ini" ]] || return 0

  while IFS= read -r stored_path; do
    [[ -n "$stored_path" ]] || continue
    candidate="$(gnb_resolve_stored_path "$firefox_root" "$stored_path" "1")"
    gnb_add_candidate "$candidate"
  done < <(
    awk '
      /^\[Install/ { in_install = 1; next }
      /^\[/ { in_install = 0 }
      in_install && /^Default=/ {
        sub(/^Default=/, "")
        sub(/\r$/, "")
        print
      }
    ' "$profiles_ini"
  )

  while IFS= read -r record; do
    [[ -n "$record" ]] || continue
    relative="${record%%|*}"
    stored_path="${record#*|}"
    candidate="$(gnb_resolve_stored_path "$firefox_root" "$stored_path" "$relative")"
    gnb_add_candidate "$candidate"
  done < <(
    awk -F= '
      function emit() {
        if (in_profile && profile_path != "") print is_relative "|" profile_path
      }
      /^\[Profile/ {
        emit()
        in_profile = 1
        profile_path = ""
        is_relative = "1"
        next
      }
      /^\[/ {
        emit()
        in_profile = 0
        profile_path = ""
        next
      }
      in_profile && $1 == "Path" {
        profile_path = substr($0, index($0, "=") + 1)
        sub(/\r$/, "", profile_path)
      }
      in_profile && $1 == "IsRelative" {
        is_relative = substr($0, index($0, "=") + 1)
        sub(/\r$/, "", is_relative)
      }
      END { emit() }
    ' "$profiles_ini"
  )
}

gnb_collect_root_candidates() {
  local firefox_root="${1%/}"
  local candidate=""
  gnb_add_searched_root "$firefox_root"
  [[ -d "$firefox_root" ]] || return 0

  gnb_collect_ini_candidates "$firefox_root"

  for candidate in "$firefox_root"/Profiles/* "$firefox_root"/*; do
    [[ -d "$candidate" ]] || continue
    gnb_add_candidate "$candidate"
  done
}

gnb_profile_stamp() {
  local candidate="$1"
  local source="$candidate"
  local stamp="0"
  [[ -f "$candidate/prefs.js" ]] && source="$candidate/prefs.js"
  stamp="$(stat -c %Y "$source" 2>/dev/null || stat -f %m "$source" 2>/dev/null || printf '0')"
  [[ "$stamp" =~ ^[0-9]+$ ]] || stamp="0"
  printf '%s' "$stamp"
}

gnb_pick_newest_candidate() {
  local candidate=""
  local best_profile=""
  local stamp="0"
  local best_stamp="-1"
  for candidate in "${GNB_PROFILE_CANDIDATES[@]}"; do
    stamp="$(gnb_profile_stamp "$candidate")"
    if (( stamp > best_stamp )); then
      best_stamp="$stamp"
      best_profile="$candidate"
    fi
  done
  [[ -n "$best_profile" ]] || return 1
  printf '%s' "$best_profile"
}

gnb_print_search_report() {
  local root=""
  printf '\nO instalador verificou estes locais:\n' >&2
  for root in "${GNB_SEARCHED_ROOTS[@]}"; do
    printf '  - %s\n' "$root" >&2
  done
}

gnb_manual_profile() {
  local selected=""
  if command -v zenity >/dev/null 2>&1; then
    selected="$(zenity --file-selection --directory --title="Escolha a pasta do perfil mostrada em about:support" 2>/dev/null)" || true
    selected="${selected%/}"
    if gnb_is_profile_dir "$selected"; then
      printf '%s' "$selected"
      return 0
    fi
  elif command -v kdialog >/dev/null 2>&1; then
    selected="$(kdialog --getexistingdirectory "$HOME" "Escolha a pasta do perfil mostrada em about:support" 2>/dev/null)" || true
    selected="${selected%/}"
    if gnb_is_profile_dir "$selected"; then
      printf '%s' "$selected"
      return 0
    fi
  fi

  [[ -t 0 ]] || return 1
  printf '\nCole o caminho da pasta do perfil mostrado em about:support\n' >&2
  printf '(campo “Pasta do perfil”) ou pressione Return para cancelar:\n> ' >&2
  IFS= read -r selected || return 1
  selected="${selected%/}"
  [[ -n "$selected" ]] || return 1
  if gnb_is_profile_dir "$selected"; then
    printf '%s' "$selected"
    return 0
  fi
  printf '\nA pasta escolhida não parece ser um perfil do Firefox: %s\n' "$selected" >&2
  return 1
}

gnb_resolve_firefox_profile() {
  local explicit_profile="${1:-${GNB_FIREFOX_PROFILE:-}}"
  local root=""
  local detected=""
  local flatpak_root=""
  local xdg_config_root="${XDG_CONFIG_HOME:-$HOME/.config}"
  local roots=(
    "$xdg_config_root/mozilla/firefox"
    "$xdg_config_root/firefox"
    "$HOME/.mozilla/firefox"
    "$HOME/.mozilla/firefox-esr"
    "$HOME/snap/firefox/common/.mozilla/firefox"
    "$HOME/.var/app/org.mozilla.firefox/.mozilla/firefox"
  )

  if [[ -n "$explicit_profile" ]]; then
    explicit_profile="${explicit_profile%/}"
    gnb_is_profile_dir "$explicit_profile" || {
      printf 'O perfil informado não é válido: %s\n' "$explicit_profile" >&2
      return 1
    }
    printf '%s' "$explicit_profile"
    return 0
  fi

  GNB_PROFILE_CANDIDATES=()
  GNB_SEARCHED_ROOTS=()
  for root in "${roots[@]}"; do
    gnb_collect_root_candidates "$root"
  done
  for flatpak_root in "$HOME"/.var/app/org.mozilla.firefox*/.mozilla/firefox; do
    [[ -d "$flatpak_root" ]] || continue
    gnb_collect_root_candidates "$flatpak_root"
  done

  detected="$(gnb_pick_newest_candidate)" && {
    printf '%s' "$detected"
    return 0
  }

  gnb_print_search_report
  gnb_manual_profile
}

gnb_backup_file() {
  local path="$1"
  local timestamp="$2"
  local backup="$path.backup-$timestamp"
  local counter=1
  [[ -f "$path" ]] || return 0
  while [[ -e "$backup" ]]; do
    backup="$path.backup-$timestamp-$counter"
    counter=$((counter + 1))
  done
  cp -p "$path" "$backup"
}
