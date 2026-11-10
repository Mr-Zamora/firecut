"""Run FireCut's checkMedia through QuickJS with a stub DOM.

The stub <video>/<audio>/Image elements decide ok/missing/unplayable by
looking at the real files on disk (missing -> code 2, wrong signature ->
code 4), so the engine's branching logic is exercised for real.

Usage:  python tests/run-media-tests.py
"""

import os
import sys
import json
import quickjs

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(BASE, '..')


def _abs(path):
    # Media URLs are resolved the way a browser resolves them: relative
    # to the page that loaded them, which here is the tests/ folder.
    return path if os.path.isabs(path) else os.path.normpath(os.path.join(BASE, path))


def file_exists(path):
    return os.path.isfile(_abs(path))


def file_decodable(path):
    """A stand-in for the browser decoder: checks magic bytes."""
    try:
        head = open(_abs(path), 'rb').read(64)
    except OSError:
        return False
    low = path.lower()
    if low.endswith(('.mp4', '.m4v')):
        return b'ftyp' in head
    if low.endswith('.png'):
        return head[:4] == b'\x89PNG'
    if low.endswith(('.jpg', '.jpeg')):
        return head[:2] == b'\xff\xd8'
    if low.endswith('.mp3'):
        return head[:3] == b'ID3' or (head[0:1] == b'\xff' and (head[1] & 0xE0) == 0xE0)
    return False


ctx = quickjs.Context()
ctx.add_callable('pyExists', file_exists)
ctx.add_callable('pyDecodable', file_decodable)

results = []
ctx.add_callable('pyDone', lambda s: results.append(json.loads(s)))

engine = open(os.path.join(ROOT, 'firecut-template', 'firecut', 'firecut.js'),
              encoding='utf-8').read()
fixtures = open(os.path.join(BASE, 'stories.js'), encoding='utf-8').read()

ctx.eval(engine)
ctx.eval(fixtures)

# Minimal DOM: createElement returns an object whose src setter fires the
# matching handler synchronously, mirroring what a browser would do.
ctx.eval(r'''
function setTimeout() { return 0; }   /* the 10 s safety net never fires here */
var document = {
  createElement: function (kind) {
    return makeProbe(kind);
  }
};
function Image() {
  return makeProbe('image');
}
function makeProbe(kind) {
  var self = { error: null, videoWidth: 0 };
  Object.defineProperty(self, 'src', {
    set: function (v) {
      /* Browsers give code 4 for both missing and unreadable files. */
      if (!pyExists(v) || !pyDecodable(v)) {
        self.error = { code: 4 };
        if (self.onerror) { self.onerror(); }
      } else {
        /* "nopicture" files stand in for an undecodable video track. */
        self.videoWidth = v.indexOf('nopicture') >= 0 ? 0 : 1920;
        var ok = self.onload || self.onloadedmetadata;
        if (ok) { ok(); }
      }
    }
  });
  return self;
}
''')

ctx.eval(r'''
var __out = [];
TEST_STORIES.forEach(function (fix) {
  var res = FireCut.analyse(fix.text);
  var base = fix.mediaBase || '../firecut-demo/media/';
  var norm = base;
  FireCut.checkMedia(res.model, norm, function (mediaResults) {
    __out.push({ name: fix.name, media: mediaResults });
  });
});
pyDone(JSON.stringify(__out));
''')

# Pull expected media lists from the fixture file via QuickJS.
expected = json.loads(ctx.eval(
    'JSON.stringify(TEST_STORIES.map(function(f){return {name:f.name,'
    'media:f.media||[]}}))'
))

fail = 0
got = {r['name']: {m['file']: m['status'] for m in r['media']} for r in results[0]}
for fix in expected:
    exp = {m['file']: m['status'] for m in fix['media']}
    if not exp:
        continue
    actual = got.get(fix['name'], {})
    for f, st in exp.items():
        a = actual.get(f, '<no result>')
        ok = a == st
        tag = 'PASS' if ok else 'FAIL'
        if not ok:
            fail += 1
        print('%s  %-45s %-25s expected=%-10s got=%s'
              % (tag, fix['name'], f, st, a))

print('-' * 70)
print('%d failed' % fail)
sys.exit(1 if fail else 0)
