# Writes a copy of a drive.mjs plan whose pages first define the helpers of
# app-helpers.js. Python standard library only.
#   python -I scripts/firefox-bidi/add-helpers.py <plan.json> <out.json>
import json
import pathlib
import sys

if len(sys.argv) != 3:
    sys.exit('Usage: python -I scripts/firefox-bidi/add-helpers.py <plan.json> <out.json>')

helpers = (pathlib.Path(__file__).parent / 'app-helpers.js').read_text(encoding='utf-8')
plan = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
for page in plan['pages']:
    page['steps'] = [{'js': helpers, 'wait': 100}, *page.get('steps', [])]
pathlib.Path(sys.argv[2]).write_text(json.dumps(plan, indent=2), encoding='utf-8')
