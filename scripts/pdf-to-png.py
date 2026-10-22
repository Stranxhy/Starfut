"""Rasteriza PDFs a PNG para revisión visual.

Uso: python scripts/pdf-to-png.py <salida_png> <archivo.pdf> [<archivo.pdf> ...] [--dpi 110]
"""
import sys
from pathlib import Path

import pymupdf

args = sys.argv[1:]
dpi = 110
if "--dpi" in args:
    i = args.index("--dpi")
    dpi = int(args[i + 1])
    del args[i : i + 2]
out = Path(args[0])
out.mkdir(parents=True, exist_ok=True)
for f in args[1:]:
    doc = pymupdf.open(f)
    stem = Path(f).stem
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=dpi)
        pix.save(out / f"{stem}-p{i + 1}.png")
    print(f"{stem}: {doc.page_count} pagina(s)")
