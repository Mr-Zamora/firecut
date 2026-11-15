/* ==========================================================================
   FireCut Story Editor - Phase 1 prototype
   Plain JavaScript (ES5-safe), no dependencies, works from file://.
   All parsing, checking and map drawing comes from firecut.js, so the
   editor and PLAY.html always agree. Students never edit this file.
   ========================================================================== */

var FireCutEditor = (function () {

  /* ----------------------------------------------------------------------
     Helpers with no DOM (kept JScript-safe so they can be tested headless)
     ---------------------------------------------------------------------- */

  function each(arr, fn) {
    for (var i = 0; i < arr.length; i++) { fn(arr[i], i); }
  }

  function idxOf(arr, item) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === item) { return i; }
    }
    return -1;
  }

  /* Split by hand: JScript's String.split drops empty strings. */
  function splitLines(text) {
    var lines = [], start = 0, i;
    for (i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === '\n' || ch === '\r') {
        lines.push(text.substring(start, i));
        if (ch === '\r' && text.charAt(i + 1) === '\n') { i++; }
        start = i + 1;
      }
    }
    lines.push(text.substring(start));
    return lines;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var OPEN = 'FireCut.story(`';
  var CLOSE = '`);';

  /* The whole story.js file, so editor line numbers match PLAY.html. */
  function buildFileText(raw) {
    return OPEN + raw + CLOSE;
  }

  /* The story text between the backticks, or null if they are missing. */
  function storyPart(fileText) {
    var a = fileText.indexOf('`'), b = fileText.lastIndexOf('`');
    if (a < 0 || b <= a) { return null; }
    return fileText.substring(a + 1, b);
  }

  /* The checker puts "Line 12: " in front of messages; the list shows
     the line number in its own column instead. The words are unchanged. */
  function messageWords(item) {
    return item.text.replace(/^Line \d+: /, '');
  }

  function sceneAtLine(model, line) {
    var found = null;
    each(model.scenes, function (s) { if (s.line <= line) { found = s; } });
    return found;
  }

  /* Which scenes (or the title screen) use each media file. */
  function mediaUsage(model) {
    var use = {};
    function add(file, where, line) {
      if (!file || file.toLowerCase() === 'none') { return; }
      if (!use.hasOwnProperty(file)) { use[file] = []; }
      for (var i = 0; i < use[file].length; i++) {
        if (use[file][i].where === where) { return; }
      }
      use[file].push({ where: where, line: line });
    }
    add(model.titleBackground, 'title screen', model.titleBackgroundLine);
    add(model.titleOverlay, 'title screen', model.titleOverlayLine);
    add(model.titleMusic, 'title screen', model.titleMusicLine);
    add(model.waitLoop, 'every scene', model.waitLoopLine);
    each(model.scenes, function (s) {
      add(s.video, s.name, s.videoLine);
      add(s.image, s.name, s.imageLine);
      add(s.music, s.name, s.musicLine);
      add(s.waitLoop, s.name, s.waitLoopLine);
      each(s.choices, function (ch) { add(ch.image, s.name, ch.line); });
    });
    return use;
  }

  /* Short description of a scene for the map tooltip. */
  function sceneSummary(scene) {
    var rows = [];
    if (scene.video) { rows.push('VIDEO: ' + scene.video); }
    if (scene.image) { rows.push('IMAGE: ' + scene.image); }
    if (!scene.video && !scene.image && scene.text) { rows.push('TEXT card'); }
    if (scene.timerTarget) {
      rows.push('TIMER: ' + scene.timer + ' s, then ' + scene.timerTarget);
    }
    if (scene.choices.length) {
      var t = [];
      each(scene.choices, function (c) { t.push(c.target); });
      rows.push(scene.choices.length + (scene.choices.length === 1 ? ' choice: ' : ' choices: ') +
        t.join(', '));
    }
    if (scene.next) { rows.push('NEXT: ' + scene.next); }
    if (scene.ending) { rows.push('ENDING: ' + scene.ending); }
    return rows;
  }

  /* ---------- syntax highlighting (one line in, HTML out) ---------- */

  var FILE_KEYS = { 'VIDEO': 1, 'IMAGE': 1, 'MUSIC': 1, 'WAIT-LOOP': 1,
    'TITLE-BACKGROUND': 1, 'TITLE-OVERLAY': 1, 'TITLE-MUSIC': 1 };
  var TARGET_KEYS = { 'START': 1, 'NEXT': 1 };

  function highlightLine(s) {
    if (/^\s*#/.test(s)) { return '<span class="fe-c">' + esc(s) + '</span>'; }
    var m = /^(\s*)([A-Z][A-Z\-]*)(\s*:)(.*)$/.exec(s);
    if (!m) { return esc(s); }
    var key = m[2], val = m[4];
    if (key === 'SCENE') {
      return m[1] + '<span class="fe-ks">' + esc(key + m[3] + val) + '</span>';
    }
    var out = m[1] + '<span class="fe-k">' + esc(key + m[3]) + '</span>';
    if (FILE_KEYS[key] && !/^\s*none\s*$/i.test(val)) {
      return out + '<span class="fe-f">' + esc(val) + '</span>';
    }
    if (TARGET_KEYS[key]) { return out + '<span class="fe-t">' + esc(val) + '</span>'; }
    if (key === 'CHOICE' || key === 'TIMER') {
      var a = val.indexOf('->');
      if (a >= 0) {
        var before = val.substring(0, a), after = val.substring(a + 2), img = '';
        var bar = after.indexOf('|');
        if (key === 'CHOICE' && bar >= 0) {
          img = after.substring(bar);
          after = after.substring(0, bar);
        }
        return out + esc(before) + '<span class="fe-a">-&gt;</span>' +
          '<span class="fe-t">' + esc(after) + '</span>' +
          (img ? '<span class="fe-f">' + esc(img) + '</span>' : '');
      }
    }
    return out + esc(val);
  }

  /* ----------------------------------------------------------------------
     Phase 1 sample data
     ---------------------------------------------------------------------- */

  /* Stand-in for a chosen media folder until Phase 3: the demo's files. */
  var SAMPLE_MEDIA = [
    'movie1_cadburyegg.mp4', 'movie2_cadburyegg.mp4', 'movie3_cadburyegg.mp4',
    'movie4_cadburyegg.mp4', 'movie5_cadburyegg.mp4', 'movie6_cadburyegg.mp4',
    'title-bg.mp4', 'title-bg.jpg', 'transparent-title-centre.png',
    'love-letter.jpg', 'yes.jpg', 'friendzone.jpg', 'title.mp3', 'ambient.mp3'
  ];

  /* Keyword tables, matching STORY.md. */
  var HELP_STORY_KEYS = [
    ['TITLE:', 'The story\'s name (also names the browser tab)'],
    ['START:', 'Which scene plays first'],
    ['TITLE-BACKGROUND:', 'Image, or a silent looping video, behind the title screen'],
    ['TITLE-OVERLAY:', 'See-through PNG over the title background'],
    ['TITLE-MUSIC:', 'Music on the title screen'],
    ['WAIT-LOOP:', 'Audio that loops while choices are shown']
  ];

  var HELP_SCENE_KEYS = [
    ['SCENE:', 'Starts a new scene and names it'],
    ['VIDEO:', 'Plays an mp4 clip full screen'],
    ['IMAGE:', 'Shows a still image'],
    ['TEXT:', 'Text card, or a caption over an image or video'],
    ['MUSIC:', 'Audio during an image or text scene'],
    ['DURATION:', 'Seconds an image or text scene shows (default 3)'],
    ['CHOICE:', 'A button: Label -> scene-name'],
    ['NEXT:', 'Move straight to another scene, no buttons'],
    ['ENDING:', 'Ending message and a Play again button'],
    ['CHOICES-AT:', 'Show choices this many seconds before the clip ends'],
    ['TIMER:', 'Countdown, then takes that scene if nobody clicks'],
    ['WAIT-LOOP:', 'Different wait audio for this scene, or none']
  ];

  var HELP_SHORTCUTS = [
    ['Ctrl+S', 'Save story.js'],
    ['Ctrl+Enter', 'Play from the start'],
    ['Ctrl+Shift+Enter', 'Play from the scene you are in'],
    ['Ctrl+F', 'Find text'],
    ['F1', 'Open or close this help'],
    ['Alt+1 / 2 / 3', 'Map / Checks / Media tab'],
    ['Esc', 'Close help or menus']
  ];

  /* ----------------------------------------------------------------------
     The page
     ---------------------------------------------------------------------- */

  var LOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" ' +
    'width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  var ICON_ERR = '<svg class="fe-check-ico" viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.1"/></svg>';
  var ICON_WARN = '<svg class="fe-check-ico" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.1"/></svg>';
  var ICON_FILM = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" ' +
    'width="17" height="15" rx="2"/><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/></svg>';
  var ICON_IMAGE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" ' +
    'width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-5-5-9 8.5"/></svg>';
  var ICON_AUDIO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5.5l11-2V16"/>' +
    '<circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>';

  var app = {
    result: null,       // last FireCut.analyse() result
    marks: {},          // line number -> 'err' | 'warn'
    curLine: -1,        // 0-based line the cursor is on
    dirty: false,
    stale: false,       // text changed since the last Update
    zoom: 1,
    fit: true,
    firstMap: true,     // the first map drawn opens at a readable size
    here: null,         // name of the scene the cursor is in
    natW: 0,
    natH: 0,
    svg: null,
    tab: 'map'
  };

  function $(id) { return document.getElementById(id); }

  function store(key, value) {
    try { window.localStorage.setItem('firecut-editor-' + key, String(value)); } catch (e) {}
  }

  function recall(key) {
    try { return window.localStorage.getItem('firecut-editor-' + key); } catch (e) { return null; }
  }

  /* ---------- toast ---------- */

  var toastTimer = null;
  function toast(text) {
    var t = $('fe-toast');
    t.textContent = text;
    t.hidden = false;
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { t.hidden = true; }, 2800);
  }

  /* ---------- code view ---------- */

  function cursorLine() {
    var ta = $('fe-text');
    var before = ta.value.substring(0, ta.selectionStart);
    return splitLines(before).length - 1;
  }

  function renderCode() {
    var lines = splitLines($('fe-text').value);
    var last = lines.length - 1;
    var hl = [], gut = [];
    for (var i = 0; i < lines.length; i++) {
      var locked = (i === 0 && lines[i].indexOf(OPEN) === 0) ||
        (i === last && lines[i].indexOf(CLOSE) >= 0);
      var mark = app.marks[i + 1];
      var cur = i === app.curLine ? ' fe-cur' : '';
      var inner = locked ? '<span class="fe-lock">' + esc(lines[i]) + '</span>' :
        highlightLine(lines[i]);
      if (mark) { inner = '<span class="fe-u-' + mark + '">' + inner + '</span>'; }
      hl.push('<span class="fe-ln' + cur + '">' + inner + '</span>');
      gut.push('<div class="fe-gl' + cur + (mark ? ' fe-mark-' + mark : '') + '">' +
        (locked && !mark ? LOCK_SVG : '') + (i + 1) + '</div>');
    }
    $('fe-hl').innerHTML = hl.join('');
    $('fe-gutter').innerHTML = gut.join('');
    syncScroll();
  }

  function syncScroll() {
    var ta = $('fe-text');
    $('fe-hl').scrollTop = ta.scrollTop;
    $('fe-hl').scrollLeft = ta.scrollLeft;
    $('fe-gutter').scrollTop = ta.scrollTop;
  }

  /* Move the current-line band and the map highlight with the cursor. */
  function onCursor() {
    var line = cursorLine();
    if (line === app.curLine) { return; }
    var hl = $('fe-hl').children, gut = $('fe-gutter').children;
    if (app.curLine >= 0 && hl[app.curLine]) {
      hl[app.curLine].className = hl[app.curLine].className.replace(' fe-cur', '');
      gut[app.curLine].className = gut[app.curLine].className.replace(' fe-cur', '');
    }
    app.curLine = line;
    if (hl[line]) { hl[line].className += ' fe-cur'; gut[line].className += ' fe-cur'; }
    $('fe-st-line').textContent = 'Line ' + (line + 1);
    highlightHere();
  }

  /* ---------- checking ---------- */

  function analyse() {
    var raw = storyPart($('fe-text').value);
    var result = null;
    if (raw !== null) {
      try { result = FireCut.analyse(raw); } catch (e) { result = null; }
    }
    $('fe-map-paused').hidden = !!result;
    $('fe-map').className = result ? 'fe-map' : 'fe-map fe-paused';
    if (!result) { return; }
    app.result = result;
    app.stale = false;
    app.marks = {};
    each(result.warnings, function (w) { if (w.line > 0) { app.marks[w.line] = 'warn'; } });
    each(result.errors, function (e) { if (e.line > 0) { app.marks[e.line] = 'err'; } });
    var title = result.model.title || 'Untitled story';
    $('fe-title').textContent = title;
    document.title = 'FireCut Editor - ' + title;
    renderCode();
    renderChecks();
    renderMap();
    renderMedia();
    renderStatus();
  }

  /* ---------- status bar and tab counts ---------- */

  function setStat(id, text, cls) {
    var el = $(id);
    el.textContent = text;
    el.className = 'fe-st' + (cls ? ' ' + cls : '');
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function renderStatus() {
    var r = app.result;
    var ne = r.errors.length, nw = r.warnings.length;
    var clean = ne === 0 && nw === 0;
    setStat('fe-st-errors', plural(ne, 'error'), ne ? 'fe-st-err' : (clean ? 'fe-st-ok' : ''));
    setStat('fe-st-warnings', plural(nw, 'warning'), nw ? 'fe-st-warn' : (clean ? 'fe-st-ok' : ''));
    setStat('fe-st-scenes', plural(r.model.scenes.length, 'scene'));
    setStat('fe-st-endings', plural(r.model.endings.length, 'ending'));
    setStat('fe-st-line', 'Line ' + (app.curLine + 1));
    setStat('fe-st-checked', app.stale ? 'Changed since the last check: press Update' : 'Checked');
    setStat('fe-st-saved', app.dirty ? 'Not saved to story.js yet' : 'No changes yet');

    var counts = '';
    if (ne) { counts += '<span class="fe-count fe-count-err">' + ne + '</span>'; }
    if (nw) { counts += '<span class="fe-count fe-count-warn">' + nw + '</span>'; }
    if (clean) { counts = '<span class="fe-count fe-count-ok">0</span>'; }
    $('fe-check-counts').innerHTML = counts;
  }

  /* ---------- Checks tab ---------- */

  function renderChecks() {
    var r = app.result, html = [];
    function group(list, title, kind, icon) {
      if (!list.length) { return; }
      html.push('<h3>' + title + ' (' + list.length + ')</h3>');
      each(list, function (item) {
        html.push('<button type="button" class="fe-check fe-check-' + kind +
          '" data-line="' + item.line + '">' + icon +
          '<span class="fe-check-line">' + (item.line ? 'Line ' + item.line : 'Story') +
          '</span><span>' + esc(messageWords(item)) + '</span></button>');
      });
    }
    group(r.errors, 'Errors', 'err', ICON_ERR);
    group(r.warnings, 'Warnings', 'warn', ICON_WARN);
    if (!html.length) {
      html.push('<div class="fe-checks-empty"><b>No problems found.</b>' +
        'Press Play to watch your story.</div>');
    }
    $('fe-checks').innerHTML = html.join('');
  }

  /* ---------- Map tab ---------- */

  function renderMap() {
    var host = $('fe-map');
    host.innerHTML = FireCut.mapSvg(app.result.model);
    var svg = host.getElementsByTagName('svg')[0];
    app.svg = svg;
    app.natW = parseFloat(svg.getAttribute('width'));
    app.natH = parseFloat(svg.getAttribute('height'));
    svg.removeAttribute('style');
    /* The player's "Play from ..." tooltips would cover the editor's own. */
    var titles = svg.querySelectorAll('.fc-map-node > title');
    for (var i = 0; i < titles.length; i++) { titles[i].parentNode.removeChild(titles[i]); }
    /* Fitting a wide story into half a laptop screen makes the text too
       small to read, so the first view never goes below READABLE. Fit
       still shows the whole map on request. */
    if (app.firstMap) {
      app.firstMap = false;
      app.fit = fitZoom() >= READABLE;
      if (!app.fit) { app.zoom = READABLE; }
    }
    applyZoom();
    app.here = null;
    highlightHere();
  }

  var READABLE = 0.6;

  function fitZoom() {
    var view = $('fe-map-view');
    var z = Math.min((view.clientWidth - 24) / app.natW, (view.clientHeight - 24) / app.natH);
    return Math.max(0.1, Math.min(z, 1.5));
  }

  function applyZoom() {
    if (!app.svg) { return; }
    if (app.fit) { app.zoom = fitZoom(); }
    app.svg.setAttribute('width', Math.round(app.natW * app.zoom));
    app.svg.setAttribute('height', Math.round(app.natH * app.zoom));
    var pct = Math.round(app.zoom * 100) + '%';
    $('fe-zoom-fit').textContent = app.fit ? 'Fit' : pct;
    $('fe-zoom-fit').title = app.fit ? 'Fitted to the pane (' + pct + ')' : 'Fit the whole map';
  }

  /* Zoom keeping the point under (cx, cy) in place. */
  function zoomTo(z, cx, cy) {
    var view = $('fe-map-view');
    if (cx === undefined) { cx = view.clientWidth / 2; cy = view.clientHeight / 2; }
    var old = app.zoom;
    z = Math.max(0.1, Math.min(z, 2.5));
    var mx = view.scrollLeft + cx, my = view.scrollTop + cy;
    app.fit = false;
    app.zoom = z;
    applyZoom();
    view.scrollLeft = mx * (z / old) - cx;
    view.scrollTop = my * (z / old) - cy;
  }

  function highlightHere() {
    if (!app.svg || !app.result) { return; }
    var olds = app.svg.querySelectorAll('.fe-here');
    for (var i = 0; i < olds.length; i++) {
      olds[i].setAttribute('class', olds[i].getAttribute('class').replace(' fe-here', ''));
    }
    var s = sceneAtLine(app.result.model, app.curLine + 1);
    if (!s) { app.here = null; return; }
    var nodes = app.svg.querySelectorAll('.fc-map-node');
    for (var j = 0; j < nodes.length; j++) {
      if (nodes[j].getAttribute('data-scene') === s.name) {
        nodes[j].setAttribute('class', nodes[j].getAttribute('class') + ' fe-here');
        /* Bring the scene into view when the cursor moves to a new one. */
        if (app.here !== s.name) { showNode(nodes[j]); }
      }
    }
    app.here = s.name;
  }

  function showNode(node) {
    var view = $('fe-map-view');
    if (view.offsetParent === null) { return; }   // Map tab not showing
    var v = view.getBoundingClientRect(), n = node.getBoundingClientRect();
    if (n.left >= v.left && n.right <= v.right && n.top >= v.top && n.bottom <= v.bottom) { return; }
    view.scrollLeft += (n.left + n.width / 2) - (v.left + v.width / 2);
    view.scrollTop += (n.top + n.height / 2) - (v.top + v.height / 2);
  }

  function nodeFrom(target) {
    while (target && target !== document) {
      if (target.getAttribute && /\bfc-map-node\b/.test(target.getAttribute('class') || '')) {
        return target;
      }
      target = target.parentNode;
    }
    return null;
  }

  function showTip(node, e) {
    var tip = $('fe-tip');
    var s = app.result && app.result.model.sceneMap[node.getAttribute('data-scene')];
    if (!s) { tip.hidden = true; return; }
    var rows = sceneSummary(s), html = '<b>' + esc(s.name) + '</b> <span class="fe-tip-line">(line ' +
      s.line + ')</span>';
    each(rows, function (r) { html += '<br>' + esc(r); });
    tip.innerHTML = html;
    tip.hidden = false;
    var panel = $('fe-panel-map').getBoundingClientRect();
    var x = e.clientX - panel.left + 14, y = e.clientY - panel.top + 16;
    if (x + tip.offsetWidth > panel.width - 8) { x = e.clientX - panel.left - tip.offsetWidth - 14; }
    if (y + tip.offsetHeight > panel.height - 8) { y = e.clientY - panel.top - tip.offsetHeight - 12; }
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }

  function bindMap() {
    var view = $('fe-map-view');
    var drag = null, dragged = false;

    view.addEventListener('mousedown', function (e) {
      if (e.button !== 0) { return; }
      drag = { x: e.clientX, y: e.clientY, sl: view.scrollLeft, st: view.scrollTop };
      dragged = false;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!drag) { return; }
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!dragged && Math.abs(dx) + Math.abs(dy) > 4) {
        dragged = true;
        view.className = 'fe-map-view fe-panning';
        $('fe-tip').hidden = true;
      }
      if (dragged) {
        view.scrollLeft = drag.sl - dx;
        view.scrollTop = drag.st - dy;
      }
    });
    document.addEventListener('mouseup', function () {
      if (drag) { view.className = 'fe-map-view'; }
      drag = null;
    });

    view.addEventListener('click', function (e) {
      if (dragged) { dragged = false; return; }
      var node = nodeFrom(e.target);
      if (node) {
        toast('Coming in a later phase: jumping to the "' +
          node.getAttribute('data-scene') + '" scene in your story.');
      }
    });
    view.addEventListener('contextmenu', function (e) {
      var node = nodeFrom(e.target);
      if (!node) { return; }
      e.preventDefault();
      toast('Play from here is coming soon.');
    });
    view.addEventListener('mousemove', function (e) {
      if (drag && dragged) { return; }
      var node = nodeFrom(e.target);
      if (node) { showTip(node, e); } else { $('fe-tip').hidden = true; }
    });
    view.addEventListener('mouseleave', function () { $('fe-tip').hidden = true; });
    view.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) { return; }
      e.preventDefault();
      var r = view.getBoundingClientRect();
      zoomTo(app.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    $('fe-zoom-in').onclick = function () { zoomTo(app.zoom * 1.25); };
    $('fe-zoom-out').onclick = function () { zoomTo(app.zoom / 1.25); };
    $('fe-zoom-fit').onclick = function () { app.fit = true; applyZoom(); };
  }

  /* ---------- Media tab (sample list in Phase 1) ---------- */

  function renderMedia() {
    var model = app.result.model;
    var use = mediaUsage(model);
    var html = [], missing = [];
    $('fe-media-summary').textContent = 'media (' + SAMPLE_MEDIA.length +
      ' files). Click a file to add it at the cursor.';

    for (var f in use) {
      if (use.hasOwnProperty(f) && idxOf(SAMPLE_MEDIA, f) < 0) { missing.push(f); }
    }
    if (missing.length) {
      var links = [];
      each(missing, function (m) {
        links.push('<b>' + esc(m) + '</b> (line ' + use[m][0].line + ')');
      });
      html.push('<div class="fe-banner fe-banner-err">' + ICON_ERR +
        '<span>Your story names files that are not in this folder: ' +
        links.join(', ') + '. Check the spelling.</span></div>');
    } else {
      html.push('<div class="fe-banner fe-banner-ok"><svg class="fe-check-ico" viewBox="0 0 24 24" ' +
        'aria-hidden="true" style="stroke:#4ade80"><circle cx="12" cy="12" r="9"/>' +
        '<path d="m8 12.2 2.8 2.8L16 9.5"/></svg>Every file your story names is in this folder.</div>');
    }

    var groups = [['video', 'Videos', ICON_FILM], ['image', 'Images', ICON_IMAGE],
      ['audio', 'Audio', ICON_AUDIO]];
    each(groups, function (g) {
      var files = [];
      each(SAMPLE_MEDIA, function (f) { if (FireCut.mediaKind(f) === g[0]) { files.push(f); } });
      if (!files.length) { return; }
      html.push('<div class="fe-media-group"><h3>' + g[1] + ' (' + files.length + ')</h3>' +
        '<div class="fe-media-grid">');
      each(files, function (f) {
        var where = [];
        if (use.hasOwnProperty(f)) { each(use[f], function (u) { where.push(u.where); }); }
        html.push('<button type="button" class="fe-file-card" data-file="' + esc(f) + '">' +
          '<span class="fe-thumb">' + g[2] + '</span><span class="fe-file-name">' + esc(f) +
          '</span><span class="fe-file-use ' + (where.length ? 'fe-used">Used in ' +
          esc(where.join(', ')) : 'fe-unused">Not used yet') + '</span></button>');
      });
      html.push('</div></div>');
    });
    $('fe-media').innerHTML = html.join('');
  }

  /* ---------- Help panel ---------- */

  function renderHelp() {
    var html = [];
    function rows(list) {
      each(list, function (k) {
        html.push('<div class="fe-kw"><code>' + esc(k[0]) + '</code><span>' + esc(k[1]) +
          '</span><button type="button" class="fe-btn" data-soon="Coming in a later phase: ' +
          'inserting keywords.">Insert</button></div>');
      });
    }
    html.push('<h3>At the top, before any scene</h3>');
    rows(HELP_STORY_KEYS);
    html.push('<h3>Inside each scene</h3>');
    rows(HELP_SCENE_KEYS);
    html.push('<h3>What every scene needs</h3><table class="fe-needs"><tr><th>One thing on ' +
      'screen</th><th>One way out</th></tr><tr><td><code>VIDEO:</code></td><td><code>CHOICE:' +
      '</code> (up to 4)</td></tr><tr><td><code>IMAGE:</code></td><td><code>NEXT:</code></td>' +
      '</tr><tr><td><code>TEXT:</code></td><td><code>ENDING:</code></td></tr></table>');
    html.push('<h3>Keyboard shortcuts</h3><table class="fe-keys">');
    each(HELP_SHORTCUTS, function (k) {
      html.push('<tr><td><kbd>' + esc(k[0]) + '</kbd></td><td>' + esc(k[1]) + '</td></tr>');
    });
    html.push('</table>');
    $('fe-help-body').innerHTML = html.join('');
  }

  function setHelp(open) {
    $('fe-help-panel').hidden = !open;
    $('fe-help').setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /* ---------- tabs, menu, divider, text size ---------- */

  function selectTab(name) {
    app.tab = name;
    each(['map', 'checks', 'media'], function (t) {
      $('fe-tab-' + t).setAttribute('aria-selected', t === name ? 'true' : 'false');
      $('fe-panel-' + t).hidden = t !== name;
    });
    setHelp(false);
    if (name === 'map') { applyZoom(); }
  }

  function setMenu(open) {
    $('fe-insert-menu').hidden = !open;
    $('fe-insert').setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function isNarrow() {
    return window.matchMedia && window.matchMedia('(max-width: 999px)').matches;
  }

  function applySplit() {
    var key = isNarrow() ? 'split-narrow' : 'split';
    var pct = parseFloat(recall(key));
    if (!(pct >= 20 && pct <= 80)) { pct = isNarrow() ? 48 : 50; }
    $('fe-left').style.flexBasis = pct + '%';
    applyZoom();
  }

  function bindDivider() {
    var div = $('fe-divider'), dragging = false;
    function move(clientX, clientY) {
      var r = $('fe-main').getBoundingClientRect();
      var pct = isNarrow() ? (clientY - r.top) / r.height * 100 : (clientX - r.left) / r.width * 100;
      pct = Math.max(20, Math.min(80, pct));
      $('fe-left').style.flexBasis = pct + '%';
      store(isNarrow() ? 'split-narrow' : 'split', pct.toFixed(1));
      applyZoom();
    }
    div.addEventListener('mousedown', function (e) {
      dragging = true;
      document.body.className += ' fe-dragging';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) { if (dragging) { move(e.clientX, e.clientY); } });
    document.addEventListener('mouseup', function () {
      if (!dragging) { return; }
      dragging = false;
      document.body.className = document.body.className.replace(' fe-dragging', '');
    });
    div.addEventListener('keydown', function (e) {
      var step = { ArrowLeft: -2, ArrowUp: -2, ArrowRight: 2, ArrowDown: 2 }[e.key];
      if (!step) { return; }
      e.preventDefault();
      var r = $('fe-main').getBoundingClientRect(), l = $('fe-left').getBoundingClientRect();
      var pct = isNarrow() ? l.height / r.height * 100 : l.width / r.width * 100;
      move(r.left + (pct + step) / 100 * r.width, r.top + (pct + step) / 100 * r.height);
    });
  }

  var FONT_MIN = 12, FONT_MAX = 22;
  function setFont(px) {
    px = Math.max(FONT_MIN, Math.min(FONT_MAX, px));
    app.font = px;
    var code = $('fe-code');
    code.style.setProperty('--fe-fs', px + 'px');
    code.style.setProperty('--fe-lh', Math.round(px * 1.47) + 'px');
    store('font', px);
    syncScroll();
  }

  /* ---------- start ---------- */

  function loadStory() {
    var raw = FireCut._rawStory ? FireCut._rawStory() : null;
    var note = $('fe-file-note');
    if (raw === null) {
      var bad = FireCut._storyJsError ? FireCut._storyJsError() : null;
      note.textContent = bad ? 'story.js has a mistake that stops it loading' +
        (bad.line ? ' (line ' + bad.line + ')' : '') + '. Showing an empty story.' :
        'story.js was not found in this folder. Showing an empty story.';
      note.className = 'fe-file-note fe-bad';
      raw = '\n\n';
    } else {
      note.textContent = 'opened from this folder';
    }
    $('fe-text').value = buildFileText(raw);
  }

  function start() {
    if (typeof document === 'undefined' || !window.FireCut) { return; }
    var ta = $('fe-text');

    loadStory();
    renderHelp();
    setFont(parseInt(recall('font'), 10) || 15);
    applySplit();
    app.curLine = 0;
    analyse();
    /* Caret at the top first, so focusing does not scroll to the end. */
    ta.setSelectionRange(0, 0);
    ta.focus();
    ta.scrollTop = 0;
    syncScroll();
    onCursor();

    ta.addEventListener('input', function () {
      app.dirty = true;
      app.stale = true;
      $('fe-dirty').hidden = false;
      renderCode();
      onCursor();
      if (app.result) { renderStatus(); }
    });
    ta.addEventListener('scroll', syncScroll);
    each(['keyup', 'click', 'select', 'focus'], function (ev) { ta.addEventListener(ev, onCursor); });
    document.addEventListener('selectionchange', function () {
      if (document.activeElement === ta) { onCursor(); }
    });

    $('fe-refresh').onclick = analyse;
    $('fe-font-down').onclick = function () { setFont(app.font - 1); };
    $('fe-font-up').onclick = function () { setFont(app.font + 1); };
    $('fe-help').onclick = function () { setHelp($('fe-help-panel').hidden); };
    $('fe-help-close').onclick = function () { setHelp(false); };
    $('fe-insert').onclick = function (e) {
      e.stopPropagation();
      setMenu($('fe-insert-menu').hidden);
    };
    each(['map', 'checks', 'media'], function (t) {
      $('fe-tab-' + t).onclick = function () { selectTab(t); };
    });

    /* Anything not built yet says which phase brings it. */
    document.addEventListener('click', function (e) {
      var el = e.target;
      while (el && el !== document && !(el.getAttribute && el.getAttribute('data-soon'))) {
        el = el.parentNode;
      }
      if (el && el !== document) {
        toast(el.getAttribute('data-soon'));
        setMenu(false);
        return;
      }
      if (!$('fe-insert-menu').hidden && !$('fe-insert-menu').contains(e.target)) { setMenu(false); }
      var check = e.target;
      while (check && check !== document && !/\bfe-check\b/.test(check.className || '')) {
        check = check.parentNode;
      }
      if (check && check !== document) {
        toast('Coming in a later phase: jumping to line ' + check.getAttribute('data-line') + '.');
      }
      var card = e.target;
      while (card && card !== document && !/\bfe-file-card\b/.test(card.className || '')) {
        card = card.parentNode;
      }
      if (card && card !== document) {
        toast('Coming in a later phase: adding ' + card.getAttribute('data-file') + ' at the cursor.');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.altKey && !e.ctrlKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault();
        selectTab(['map', 'checks', 'media'][parseInt(e.key, 10) - 1]);
      } else if (e.key === 'F1') {
        e.preventDefault();
        setHelp($('fe-help-panel').hidden);
      } else if (e.key === 'Escape') {
        setMenu(false);
        setHelp(false);
      } else if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        toast('Coming in a later phase: saving story.js.');
      } else if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        toast('Play is coming soon.');
      }
    });

    bindMap();
    bindDivider();
    window.addEventListener('resize', applySplit);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }

  return {
    splitLines: splitLines,
    buildFileText: buildFileText,
    storyPart: storyPart,
    messageWords: messageWords,
    sceneAtLine: sceneAtLine,
    mediaUsage: mediaUsage,
    sceneSummary: sceneSummary,
    highlightLine: highlightLine
  };
})();
