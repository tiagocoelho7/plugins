#!/usr/bin/env python3
"""Integration tests for the optional POSIX appearance installers.

The scripts are executed against disposable Firefox-like profiles. No real
Firefox profile is read or modified.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPORT_LINE = '@import url("grupos-na-barra.css");'
PREFERENCE_LINE = 'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);'


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=30,
    )


def check_platform(platform: str, installer: str, remover: str) -> None:
    source = ROOT / "visual-src" / platform
    with tempfile.TemporaryDirectory(prefix=f"gnb-{platform}-") as temporary:
        profile = Path(temporary) / "Profile with spaces.default-release"
        chrome = profile / "chrome"
        chrome.mkdir(parents=True)
        (profile / "prefs.js").write_text('// profile marker\n', encoding="utf-8")
        (chrome / "userChrome.css").write_text(
            '/* existing user style */\n#navigator-toolbox { opacity: 1; }\n',
            encoding="utf-8",
        )
        (profile / "user.js").write_text(
            'user_pref("example.keep", true);\n'
            'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", false);\n',
            encoding="utf-8",
        )

        run([str(source / installer), str(profile)])
        run([str(source / installer), str(profile)])

        user_chrome = (chrome / "userChrome.css").read_text(encoding="utf-8")
        user_js = (profile / "user.js").read_text(encoding="utf-8")
        installed_css = chrome / "grupos-na-barra.css"
        assert user_chrome.splitlines().count(IMPORT_LINE) == 1
        assert "existing user style" in user_chrome
        assert user_js.count(PREFERENCE_LINE) == 1
        assert 'user_pref("example.keep", true);' in user_js
        assert "stylesheets\", false" not in user_js
        assert installed_css.read_bytes() == (source / "grupos-na-barra.css").read_bytes()

        backup_count_after_install = len(list(profile.rglob("*.backup-*")))
        assert backup_count_after_install >= 2

        run([str(source / remover), str(profile)])
        user_chrome_after_remove = (chrome / "userChrome.css").read_text(encoding="utf-8")
        user_js_after_remove = (profile / "user.js").read_text(encoding="utf-8")
        assert IMPORT_LINE not in user_chrome_after_remove
        assert "existing user style" in user_chrome_after_remove
        assert PREFERENCE_LINE in user_js_after_remove
        assert not installed_css.exists()

        # A second removal is harmless and preserves unrelated customization.
        run([str(source / remover), str(profile)])
        assert IMPORT_LINE not in (chrome / "userChrome.css").read_text(encoding="utf-8")
        assert 'user_pref("example.keep", true);' in (profile / "user.js").read_text(encoding="utf-8")



def check_windows_static() -> None:
    source = ROOT / "visual-src" / "windows"
    common = (source / "Visual-Common.ps1").read_text(encoding="utf-8-sig")
    assert (
        "[AllowEmptyCollection()][Parameter(Mandatory = $true)]"
        "[System.Collections.Generic.List[string]]$List"
    ) in common, "Windows installer must allow its initially empty profile-path list"


def main() -> int:
    check_windows_static()
    check_platform("linux", "instalar-visual.sh", "remover-visual.sh")
    check_platform("macos", "Instalar-visual.command", "Remover-visual.command")
    print("visual installer integration tests: passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
