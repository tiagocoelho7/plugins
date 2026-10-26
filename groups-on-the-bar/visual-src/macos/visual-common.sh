#!/bin/bash

set -u
set -o pipefail

GNB_PROFILE_CANDIDATES=()
GNB_PROFILE_CANDIDATES_COUNT=0
GNB_SEARCHED_ROOTS=()
GNB_SEARCHED_ROOTS_COUNT=0

gnb_pause_before_exit() {
  [[ -t 0 ]] || return 0
  printf '\nPressione Return para fechar esta janela.'
  read -r _unused
}

gnb_fail() {
  printf '\nERRO: %s\n' "$1" >&2
  gnb_pause_before_exit
  exit 1
}

gnb_assert_firefox_closed() {
  if command -v pgrep >/dev/null 2>&1 && {
    pgrep -x firefox >/dev/null 2>&1 || pgrep -x Firefox >/dev/null 2>&1 ||
    pgrep -x firefox-bin >/dev/null 2>&1
  }; then
    gnb_fail "Feche todas as janelas do Firefox com ⌘Q antes de continuar."
  fi
}

gnb_is_profile_dir() {
  local candidate="${1%/}"
  [[ -d "$candidate" ]] || return 1
  [[ -f "$candidate/prefs.js" || -f "$candidate/compatibility.ini" ||
     -f "$candidate/places.sqlite" || -d "$candidate/sessionstore-backups" ]]
}

gnb_add_candidate() {
  local candidate="${1%/}"
  local index=0
  [[ -n "$candidate" ]] || return 0
  gnb_is_profile_dir "$candidate" || return 0

  # Bash 3.2 (the version shipped with macOS) raises "unbound variable"
  # when an empty array is expanded as "${array[@]}" while set -u is active.
  # Iterate by an explicit count so the empty-array case is never expanded.
  for (( index=0; index<GNB_PROFILE_CANDIDATES_COUNT; index++ )); do
    [[ "${GNB_PROFILE_CANDIDATES[$index]}" = "$candidate" ]] && return 0
  done

  GNB_PROFILE_CANDIDATES[$GNB_PROFILE_CANDIDATES_COUNT]="$candidate"
  GNB_PROFILE_CANDIDATES_COUNT=$((GNB_PROFILE_CANDIDATES_COUNT + 1))
}

gnb_add_searched_root() {
  local root="${1%/}"
  local index=0
  [[ -n "$root" ]] || return 0

  for (( index=0; index<GNB_SEARCHED_ROOTS_COUNT; index++ )); do
    [[ "${GNB_SEARCHED_ROOTS[$index]}" = "$root" ]] && return 0
  done

  GNB_SEARCHED_ROOTS[$GNB_SEARCHED_ROOTS_COUNT]="$root"
  GNB_SEARCHED_ROOTS_COUNT=$((GNB_SEARCHED_ROOTS_COUNT + 1))
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
  stamp="$(stat -f %m "$source" 2>/dev/null || stat -c %Y "$source" 2>/dev/null || printf '0')"
  [[ "$stamp" =~ ^[0-9]+$ ]] || stamp="0"
  printf '%s' "$stamp"
}

gnb_pick_newest_candidate() {
  local candidate=""
  local best_profile=""
  local stamp="0"
  local best_stamp="-1"
  local index=0
  for (( index=0; index<GNB_PROFILE_CANDIDATES_COUNT; index++ )); do
    candidate="${GNB_PROFILE_CANDIDATES[$index]}"
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
  local index=0
  printf '\nO instalador verificou estes locais:\n' >&2
  for (( index=0; index<GNB_SEARCHED_ROOTS_COUNT; index++ )); do
    root="${GNB_SEARCHED_ROOTS[$index]}"
    printf '  - %s\n' "$root" >&2
  done
}

gnb_manual_profile() {
  local selected=""
  if command -v osascript >/dev/null 2>&1; then
    selected="$(osascript -e 'POSIX path of (choose folder with prompt "Escolha a pasta do perfil do Firefox mostrada em about:support")' 2>/dev/null)" || true
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
  local roots=(
    "$HOME/Library/Application Support/Firefox"
    "$HOME/Library/Containers/org.mozilla.firefox/Data/Library/Application Support/Firefox"
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
  GNB_PROFILE_CANDIDATES_COUNT=0
  GNB_SEARCHED_ROOTS=()
  GNB_SEARCHED_ROOTS_COUNT=0
  for root in "${roots[@]}"; do
    gnb_collect_root_candidates "$root"
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
