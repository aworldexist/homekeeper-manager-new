"""Read the supplied workbook without changing it; retain sheet and row provenance.
Optional maintenance helper only. The web application has no Python dependency.
Usage: python scripts/extract-reference.py public/references/food-storage.xlsx
"""
import json
import sys
from pathlib import Path
import openpyxl

source = Path(sys.argv[1] if len(sys.argv) > 1 else 'public/references/food-storage.xlsx')
destination = Path('src/referenceWorkbook.json')
book = openpyxl.load_workbook(source, read_only=True, data_only=True)
sheets = []
for sheet in book:
    # The supplied workbook declares A1 dimensions although further rows contain data.
    sheet.reset_dimensions()
    rows = [{'row': index, 'cells': [str(v) if v is not None else '' for v in values]}
            for index, values in enumerate(sheet.iter_rows(values_only=True), 1)
            if any(v is not None for v in values)]
    sheets.append({'name': sheet.title, 'rows': rows})
destination.write_text(json.dumps({'sourceName': '常见生鲜食品水果保质期参考表.xlsx',
                                  'sourceUrl': './references/food-storage.xlsx',
                                  'sheets': sheets}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Extracted {sum(len(s["rows"])-1 for s in sheets)} reference rows in {len(sheets)} sheets.')
