/* ==========================================================================
   FireCut Story Editor (EDITOR.html)
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

  /* Start and end character offsets for a 1-based line number. */
  function lineBounds(text, lineNum) {
    var cur = 1, start = 0, i;
    if (!lineNum || lineNum < 1) { lineNum = 1; }
    for (i = 0; i < text.length; i++) {
      if (cur === lineNum) { break; }
      var ch = text.charAt(i);
      if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text.charAt(i + 1) === '\n') { i++; }
        cur++;
        start = i + 1;
      }
    }
    var end = start;
    while (end < text.length && text.charAt(end) !== '\n' && text.charAt(end) !== '\r') {
      end++;
    }
    return { start: start, end: end };
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var OPEN = 'FireCut.story(`';
  var CLOSE = '`);';

  /* The whole story.js file, so editor line numbers match PLAY.html. */
  function buildFileText(raw) {
    var s = String(raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (s.charAt(0) !== '\n') { s = '\n' + s; }
    if (s.charAt(s.length - 1) !== '\n') { s = s + '\n'; }
    return OPEN + s + CLOSE;
  }

  /* The story text between the backticks, or null if they are missing. */
  function storyPart(fileText) {
    var a = fileText.indexOf('`'), b = fileText.lastIndexOf('`');
    if (a < 0 || b <= a) { return null; }
    var mid = fileText.substring(a + 1, b);
    if (mid.indexOf('`') >= 0) { return null; }
    return mid;
  }

  /* Whether the wrapper lines are intact and no backtick is inside. */
  function hasValidWrapper(fileText) {
    var openLine = OPEN + '\n';
    var closeLine = '\n' + CLOSE;
    if (fileText.indexOf(openLine) !== 0) { return false; }
    if (fileText.length < openLine.length + closeLine.length) { return false; }
    if (fileText.lastIndexOf(closeLine) !== fileText.length - closeLine.length) { return false; }
    var inner = fileText.substring(openLine.length, fileText.length - closeLine.length);
    return inner.indexOf('`') < 0;
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

  function formatTime(d) {
    var h = d.getHours(), m = d.getMinutes();
    var ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12;
    if (h === 0) { h = 12; }
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function validFileName(name) {
    return /^[a-z0-9_\-\.]+$/.test(name);
  }

  /* Next available scene name: new-scene, new-scene-2, new-scene-3, ... */
  function uniqueSceneName(model, base) {
    var root = base || 'new-scene';
    var map = (model && model.sceneMap) ? model.sceneMap : {};
    if (!map.hasOwnProperty(root)) { return root; }
    var n = 2;
    while (map.hasOwnProperty(root + '-' + n)) { n++; }
    return root + '-' + n;
  }

  /* Compare the story's media references against a list of folder file names. */
  function analyseMediaFolder(model, fileNames) {
    var use = mediaUsage(model);
    var missing = [], badNames = [];
    for (var f in use) {
      if (use.hasOwnProperty(f) && idxOf(fileNames, f) < 0) {
        missing.push({ file: f, line: use[f][0].line });
      }
    }
    each(fileNames, function (name) {
      if (!validFileName(name)) { badNames.push(name); }
    });
    return { use: use, missing: missing, badNames: badNames };
  }

  /* Ready-made blocks for the Insert menu (matching STORY.md). */
  function buildPatternBlock(kind, sceneName) {
    var s = sceneName || 'new-scene';
    if (kind === 'video-choices') {
      return {
        isScene: true,
        select: s,
        text: 'SCENE: ' + s + '\nVIDEO: clip.mp4\nCHOICE: First choice -> scene-name\nCHOICE: Second choice -> scene-name'
      };
    }
    if (kind === 'buttons-during') {
      return {
        isScene: true,
        select: s,
        text: 'SCENE: ' + s + '\nVIDEO: clip.mp4\nCHOICES-AT: 4\nCHOICE: First choice -> scene-name\nCHOICE: Second choice -> scene-name'
      };
    }
    if (kind === 'timer') {
      return {
        isScene: true,
        select: s,
        text: 'SCENE: ' + s + '\nVIDEO: clip.mp4\nTIMER: 6 -> scene-name\nCHOICE: First choice -> scene-name\nCHOICE: Second choice -> scene-name'
      };
    }
    if (kind === 'image-music') {
      return {
        isScene: true,
        select: s,
        text: 'SCENE: ' + s + '\nIMAGE: picture.jpg\nTEXT: Caption words here.\nMUSIC: music.mp3\nDURATION: 5\nCHOICE: Continue -> scene-name'
      };
    }
    if (kind === 'auto-continue') {
      return {
        isScene: true,
        select: s,
        text: 'SCENE: ' + s + '\nVIDEO: clip.mp4\nNEXT: scene-name'
      };
    }
    if (kind === 'ending-card') {
      return {
        isScene: true,
        select: s,
        text: 'SCENE: ' + s + '\nTEXT: Final words on screen.\nENDING: The end!'
      };
    }
    if (kind === 'single-choice') {
      return {
        isScene: false,
        select: 'Button label',
        text: 'CHOICE: Button label -> scene-name'
      };
    }
    return null;
  }

  /* If lineText has a scene-target slot (START:, NEXT:, or after -> on
     CHOICE: / TIMER:) and colOffset is in that slot, return its bounds. */
  function targetSpanAt(lineText, colOffset) {
    if (/^\s*#/.test(lineText)) { return null; }
    var m = /^(\s*)([A-Za-z][A-Za-z\-]*)(\s*:)(.*)$/.exec(lineText);
    if (!m) { return null; }
    var key = m[2].toUpperCase();
    var afterColon = m[1].length + m[2].length + m[3].length;
    var slotStart, slotEnd, triggerStart;

    if (key === 'START' || key === 'NEXT') {
      triggerStart = afterColon;
      slotStart = afterColon;
      slotEnd = lineText.length;
    } else if (key === 'CHOICE' || key === 'TIMER') {
      var arrow = lineText.indexOf('->', afterColon);
      if (arrow < 0) { return null; }
      triggerStart = arrow;
      slotStart = arrow + 2;
      slotEnd = lineText.length;
      if (key === 'CHOICE') {
        var bar = lineText.indexOf('|', slotStart);
        if (bar >= 0) { slotEnd = bar; }
      }
    } else {
      return null;
    }

    if (colOffset < triggerStart || colOffset > slotEnd) { return null; }

    var raw = lineText.substring(slotStart, slotEnd);
    var lead = /^(\s*)/.exec(raw)[1].length;
    var trail = /(\s*)$/.exec(raw)[1].length;
    var tokStart = slotStart + lead;
    var tokEnd = Math.max(tokStart, slotEnd - trail);
    return {
      key: key,
      slotStart: slotStart,
      start: tokStart,
      end: tokEnd,
      needsSpace: lead === 0,
      value: lineText.substring(tokStart, tokEnd)
    };
  }

  function sceneTag(scene, model) {
    var parts = [];
    if (model && model.start === scene.name) { parts.push('start'); }
    if (scene.video) { parts.push('video'); }
    else if (scene.image) { parts.push('image'); }
    else if (scene.text) { parts.push('text'); }
    if (scene.ending) { parts.push('ending'); }
    return parts.join(' \u00b7 ');
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
     Starter template & reference data
     ---------------------------------------------------------------------- */

  /* Beginner Golden Egg story used when story.js is missing or broken,
     and for "New story" in Phase 3. */
  var BEGINNER_RAW = '\n' +
    '# Your story lives between these two lines. Never delete them,\n' +
    '# and never type a backtick inside your story.\n' +
    '# Full guide: STORY.md in this folder.\n\n' +
    'TITLE: My Story\n' +
    'START: intro\n\n' +
    '# Change the title above to your story\'s name.\n' +
    '# Optional extras you can add here:\n' +
    '#   TITLE-BACKGROUND: poster.jpg   (image or looping video behind the title screen)\n' +
    '#   TITLE-OVERLAY: logo.png        (see-through PNG over the background)\n' +
    '#   TITLE-MUSIC: theme.mp3         (music on the title screen)\n' +
    '#   WAIT-LOOP: ambient.mp3         (audio while choices are shown)\n\n' +
    '# This starter works with no media files. When your clips are ready,\n' +
    '# drop them in media/ and swap the TEXT lines for VIDEO lines like:\n' +
    '#   VIDEO: movie1.mp4\n\n' +
    'SCENE: intro\n' +
    'TEXT: A mysterious egg sits on the table in front of you.\n' +
    'CHOICE: Talk to it -> hello\n' +
    'CHOICE: Walk away -> walk-away\n\n' +
    'SCENE: hello\n' +
    'TEXT: The egg seems to shimmer in the light. It might be listening.\n' +
    'CHOICE: Compliment it -> compliment\n' +
    'CHOICE: Leave quietly -> walk-away\n\n' +
    'SCENE: compliment\n' +
    'TEXT: The egg glows a little brighter. It is blushing.\n' +
    'ENDING: Sweet ending! You made a golden friend.\n\n' +
    'SCENE: walk-away\n' +
    'TEXT: You leave the egg behind. It watches you go.\n' +
    'ENDING: A quiet ending! Some mysteries stay unsolved.\n\n';

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

  var MSG_BACKTICK = 'Backticks can\'t go inside your story. They would stop it from being read.';
  var MSG_LOCKED = 'The first and last lines wrap your story for PLAY.html and cannot be changed.';
  var MSG_DOWNLOAD_TIP = 'Your browser saved story.js to Downloads. Move it into your story folder, replacing the old one.';

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
    result: null,         // last FireCut.analyse() result
    marks: {},            // line number -> 'err' | 'warn'
    curLine: -1,          // 0-based line the cursor is on
    diskText: '',         // original story.js text from the folder
    lastValidText: '',    // last valid full-file buffer
    dirty: false,
    everSaved: false,
    draftTime: null,      // e.g. '10:42 am'
    analyseTimer: null,
    draftTimer: null,
    fileHandle: null,     // remembered showSaveFilePicker handle
    shownDownloadTip: false,
    mediaFiles: SAMPLE_MEDIA.slice(),
    mediaUrls: {},        // fileName -> object URL for previews
    mediaFolderName: 'media',
    mediaFolderChosen: false,
    zoom: 1,
    fit: true,
    firstMap: true,       // the first map drawn opens at a readable size
    here: null,           // name of the scene the cursor is in
    natW: 0,
    natH: 0,
    svg: null,
    tab: 'map',
    previewStop: null,
    previewScene: null,
    dismissedPickLine: -1,
    dismissedPickVal: null
  };

  function $(id) { return document.getElementById(id); }

  function store(key, value) {
    try { window.localStorage.setItem('firecut-editor-' + key, String(value)); } catch (e) {}
  }

  function recall(key) {
    try { return window.localStorage.getItem('firecut-editor-' + key); } catch (e) { return null; }
  }

  function removeStore(key) {
    try { window.localStorage.removeItem('firecut-editor-' + key); } catch (e) {}
  }

  /* ---------- toast ---------- */

  var toastTimer = null;
  function toast(text, ms) {
    var t = $('fe-toast');
    t.textContent = text;
    t.hidden = false;
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3200);
  }

  /* ---------- code view & editor guards ---------- */

  function editableMin() {
    return OPEN.length + 1;
  }

  function editableMax(text) {
    return Math.max(editableMin(), text.length - CLOSE.length - 1);
  }

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
    updateScenePicker();
  }

  /* Move the current-line band and the map highlight with the cursor. */
  function onCursor() {
    var line = cursorLine();
    updateScenePicker();
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

  /* ---------- inline scene target picker ---------- */

  function hideScenePicker() {
    var pick = $('fe-scene-pick');
    if (pick) { pick.hidden = true; }
  }

  function updateScenePicker() {
    var pick = $('fe-scene-pick');
    var ta = $('fe-text');
    if (!pick || !ta || document.activeElement !== ta || !app.result) {
      hideScenePicker();
      return;
    }
    var lineIdx = cursorLine();
    var lineNum = lineIdx + 1;
    var b = lineBounds(ta.value, lineNum);
    var lineText = ta.value.substring(b.start, b.end);
    var colOffset = ta.selectionStart - b.start;
    var span = targetSpanAt(lineText, colOffset);
    if (!span) {
      app.dismissedPickLine = -1;
      app.dismissedPickVal = null;
      hideScenePicker();
      return;
    }
    if (app.dismissedPickLine === lineNum && app.dismissedPickVal === span.value) {
      hideScenePicker();
      return;
    }

    var model = app.result.model;
    var val = span.value;
    var canCreateTyped = /^[a-z0-9\-]+$/.test(val) && val !== 'scene-name' &&
      !model.sceneMap.hasOwnProperty(val);
    var html = ['<div class="fe-sp-head"><span>Link to scene</span><span>Click to pick</span></div>'];

    if (canCreateTyped) {
      html.push('<button type="button" class="fe-sp-item fe-sp-new" data-sp-create="' +
        esc(val) + '"><span class="fe-sp-name">+ Create scene "' + esc(val) +
        '"</span><span class="fe-sp-meta">new</span></button>');
      if (model.scenes.length) { html.push('<div class="fe-sp-sep"></div>'); }
    }

    if (model.scenes.length) {
      html.push('<div class="fe-sp-list">');
      each(model.scenes, function (s) {
        var active = s.name === val ? ' fe-sp-active' : '';
        html.push('<button type="button" class="fe-sp-item' + active +
          '" data-sp-scene="' + esc(s.name) + '"><span class="fe-sp-name">' +
          esc(s.name) + '</span><span class="fe-sp-meta">' +
          esc(sceneTag(s, model)) + '</span></button>');
      });
      html.push('</div>');
    }

    if (!canCreateTyped) {
      var nextNew = uniqueSceneName(model, 'new-scene');
      if (model.scenes.length) { html.push('<div class="fe-sp-sep"></div>'); }
      html.push('<button type="button" class="fe-sp-item fe-sp-new" data-sp-create="' +
        esc(nextNew) + '"><span class="fe-sp-name">+ New scene (' + esc(nextNew) +
        ')</span><span class="fe-sp-meta">add below</span></button>');
    }

    pick.innerHTML = html.join('');
    pick.hidden = false;

    var editEl = $('fe-edit');
    var lh = app.font ? Math.round(app.font * 1.47) : 22;
    var lineTop = 10 + lineIdx * lh - ta.scrollTop;
    if (lineTop + lh < 0 || lineTop > editEl.clientHeight - 10) {
      pick.hidden = true;
      return;
    }
    var top = lineTop + lh + 4;
    if (top + pick.offsetHeight > editEl.clientHeight - 8) {
      top = Math.max(4, lineTop - pick.offsetHeight - 4);
    }
    var left = 4 + Math.round(span.start * (app.font || 15) * 0.6) - ta.scrollLeft;
    var hlChildren = $('fe-hl').children;
    var tEl = hlChildren[lineIdx] ? hlChildren[lineIdx].querySelector('.fe-t') : null;
    if (tEl && editEl.getBoundingClientRect) {
      var er = editEl.getBoundingClientRect(), tr = tEl.getBoundingClientRect();
      if (tr.width > 0 || tr.left > 0) { left = tr.left - er.left; }
    }
    var maxLeft = Math.max(8, editEl.clientWidth - pick.offsetWidth - 12);
    pick.style.top = Math.round(top) + 'px';
    pick.style.left = Math.round(Math.max(8, Math.min(maxLeft, left))) + 'px';
  }

  function pickSceneTarget(targetName) {
    var ta = $('fe-text');
    var lineIdx = cursorLine();
    var lineNum = lineIdx + 1;
    var b = lineBounds(ta.value, lineNum);
    var lineText = ta.value.substring(b.start, b.end);
    var span = targetSpanAt(lineText, ta.selectionStart - b.start);
    if (!span) { hideScenePicker(); return; }
    var insertStr = (span.needsSpace ? ' ' : '') + targetName;
    var repStart = b.start + span.start;
    var repEnd = b.start + span.end;
    var caret = repStart + insertStr.length;
    app.dismissedPickLine = lineNum;
    app.dismissedPickVal = targetName;
    hideScenePicker();
    replaceRange(repStart, repEnd, insertStr, caret, caret);
  }

  function createSceneFromTarget(newSceneName) {
    var ta = $('fe-text');
    var lines = splitLines(ta.value);
    var maxLine = lines.length - 1;
    var lineIdx = cursorLine();
    var lineNum = Math.max(2, Math.min(maxLine, lineIdx + 1));
    var b = lineBounds(ta.value, lineNum);
    var lineText = ta.value.substring(b.start, b.end);
    var span = targetSpanAt(lineText, ta.selectionStart - b.start);
    if (!span) { hideScenePicker(); return; }

    var model = app.result ? app.result.model : null;
    var insertAfterLine = lineNum;
    if (model && model.scenes.length > 0) {
      var curScene = sceneAtLine(model, lineNum);
      if (curScene) {
        var nextSceneLine = maxLine + 1;
        for (var i = 0; i < model.scenes.length; i++) {
          if (model.scenes[i].line > curScene.line) {
            nextSceneLine = model.scenes[i].line;
            break;
          }
        }
        var sceneEndLine = lastContentLineBefore(lines, curScene.line, nextSceneLine);
        if (lineNum <= sceneEndLine) { insertAfterLine = sceneEndLine; }
      } else {
        var firstSceneLine = model.scenes[0].line;
        var headerEndLine = lastContentLineBefore(lines, 2, firstSceneLine);
        if (lineNum <= headerEndLine) { insertAfterLine = headerEndLine; }
      }
    }

    var endB = lineBounds(ta.value, insertAfterLine);
    var lineTrim = lines[insertAfterLine - 1].replace(/^\s+|\s+$/g, '');
    var insertPos = lineTrim === '' ? endB.start : endB.end;
    var prevBlank = insertAfterLine > 2 && lines[insertAfterLine - 2].replace(/^\s+|\s+$/g, '') === '';
    var nextBlank = insertAfterLine < maxLine && lines[insertAfterLine].replace(/^\s+|\s+$/g, '') === '';
    var lead = lineTrim === '' ? (prevBlank ? '' : '\n') : '\n\n';
    var trail = (lineTrim === '' && nextBlank) ? '' : (nextBlank ? '' : '\n');

    var placeholder = 'What happens in this scene.';
    var blockText = 'SCENE: ' + newSceneName + '\nTEXT: ' + placeholder + '\nENDING: The end!';

    var repStart = b.start + span.start;
    var repEnd = b.start + span.end;
    var targetStr = (span.needsSpace ? ' ' : '') + newSceneName;
    var between = ta.value.substring(repEnd, insertPos);
    var combined = targetStr + between + lead + blockText + trail;
    var subIdx = blockText.indexOf(placeholder);
    var selStart = repStart + targetStr.length + between.length + lead.length + subIdx;
    var selEnd = selStart + placeholder.length;

    hideScenePicker();
    replaceRange(repStart, endB.end, combined, selStart, selEnd);
    toast('Created SCENE: ' + newSceneName + '.');
  }

  /* Replace [start, end] in the editor while keeping Undo / Redo intact,
     then select [selStart, selEnd] so placeholders can be typed over. */
  function replaceRange(start, end, text, selStart, selEnd) {
    var ta = $('fe-text');
    var min = editableMin(), max = editableMax(ta.value);
    start = Math.max(min, Math.min(max, start));
    end = Math.max(start, Math.min(max, end));
    ta.focus();
    ta.setSelectionRange(start, end);
    var ok = false;
    try {
      ok = document.execCommand && document.execCommand('insertText', false, text);
    } catch (err) { ok = false; }
    if (!ok) {
      var v = ta.value;
      ta.value = v.substring(0, start) + text + v.substring(end);
      onTextChanged();
    }
    var s = selStart !== undefined ? selStart : start + text.length;
    var e = selEnd !== undefined ? selEnd : s;
    ta.setSelectionRange(s, e);
    if (app.analyseTimer) {
      clearTimeout(app.analyseTimer);
      app.analyseTimer = null;
    }
    analyse();
    var line = splitLines(ta.value.substring(0, s)).length;
    var lh = (app.font ? Math.round(app.font * 1.47) : 22);
    var top = (line - 1) * lh, bot = top + lh;
    if (top < ta.scrollTop || bot > ta.scrollTop + ta.clientHeight - 20) {
      ta.scrollTop = Math.max(0, top - (ta.clientHeight / 3));
    }
    syncScroll();
    app.curLine = -1;
    onCursor();
  }

  /* Insert text at the cursor while keeping browser Undo / Redo working. */
  function insertAtCursor(text) {
    var ta = $('fe-text');
    replaceRange(ta.selectionStart, ta.selectionEnd, text);
  }

  /* Insert a single keyword line at or below the current line and select its placeholder. */
  function insertLineWithSelect(lineText, selectSubstr) {
    var ta = $('fe-text');
    var lines = splitLines(ta.value);
    var cur = Math.max(2, Math.min(lines.length - 1, cursorLine() + 1));
    var b = lineBounds(ta.value, cur);
    var curStr = ta.value.substring(b.start, b.end);
    var isBlank = curStr.replace(/\s+/g, '') === '';
    var prefix = isBlank ? '' : '\n';
    var pos = isBlank ? b.start : b.end;
    var endPos = b.end;
    var full = prefix + lineText;
    var subIdx = selectSubstr ? lineText.indexOf(selectSubstr) : -1;
    var selStart = subIdx >= 0 ? pos + prefix.length + subIdx : pos + full.length;
    var selEnd = subIdx >= 0 ? selStart + selectSubstr.length : selStart;
    replaceRange(pos, endPos, full, selStart, selEnd);
  }

  /* Find the last non-blank, non-comment line of a scene (or header) before nextLine. */
  function lastContentLineBefore(lines, startLine, beforeLine) {
    var last = startLine;
    for (var i = beforeLine - 1; i >= startLine; i--) {
      var t = lines[i - 1].replace(/^\s+|\s+$/g, '');
      if (t !== '' && t.charAt(0) !== '#') {
        last = i;
        break;
      }
    }
    return last;
  }

  /* Insert a pattern from the Insert menu, or replace with the starter story. */
  function insertPattern(kind) {
    var ta = $('fe-text');
    if (kind === 'new-story') {
      if (!window.confirm('Replace the current story with the beginner Golden Egg template?')) {
        return;
      }
      var body = BEGINNER_RAW.replace(/^\n/, '').replace(/\n$/, '');
      var min = editableMin(), max = editableMax(ta.value);
      replaceRange(min, max, body, min, min);
      ta.scrollTop = 0;
      syncScroll();
      toast('Started a new story from the beginner template.');
      return;
    }
    var model = app.result ? app.result.model : null;
    var sName = uniqueSceneName(model, 'new-scene');
    var block = buildPatternBlock(kind, sName);
    if (!block) { return; }

    if (!block.isScene) {
      insertLineWithSelect(block.text, block.select);
      return;
    }

    var lines = splitLines(ta.value);
    var maxLine = lines.length - 1;
    var cur = Math.max(2, Math.min(maxLine, cursorLine() + 1));
    var curTrim = lines[cur - 1].replace(/^\s+|\s+$/g, '');

    /* Find the end of the scene the cursor is inside so we never split a scene in half. */
    var insertAfterLine = cur;
    if (model && model.scenes.length > 0) {
      var curScene = sceneAtLine(model, cur);
      if (curScene) {
        var nextSceneLine = maxLine + 1;
        for (var i = 0; i < model.scenes.length; i++) {
          if (model.scenes[i].line > curScene.line) {
            nextSceneLine = model.scenes[i].line;
            break;
          }
        }
        var sceneEndLine = lastContentLineBefore(lines, curScene.line, nextSceneLine);
        if (cur <= sceneEndLine) {
          insertAfterLine = sceneEndLine;
        }
      } else {
        /* Cursor is in the header above the first scene. */
        var firstSceneLine = model.scenes[0].line;
        var headerEndLine = lastContentLineBefore(lines, 2, firstSceneLine);
        if (cur <= headerEndLine) {
          insertAfterLine = headerEndLine;
        }
      }
    }

    var b = lineBounds(ta.value, insertAfterLine);
    var lineTrim = lines[insertAfterLine - 1].replace(/^\s+|\s+$/g, '');
    var pos = lineTrim === '' ? b.start : b.end;
    var prevBlank = insertAfterLine > 2 && lines[insertAfterLine - 2].replace(/^\s+|\s+$/g, '') === '';
    var nextBlank = insertAfterLine < maxLine && lines[insertAfterLine].replace(/^\s+|\s+$/g, '') === '';
    var lead = lineTrim === '' ? (prevBlank ? '' : '\n') : '\n\n';
    var trail = (lineTrim === '' && nextBlank) ? '' : (nextBlank ? '' : '\n');
    var full = lead + block.text + trail;
    var subIdx = block.text.indexOf(block.select);
    var selStart = pos + lead.length + (subIdx >= 0 ? subIdx : 0);
    var selEnd = selStart + block.select.length;
    replaceRange(pos, b.end, full, selStart, selEnd);
  }

  /* Insert a keyword from the Help panel and select its placeholder value. */
  var KEYWORD_TEMPLATES = {
    'TITLE:': ['TITLE: My Story', 'My Story'],
    'START:': ['START: intro', 'intro'],
    'TITLE-BACKGROUND:': ['TITLE-BACKGROUND: poster.jpg', 'poster.jpg'],
    'TITLE-OVERLAY:': ['TITLE-OVERLAY: logo.png', 'logo.png'],
    'TITLE-MUSIC:': ['TITLE-MUSIC: theme.mp3', 'theme.mp3'],
    'WAIT-LOOP:story': ['WAIT-LOOP: ambient.mp3', 'ambient.mp3'],
    'SCENE:': null,
    'VIDEO:': ['VIDEO: clip.mp4', 'clip.mp4'],
    'IMAGE:': ['IMAGE: picture.jpg', 'picture.jpg'],
    'TEXT:': ['TEXT: Words on screen.', 'Words on screen.'],
    'MUSIC:': ['MUSIC: music.mp3', 'music.mp3'],
    'DURATION:': ['DURATION: 5', '5'],
    'CHOICE:': ['CHOICE: Button label -> scene-name', 'Button label'],
    'NEXT:': ['NEXT: scene-name', 'scene-name'],
    'ENDING:': ['ENDING: The end!', 'The end!'],
    'CHOICES-AT:': ['CHOICES-AT: 4', '4'],
    'TIMER:': ['TIMER: 6 -> scene-name', '6 -> scene-name'],
    'WAIT-LOOP:scene': ['WAIT-LOOP: none', 'none']
  };

  function insertKeyword(kw, section) {
    if (kw === 'SCENE:') {
      var name = uniqueSceneName(app.result ? app.result.model : null, 'new-scene');
      insertLineWithSelect('SCENE: ' + name, name);
      return;
    }
    var lookup = kw === 'WAIT-LOOP:' ? ('WAIT-LOOP:' + (section || 'scene')) : kw;
    var tpl = KEYWORD_TEMPLATES[lookup] || [kw + ' value', 'value'];
    insertLineWithSelect(tpl[0], tpl[1]);
  }

  /* Insert a media file from the Media tab, or replace the value on a matching line. */
  var MEDIA_MATCH_KEYS = {
    video: { 'VIDEO': 1, 'TITLE-BACKGROUND': 1 },
    image: { 'IMAGE': 1, 'TITLE-BACKGROUND': 1, 'TITLE-OVERLAY': 1 },
    audio: { 'MUSIC': 1, 'TITLE-MUSIC': 1, 'WAIT-LOOP': 1 }
  };
  var MEDIA_DEFAULT_KEY = {
    video: 'VIDEO',
    image: 'IMAGE',
    audio: 'MUSIC'
  };

  function insertMediaFile(fileName) {
    var kind = FireCut.mediaKind(fileName);
    var defKey = MEDIA_DEFAULT_KEY[kind] || 'VIDEO';
    var matchSet = MEDIA_MATCH_KEYS[kind] || {};
    var ta = $('fe-text');
    var lines = splitLines(ta.value);
    var cur = Math.max(2, Math.min(lines.length - 1, cursorLine() + 1));
    var b = lineBounds(ta.value, cur);
    var curStr = ta.value.substring(b.start, b.end);
    var m = /^(\s*)([A-Za-z][A-Za-z\-]*)\s*:(.*)$/.exec(curStr);
    if (m && matchSet[m[2].toUpperCase()]) {
      var prefix = m[1] + m[2].toUpperCase() + ': ';
      var newLine = prefix + fileName;
      replaceRange(b.start, b.end, newLine, b.start + prefix.length, b.start + newLine.length);
      return;
    }
    insertLineWithSelect(defKey + ': ' + fileName, fileName);
  }

  /* Jump to a 1-based line number, select that line and scroll it into view. */
  function jumpToLine(line) {
    var ta = $('fe-text');
    var total = splitLines(ta.value).length;
    if (!line || line < 1) { line = 2; }
    if (line > total) { line = total; }
    var b = lineBounds(ta.value, line);
    ta.focus();
    ta.setSelectionRange(b.start, b.end);
    var lh = (app.font ? Math.round(app.font * 1.47) : 22);
    var targetTop = (line - 1) * lh - (ta.clientHeight / 2) + (lh / 2);
    ta.scrollTop = Math.max(0, targetTop);
    ta.scrollLeft = 0;
    syncScroll();
    app.curLine = -1;
    onCursor();
  }

  function scheduleAnalyse() {
    if (app.analyseTimer) { clearTimeout(app.analyseTimer); }
    app.analyseTimer = setTimeout(function () {
      app.analyseTimer = null;
      analyse();
    }, 400);
  }

  function scheduleDraft() {
    if (app.draftTimer) { return; }
    app.draftTimer = setTimeout(function () {
      app.draftTimer = null;
      saveDraft();
    }, 5000);
  }

  function saveDraft() {
    if (app.draftTimer) { clearTimeout(app.draftTimer); app.draftTimer = null; }
    if (!app.dirty) { return; }
    var when = formatTime(new Date());
    store('draft-text', $('fe-text').value);
    store('draft-time', when);
    app.draftTime = when;
    if (app.result) { renderStatus(); }
  }

  function onTextChanged() {
    var ta = $('fe-text');
    if (!hasValidWrapper(ta.value)) {
      var hadBacktick = ta.value.substring(editableMin(), Math.max(editableMin(), ta.value.length - CLOSE.length - 1)).indexOf('`') >= 0;
      ta.value = app.lastValidText;
      var pos = Math.max(editableMin(), Math.min(editableMax(ta.value), ta.selectionStart));
      ta.setSelectionRange(pos, pos);
      toast(hadBacktick ? MSG_BACKTICK : MSG_LOCKED);
      renderCode();
      onCursor();
      return;
    }
    app.lastValidText = ta.value;
    app.dirty = true;
    $('fe-dirty').hidden = false;
    renderCode();
    onCursor();
    if (app.result) { renderStatus(); }
    scheduleAnalyse();
    scheduleDraft();
  }

  function bindEditorGuards() {
    var ta = $('fe-text');

    ta.addEventListener('keydown', function (e) {
      if (e.key === '`') {
        e.preventDefault();
        toast(MSG_BACKTICK);
        return;
      }
      var min = editableMin(), max = editableMax(ta.value);
      var s = ta.selectionStart, end = ta.selectionEnd;

      /* Ctrl+A selects the story body between the locked wrapper lines. */
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        ta.setSelectionRange(min, max);
        onCursor();
        return;
      }

      /* Tab inserts two spaces instead of leaving the editor. */
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (s < min || end > max) {
          toast(MSG_LOCKED);
          return;
        }
        insertAtCursor('  ');
        return;
      }

      /* Block Backspace / Delete at the locked wrapper boundaries even with modifiers. */
      if ((e.key === 'Backspace' || e.key === 'Delete') &&
          (s < min || end > max ||
           (e.key === 'Backspace' && s === end && s <= min) ||
           (e.key === 'Delete' && s === end && end >= max))) {
        e.preventDefault();
        toast(MSG_LOCKED);
        return;
      }

      /* Allow navigation and shortcuts (Ctrl+C, Ctrl+Z, Ctrl+Y, Ctrl+F, etc.). */
      if (e.ctrlKey || e.metaKey || e.altKey) { return; }
      var nav = {
        ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
        Home: 1, End: 1, PageUp: 1, PageDown: 1, Escape: 1,
        Shift: 1, Control: 1, Alt: 1, Meta: 1, CapsLock: 1,
        F1: 1, F2: 1, F3: 1, F4: 1, F5: 1, F6: 1,
        F7: 1, F8: 1, F9: 1, F10: 1, F11: 1, F12: 1
      };
      if (nav[e.key]) { return; }

      /* Block edits that touch the locked first or last line. */
      if (s < min || end > max) {
        e.preventDefault();
        toast(MSG_LOCKED);
      }
    });

    ta.addEventListener('paste', function (e) {
      var min = editableMin(), max = editableMax(ta.value);
      if (ta.selectionStart < min || ta.selectionEnd > max) {
        e.preventDefault();
        toast(MSG_LOCKED);
        return;
      }
      var clip = (e.clipboardData || window.clipboardData);
      var pasted = clip ? clip.getData('text') : '';
      if (pasted && pasted.indexOf('`') >= 0) {
        e.preventDefault();
        toast(MSG_BACKTICK);
      }
    });

    ta.addEventListener('cut', function (e) {
      var min = editableMin(), max = editableMax(ta.value);
      if (ta.selectionStart < min || ta.selectionEnd > max) {
        e.preventDefault();
        toast(MSG_LOCKED);
      }
    });
  }

  /* ---------- checking ---------- */

  function analyse() {
    var raw = storyPart($('fe-text').value);
    var result = null;
    if (raw !== null) {
      try { result = FireCut.analyse(raw); } catch (e) { result = null; }
    }
    var canDrawMap = !!(result && result.model.scenes.length > 0);
    $('fe-map-paused').hidden = canDrawMap;
    $('fe-map').className = canDrawMap ? 'fe-map' : 'fe-map fe-paused';
    if (!result) { return; }
    app.result = result;
    app.marks = {};
    each(result.warnings, function (w) { if (w.line > 0) { app.marks[w.line] = 'warn'; } });
    each(result.errors, function (e) { if (e.line > 0) { app.marks[e.line] = 'err'; } });
    var title = result.model.title || 'Untitled story';
    $('fe-title').textContent = title;
    document.title = 'FireCut Editor - ' + title;
    renderCode();
    renderChecks();
    if (canDrawMap || !app.svg) { renderMap(); }
    renderMedia();
    renderStatus();
    updateScenePicker();
  }

  /* ---------- status bar and tab counts ---------- */

  function setStat(id, text, cls) {
    var el = $(id);
    if (!el) { return; }
    el.textContent = text;
    el.className = 'fe-st' + (cls ? ' ' + cls : '');
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function renderStatus() {
    var r = app.result;
    if (!r) { return; }
    var ne = r.errors.length, nw = r.warnings.length;
    var clean = ne === 0 && nw === 0;
    setStat('fe-st-errors', plural(ne, 'error'), ne ? 'fe-st-err' : (clean ? 'fe-st-ok' : ''));
    setStat('fe-st-warnings', plural(nw, 'warning'), nw ? 'fe-st-warn' : (clean ? 'fe-st-ok' : ''));
    setStat('fe-st-scenes', plural(r.model.scenes.length, 'scene'));
    setStat('fe-st-endings', plural(r.model.endings.length, 'ending'));
    setStat('fe-st-line', 'Line ' + (app.curLine + 1));
    setStat('fe-st-checked', app.draftTime ? 'Draft saved ' + app.draftTime : '');
    setStat('fe-st-saved', app.dirty ? 'Not saved to story.js yet' :
      (app.everSaved ? 'Saved to story.js' : 'No changes yet'));

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
    var view = $('fe-map-view');
    var host = $('fe-map');
    var hadSvg = !!app.svg;
    var prevSL = view.scrollLeft, prevST = view.scrollTop, prevHere = app.here;

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
    if (hadSvg) {
      view.scrollLeft = prevSL;
      view.scrollTop = prevST;
    }
    app.here = prevHere;
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
      if (node && app.result) {
        var sc = app.result.model.sceneMap[node.getAttribute('data-scene')];
        if (sc && sc.line > 0) { jumpToLine(sc.line); }
      }
    });
    view.addEventListener('contextmenu', function (e) {
      var node = nodeFrom(e.target);
      if (!node) { return; }
      e.preventDefault();
      $('fe-tip').hidden = true;
      startPreview(node.getAttribute('data-scene'));
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

  /* ---------- Media tab ---------- */

  function releaseMediaUrls() {
    for (var k in app.mediaUrls) {
      if (app.mediaUrls.hasOwnProperty(k) && app.mediaUrls[k]) {
        try { URL.revokeObjectURL(app.mediaUrls[k]); } catch (e) {}
      }
    }
    app.mediaUrls = {};
  }

  function isIgnoredFolderFile(name) {
    var lower = name.toLowerCase();
    return lower.charAt(0) === '.' || lower === 'readme.txt' ||
      lower === 'thumbs.db' || lower === 'desktop.ini';
  }

  function setMediaFolder(fileList) {
    releaseMediaUrls();
    var names = [], folderName = 'media';
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      var rel = f.webkitRelativePath || f.name || '';
      var parts = rel.split('/');
      if (parts.length > 2) { continue; }   // skip nested subfolders
      if (parts.length === 2 && parts[0]) { folderName = parts[0]; }
      var name = f.name || parts[parts.length - 1];
      if (!name || isIgnoredFolderFile(name)) { continue; }
      names.push(name);
      var kind = FireCut.mediaKind(name);
      if ((kind === 'image' || kind === 'video') && typeof URL !== 'undefined' && URL.createObjectURL) {
        try { app.mediaUrls[name] = URL.createObjectURL(f); } catch (e) {}
      }
    }
    names.sort();
    app.mediaFiles = names;
    app.mediaFolderName = folderName;
    app.mediaFolderChosen = true;
    var note = $('fe-media-note');
    if (note) {
      note.textContent = 'Your browser forgets the folder when the editor closes, so you choose it again each time.';
    }
    renderMedia();
  }

  function renderMedia() {
    var model = app.result.model;
    var filesList = app.mediaFiles;
    var check = analyseMediaFolder(model, filesList);
    var use = check.use, missing = check.missing, badNames = check.badNames;
    var html = [];
    $('fe-media-summary').textContent = app.mediaFolderName + ' (' + filesList.length +
      (filesList.length === 1 ? ' file' : ' files') + '). Click a file to add it at the cursor.';

    if (missing.length) {
      var links = [];
      each(missing, function (m) {
        links.push('<button type="button" class="fe-link" data-jump-line="' + m.line +
          '"><b>' + esc(m.file) + '</b> (line ' + m.line + ')</button>');
      });
      html.push('<div class="fe-banner fe-banner-err">' + ICON_ERR +
        '<span>Your story names files that are not in this folder: ' +
        links.join(', ') + '. Check the spelling.</span></div>');
    } else {
      html.push('<div class="fe-banner fe-banner-ok"><svg class="fe-check-ico" viewBox="0 0 24 24" ' +
        'aria-hidden="true" style="stroke:#4ade80"><circle cx="12" cy="12" r="9"/>' +
        '<path d="m8 12.2 2.8 2.8L16 9.5"/></svg>Every file your story names is in this folder.</div>');
    }

    each(badNames, function (bad) {
      html.push('<div class="fe-banner fe-banner-warn">' + ICON_WARN +
        '<span>The file name "' + esc(bad) + '" uses capitals or characters other than lowercase ' +
        'letters, numbers, hyphens and underscores. That can break when the project moves ' +
        'computers. Rename the file and update the story.</span></div>');
    });

    var groups = [['video', 'Videos', ICON_FILM], ['image', 'Images', ICON_IMAGE],
      ['audio', 'Audio', ICON_AUDIO]];
    each(groups, function (g) {
      var files = [];
      each(filesList, function (f) { if (FireCut.mediaKind(f) === g[0]) { files.push(f); } });
      if (!files.length) { return; }
      html.push('<div class="fe-media-group"><h3>' + g[1] + ' (' + files.length + ')</h3>' +
        '<div class="fe-media-grid">');
      each(files, function (f) {
        var whereLinks = [];
        if (use.hasOwnProperty(f)) {
          each(use[f], function (u) {
            whereLinks.push('<span class="fe-use-link" data-jump-line="' + (u.line || 2) +
              '" title="Jump to line ' + (u.line || 2) + '">' + esc(u.where) + '</span>');
          });
        }
        var url = app.mediaUrls[f];
        var thumb = g[2];
        if (url && g[0] === 'image') {
          thumb += '<img class="fe-thumb-img" src="' + esc(url) + '" alt="">';
        } else if (url && g[0] === 'video') {
          thumb += '<video class="fe-thumb-vid" src="' + esc(url) + '" muted loop playsinline preload="metadata"></video>';
        }
        var badCls = validFileName(f) ? '' : ' fe-file-bad';
        html.push('<button type="button" class="fe-file-card' + badCls + '" data-file="' + esc(f) + '">' +
          '<span class="fe-thumb">' + thumb + '</span><span class="fe-file-name">' + esc(f) +
          '</span><span class="fe-file-use ' + (whereLinks.length ? 'fe-used">Used in ' +
          whereLinks.join(', ') : 'fe-unused">Not used yet') + '</span>' +
          (validFileName(f) ? '' : '<span class="fe-file-warn">Rename to lowercase, no spaces</span>') +
          '</button>');
      });
      html.push('</div></div>');
    });
    $('fe-media').innerHTML = html.join('');
  }

  function bindMedia() {
    var choose = $('fe-media-choose');
    var input = $('fe-media-input');
    if (choose && input) {
      choose.onclick = function () {
        input.value = '';
        input.click();
      };
      input.addEventListener('change', function () {
        if (input.files && input.files.length) {
          setMediaFolder(input.files);
        }
      });
    }
    var host = $('fe-media');
    host.addEventListener('mouseover', function (e) {
      var card = e.target;
      while (card && card !== host && !/\bfe-file-card\b/.test(card.className || '')) {
        card = card.parentNode;
      }
      if (!card || card === host) { return; }
      var vid = card.getElementsByTagName('video')[0];
      if (vid && vid.paused) {
        try {
          var p = vid.play();
          if (p && p.then) { p.then(function () {}, function () {}); }
        } catch (err) {}
      }
    });
    host.addEventListener('mouseout', function (e) {
      var card = e.target;
      while (card && card !== host && !/\bfe-file-card\b/.test(card.className || '')) {
        card = card.parentNode;
      }
      if (!card || card === host) { return; }
      var rel = e.relatedTarget;
      if (rel && card.contains(rel)) { return; }
      var vid = card.getElementsByTagName('video')[0];
      if (vid && !vid.paused) {
        try { vid.pause(); vid.currentTime = 0; } catch (err) {}
      }
    });
  }

  /* ---------- Help panel ---------- */

  function renderHelp() {
    var html = [];
    function rows(list, section) {
      each(list, function (k) {
        html.push('<div class="fe-kw"><code class="fe-use-link" data-kw="' + esc(k[0]) +
          '" data-kw-sec="' + section + '" title="Click to insert ' + esc(k[0]) + '">' +
          esc(k[0]) + '</code><span>' + esc(k[1]) +
          '</span><button type="button" class="fe-btn" data-kw="' + esc(k[0]) +
          '" data-kw-sec="' + section + '">Insert</button></div>');
      });
    }
    html.push('<h3>At the top, before any scene</h3>');
    rows(HELP_STORY_KEYS, 'story');
    html.push('<h3>Inside each scene</h3>');
    rows(HELP_SCENE_KEYS, 'scene');
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

  /* ---------- Play preview ---------- */

  function startPreview(sceneName) {
    if (app.analyseTimer) {
      clearTimeout(app.analyseTimer);
      app.analyseTimer = null;
      analyse();
    }
    if (app.previewStop) {
      app.previewStop();
      app.previewStop = null;
    }
    var raw = storyPart($('fe-text').value);
    if (raw === null) {
      toast('The first and last lines of story.js are locked and cannot be removed.');
      return;
    }
    app.previewScene = sceneName || null;
    var info = $('fe-preview-info');
    if (app.previewScene) {
      info.innerHTML = 'Playing from <span class="fe-preview-scene">' +
        esc(app.previewScene) + '</span>, using your unsaved story';
    } else {
      info.textContent = 'Playing from the start, using your unsaved story';
    }
    setMenu(false);
    setHelp(false);
    var overlay = $('fe-preview');
    overlay.hidden = false;
    $('fe-preview-close').focus();
    app.previewStop = FireCut.preview(raw, app.previewScene, $('fe-preview-stage'));
  }

  function closePreview() {
    if (app.previewStop) {
      app.previewStop();
      app.previewStop = null;
    }
    var overlay = $('fe-preview');
    if (overlay && !overlay.hidden) {
      overlay.hidden = true;
      $('fe-text').focus();
    }
  }

  /* ---------- Opening, saving and drafts ---------- */

  function setBuffer(fileText, noteText, isBad, isDirty) {
    var ta = $('fe-text');
    ta.value = fileText;
    app.lastValidText = fileText;
    app.dirty = !!isDirty;
    $('fe-dirty').hidden = !app.dirty;
    if (noteText !== null && noteText !== undefined) {
      var note = $('fe-file-note');
      note.textContent = noteText;
      note.className = isBad ? 'fe-file-note fe-bad' : 'fe-file-note';
    }
    app.curLine = 0;
    app.firstMap = true;
    analyse();
    var startPos = editableMin();
    ta.setSelectionRange(startPos, startPos);
    ta.focus();
    ta.scrollTop = 0;
    syncScroll();
    app.curLine = -1;
    onCursor();
  }

  function loadStory() {
    var raw = FireCut._rawStory ? FireCut._rawStory() : null;
    var noteText, isBad = false;
    if (raw === null) {
      var bad = FireCut._storyJsError ? FireCut._storyJsError() : null;
      noteText = bad ? 'story.js has a mistake that stops it loading' +
        (bad.line ? ' (line ' + bad.line + ')' : '') + '. Showing the starter story.' :
        'story.js was not found in this folder. Showing the starter story.';
      isBad = true;
      raw = BEGINNER_RAW;
    } else {
      noteText = 'opened from this folder';
    }
    var diskText = buildFileText(raw);
    app.diskText = diskText;
    setBuffer(diskText, noteText, isBad, false);

    /* Check if an unsaved draft exists that differs from story.js. */
    var draftText = recall('draft-text');
    var draftTime = recall('draft-time') || 'earlier';
    if (draftText && hasValidWrapper(draftText) && draftText !== diskText) {
      showDraftPrompt(draftText, draftTime);
    }
  }

  function showDraftPrompt(draftText, draftTime) {
    var modal = $('fe-draft-modal');
    $('fe-draft-msg').textContent = 'You have unsaved changes from ' + draftTime +
      '. Keep working on them, or open story.js?';
    modal.hidden = false;
    $('fe-draft-keep').focus();

    $('fe-draft-keep').onclick = function () {
      modal.hidden = true;
      app.draftTime = draftTime;
      setBuffer(draftText, 'unsaved draft from ' + draftTime, false, true);
    };
    $('fe-draft-discard').onclick = function () {
      modal.hidden = true;
      removeStore('draft-text');
      removeStore('draft-time');
      app.draftTime = null;
      renderStatus();
      $('fe-text').focus();
    };
  }

  function openChosenFile(file) {
    if (!file) { return; }
    if (app.dirty && !window.confirm('You have unsaved changes. Open "' + file.name + '" and replace them?')) {
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      var raw = storyPart(text);
      if (raw === null) {
        /* Plain story text without FireCut.story(`...`); wrapper. */
        raw = '\n' + text.replace(/`/g, '\'') + '\n';
      }
      app.fileHandle = null;
      app.everSaved = false;
      app.draftTime = null;
      removeStore('draft-text');
      removeStore('draft-time');
      var newText = buildFileText(raw);
      var differs = newText !== app.diskText;
      setBuffer(newText, 'opened from ' + file.name, false, differs);
      if (differs) { saveDraft(); }
      toast('Opened ' + file.name + '.');
    };
    reader.onerror = function () {
      toast('Could not read ' + file.name + '.');
    };
    reader.readAsText(file);
  }

  function onSaved(usedPicker) {
    if (app.draftTimer) { clearTimeout(app.draftTimer); app.draftTimer = null; }
    removeStore('draft-text');
    removeStore('draft-time');
    app.dirty = false;
    app.everSaved = true;
    app.draftTime = null;
    $('fe-dirty').hidden = true;
    renderStatus();
    if (usedPicker) {
      toast('Saved story.js.');
    } else if (!app.shownDownloadTip) {
      app.shownDownloadTip = true;
      toast(MSG_DOWNLOAD_TIP, 6500);
    } else {
      toast('Downloaded story.js.');
    }
  }

  function downloadFallback(text) {
    var blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'story.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    onSaved(false);
  }

  function writeToHandle(handle, text) {
    return handle.createWritable().then(function (w) {
      return w.write(text).then(function () { return w.close(); });
    });
  }

  function saveStory() {
    if (app.analyseTimer) {
      clearTimeout(app.analyseTimer);
      app.analyseTimer = null;
      analyse();
    }
    var text = $('fe-text').value;
    if (app.fileHandle && app.fileHandle.createWritable) {
      writeToHandle(app.fileHandle, text).then(function () {
        onSaved(true);
      }, function () {
        app.fileHandle = null;
        saveStory();
      });
      return;
    }
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        window.showSaveFilePicker({
          suggestedName: 'story.js',
          types: [{ description: 'FireCut story (story.js)', accept: { 'text/javascript': ['.js'] } }]
        }).then(function (handle) {
          app.fileHandle = handle;
          return writeToHandle(handle, text);
        }).then(function () {
          onSaved(true);
        }, function (err) {
          if (err && err.name === 'AbortError') { return; }
          downloadFallback(text);
        });
        return;
      } catch (e) {
        downloadFallback(text);
        return;
      }
    }
    downloadFallback(text);
  }

  function bindFileActions() {
    var input = $('fe-file-input');
    $('fe-open').onclick = function () {
      input.value = '';
      input.click();
    };
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) { openChosenFile(input.files[0]); }
    });
    $('fe-download').onclick = saveStory;

    /* Drag-and-drop a .js story file onto the editor window. */
    window.addEventListener('dragover', function (e) {
      if (e.dataTransfer && e.dataTransfer.types) {
        e.preventDefault();
      }
    });
    window.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) { return; }
      e.preventDefault();
      openChosenFile(e.dataTransfer.files[0]);
    });

    /* Warn on closing the tab with unsaved changes, and save a draft first. */
    window.addEventListener('beforeunload', function (e) {
      if (!app.dirty) { return; }
      saveDraft();
      e.preventDefault();
      e.returnValue = '';
    });
  }

  /* ---------- tabs, menu, divider, text size ---------- */

  function selectTab(name) {
    app.tab = name;
    each(['map', 'checks', 'media'], function (t) {
      $('fe-tab-' + t).setAttribute('aria-selected', t === name ? 'true' : 'false');
      $('fe-panel-' + t).hidden = t !== name;
    });
    setHelp(false);
    if (name === 'map') {
      applyZoom();
      app.here = null;
      highlightHere();
    }
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

  function start() {
    if (typeof document === 'undefined' || !window.FireCut) { return; }
    var ta = $('fe-text');

    renderHelp();
    setFont(parseInt(recall('font'), 10) || 15);
    applySplit();
    loadStory();
    bindEditorGuards();
    bindFileActions();
    bindMedia();

    ta.addEventListener('input', onTextChanged);
    ta.addEventListener('scroll', syncScroll);
    ta.addEventListener('mousedown', function () {
      app.dismissedPickLine = -1;
      app.dismissedPickVal = null;
    });
    ta.addEventListener('blur', function () {
      hideScenePicker();
    });
    $('fe-scene-pick').addEventListener('mousedown', function (e) {
      e.preventDefault();
    });
    each(['keyup', 'click', 'select', 'focus'], function (ev) { ta.addEventListener(ev, onCursor); });
    document.addEventListener('selectionchange', function () {
      if (document.activeElement === ta) { onCursor(); }
    });

    $('fe-font-down').onclick = function () { setFont(app.font - 1); };
    $('fe-font-up').onclick = function () { setFont(app.font + 1); };
    $('fe-play').onclick = function () { startPreview(null); };
    $('fe-preview-restart').onclick = function () { startPreview(app.previewScene); };
    $('fe-preview-close').onclick = function () { closePreview(); };
    $('fe-help').onclick = function () { setHelp($('fe-help-panel').hidden); };
    $('fe-help-close').onclick = function () { setHelp(false); };
    $('fe-insert').onclick = function (e) {
      e.stopPropagation();
      setMenu($('fe-insert-menu').hidden);
    };
    each(['map', 'checks', 'media'], function (t) {
      $('fe-tab-' + t).onclick = function () { selectTab(t); };
    });

    /* Delegated clicks for Insert menu, Help keywords, Media cards, Checks, and jump links. */
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

      var ins = e.target;
      while (ins && ins !== document && !(ins.getAttribute && ins.getAttribute('data-insert'))) {
        ins = ins.parentNode;
      }
      if (ins && ins !== document) {
        setMenu(false);
        insertPattern(ins.getAttribute('data-insert'));
        return;
      }

      if (!$('fe-insert-menu').hidden && !$('fe-insert-menu').contains(e.target)) { setMenu(false); }

      var spScene = e.target;
      while (spScene && spScene !== document && !(spScene.getAttribute && spScene.getAttribute('data-sp-scene'))) {
        spScene = spScene.parentNode;
      }
      if (spScene && spScene !== document) {
        pickSceneTarget(spScene.getAttribute('data-sp-scene'));
        return;
      }

      var spCreate = e.target;
      while (spCreate && spCreate !== document && !(spCreate.getAttribute && spCreate.getAttribute('data-sp-create'))) {
        spCreate = spCreate.parentNode;
      }
      if (spCreate && spCreate !== document) {
        createSceneFromTarget(spCreate.getAttribute('data-sp-create'));
        return;
      }

      var kwBtn = e.target;
      while (kwBtn && kwBtn !== document && !(kwBtn.getAttribute && kwBtn.getAttribute('data-kw'))) {
        kwBtn = kwBtn.parentNode;
      }
      if (kwBtn && kwBtn !== document) {
        insertKeyword(kwBtn.getAttribute('data-kw'), kwBtn.getAttribute('data-kw-sec'));
        return;
      }

      var jmp = e.target;
      while (jmp && jmp !== document && !(jmp.getAttribute && jmp.getAttribute('data-jump-line'))) {
        jmp = jmp.parentNode;
      }
      if (jmp && jmp !== document) {
        e.stopPropagation();
        var jLine = parseInt(jmp.getAttribute('data-jump-line'), 10);
        jumpToLine(jLine > 0 ? jLine : 2);
        return;
      }

      var check = e.target;
      while (check && check !== document && !/\bfe-check\b/.test(check.className || '')) {
        check = check.parentNode;
      }
      if (check && check !== document) {
        var line = parseInt(check.getAttribute('data-line'), 10);
        jumpToLine(line > 0 ? line : 2);
        return;
      }

      var card = e.target;
      while (card && card !== document && !/\bfe-file-card\b/.test(card.className || '')) {
        card = card.parentNode;
      }
      if (card && card !== document) {
        insertMediaFile(card.getAttribute('data-file'));
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('fe-preview').hidden) {
          e.preventDefault();
          closePreview();
          return;
        }
        if ($('fe-scene-pick') && !$('fe-scene-pick').hidden) {
          var lNum = cursorLine() + 1;
          var b = lineBounds(ta.value, lNum);
          var sp = targetSpanAt(ta.value.substring(b.start, b.end), ta.selectionStart - b.start);
          app.dismissedPickLine = lNum;
          app.dismissedPickVal = sp ? sp.value : null;
          hideScenePicker();
        }
        setMenu(false);
        setHelp(false);
        return;
      }
      if (!$('fe-preview').hidden) { return; }
      if (e.altKey && !e.ctrlKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault();
        selectTab(['map', 'checks', 'media'][parseInt(e.key, 10) - 1]);
      } else if (e.key === 'F1') {
        e.preventDefault();
        setHelp($('fe-help-panel').hidden);
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveStory();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          if (app.analyseTimer) {
            clearTimeout(app.analyseTimer);
            app.analyseTimer = null;
            analyse();
          }
          var sc = app.result && app.result.model ?
            sceneAtLine(app.result.model, app.curLine + 1) : null;
          startPreview(sc ? sc.name : null);
        } else {
          startPreview(null);
        }
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
    lineBounds: lineBounds,
    buildFileText: buildFileText,
    storyPart: storyPart,
    hasValidWrapper: hasValidWrapper,
    messageWords: messageWords,
    sceneAtLine: sceneAtLine,
    mediaUsage: mediaUsage,
    analyseMediaFolder: analyseMediaFolder,
    uniqueSceneName: uniqueSceneName,
    validFileName: validFileName,
    buildPatternBlock: buildPatternBlock,
    targetSpanAt: targetSpanAt,
    sceneSummary: sceneSummary,
    highlightLine: highlightLine
  };
})();
