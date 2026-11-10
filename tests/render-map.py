"""Render the story map for a story.js to a PNG, without a browser.

Usage:  python tests/render-map.py firecut-demo/story.js out.png
Needs:  pip install quickjs resvg-py
"""

import os
import re
import sys
import quickjs
import resvg_py

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
story_path, out_path = sys.argv[1], sys.argv[2]

engine = open(os.path.join(ROOT, 'firecut-template', 'firecut', 'firecut.js'),
              encoding='utf-8').read()
src = open(story_path, encoding='utf-8').read()
m = re.search(r'FireCut\.story\s*\(\s*`([\s\S]*)`\s*\)', src)
if not m:
    sys.exit('could not find FireCut.story(`...`) in ' + story_path)

ctx = quickjs.Context()
ctx.eval(engine)
ctx.set('storyText', m.group(1))
svg = ctx.eval('FireCut.mapSvg(FireCut.analyse(storyText).model)')

# Dark backdrop like the in-app panel, then render.
svg = svg.replace('>', '><rect width="100%" height="100%" fill="#14151b"/>', 1)
png = resvg_py.svg_to_bytes(svg_string=svg)
open(out_path, 'wb').write(bytes(png))
print('wrote', out_path)
