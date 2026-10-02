"""Update the exported personal browser plugin without changing its identity.

Usage: python3 scripts/package-personal-plugin.py /path/to/export.zip 1.0.1
The public submission's plugin.json and ZIP are never modified.
"""
from pathlib import Path
import hashlib
import json
import re
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]).resolve()
version = sys.argv[2]
assert re.fullmatch(r"\d+\.\d+\.\d+", version), "Use a semantic version"
with zipfile.ZipFile(source) as archive:
    original = json.loads(archive.read(".codex-plugin/plugin.json"))
    apps_bytes = archive.read(".app.json")
apps = json.loads(apps_bytes)
assert original["apps"] == "./.app.json"
assert re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", original["name"])
assert set(apps) == {"apps"} and len(apps["apps"]) == 1
assert all(set(app) == {"id"} and app["id"].startswith("asdk_app_") for app in apps["apps"].values())
assert tuple(map(int, version.split('.'))) > tuple(map(int, original["version"].split('.')))

public = json.loads((root / "plugin.json").read_text())
manifest = {
    "name": original["name"],
    "version": version,
    "description": public["description"],
    "author": public["author"],
    "apps": original["apps"],
    "interface": public["extensions"]["com.openai"]["interface"],
}
files = {
    ".codex-plugin/plugin.json": (json.dumps(manifest, indent=2) + "\n").encode(),
    ".app.json": apps_bytes,
    "assets/har-mark.png": (root / "assets/har-mark.png").read_bytes(),
    "README.md": (
        "# Hicks Help — personal browser testing update\n\n"
        f"Version {version}. Upload this to the existing personal testing plugin's "
        "Upload new version dialog in ChatGPT. The package retains its exported "
        f"internal name ({original['name']}) and registered browser app connection.\n\n"
        "Includes HAR's logo, company name, public support/legal links and starter "
        "prompts. No local server or desktop executable is included.\n\n"
        "The public hicks-help submission is separate and has already been submitted "
        "according to the owner. Do not upload this personal update to that submission.\n"
    ).encode(),
}
destination = root / "artifacts" / f"hicks-help-personal-{version}.zip"
with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
    for name, content in files.items():
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 2, 0, 0, 0))
        info.external_attr = 0o644 << 16
        archive.writestr(info, content, compress_type=zipfile.ZIP_DEFLATED)
with zipfile.ZipFile(destination) as archive:
    assert set(archive.namelist()) == set(files)
    built = json.loads(archive.read(".codex-plugin/plugin.json"))
    assert built["name"] == original["name"]
    assert archive.read(".app.json") == apps_bytes
    assert built["interface"]["developerName"] == "Hicksville Auto Recyclers"
    assert built["interface"]["displayName"] == "Hicks Help"
    assert built["interface"]["capabilities"] == ["Read"]
    for field in ["logo", "composerIcon"]:
        assert built["interface"][field].removeprefix("./") in archive.namelist()
print(destination)
print("Preserved package name:", original["name"])
print("Preserved registered app mapping; no bundled local or remote MCP declaration.")
print("SHA-256:", hashlib.sha256(destination.read_bytes()).hexdigest())
