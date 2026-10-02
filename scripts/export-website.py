"""Export a reviewed, compiled runtime into the existing HAR website checkout."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
destination = Path(sys.argv[1]).resolve() / 'vendor' / 'har-mcp'
modules = ['config', 'public-data', 'catalog', 'knowledge', 'limiter', 'server', 'handler']
tracked = subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=root, text=True)
if tracked.strip():
    raise SystemExit('Commit the reviewed source before exporting its runtime.')
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
package = json.loads((root / 'package.json').read_text())
files = {f'{module}{suffix}': (root / 'dist' / 'src' / f'{module}{suffix}').read_bytes()
         for module in modules for suffix in ['.js', '.d.ts']}
destination.mkdir(parents=True, exist_ok=True)
expected = set(files) | {'package.json', 'provenance.json'}
unexpected = {path.name for path in destination.iterdir()} - expected
if unexpected:
    raise SystemExit(f'Refusing to overwrite an unexpected vendor directory: {sorted(unexpected)}')
for name, content in files.items():
    (destination / name).write_bytes(content)
manifest = {
    'name': '@har/public-mcp', 'version': package['version'], 'private': True, 'type': 'module',
    'description': 'Compiled public MCP from the company Hicksvilleauto-mcp repository.',
    'exports': {f'./{name}': {'types': f'./{name}.d.ts', 'import': f'./{name}.js'} for name in ['config', 'handler']},
    'dependencies': package['dependencies'],
}
(destination / 'package.json').write_text(json.dumps(manifest, indent=2) + '\n')
provenance = {
    'repository': 'https://github.com/hicksvilleautorecyclers/Hicksvilleauto-mcp',
    'commit': commit,
    'regenerate': 'npm ci && npm run build && npm run check && python3 scripts/export-website.py /path/to/website',
    'sha256': {name: hashlib.sha256(content).hexdigest() for name, content in files.items()},
}
(destination / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
print(f'Exported {len(files)} reviewed runtime files from {commit} to {destination}')
