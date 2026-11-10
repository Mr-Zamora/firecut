# FireCut

Offline branching-video story player for Year 11 IT Multimedia.
Spec: `md/2026-11-10-firecut-spec.md` (source of truth).
Build brief: `md/2026-11-10-firecut-build-brief.md`.

## Layout

- `firecut-template/` - student template (PLAY.html, story.js, style.css, media/, firecut/)
- `firecut-demo/` - same structure, populated demo (keep firecut/ in sync with template!)
- `docs/` - student-quick-start.md, teacher-notes.md
- `tests/` - dev tooling, not shipped to students

## Rules

- `firecut-template/firecut/firecut.js` is ES5-safe (no arrow fns,
  template literals, let/const, forEach, Date.now, `.catch` dot-access)
  so it runs under cscript JScript for headless tests. After editing,
  re-copy `firecut.js` and `firecut.css` into `firecut-demo/firecut/`.
- `firecut-demo/style.css` has demo-only rules (hidden title, Start button
  under the egg). Never overwrite it with the template's style.css; copy
  only the documentation comments across if those change.
- No dependencies, no fetch/XHR, works on file://.
- Australian spelling in user-facing text; no em dashes.

## Test commands (repo root)

```
cscript //E:jscript //Nologo tests/run-check-tests.js   parser + checker fixtures
python tests/run-media-tests.py                        media probing via QuickJS
cscript //E:jscript //Nologo tests/check-demo-story.js   validate real story.js files
python tests/render-map.py firecut-demo/story.js out.png  render story map to PNG (needs resvg-py)
```

- Fixtures: `tests/stories.js` (shared by cscript + browser page).
- `tests/parser-test.html` - browser runner, `?auto` runs all.
- Gotchas: JScript `String.split` drops empty strings (manual
  `splitLines` used); reserved words like `catch` need bracket
  access `p['catch']`; FSO on this OneDrive machine fails backslash
  paths - use forward slashes in test scripts.
