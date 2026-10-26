#!/usr/bin/env python3
"""Release-level structural and reproducibility audit.

Uses only Python's standard library plus the system Node.js and Bash binaries.
It never reads or modifies a real Firefox profile.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
PLATFORMS = ("macos", "windows", "linux")


class HtmlAuditParser(HTMLParser):
    def __init__(self, path: Path) -> None:
        super().__init__(convert_charrefs=True)
        self.path = path
        self.ids: set[str] = set()
        self.duplicate_ids: list[str] = []
        self.inline_scripts: list[int] = []
        self._script_without_src = False
        self._script_line = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        element_id = attributes.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicate_ids.append(element_id)
            self.ids.add(element_id)
        if tag == "script":
            self._script_without_src = not bool(attributes.get("src"))
            self._script_line = self.getpos()[0]
            src = attributes.get("src")
            if src and ("://" in src or src.startswith("//")):
                raise AssertionError(f"remote script in {self.path}:{self._script_line}: {src}")

    def handle_data(self, data: str) -> None:
        if self._script_without_src and data.strip():
            self.inline_scripts.append(self._script_line)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self._script_without_src = False


def run(command: list[str], cwd: Path = ROOT) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=180,
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_zip_name(name: str) -> bool:
    if not name or "\\" in name or name.startswith("/") or "\x00" in name:
        return False
    parts = name.rstrip("/").split("/")
    return bool(parts) and all(part not in {"", ".", ".."} for part in parts)


def audit_zip(path: Path, expected_root: str | None = None) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)), f"duplicate ZIP entries in {path.name}"
        assert all(safe_zip_name(name) for name in names), f"unsafe ZIP path in {path.name}"
        for info in archive.infolist():
            unix_type = (info.external_attr >> 16) & 0o170000
            assert unix_type != 0o120000, f"symbolic link in {path.name}: {info.filename}"
        if expected_root:
            assert all(
                name == expected_root or name.startswith(f"{expected_root}/") for name in names
            ), f"unexpected source ZIP root in {path.name}"
        archive.testzip() is None or (_ for _ in ()).throw(
            AssertionError(f"corrupt member in {path.name}")
        )
        return names


def load_builder(source_root: Path):
    spec = importlib.util.spec_from_file_location("gnb_build", source_root / "build.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def compare_xpi_to_runtime(source_root: Path, xpi: Path) -> None:
    builder = load_builder(source_root)
    expected = {name for name, _path in builder.runtime_entries(VERSION)}
    with zipfile.ZipFile(xpi) as archive:
        actual = {name for name in archive.namelist() if not name.endswith("/")}
    assert actual == expected, (
        f"XPI/runtime mismatch; missing={sorted(expected - actual)}, extra={sorted(actual - expected)}"
    )


def main() -> int:
    assert VERSION == "3.0.10", f"unexpected release version: {VERSION}"

    # Parse every JSON and every SVG shipped in source.
    for path in ROOT.rglob("*.json"):
        if ".git" not in path.parts and "dist" not in path.parts:
            json.loads(path.read_text(encoding="utf-8-sig"))
    for path in ROOT.rglob("*.svg"):
        if ".git" not in path.parts and "dist" not in path.parts:
            ElementTree.parse(path)

    # HTML structure: IDs are unique and executable code is never inline/remote.
    for path in ROOT.rglob("*.html"):
        if ".git" in path.parts or "dist" in path.parts:
            continue
        parser = HtmlAuditParser(path)
        parser.feed(path.read_text(encoding="utf-8"))
        assert not parser.duplicate_ids, f"duplicate IDs in {path}: {parser.duplicate_ids}"
        assert not parser.inline_scripts, f"inline script in {path}: {parser.inline_scripts}"

    # JavaScript and POSIX script syntax.
    for path in sorted(ROOT.rglob("*.js")):
        if ".git" not in path.parts and "dist" not in path.parts:
            run(["node", "--check", str(path)])
    for path in sorted(list((ROOT / "visual-src").rglob("*.sh")) + list((ROOT / "visual-src").rglob("*.command"))):
        run(["bash", "-n", str(path)])

    with tempfile.TemporaryDirectory(prefix="gnb-release-audit-") as temporary:
        temporary_root = Path(temporary)

        # The builder must reject a symlinked output directory before resolving it.
        real_output = temporary_root / "real-output"
        real_output.mkdir()
        symlink_output = temporary_root / "linked-output"
        try:
            symlink_output.symlink_to(real_output, target_is_directory=True)
        except OSError:
            symlink_output = None
        if symlink_output is not None:
            rejected = subprocess.run(
                ["python3", "build.py", "--dist", str(symlink_output)],
                cwd=ROOT,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=30,
            )
            assert rejected.returncode != 0
            assert "symbolic link" in rejected.stderr.lower()

        first_dist = temporary_root / "first"
        run(["python3", "build.py", "--dist", str(first_dist), "--check-reproducible"])

        xpi = first_dist / f"groups-on-the-bar-firefox-v{VERSION}.xpi"
        source_zip = first_dist / f"groups-on-the-bar-firefox-source-v{VERSION}.zip"
        assert xpi.is_file() and source_zip.is_file()
        xpi_names = audit_zip(xpi)
        assert "manifest.json" in xpi_names
        assert not any(name.startswith("tests/") for name in xpi_names)
        assert "build.py" not in xpi_names
        compare_xpi_to_runtime(ROOT, xpi)

        source_root_name = f"groups-on-the-bar-firefox-source-v{VERSION}"
        source_names = audit_zip(source_zip, source_root_name)
        for required in ("README.md", "PRIVACY.md", "AMO_REVIEW_NOTES.md", "build.py"):
            assert f"{source_root_name}/{required}" in source_names
        assert any(name.startswith(f"{source_root_name}/visual-src/") for name in source_names)

        # Embedded visual ZIPs are byte-identical to the separately distributed ZIPs.
        with zipfile.ZipFile(xpi) as archive:
            for platform in PLATFORMS:
                filename = f"groups-on-the-bar-visual-{platform}-v{VERSION}.zip"
                separate = first_dist / filename
                audit_zip(separate, f"grupos-na-barra-visual-{platform}")
                embedded = archive.read(f"visual/{filename}data")
                assert embedded == separate.read_bytes(), f"embedded visual mismatch: {platform}"

        # A reviewer can rebuild the exact XPI from the submitted source ZIP.
        extracted = temporary_root / "extracted"
        with zipfile.ZipFile(source_zip) as archive:
            archive.extractall(extracted)
        rebuilt_root = extracted / source_root_name
        rebuilt_dist = temporary_root / "rebuilt"
        run(["python3", "build.py", "--dist", str(rebuilt_dist), "--check-reproducible"], cwd=rebuilt_root)
        for filename in [
            f"groups-on-the-bar-firefox-v{VERSION}.xpi",
            *[f"groups-on-the-bar-visual-{platform}-v{VERSION}.zip" for platform in PLATFORMS],
        ]:
            assert (first_dist / filename).read_bytes() == (rebuilt_dist / filename).read_bytes(), (
                f"source rebuild mismatch: {filename}"
            )

        # Checksums match every release artifact and do not include themselves.
        checksum_lines = (first_dist / "SHA256SUMS.txt").read_text(encoding="utf-8").splitlines()
        checksum_map = {line.split("  ", 1)[1]: line.split("  ", 1)[0] for line in checksum_lines}
        expected_artifacts = {
            f"groups-on-the-bar-firefox-v{VERSION}.xpi",
            f"groups-on-the-bar-firefox-source-v{VERSION}.zip",
            *{f"groups-on-the-bar-visual-{platform}-v{VERSION}.zip" for platform in PLATFORMS},
        }
        assert set(checksum_map) == expected_artifacts
        for filename in expected_artifacts:
            assert checksum_map[filename] == sha256(first_dist / filename)

    print("release structural/reproducibility audit: passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
