"""Refresh the editable source ZIP and static upload ZIP from the current release."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

site = Path(__file__).resolve().parent.parent
output = site.parent / 'Astreis_Website_Delivery'
output.mkdir(exist_ok=True)
for name, base, prefix in [('Astreis-Source.zip', site, Path('Astreis_Website')),
                           ('Astreis-Netlify.zip', site / 'dist', Path('.'))]:
    temporary = output / (name + '.next')
    with ZipFile(temporary, 'w', ZIP_DEFLATED, compresslevel=6) as archive:
        for p in sorted(base.rglob('*')):
            rel = p.relative_to(base)
            if not p.is_file() or any(x in rel.parts for x in ['dist', 'output', 'node_modules', '.git', '.netlify', '__pycache__', '.venv']):
                continue
            if p.name.startswith('.env') and p.name != '.env.example':
                continue
            archive.write(p, prefix / rel)
    with ZipFile(temporary) as archive:
        if archive.testzip() is not None:
            raise RuntimeError('Delivery archive failed verification')
    temporary.replace(output / name)
    print(output / name)
