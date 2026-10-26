#!/usr/bin/env python3
"""Deterministic release builder for Groups 'On the Bar'.

Requirements: Python 3.10+ from the standard library only.
Outputs are written to ./dist by default.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Iterable, Sequence

ROOT = Path(__file__).resolve().parent
FIXED_ZIP_TIME = (2026, 1, 1, 0, 0, 0)
VERSION_PATTERN = re.compile(r"^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){1,3}$")
TOP_LEVEL_RUNTIME_FILES = (
    "manifest.json",
    "background.js",
    "sync-store.js",
    "ui-preferences.js",
    "translations-extra.js",
)
TOP_LEVEL_RUNTIME_DIRS = ("_locales", "icons", "launcher", "popup")
VISUAL_PLATFORMS = ("macos", "windows", "linux")
VISUAL_ROOT_NAMES = {
    "macos": "grupos-na-barra-visual-macos",
    "windows": "grupos-na-barra-visual-windows",
    "linux": "grupos-na-barra-visual-linux",
}
SOURCE_EXCLUDES = {
    ".git",
    "dist",
    "__pycache__",
    ".pytest_cache",
    ".coverage",
}


def read_version() -> str:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    version = str(manifest.get("version", "")).strip()
    if not VERSION_PATTERN.fullmatch(version):
        raise RuntimeError(
            "manifest.json version must contain 2 to 4 dot-separated non-negative integers"
        )
    return version


def is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def validate_archive_name(name: str) -> str:
    if not isinstance(name, str) or not name or "\x00" in name or "\\" in name:
        raise RuntimeError(f"invalid archive name: {name!r}")
    if name.startswith("/") or name.endswith("/"):
        raise RuntimeError(f"archive entries must be relative files: {name!r}")
    parts = name.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise RuntimeError(f"unsafe archive path: {name!r}")
    normalized = PurePosixPath(name).as_posix()
    if normalized != name:
        raise RuntimeError(f"non-canonical archive path: {name!r}")
    return normalized


def validate_source_path(path: Path) -> Path:
    if path.is_symlink():
        raise RuntimeError(f"release inputs may not be symbolic links: {path}")
    resolved = path.resolve(strict=True)
    if not is_within(resolved, ROOT.resolve()):
        raise RuntimeError(f"release input escapes the source tree: {path}")
    if not resolved.is_file():
        raise RuntimeError(f"missing release input: {path}")
    return resolved


def validate_dist_directory(dist: Path) -> Path:
    if dist.is_symlink():
        raise RuntimeError("output directory may not be a symbolic link")
    resolved = dist.resolve()
    root = ROOT.resolve()
    default_dist = (ROOT / "dist").resolve()
    if resolved == root or is_within(root, resolved):
        raise RuntimeError("output directory cannot be the source tree or one of its parents")
    if is_within(resolved, root) and resolved != default_dist:
        raise RuntimeError("an output directory inside the source tree must be ./dist")
    return resolved


def normalized_mode(path: Path) -> int:
    # Do not depend on executable bits surviving source-ZIP extraction. The
    # runnable POSIX installers must remain executable even when the source was
    # unpacked by a tool that discarded Unix permissions.
    if path.name == "build.py" or path.suffix.lower() in {".sh", ".command"}:
        return 0o755
    return 0o644


def zip_bytes(entries: Sequence[tuple[str, Path]]) -> bytes:
    normalized_entries: list[tuple[str, Path]] = []
    seen_names: set[str] = set()
    for archive_name, source_path in entries:
        safe_name = validate_archive_name(archive_name.replace(os.sep, "/"))
        if safe_name in seen_names:
            raise RuntimeError(f"duplicate archive entry: {safe_name}")
        seen_names.add(safe_name)
        normalized_entries.append((safe_name, validate_source_path(source_path)))

    buffer = io.BytesIO()
    with zipfile.ZipFile(
        buffer,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
        strict_timestamps=True,
    ) as archive:
        for archive_name, source_path in sorted(normalized_entries, key=lambda item: item[0]):
            info = zipfile.ZipInfo(archive_name, FIXED_ZIP_TIME)
            info.create_system = 3
            info.compress_type = zipfile.ZIP_STORED
            info.external_attr = (stat.S_IFREG | normalized_mode(source_path)) << 16
            info.flag_bits |= 0x800  # UTF-8 file names
            archive.writestr(info, source_path.read_bytes())
    return buffer.getvalue()


def write_if_changed(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink():
        raise RuntimeError(f"refusing to overwrite symbolic link: {path}")
    if path.exists() and path.read_bytes() == payload:
        return
    path.write_bytes(payload)


def visual_entries(platform: str) -> list[tuple[str, Path]]:
    source_root = ROOT / "visual-src" / platform
    if not source_root.is_dir():
        raise RuntimeError(f"missing visual source directory: {source_root}")
    package_root = VISUAL_ROOT_NAMES[platform]
    return [
        (f"{package_root}/{path.relative_to(source_root).as_posix()}", path)
        for path in source_root.rglob("*")
        if path.is_file()
    ]


def clean_runtime_visual_packages() -> None:
    visual_dir = ROOT / "visual"
    for path in visual_dir.glob("groups-on-the-bar-visual-*.zip*"):
        path.unlink()


def build_visual_packages(version: str, dist: Path) -> dict[str, bytes]:
    clean_runtime_visual_packages()
    payloads: dict[str, bytes] = {}
    for platform in VISUAL_PLATFORMS:
        payload = zip_bytes(visual_entries(platform))
        filename = f"groups-on-the-bar-visual-{platform}-v{version}.zip"
        write_if_changed(dist / filename, payload)
        write_if_changed(ROOT / "visual" / f"{filename}data", payload)
        payloads[platform] = payload
    return payloads


def runtime_entries(version: str) -> list[tuple[str, Path]]:
    entries: list[tuple[str, Path]] = []
    for filename in TOP_LEVEL_RUNTIME_FILES:
        entries.append((filename, ROOT / filename))
    for dirname in TOP_LEVEL_RUNTIME_DIRS:
        directory = ROOT / dirname
        entries.extend(
            (path.relative_to(ROOT).as_posix(), path)
            for path in directory.rglob("*")
            if path.is_file()
        )
    visual_dir = ROOT / "visual"
    for filename in ("setup.html", "setup.css", "setup.js"):
        entries.append((f"visual/{filename}", visual_dir / filename))
    for platform in VISUAL_PLATFORMS:
        filename = f"groups-on-the-bar-visual-{platform}-v{version}.zipdata"
        entries.append((f"visual/{filename}", visual_dir / filename))
    return entries


def source_entries(version: str, dist: Path) -> list[tuple[str, Path]]:
    root_name = f"groups-on-the-bar-firefox-source-v{version}"
    entries: list[tuple[str, Path]] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if is_within(path.resolve(), dist.resolve()):
            continue
        relative = path.relative_to(ROOT)
        if any(part in SOURCE_EXCLUDES for part in relative.parts):
            continue
        if relative.parts[0] == "visual" and path.suffix == ".zip":
            continue
        entries.append((f"{root_name}/{relative.as_posix()}", path))
    return entries


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def write_checksums(dist: Path, artifacts: dict[str, bytes]) -> None:
    lines = [f"{sha256(payload)}  {name}" for name, payload in sorted(artifacts.items())]
    (dist / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def build(dist: Path, check_reproducible: bool = False) -> dict[str, bytes]:
    version = read_version()
    dist = validate_dist_directory(dist)
    dist.mkdir(parents=True, exist_ok=True)
    for old_file in dist.iterdir():
        if old_file.is_file():
            old_file.unlink()

    visual_payloads = build_visual_packages(version, dist)
    artifacts: dict[str, bytes] = {
        f"groups-on-the-bar-visual-{platform}-v{version}.zip": payload
        for platform, payload in visual_payloads.items()
    }

    xpi_name = f"groups-on-the-bar-firefox-v{version}.xpi"
    source_name = f"groups-on-the-bar-firefox-source-v{version}.zip"
    artifacts[xpi_name] = zip_bytes(runtime_entries(version))
    write_if_changed(dist / xpi_name, artifacts[xpi_name])
    artifacts[source_name] = zip_bytes(source_entries(version, dist))
    write_if_changed(dist / source_name, artifacts[source_name])
    write_checksums(dist, artifacts)

    if check_reproducible:
        second_visual = {
            platform: zip_bytes(visual_entries(platform)) for platform in VISUAL_PLATFORMS
        }
        second_xpi = zip_bytes(runtime_entries(version))
        second_source = zip_bytes(source_entries(version, dist))
        if second_visual != visual_payloads or second_xpi != artifacts[xpi_name] or second_source != artifacts[source_name]:
            raise RuntimeError("release build is not reproducible")

    return artifacts


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dist",
        type=Path,
        default=ROOT / "dist",
        help="output directory (default: ./dist)",
    )
    parser.add_argument(
        "--check-reproducible",
        action="store_true",
        help="build every archive twice and compare the bytes",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        artifacts = build(args.dist, args.check_reproducible)
    except Exception as error:  # noqa: BLE001 - CLI boundary
        print(f"build failed: {error}", file=sys.stderr)
        return 1

    for name, payload in sorted(artifacts.items()):
        print(f"{sha256(payload)}  {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
