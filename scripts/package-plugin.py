"""Create a small, reproducible plugin ZIP from an explicit public-file allowlist."""
from pathlib import Path
import json, zipfile, hashlib

root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'plugin.json').read_text())
destination=root/'artifacts'/f'hicks-help-{manifest["version"]}.zip'
destination.parent.mkdir(exist_ok=True)
files=['plugin.json','mcp.json','assets/har-mark.png','PLUGIN-README.md']
with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        item=zipfile.ZipInfo(name, date_time=(2026,10,2,0,0,0))
        item.external_attr=0o644<<16
        archive.writestr(item,(root/name).read_bytes(),compress_type=zipfile.ZIP_DEFLATED)
with zipfile.ZipFile(destination) as archive:
    assert sorted(archive.namelist())==sorted(files)
    assert json.loads(archive.read('mcp.json'))['mcpServers']['har']['url']=='https://hicksvilleautorecyclers.com/api/mcp'
print(destination)
print('SHA-256:',hashlib.sha256(destination.read_bytes()).hexdigest())
