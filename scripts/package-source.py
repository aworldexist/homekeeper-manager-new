"""Create the complete, portable delivery archive using Python standard library only."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib

root = Path(__file__).resolve().parent.parent
output = root / 'deliverables'
output.mkdir(exist_ok=True)
archive = output / 'homekeeper-complete-source.zip'
directories = ['src', 'tests', 'scripts', 'public', 'deploy', 'dist']
files = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts',
         'index.html', '.gitignore', 'README.md', 'requirement.tst', 'DELIVERY_VERIFICATION.md']
paths = [root / name for name in files]
for name in directories:
    paths.extend(path for path in (root / name).rglob('*') if path.is_file())
with ZipFile(archive, 'w', ZIP_DEFLATED) as bundle:
    for path in paths:
        if not path.is_file():
            raise FileNotFoundError(path)
        if path.suffix == '.pyc' or '__pycache__' in path.parts:
            continue
        bundle.write(path, 'homekeeper/' + path.relative_to(root).as_posix())
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    names = bundle.namelist()
    for expected in ['package.json', 'package-lock.json', 'README.md', 'requirement.tst',
                     'src/App.tsx', 'public/references/food-storage.xlsx', 'dist/index.html']:
        assert 'homekeeper/' + expected in names, expected
    assert not any('/node_modules/' in name or '/.npm-cache/' in name for name in names)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / 'SHA256SUMS.txt').write_text(f'{digest}  {archive.name}\n', encoding='utf-8')
print(f'Created {archive.name}: {len(names)} files, {archive.stat().st_size} bytes, SHA256 {digest}')
