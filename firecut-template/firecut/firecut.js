/* ==========================================================================
   FireCut engine - version 1
   Plain JavaScript (ES5-safe). No dependencies. Runs from file:// in
   Chrome and Edge. Students never edit this file.
   ========================================================================== */

var FireCut = (function () {

  /* ----------------------------------------------------------------------
     Public data set by story.js
     ---------------------------------------------------------------------- */

  var rawStory = null;          // text passed to FireCut.story()
  var storyJsError = null;      // syntax error captured while story.js loads

  function story(text) {
    rawStory = text;
  }

  /* ----------------------------------------------------------------------
     Small helpers (kept ES3/ES5-safe so the parser can run under cscript)
     ---------------------------------------------------------------------- */

  function trim(s) {
    return s.replace(/^\s+|\s+$/g, '');
  }

  function idxOf(arr, item) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === item) { return i; }
    }
    return -1;
  }

  function each(arr, fn) {
    for (var i = 0; i < arr.length; i++) { fn(arr[i], i); }
  }

  function fileExt(name) {
    var dot = name.lastIndexOf('.');
    return dot < 0 ? '' : name.substring(dot + 1).toLowerCase();
  }

  /* String.split drops empty strings under Windows Script Host's JScript,
     so lines are split by hand to keep blank lines counted everywhere. */
  function splitLines(raw) {
    var lines = [], start = 0, i;
    for (i = 0; i < raw.length; i++) {
      var ch = raw.charAt(i);
      if (ch === '\n' || ch === '\r') {
        lines.push(raw.substring(start, i));
        start = i + 1;
        if (ch === '\r' && raw.charAt(i + 1) === '\n') { i++; start = i + 1; }
      }
    }
    lines.push(raw.substring(start));
    return lines;
  }

  /* ----------------------------------------------------------------------
     Keyword tables
     ---------------------------------------------------------------------- */

  var STORY_KEYS = {
    'TITLE': 1, 'START': 1, 'TITLE-BACKGROUND': 1, 'WAIT-LOOP': 1,
    'TITLE-MUSIC': 1
  };

  var SCENE_KEYS = {
    'VIDEO': 1, 'IMAGE': 1, 'TEXT': 1, 'MUSIC': 1, 'DURATION': 1,
    'CHOICE': 1, 'NEXT': 1, 'ENDING': 1, 'CHOICES-AT': 1, 'TIMER': 1,
    'WAIT-LOOP': 1
  };

  var RESERVED = { 'SET': 1, 'IF': 1 };

  function isKnownKey(key) {
    return STORY_KEYS[key] || SCENE_KEYS[key] || key === 'SCENE';
  }

  /* ----------------------------------------------------------------------
     The parser
     ---------------------------------------------------------------------- */

  function err(list, line, text) {
    list.push({ type: 'error', line: line, text: 'Line ' + line + ': ' + text });
  }

  function warn(list, line, text) {
    list.push({ type: 'warning', line: line, text: 'Line ' + line + ': ' + text });
  }

  function warnNoLine(list, text) {
    list.push({ type: 'warning', line: 0, text: text });
  }

  function errNoLine(list, text) {
    list.push({ type: 'error', line: 0, text: text });
  }

  function suggest(key) {
    /* Find the closest known keyword for a "did you mean" hint. */
    var all = ['TITLE', 'START', 'TITLE-BACKGROUND', 'WAIT-LOOP', 'SCENE',
      'VIDEO', 'IMAGE', 'TEXT', 'MUSIC', 'DURATION', 'CHOICE', 'NEXT',
      'ENDING', 'CHOICES-AT', 'TIMER'];
    var best = null, bestScore = 4;
    each(all, function (k) {
      var d = levenshtein(key, k);
      if (d < bestScore) { bestScore = d; best = k; }
    });
    if (best) { return ' Did you mean ' + best + '?'; }
    return ' Check the keyword list in the quick start guide.';
  }

  function levenshtein(a, b) {
    var m = a.length, n = b.length, i, j;
    var prev = [], cur = [];
    for (j = 0; j <= n; j++) { prev[j] = j; }
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[n];
  }

  function newScene(name, line) {
    return {
      name: name, line: line,
      video: null, videoLine: 0,
      image: null, imageLine: 0,
      text: null, textLine: 0,
      music: null, musicLine: 0,
      duration: null, durationLine: 0,
      choicesAt: null, choicesAtLine: 0,
      waitLoop: null, waitLoopLine: 0,
      choices: [],              // {label, target, image, line}
      next: null, nextLine: 0,
      ending: null, endingLine: 0,
      timer: null, timerLine: 0, timerTarget: null,
      reachable: false
    };
  }

  function addMedia(model, file, line) {
    model.mediaRefs.push({ file: file, line: line });
  }

  function parseNumber(value) {
    if (!/^\d+(\.\d+)?$/.test(value)) { return null; }
    return parseFloat(value);
  }

  function parseStory(raw) {
    var model = {
      title: null, titleLine: 0,
      start: null, startLine: 0,
      titleBackground: null, titleBackgroundLine: 0,
      titleMusic: null, titleMusicLine: 0,
      waitLoop: null, waitLoopLine: 0,
      scenes: [],
      sceneMap: {},
      mediaRefs: [],
      endings: []
    };
    var errors = [], warnings = [];
    var lines = splitLines(raw);
    var scene = null;
    var sawScene = false;

    each(lines, function (rawLine, i) {
      var num = i + 1;
      var t = trim(rawLine);
      if (t === '' || t.charAt(0) === '#') { return; }

      var m = /^([A-Za-z][A-Za-z\-]*)\s*:(.*)$/.exec(t);
      var key, value;
      if (!m) {
        /* A known keyword with a missing colon gets a specific hint. */
        var w = /^([A-Za-z][A-Za-z\-]*)/.exec(t);
        if (w && (isKnownKey(w[1].toUpperCase()) || RESERVED[w[1].toUpperCase()])) {
          err(errors, num, '"' + w[1].toUpperCase() +
            '" needs a colon after it, like "' + w[1].toUpperCase() + ': value".');
        } else {
          err(errors, num, 'this line is not in the form KEYWORD: value. ' +
            'Check for a missing colon, or delete the line.');
        }
        return;
      }
      key = m[1].toUpperCase();
      value = trim(m[2]);

      if (RESERVED[key]) {
        err(errors, num, key + ' is not available in this version of FireCut. ' +
          'It is reserved for version 2. Delete this line to fix the story.');
        return;
      }

      if (key === 'SCENE') {
        sawScene = true;
        scene = null;
        if (value === '') {
          err(errors, num, 'SCENE needs a name, like "SCENE: hallway".');
          return;
        }
        if (!/^[a-z0-9\-]+$/.test(value)) {
          err(errors, num, 'the scene name "' + value + '" is not allowed. ' +
            'Use lowercase letters, numbers and hyphens only.');
          return;
        }
        if (model.sceneMap[value]) {
          err(errors, num, 'there is already a scene called "' + value +
            '" (first used on line ' + model.sceneMap[value].line +
            '). Rename one of them.');
          return;
        }
        scene = newScene(value, num);
        model.scenes.push(scene);
        model.sceneMap[value] = scene;
        return;
      }

      if (!sawScene) {
        /* Top of the story: only story keywords allowed. */
        if (STORY_KEYS[key]) {
          if (value === '') {
            err(errors, num, key + ' needs a value.');
            return;
          }
          if (key === 'TITLE') {
            if (model.title !== null) {
              warn(warnings, num, 'TITLE is set more than once. The first one is used.');
            } else {
              model.title = value; model.titleLine = num;
            }
          } else if (key === 'START') {
            if (model.start !== null) {
              warn(warnings, num, 'START is set more than once. The first one is used.');
            } else {
              model.start = value; model.startLine = num;
            }
          } else if (key === 'TITLE-BACKGROUND') {
            model.titleBackground = value; model.titleBackgroundLine = num;
            addMedia(model, value, num);
          } else if (key === 'WAIT-LOOP') {
            model.waitLoop = value; model.waitLoopLine = num;
            if (value.toLowerCase() !== 'none') { addMedia(model, value, num); }
          } else if (key === 'TITLE-MUSIC') {
            model.titleMusic = value; model.titleMusicLine = num;
            if (value.toLowerCase() !== 'none') { addMedia(model, value, num); }
          }
        } else if (SCENE_KEYS[key]) {
          err(errors, num, '"' + key + '" needs to be under a SCENE line. ' +
            'Add "SCENE: name" above it first.');
        } else {
          err(errors, num, 'unknown keyword "' + key + '".' + suggest(key));
        }
        return;
      }

      /* Inside a scene. WAIT-LOOP is valid here too, so only keywords
         that are story-only (TITLE, START, TITLE-BACKGROUND) error. */
      if (STORY_KEYS[key] && !SCENE_KEYS[key]) {
        err(errors, num, key + ' belongs at the top of the story, ' +
          'before the first SCENE line.');
        return;
      }
      if (!SCENE_KEYS[key]) {
        err(errors, num, 'unknown keyword "' + key + '".' + suggest(key));
        return;
      }
      if (!scene) { return; }   /* an earlier SCENE line already failed */

      switch (key) {
        case 'VIDEO':
          if (value === '') { err(errors, num, 'VIDEO needs a file name.'); break; }
          if (scene.video) {
            warn(warnings, num, 'VIDEO is set twice in scene "' + scene.name +
              '". The first one is used.');
            break;
          }
          scene.video = value; scene.videoLine = num;
          addMedia(model, value, num);
          break;
        case 'IMAGE':
          if (value === '') { err(errors, num, 'IMAGE needs a file name.'); break; }
          scene.image = value; scene.imageLine = num;
          addMedia(model, value, num);
          break;
        case 'TEXT':
          if (value === '') { err(errors, num, 'TEXT needs some words.'); break; }
          scene.text = value; scene.textLine = num;
          break;
        case 'MUSIC':
          if (value === '') { err(errors, num, 'MUSIC needs a file name.'); break; }
          scene.music = value; scene.musicLine = num;
          if (value.toLowerCase() !== 'none') { addMedia(model, value, num); }
          break;
        case 'DURATION': {
          var d = parseNumber(value);
          if (d === null || d <= 0) {
            err(errors, num, 'DURATION needs a number of seconds, like "DURATION: 5".');
          } else {
            scene.duration = d; scene.durationLine = num;
          }
          break;
        }
        case 'CHOICES-AT': {
          var c = parseNumber(value);
          if (c === null || c < 0) {
            err(errors, num, 'CHOICES-AT needs a number of seconds, like "CHOICES-AT: 4".');
          } else {
            scene.choicesAt = c; scene.choicesAtLine = num;
          }
          break;
        }
        case 'WAIT-LOOP':
          if (value === '') { err(errors, num, 'WAIT-LOOP needs a file name or "none".'); break; }
          scene.waitLoop = value; scene.waitLoopLine = num;
          if (value.toLowerCase() !== 'none') { addMedia(model, value, num); }
          break;
        case 'NEXT':
          if (value === '') { err(errors, num, 'NEXT needs a scene name.'); break; }
          scene.next = value; scene.nextLine = num;
          break;
        case 'ENDING':
          if (value === '') {
            err(errors, num, 'ENDING needs a message, like "ENDING: You made it out!"');
            break;
          }
          scene.ending = value; scene.endingLine = num;
          break;
        case 'CHOICE': {
          var pipeIdx = value.indexOf('|');
          var img = null;
          var left = value;
          if (pipeIdx >= 0) {
            img = trim(value.substring(pipeIdx + 1));
            left = trim(value.substring(0, pipeIdx));
            if (img === '') {
              err(errors, num, 'the "|" at the end of this choice needs an image ' +
                'file name after it, like "CHOICE: label -> scene | btn.png".');
              break;
            }
          }
          var arrowIdx = left.indexOf('->');
          if (arrowIdx < 0) {
            err(errors, num, 'this choice needs an arrow, like ' +
              '"CHOICE: label -> scene-name".');
            break;
          }
          var label = trim(left.substring(0, arrowIdx));
          var target = trim(left.substring(arrowIdx + 2));
          if (label === '') {
            err(errors, num, 'this choice has no button text before the "->".');
            break;
          }
          if (target === '') {
            err(errors, num, 'the choice "' + label + '" needs a scene name after "->".');
            break;
          }
          scene.choices.push({ label: label, target: target, image: img, line: num });
          if (img) { addMedia(model, img, num); }
          break;
        }
        case 'TIMER': {
          var ta = value.indexOf('->');
          if (ta < 0) {
            err(errors, num, 'TIMER needs seconds and a scene, like "TIMER: 8 -> lift".');
            break;
          }
          var secs = parseNumber(trim(value.substring(0, ta)));
          var ttarget = trim(value.substring(ta + 2));
          if (secs === null || secs <= 0) {
            err(errors, num, 'TIMER needs a number of seconds, like "TIMER: 8 -> lift".');
            break;
          }
          if (ttarget === '') {
            err(errors, num, 'TIMER needs a scene name after "->".');
            break;
          }
          scene.timer = secs; scene.timerLine = num; scene.timerTarget = ttarget;
          break;
        }
      }
    });

    checkStory(model, errors, warnings);
    return { model: model, errors: errors, warnings: warnings };
  }

  /* ----------------------------------------------------------------------
     Structural checks (after parsing, before media probing)
     ---------------------------------------------------------------------- */

  function validFileName(name) {
    return /^[a-z0-9_\-\.]+$/.test(name);
  }

  function checkStory(model, errors, warnings) {
    if (model.title === null) {
      errNoLine(errors, 'The story needs a TITLE line near the top, ' +
        'like "TITLE: My Story".');
    }
    if (model.start === null) {
      errNoLine(errors, 'The story needs a START line near the top, ' +
        'like "START: intro".');
    } else if (!model.sceneMap[model.start]) {
      err(errors, model.startLine, 'START points to a scene called "' +
        model.start + '", but there is no scene with that name. ' +
        'Check the spelling.');
    }

    var clipCount = 0;
    var choiceKeyTargets = {};

    each(model.scenes, function (scene) {
      var hasMedia = scene.video || scene.image || scene.text;
      var hasExit = scene.choices.length > 0 || scene.next || scene.ending;

      if (scene.video) { clipCount++; }

      if (!hasMedia) {
        err(errors, scene.line, 'the scene "' + scene.name +
          '" has no VIDEO, IMAGE or TEXT. It needs one of these.');
      }
      if (!hasExit) {
        err(errors, scene.line, 'the scene "' + scene.name +
          '" has no CHOICE, NEXT or ENDING, so the story would get stuck here.');
      }
      if (scene.choices.length > 4) {
        err(errors, scene.choices[4].line, 'the scene "' + scene.name +
          '" has ' + scene.choices.length + ' choices. Four is the most allowed.');
      }
      if (scene.video && scene.image) {
        warn(warnings, scene.imageLine || scene.line, 'the scene "' + scene.name +
          '" sets both VIDEO and IMAGE. The video will play; ' +
          'delete the one you do not need.');
      }
      if (scene.choicesAt !== null && !scene.video) {
        warn(warnings, scene.choicesAtLine, 'CHOICES-AT only works on scenes ' +
          'with VIDEO. It will do nothing here.');
      }
      if (scene.music && scene.video) {
        warn(warnings, scene.musicLine, 'MUSIC only plays on scenes with IMAGE ' +
          'or TEXT, not on video scenes. It will be ignored here.');
      }
      if (scene.duration !== null && scene.video) {
        warn(warnings, scene.durationLine, 'DURATION only applies to scenes ' +
          'with IMAGE or TEXT. A video plays to its own length.');
      }
      if (scene.ending && scene.choices.length > 0) {
        warn(warnings, scene.line, 'the scene "' + scene.name +
          '" has both ENDING and CHOICEs. When the media finishes the ' +
          'ending is shown, so the choices only appear if CHOICES-AT ' +
          'brings them up early. Use one or the other.');
      }
      if (scene.next && scene.choices.length > 0) {
        warn(warnings, scene.line, 'the scene "' + scene.name +
          '" has both NEXT and CHOICEs. NEXT moves on automatically, so ' +
          'the choices will never appear. Use one or the other.');
      }

      /* Targets. */
      each(scene.choices, function (ch) {
        choiceKeyTargets[ch.target] = true;
        if (!model.sceneMap[ch.target]) {
          err(errors, ch.line, 'the choice "' + ch.label +
            '" points to a scene called "' + ch.target +
            '", but there is no scene with that name. Check the spelling.');
        }
      });
      if (scene.next && !model.sceneMap[scene.next]) {
        err(errors, scene.nextLine, 'NEXT points to a scene called "' +
          scene.next + '", but there is no scene with that name. ' +
          'Check the spelling.');
      }
      if (scene.timerTarget) {
        if (!model.sceneMap[scene.timerTarget]) {
          err(errors, scene.timerLine, 'TIMER points to a scene called "' +
            scene.timerTarget + '", but there is no scene with that name. ' +
            'Check the spelling.');
        } else {
          var among = false;
          each(scene.choices, function (ch) {
            if (ch.target === scene.timerTarget) { among = true; }
          });
          if (!among) {
            warn(warnings, scene.timerLine, 'the TIMER points to "' +
              scene.timerTarget + '", but that is not one of this scene\'s ' +
              'choices. If it is meant to be the default answer, add a ' +
              'CHOICE that leads there.');
          }
        }
      }
      if (scene.ending) { model.endings.push(scene); }
    });

    /* File name warnings. */
    each(model.mediaRefs, function (ref) {
      if (!validFileName(ref.file)) {
        warn(warnings, ref.line, 'the file name "' + ref.file +
          '" uses capitals or characters other than lowercase letters, ' +
          'numbers, hyphens and underscores. That can break when the ' +
          'project moves computers. Rename the file and update the story.');
      }
    });

    /* Reachability. */
    if (model.start && model.sceneMap[model.start]) {
      var queue = [model.sceneMap[model.start]];
      while (queue.length > 0) {
        var s = queue.shift();
        if (s.reachable) { continue; }
        s.reachable = true;
        each(s.choices, function (ch) {
          if (model.sceneMap[ch.target]) { queue.push(model.sceneMap[ch.target]); }
        });
        if (s.next && model.sceneMap[s.next]) {
          queue.push(model.sceneMap[s.next]);
        }
        if (s.timerTarget && model.sceneMap[s.timerTarget]) {
          queue.push(model.sceneMap[s.timerTarget]);
        }
      }
      each(model.scenes, function (scene) {
        if (!scene.reachable) {
          warn(warnings, scene.line, 'the scene "' + scene.name +
            '" can never be reached from START. If it is not needed, delete it.');
        }
      });
    }

    if (clipCount > 12) {
      warnNoLine(warnings, 'The story uses ' + clipCount + ' video clips. ' +
        'More than 12 can make the project slow on older computers.');
    }
  }

  /* ----------------------------------------------------------------------
     Media checks - probe each referenced file in media/
     Done async because loading a file takes a moment.
     ---------------------------------------------------------------------- */

  function mediaKind(file) {
    var ext = fileExt(file);
    if (ext === 'mp4' || ext === 'm4v') { return 'video'; }
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') { return 'image'; }
    if (ext === 'mp3') { return 'audio'; }
    return 'badext';
  }

  function checkMedia(model, base, done) {
    /* Collect unique files in the order they were first named. */
    var files = [], seen = {}, refs = {};
    each(model.mediaRefs, function (ref) {
      if (!seen[ref.file]) {
        seen[ref.file] = true;
        files.push(ref.file);
        refs[ref.file] = ref.line;
      }
    });

    var results = [];
    if (files.length === 0) { done(results); return; }

    if (typeof document === 'undefined') {
      /* Headless test run: nothing to probe. */
      done(results);
      return;
    }

    var pending = files.length;
    var reported = {};
    function report(file, line, status) {
      if (reported[file]) { return; }
      reported[file] = true;
      results.push({ file: file, line: line, status: status });
      pending--;
      if (pending === 0) { done(results); }
    }

    /* Safety net: a probe that never answers must not leave the viewer
       stuck on "Checking media files". Treat silence as present. */
    setTimeout(function () {
      each(files, function (f) { report(f, refs[f], 'ok'); });
    }, 10000);

    each(files, function (file) {
      var kind = mediaKind(file);
      var src = base + file;
      var line = refs[file];

      if (kind === 'badext') {
        report(file, line, 'badext');
        return;
      }
      if (kind === 'image') {
        var img = new Image();
        img.onload = function () { report(file, line, 'ok'); };
        img.onerror = function () { report(file, line, 'missing'); };
        img.src = src;
        return;
      }
      var el = document.createElement(kind);
      el.preload = 'metadata';
      el.onloadedmetadata = function () {
        /* The container opened, but a video track the browser cannot
           decode (for example HEVC) shows as a 0 x 0 picture. */
        if (kind === 'video' && el.videoWidth === 0) {
          report(file, line, 'unplayable');
        } else {
          report(file, line, 'ok');
        }
      };
      el.onerror = function () {
        /* Browsers report a missing file and an unreadable file with the
           same code (4), so both count as missing. Code 3 only happens
           after the file opened, so that one means "won't play". */
        var code = el.error ? el.error.code : 0;
        report(file, line, code === 3 ? 'unplayable' : 'missing');
      };
      el.src = src;
    });
  }

  /* ======================================================================
     The player
     ====================================================================== */

  var MEDIA_DIR = 'media/';
  var DEFAULT_DURATION = 3;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }

  function clear(node) {
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  /* ---------- boot ---------- */

  function start() {
    if (typeof document === 'undefined') { return; }
    var root = document.getElementById('fc-root');
    if (!root) {
      root = el('div');
      root.id = 'fc-root';
      document.body.appendChild(root);
    }
    if ((' ' + root.className + ' ').indexOf(' fc-root ') < 0) {
      root.className += (root.className ? ' ' : '') + 'fc-root';
    }
    clear(root);

    if (rawStory === null) {
      var msgs = [];
      if (storyJsError && storyJsError.line > 0) {
        msgs.push({
          type: 'error', line: storyJsError.line,
          text: 'Line ' + storyJsError.line + ': story.js has a mistake ' +
            'around here (' + storyJsError.message + '). This is usually a ' +
            'stray backtick inside the story text.'
        });
      }
      msgs.push({
        type: 'error', line: 0,
        text: 'The story file could not be read at all. Check that story.js ' +
          'sits next to PLAY.html, that its first line is exactly ' +
          'FireCut.story(` and its last line is `); and that the story ' +
          'contains no backtick characters.'
      });
      showCheckScreen(root, msgs, [], true);
      return;
    }

    var res = parseStory(rawStory);
    var checking = el('div', 'fc-checking', 'Checking media files...');
    root.appendChild(checking);

    checkMedia(res.model, MEDIA_DIR, function (mediaResults) {
      var errors = res.errors.slice(0);
      var warnings = res.warnings.slice(0);
      each(mediaResults, function (r) {
        if (r.status === 'missing') {
          errors.push({
            type: 'error', line: r.line,
            text: 'Line ' + r.line + ': the file "' + r.file +
              '" is named in the story but is missing from the media ' +
              'folder, or cannot be opened. Check the spelling of the name ' +
              'in both places. If the name is right, export the file again ' +
              'as MP4 (H.264), PNG, JPG or MP3.'
          });
        } else if (r.status === 'unplayable') {
          warnings.push({
            type: 'warning', line: r.line,
            text: 'Line ' + r.line + ': the file "' + r.file +
              '" is there, but it will not play in the browser. It is ' +
              'probably the wrong format. Export it as MP4 (H.264), ' +
              'PNG, JPG or MP3.'
          });
        } else if (r.status === 'badext') {
          errors.push({
            type: 'error', line: r.line,
            text: 'Line ' + r.line + ': "' + r.file +
              '" is a file type FireCut does not use. Videos must be mp4, ' +
              'images png or jpg, sound mp3.'
          });
        }
      });
      clear(root);
      if (errors.length > 0) {
        showCheckScreen(root, errors, warnings, true);
        return;
      }
      var app = {
        root: root, model: res.model,
        errors: errors, warnings: warnings,
        current: null, stage: null, videos: null, activeVideo: null,
        staticBox: null, choicesBox: null, timerBar: null, caption: null,
        audioUnlocked: false, muted: false,
        waitAudio: null, waitFade: null, choiceEls: [],
        titleAudio: null, titleMusicArmed: false, titleKeyHandler: null,
        openChoices: null, timerIv: null, staticIv: null
      };
      showTitle(app);
    });
  }

  /* ---------- check / error screens ---------- */

  /* One message row: coloured label, then the plain-English text. */
  function checkItem(kind, label, text) {
    var li = el('li', 'fc-check-item fc-' + kind);
    li.appendChild(el('span', 'fc-badge', label));
    li.appendChild(el('span', 'fc-check-text', text));
    return li;
  }

  function fillCheckList(list, errors, warnings) {
    each(errors, function (m) { list.appendChild(checkItem('err', 'Error', m.text)); });
    each(warnings, function (m) { list.appendChild(checkItem('warn', 'Warning', m.text)); });
    if (errors.length === 0 && warnings.length === 0) {
      list.appendChild(checkItem('ok', 'All good', 'No problems found. The story is clean.'));
    }
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function showCheckScreen(root, errors, warnings, isFatal) {
    clear(root);
    var panel = el('div', 'fc-check-screen');
    panel.appendChild(el('h1', 'fc-check-title',
      errors.length > 0 ? 'The story needs fixing' : 'Checks'));
    if (errors.length > 0) {
      panel.appendChild(el('p', 'fc-check-intro',
        plural(errors.length, 'error') +
        (warnings.length ? ' and ' + plural(warnings.length, 'warning') : '') +
        '. Fix the errors in story.js, save it, then open PLAY.html again.'));
    }
    var list = el('ul', 'fc-check-list');
    fillCheckList(list, errors, warnings);
    panel.appendChild(list);
    root.appendChild(panel);
  }

  function showChecksPanel(app) {
    var overlay = el('div', 'fc-overlay');
    var panel = el('div', 'fc-checks-panel');
    panel.appendChild(el('h2', 'fc-checks-title', 'Checks'));
    if (app.warnings.length > 0) {
      panel.appendChild(el('p', 'fc-check-intro',
        plural(app.warnings.length, 'warning') +
        '. The story still plays, but these are worth fixing.'));
    }
    var list = el('ul', 'fc-check-list');
    fillCheckList(list, [], app.warnings);
    panel.appendChild(list);
    var close = el('button', 'fc-btn fc-secondary fc-close-btn', 'Close');
    close.onclick = function () { overlay.parentNode.removeChild(overlay); };
    panel.appendChild(close);
    overlay.appendChild(panel);
    app.root.appendChild(overlay);
  }

  /* ---------- title screen ---------- */

  function showTitle(app) {
    clear(app.root);
    app.current = null;
    /* Release every pooled clip so memory stays low on the title screen. */
    if (app.videos) {
      each(app.videos, releaseVideo);
      app.activeVideo = null;
    }
    stopWaitLoop(app);
    stopMusic(app);
    clearTimers(app);
    /* The story title always names the browser tab, even when a student
       hides the on-screen title because their poster already shows it. */
    document.title = app.model.title;
    var ts = el('div', 'fc-title-screen');
    if (app.model.titleBackground) {
      ts.className += ' fc-has-background';
      ts.style.backgroundImage = "url('" + MEDIA_DIR +
        app.model.titleBackground + "')";
    }
    var box = el('div', 'fc-title-box');
    box.appendChild(el('h1', 'fc-title', app.model.title));
    bindKeys(app);
    var startBtn = el('button', 'fc-btn fc-start', 'Start');
    startBtn.onclick = function () {
      app.audioUnlocked = true;
      playScene(app, app.model.start);
    };
    box.appendChild(startBtn);
    ts.appendChild(box);

    /* TITLE-MUSIC: browsers need a first click or keypress before any
       audio can play. If audio is already unlocked (Play again), start
       straight away; otherwise arm it on the first gesture that is not
       the Start button itself. */
    stopTitleMusic(app);
    var musicFile = app.model.titleMusic;
    if (musicFile && musicFile.toLowerCase() !== 'none') {
      var note = null;
      var beginTitleMusic = function () {
        if (!note) {
          note = el('div', 'fc-music-note', 'Playing: ' + musicFile +
            '   (M mutes)');
          ts.appendChild(note);
        } else {
          note.textContent = 'Playing: ' + musicFile + '   (M mutes)';
        }
        var a = new Audio(MEDIA_DIR + musicFile);
        a.loop = true;
        a.volume = 0;
        a.muted = app.muted;
        app.titleAudio = a;
        var pp = a.play();
        if (pp && pp['catch']) {
          pp['catch'](function (err) {
            note.textContent = 'Audio blocked: ' +
              (err && err.name ? err.name : 'unknown') +
              ' - click anywhere to enable sound';
            /* Stay armed: the next real click or keypress retries. */
            app.titleMusicArmed = true;
          });
        }
        var t = 0;
        var iv = setInterval(function () {
          t += 100;
          if (!app.muted) { a.volume = Math.min(t / 1000, 1); }
          if (t >= 1000) { clearInterval(iv); }
        }, 100);
      };
      if (app.audioUnlocked) {
        beginTitleMusic();
      } else {
        app.titleMusicArmed = true;
        var onGesture = function (e) {
          if (e && e.target === startBtn) { return; }
          app.audioUnlocked = true;
          if (app.titleMusicArmed) { app.titleMusicArmed = false; beginTitleMusic(); }
        };
        ts.addEventListener('click', onGesture);
        ts.addEventListener('pointerdown', onGesture);
        app.titleKeyHandler = onGesture;
        document.addEventListener('keydown', onGesture);
      }
    }

    var corner = el('div', 'fc-title-corner');
    var mapBtn = el('button', 'fc-btn fc-secondary fc-small fc-map-btn', 'Story map');
    mapBtn.onclick = function () { showMap(app); };
    var checksBtn = el('button', 'fc-btn fc-secondary fc-small fc-checks-btn',
      app.warnings.length ? 'Checks (' + app.warnings.length + ')' : 'Checks');
    checksBtn.onclick = function () { showChecksPanel(app); };
    corner.appendChild(mapBtn);
    corner.appendChild(checksBtn);
    ts.appendChild(corner);

    var hint = el('div', 'fc-keys-hint');
    var keys = [['F', 'full screen'], ['Space', 'pause'], ['M', 'mute'], ['1-4', 'choose']];
    each(keys, function (k, i) {
      if (i > 0) { hint.appendChild(document.createTextNode('   ')); }
      hint.appendChild(el('b', null, k[0]));
      hint.appendChild(document.createTextNode(' ' + k[1]));
    });
    ts.appendChild(hint);

    app.root.appendChild(ts);
  }

  /* ---------- stage ---------- */

  var MAX_VIDEOS = 5;

  function ensureStage(app) {
    if (app.stage) { return; }
    var stage = el('div', 'fc-stage');
    app.videos = [];
    app.staticBox = el('div', 'fc-static');
    app.caption = el('div', 'fc-caption');
    app.timerBar = el('div', 'fc-timer');
    app.timerBar.appendChild(el('div', 'fc-timer-fill'));
    app.choicesBox = el('div', 'fc-choices');
    /* Video elements are inserted before staticBox so overlays always
       stay on top of the video stack. */
    stage.appendChild(app.staticBox);
    stage.appendChild(app.caption);
    stage.appendChild(app.timerBar);
    stage.appendChild(app.choicesBox);
    app.stage = stage;
  }

  function newVideo(app) {
    var v = el('video', 'fc-video');
    v.setAttribute('playsinline', 'playsinline');
    v.muted = app.muted;
    v.style.display = 'none';
    app.stage.insertBefore(v, app.staticBox);
    app.videos.push(v);
    return v;
  }

  function releaseVideo(v) {
    try { v.pause(); } catch (e) {}
    try { v.removeAttribute('src'); v.load(); } catch (e) {}
    v._fcSrc = null;
    v.style.display = 'none';
  }

  /* Next scene names reachable from this scene, deduped. */
  function nextTargets(scene) {
    var t = [];
    each(scene.choices, function (c) {
      if (idxOf(t, c.target) < 0) { t.push(c.target); }
    });
    if (scene.next && idxOf(t, scene.next) < 0) { t.push(scene.next); }
    if (scene.timerTarget && idxOf(t, scene.timerTarget) < 0) {
      t.push(scene.timerTarget);
    }
    return t;
  }

  /* Media URLs of video scenes reachable from this scene. */
  function targetVideos(app, scene) {
    var files = [];
    each(nextTargets(scene), function (name) {
      var s = app.model.sceneMap[name];
      if (s && s.video) {
        var src = MEDIA_DIR + s.video;
        if (idxOf(files, src) < 0) { files.push(src); }
      }
    });
    return files;
  }

  /* Drop buffers of pooled videos that can no longer be reached. */
  function releaseStale(app, scene, except) {
    var keep = targetVideos(app, scene);
    each(app.videos.slice(0), function (v) {
      if (v !== app.activeVideo && v !== except && v._fcSrc &&
          idxOf(keep, v._fcSrc) < 0) {
        releaseVideo(v);
      }
    });
  }

  /* Preload every next-scene clip into spare stacked elements. */
  function preloadNext(app, scene) {
    each(targetVideos(app, scene), function (src) {
      var have = false;
      each(app.videos, function (v) { if (v._fcSrc === src) { have = true; } });
      if (!have && app.videos.length < MAX_VIDEOS) {
        var v = newVideo(app);
        v.preload = 'auto';
        v._fcSrc = src;
        v.src = src;
        v.load();
      }
    });
  }

  /* Get a video element already holding src if possible. */
  function acquireVideo(app, file) {
    var src = MEDIA_DIR + file, v = null, i;
    for (i = 0; i < app.videos.length; i++) {
      var cand = app.videos[i];
      if (cand._fcSrc === src && cand !== app.activeVideo) { v = cand; break; }
    }
    if (!v) {
      for (i = 0; i < app.videos.length; i++) {
        var idle = app.videos[i];
        if (!idle._fcSrc && idle !== app.activeVideo) { v = idle; break; }
      }
    }
    if (!v && app.videos.length >= MAX_VIDEOS) {
      for (i = 0; i < app.videos.length; i++) {
        var spare = app.videos[i];
        if (spare !== app.activeVideo) { releaseVideo(spare); v = spare; break; }
      }
    }
    if (!v) { v = newVideo(app); }
    if (v._fcSrc !== src) {
      v._fcSrc = src;
      v.src = src;
      v.load();
    }
    return v;
  }

  function clearTimers(app) {
    if (app.timerIv) { clearInterval(app.timerIv); app.timerIv = null; }
    if (app.staticIv) { clearTimeout(app.staticIv); app.staticIv = null; }
    if (app.waitFade) { clearInterval(app.waitFade); app.waitFade = null; }
  }

  function clearChoices(app) {
    clear(app.choicesBox);
    app.choicesBox.style.display = 'none';
    app.timerBar.style.display = 'none';
    app.choiceEls = [];
    app.choicesVisible = false;
    app.earlyShown = false;
    app.openChoices = null;
  }

  function playScene(app, name) {
    var scene = app.model.sceneMap[name];
    if (!scene) { return; }
    app.current = scene;
    ensureStage(app);
    clear(app.root);
    app.root.appendChild(app.stage);
    clearChoices(app);
    stopWaitLoop(app);
    stopMusic(app);
    stopTitleMusic(app);
    clearTimers(app);
    if (scene.video) {
      videoScene(app, scene);
    } else {
      staticScene(app, scene);
    }
  }

  /* ---------- video scenes ---------- */

  function videoScene(app, scene) {
    var old = app.activeVideo;
    var v = acquireVideo(app, scene.video);
    app.activeVideo = v;
    app.staticBox.style.display = 'none';
    app.caption.style.display = scene.text ? 'block' : 'none';
    if (scene.text) { app.caption.textContent = scene.text; }
    /* Topmost among video elements, still under the overlay divs. */
    app.stage.insertBefore(v, app.staticBox);
    v.style.display = 'block';
    v.muted = app.muted;
    /* A pooled clip may have been stopped part way through earlier. */
    try { if (v.currentTime > 0) { v.currentTime = 0; } } catch (e) {}
    /* Ignore late events from a clip that is no longer the current one. */
    function live() { return app.current === scene && app.activeVideo === v; }
    v.onended = function () { if (live()) { sceneEnded(app, scene); } };
    /* CHOICES-AT: bring the buttons up while the clip is still playing. */
    app.earlyShown = false;
    var choicesAt = scene.choicesAt;
    if (choicesAt !== null && scene.choices.length > 0) {
      v.ontimeupdate = function () {
        if (live() && !app.earlyShown && v.duration > 0 &&
            v.currentTime >= v.duration - choicesAt) {
          app.earlyShown = true;
          showChoices(app, scene);
        }
      };
    } else {
      v.ontimeupdate = null;
    }
    v.onplaying = null;
    if (old && old !== v) {
      /* Keep the old clip under the new one until the new frame renders,
         so there is no black gap on the switch. */
      var done = false;
      var hidePrev = function () {
        if (done) { return; }
        done = true;
        v.onplaying = null;
        if (old === app.activeVideo) { return; }   /* it came back into use */
        old.style.display = 'none';
        try { old.pause(); } catch (e) {}
        if (app.current) { releaseStale(app, app.current); }
      };
      v.onplaying = hidePrev;
      setTimeout(hidePrev, 1200);
    }
    releaseStale(app, scene, old);
    var p = v.play();
    if (p && p['catch']) { p['catch'](function () {}); }
    preloadNext(app, scene);
  }

  /* ---------- image / text scenes ---------- */

  function staticScene(app, scene) {
    each(app.videos, function (v) {
      try { v.pause(); } catch (e) {}
      v.style.display = 'none';
    });
    app.activeVideo = null;
    var box = app.staticBox;
    clear(box);
    box.style.display = 'flex';
    if (scene.image) {
      var img = el('img', 'fc-static-img');
      img.src = MEDIA_DIR + scene.image;
      img.alt = '';
      box.appendChild(img);
    }
    if (scene.text) {
      /* With an image, TEXT becomes a caption laid over the picture. */
      box.appendChild(el('div', scene.image ?
        'fc-static-text fc-static-caption' : 'fc-static-text', scene.text));
    }
    app.caption.style.display = 'none';
    stopMusic(app);
    if (scene.music && app.audioUnlocked) {
      var m = new Audio(MEDIA_DIR + scene.music);
      m.loop = true;
      m.muted = app.muted;
      app.musicAudio = m;
      var mp = m.play();
      if (mp && mp['catch']) { mp['catch'](function () {}); }
    }
    preloadNext(app, scene);
    var secs = scene.duration !== null ? scene.duration : DEFAULT_DURATION;
    app.staticIv = setTimeout(function () {
      app.staticIv = null;
      sceneEnded(app, scene);
    }, secs * 1000);
  }

  /* ---------- scene ends ---------- */

  function sceneEnded(app, scene) {
    if (scene.ending) { showEnding(app, scene); return; }
    if (scene.next) { playScene(app, scene.next); return; }
    if (app.choicesVisible) { return; }   /* CHOICES-AT already showed them */
    showChoices(app, scene);
  }

  function showChoices(app, scene) {
    var box = app.choicesBox;
    clear(box);
    box.style.display = 'flex';
    app.choicesVisible = true;
    app.choiceEls = [];
    each(scene.choices, function (ch, i) {
      var b = el('button', 'fc-choice');
      b._fcTarget = ch.target;
      if (ch.image) {
        b.className += ' fc-choice-img';
        var nSrc = MEDIA_DIR + ch.image;
        var hSrc = MEDIA_DIR + hoverName(ch.image);
        b.style.backgroundImage = "url('" + nSrc + "')";
        /* If a matching -hover file exists, swap it in on hover. */
        var probe = new Image();
        probe.onload = function () {
          b.onmouseover = function () {
            b.style.backgroundImage = "url('" + hSrc + "')";
          };
          b.onmouseout = function () {
            b.style.backgroundImage = "url('" + nSrc + "')";
          };
        };
        probe.src = hSrc;
      } else {
        b.appendChild(el('span', 'fc-choice-num', String(i + 1)));
        b.appendChild(el('span', 'fc-choice-label', ch.label));
      }
      b.onclick = function () { choose(app, ch.target); };
      app.choiceEls.push(b);
      box.appendChild(b);
    });
    startWaitLoop(app, waitLoopFor(scene, app.model));
    if (scene.timer) { startTimer(app, scene); }
  }

  /* TIMER: shrinking bar across the top, then the default choice fires
     and its button flashes so the viewer sees what happened. */
  function startTimer(app, scene) {
    var bar = app.timerBar;
    var fill = bar.firstChild;
    bar.style.display = 'block';
    var total = scene.timer;
    var t0 = new Date().getTime();
    app.timerIv = setInterval(function () {
      var left = total - (new Date().getTime() - t0) / 1000;
      fill.style.width = Math.max(left / total * 100, 0) + '%';
      if (left <= 0) {
        clearInterval(app.timerIv);
        app.timerIv = null;
        var target = scene.timerTarget;
        each(app.choiceEls, function (b) {
          if (b._fcTarget === target) {
            b.className += ' fc-choice-picked';
          }
        });
        setTimeout(function () {
          if (app.current === scene && app.choicesVisible) { choose(app, target); }
        }, 450);
      }
    }, 100);
  }

  function hoverName(file) {
    var dot = file.lastIndexOf('.');
    if (dot < 0) { return file + '-hover'; }
    return file.substring(0, dot) + '-hover' + file.substring(dot);
  }

  function choose(app, target) {
    clearTimers(app);
    /* The wait loop fades out over 0.5s while the next scene is already
       loading, so the two overlap and the switch stays fast. */
    var a = app.waitAudio;
    app.waitAudio = null;
    if (app.waitFade) { clearInterval(app.waitFade); app.waitFade = null; }
    if (a) {
      var i = 0;
      var iv = setInterval(function () {
        i++;
        a.volume = Math.max(1 - i / 5, 0);
        if (i >= 5) { clearInterval(iv); a.pause(); }
      }, 100);
    }
    playScene(app, target);
  }

  /* ---------- endings ---------- */

  function showEnding(app, scene) {
    app.choiceEls = [];
    var idx = idxOf(app.model.endings, scene) + 1;
    var total = app.model.endings.length;
    var screen = el('div', 'fc-ending');
    var box = el('div', 'fc-ending-box');
    box.appendChild(el('div', 'fc-ending-msg', scene.ending));
    box.appendChild(el('div', 'fc-ending-num',
      'Ending ' + idx + ' of ' + total));
    var again = el('button', 'fc-btn fc-again', 'Play again');
    again.onclick = function () { showTitle(app); };
    box.appendChild(again);
    screen.appendChild(box);
    app.root.appendChild(screen);
  }

  /* ---------- waiting loop audio ---------- */

  function waitLoopFor(scene, model) {
    if (scene.waitLoop !== null) {
      return scene.waitLoop.toLowerCase() === 'none' ? null : scene.waitLoop;
    }
    if (model.waitLoop && model.waitLoop.toLowerCase() !== 'none') {
      return model.waitLoop;
    }
    return null;
  }

  function startWaitLoop(app, file) {
    if (!file || !app.audioUnlocked || app.waitAudio) { return; }
    var a = new Audio(MEDIA_DIR + file);
    a.loop = true;
    a.volume = 0;
    app.waitAudio = a;
    var p = a.play();
    if (p && p['catch']) { p['catch'](function () {}); }
    var t = 0;
    app.waitFade = setInterval(function () {
      t += 100;
      var vol = Math.min(t / 1000, 1);
      if (!app.muted) { a.volume = vol; }
      if (t >= 1000) { clearInterval(app.waitFade); app.waitFade = null; }
    }, 100);
  }

  function stopWaitLoop(app) {
    if (app.waitFade) { clearInterval(app.waitFade); app.waitFade = null; }
    if (app.waitAudio) { try { app.waitAudio.pause(); } catch (e) {} app.waitAudio = null; }
  }

  function stopMusic(app) {
    if (app.musicAudio) {
      try { app.musicAudio.pause(); } catch (e) {}
      app.musicAudio = null;
    }
  }

  function stopTitleMusic(app) {
    app.titleMusicArmed = false;
    if (app.titleKeyHandler) {
      document.removeEventListener('keydown', app.titleKeyHandler);
      app.titleKeyHandler = null;
    }
    if (app.titleAudio) {
      try { app.titleAudio.pause(); } catch (e) {}
      app.titleAudio = null;
    }
  }

  /* ---------- story map ---------- */

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function sceneKind(scene) {
    if (scene.video) { return 'video'; }
    if (scene.image) { return 'image'; }
    return 'text';
  }

  /* Layered layout: depth from START = column, unreachable scenes go in
     a greyed column at the far right. */
  function showMap(app) {
    showMapPanel(app, buildMapSvg(app.model));
  }

  function buildMapSvg(model) {
    var levels = {}, queue = [], i, name, d;
    if (model.start && model.sceneMap[model.start]) {
      queue.push([model.start, 0]);
      while (queue.length > 0) {
        var item = queue.shift();
        name = item[0]; d = item[1];
        if (levels[name] !== undefined) { continue; }
        levels[name] = d;
        var s = model.sceneMap[name];
        each(nextTargets(s), function (t) {
          if (model.sceneMap[t]) { queue.push([t, d + 1]); }
        });
      }
    }
    var maxLevel = 0;
    for (name in levels) {
      if (levels.hasOwnProperty(name) && levels[name] > maxLevel) {
        maxLevel = levels[name];
      }
    }
    /* Unreachable scenes get an extra column only if there are any. */
    var deadLevel = maxLevel;
    each(model.scenes, function (s) {
      if (levels[s.name] === undefined) {
        deadLevel = maxLevel + 1;
        levels[s.name] = deadLevel;
      }
    });

    /* Group scenes per column. */
    var cols = {}, colCount = deadLevel + 1;
    for (i = 0; i <= deadLevel; i++) { cols[i] = []; }
    each(model.scenes, function (s) { cols[levels[s.name]].push(s); });

    var boxW = 190, boxH = 60, gapX = 200, rowH = 130;
    var colW = boxW + gapX, padX = 30, padY = 36;
    var FONT = 'font-family="Segoe UI,Arial,sans-serif"';

    /* Edges, merged so one arrow joins any pair of scenes. */
    var edges = [], edgeKey = {};
    function addEdge(from, to, label, dashed) {
      if (!model.sceneMap[to]) { return; }
      var key = from.name + '>' + to;
      var e = edgeKey[key];
      if (!e) {
        e = { from: from.name, to: to, labels: [], dashed: true };
        edgeKey[key] = e;
        edges.push(e);
      }
      if (idxOf(e.labels, label) < 0) { e.labels.push(label); }
      if (!dashed) { e.dashed = false; }
    }
    each(model.scenes, function (s) {
      each(s.choices, function (ch) { addEdge(s, ch.target, ch.label, false); });
      if (s.next) { addEdge(s, s.next, 'auto', true); }
      if (s.timerTarget) { addEdge(s, s.timerTarget, 'timer', true); }
    });

    /* Order each column so scenes sit level with the scenes that lead
       to them (fewer crossing arrows). */
    var row = {};
    each(cols[0], function (s, r) { row[s.name] = r; });
    for (i = 1; i <= deadLevel; i++) {
      each(cols[i], function (s, r) {
        var sum = 0, n = 0;
        each(edges, function (e) {
          if (e.to === s.name && row[e.from] !== undefined &&
              levels[e.from] < i) { sum += row[e.from]; n++; }
        });
        s._fcBary = n ? sum / n : r + 1000;
      });
      cols[i].sort(function (a, b) { return a._fcBary - b._fcBary; });
      each(cols[i], function (s, r) { row[s.name] = r; });
    }

    /* Arrows to the next column are curves through the gap. Every other
       arrow (same column, backwards, skipping columns) runs in its own
       lane underneath the map so it never crosses a box. */
    var lanes = 0, outCount = {}, inCount = {}, intoFirstCol = false;
    each(edges, function (e) {
      var d = levels[e.to] - levels[e.from];
      e.under = d !== 1;
      if (e.under) {
        e.lane = lanes++;
        /* Each lane leaves and enters its box at its own height so
           arrowheads never sit on top of each other. */
        e.outIdx = outCount[e.from] || 0; outCount[e.from] = e.outIdx + 1;
        e.inIdx = inCount[e.to] || 0; inCount[e.to] = e.inIdx + 1;
        if (levels[e.to] === 0) { intoFirstCol = true; }
      }
    });
    /* Every lane gets its own vertical track, so lines never share one. */
    var laneStep = Math.min(10, (gapX / 2 - 20) / Math.max(lanes, 1));
    var padLeft = padX + (intoFirstCol ? 16 + lanes * laneStep : 0);

    var maxRows = 0;
    for (i = 0; i <= deadLevel; i++) {
      if (cols[i].length > maxRows) { maxRows = cols[i].length; }
    }
    var W = colCount * colW - gapX + padLeft + padX;
    var graphH = maxRows * rowH;

    var pos = {};
    for (i = 0; i <= deadLevel; i++) {
      var col = cols[i];
      var offY = padY + (graphH - col.length * rowH) / 2;
      each(col, function (s, r) {
        pos[s.name] = {
          x: padLeft + i * colW,
          y: offY + r * rowH + (rowH - boxH) / 2
        };
      });
    }

    var laneTop = padY + graphH + 26, laneGap = 34;
    var H = laneTop + (lanes ? lanes * laneGap : 0) + padY - (lanes ? 0 : 26);

    var placed = [];
    function freeSpot(x, y, w, h) {
      /* Nudge a label down until it overlaps no other label or box. */
      var tries = 0;
      while (tries < 12) {
        var hit = false, k;
        for (k = 0; k < placed.length; k++) {
          var p = placed[k];
          if (x - w / 2 < p.x + p.w / 2 && x + w / 2 > p.x - p.w / 2 &&
              y - h / 2 < p.y + p.h / 2 && y + h / 2 > p.y - p.h / 2) {
            hit = true; break;
          }
        }
        if (!hit) { break; }
        y += h + 4;
        tries++;
      }
      placed.push({ x: x, y: y, w: w, h: h });
      return y;
    }
    each(model.scenes, function (s) {
      var p = pos[s.name];
      placed.push({ x: p.x + boxW / 2, y: p.y + boxH / 2, w: boxW + 8, h: boxH + 8 });
    });

    var lines = [], labels = [];
    each(edges, function (e) {
      var a = pos[e.from], b = pos[e.to];
      var x1 = a.x + boxW, y1 = a.y + boxH / 2;
      var x2 = b.x, y2 = b.y + boxH / 2;
      var dAttr, lx, ly;
      if (!e.under) {
        var cx = (x1 + x2) / 2;
        dAttr = 'M' + x1 + ' ' + y1 + ' C' + cx + ' ' + y1 + ' ' + cx +
          ' ' + y2 + ' ' + (x2 - 2) + ' ' + y2;
        lx = cx; ly = (y1 + y2) / 2;
      } else {
        y1 = a.y + boxH / 2 + 12 + e.outIdx * 9;
        y2 = b.y + boxH / 2 + 12 + e.inIdx * 9;
        var gx1 = x1 + 16 + e.lane * laneStep, gx2 = x2 - 16 - e.lane * laneStep;
        var lyLane = laneTop + e.lane * laneGap;
        dAttr = 'M' + x1 + ' ' + y1 + ' H' + gx1 + ' V' + lyLane +
          ' H' + gx2 + ' V' + y2 + ' H' + (x2 - 2);
        lx = (gx1 + gx2) / 2; ly = lyLane;
      }
      var colour = e.dashed ? '#d9a54a' : '#9aa3b8';
      lines.push('<path d="' + dAttr + '" fill="none" stroke="' + colour +
        '" stroke-width="2" stroke-linejoin="round" marker-end="url(#' +
        (e.dashed ? 'fcArrD' : 'fcArr') + ')"' +
        (e.dashed ? ' stroke-dasharray="7 5"' : '') + '/>');

      /* One line per label (a choice and the timer stack neatly) and
         each line is kept narrow enough to fit in the gap. */
      var rows = [], longest = 0, k;
      for (k = 0; k < e.labels.length && k < 3; k++) {
        var t = e.labels[k];
        if (t.length > 24) { t = t.substring(0, 23) + '...'; }
        rows.push(t);
        if (t.length > longest) { longest = t.length; }
      }
      var lineH = 17, w = longest * 7.4 + 24, h = rows.length * lineH + 9;
      ly = freeSpot(lx, ly, w, h);
      var g = '<g><rect x="' + (lx - w / 2) + '" y="' + (ly - h / 2) +
        '" width="' + w + '" height="' + h + '" rx="11" fill="#2a2e3b" ' +
        'stroke="' + colour + '" stroke-width="1"/>';
      for (k = 0; k < rows.length; k++) {
        var ty = ly - h / 2 + 4.5 + lineH * (k + 1) - 4;
        g += '<text x="' + lx + '" y="' + ty + '" text-anchor="middle" ' +
          'font-size="13" fill="' + (rows[k] === 'timer' || rows[k] === 'auto' ?
          '#f0c674' : '#eef0f6') + '" ' + FONT + '>' + esc(rows[k]) + '</text>';
      }
      labels.push(g + '</g>');
    });

    var svg = [];
    svg.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W +
      ' ' + H + '" width="' + W + '" height="' + H + '" ' +
      'style="display:block;max-width:100%;height:auto;margin:0 auto">');
    svg.push('<defs>' +
      '<marker id="fcArr" markerWidth="10" markerHeight="10" refX="8" ' +
      'refY="5" orient="auto" markerUnits="userSpaceOnUse">' +
      '<path d="M0,0 L10,5 L0,10 Z" fill="#9aa3b8"/></marker>' +
      '<marker id="fcArrD" markerWidth="10" markerHeight="10" refX="8" ' +
      'refY="5" orient="auto" markerUnits="userSpaceOnUse">' +
      '<path d="M0,0 L10,5 L0,10 Z" fill="#d9a54a"/></marker></defs>');
    svg.push(lines.join(''));

    /* Boxes. Outline colour = scene type (green for video), fill marks
       endings, a separate blue ring marks START, and dashed red marks a
       scene that can never be reached. */
    var FILM = '\uD83C\uDF9E\uFE0F';   /* film frames emoji */
    var GREEN = '#4ade80';
    each(model.scenes, function (s) {
      var p = pos[s.name];
      var dead = !s.reachable;
      var isVideo = !!s.video;
      var fill = '#262a36', stroke = '#5a6178', sw = 1.5;
      if (s.ending) { fill = '#3d2318'; stroke = '#ff6a3d'; }
      if (isVideo) { stroke = GREEN; sw = 2.5; }
      if (dead) { fill = '#1a1a21'; stroke = '#ff5252'; sw = 1.5; }
      svg.push('<g class="fc-map-node" data-scene="' + esc(s.name) +
        '" style="cursor:pointer"><title>Play from ' + esc(s.name) +
        '</title>');
      if (s.name === model.start) {
        svg.push('<rect x="' + (p.x - 6) + '" y="' + (p.y - 6) +
          '" width="' + (boxW + 12) + '" height="' + (boxH + 12) +
          '" rx="15" fill="none" stroke="#7aa7ff" stroke-width="2.5"/>');
      }
      svg.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + boxW +
        '" height="' + boxH + '" rx="10" fill="' + fill + '" stroke="' +
        stroke + '" stroke-width="' + sw + '"' +
        (dead ? ' stroke-dasharray="5 4"' : '') + '/>');
      var nm = s.name.length > 20 ? s.name.substring(0, 19) + '...' : s.name;
      svg.push('<text x="' + (p.x + boxW / 2) + '" y="' + (p.y + 26) +
        '" text-anchor="middle" font-size="17" font-weight="700" fill="' +
        (dead ? '#8a8a98' : '#ffffff') + '" ' + FONT + '>' + esc(nm) +
        '</text>');
      /* Type line: "🎞️ video" in green for videos, then the extras. */
      var kind = isVideo ? FILM + ' video' : sceneKind(s);
      var extra = (s.ending ? '  |  ending' : '') +
        (s.name === model.start ? '  |  START' : '') +
        (dead ? '  |  unreachable' : '');
      svg.push('<text x="' + (p.x + boxW / 2) + '" y="' + (p.y + 46) +
        '" text-anchor="middle" font-size="13" ' + FONT + '>' +
        '<tspan fill="' + (dead ? '#ff8a80' : isVideo ? GREEN : '#c3c8d6') +
        '"' + (isVideo && !dead ? ' font-weight="700"' : '') + '>' +
        esc(kind) + '</tspan><tspan fill="' + (dead ? '#ff8a80' : '#c3c8d6') +
        '">' + esc(extra) + '</tspan></text>');
      svg.push('</g>');
    });
    svg.push(labels.join(''));
    svg.push('</svg>');
    return svg.join('');
  }

  function showMapPanel(app, svgText) {
    var i;
    var overlay = el('div', 'fc-overlay');
    var panel = el('div', 'fc-checks-panel fc-map-panel');
    panel.appendChild(el('h2', 'fc-checks-title', 'Story map'));
    var hint = el('p', 'fc-map-hint', 'Click a box to play from that scene.');
    panel.appendChild(hint);
    var legend = el('div', 'fc-map-legend');
    each([['fc-lg-video', '\uD83C\uDF9E\uFE0F Video scene'],
          ['fc-lg-start', 'START scene'], ['fc-lg-end', 'Ending'],
          ['fc-lg-dead', 'Cannot be reached'], ['fc-lg-choice', 'Choice'],
          ['fc-lg-auto', 'NEXT or TIMER']], function (item) {
      var it = el('span', 'fc-lg-item');
      it.appendChild(el('span', 'fc-lg-swatch ' + item[0]));
      it.appendChild(document.createTextNode(item[1]));
      legend.appendChild(it);
    });
    panel.appendChild(legend);
    var wrap = el('div', 'fc-map-wrap');
    wrap.innerHTML = svgText;
    panel.appendChild(wrap);
    var close = el('button', 'fc-btn fc-secondary fc-close-btn', 'Close');
    close.onclick = function () { overlay.parentNode.removeChild(overlay); };
    panel.appendChild(close);
    overlay.appendChild(panel);
    app.root.appendChild(overlay);

    var nodes = wrap.querySelectorAll('.fc-map-node');
    for (i = 0; i < nodes.length; i++) {
      (function (n) {
        n.onclick = function () {
          var target = n.getAttribute('data-scene');
          overlay.parentNode.removeChild(overlay);
          app.audioUnlocked = true;   /* this click counts as a user gesture */
          playScene(app, target);
        };
      })(nodes[i]);
    }
  }

  /* ---------- keyboard ---------- */

  function bindKeys(app) {
    if (app.keysBound) { return; }
    app.keysBound = true;
    document.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'f' || k === 'F') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        }
      } else if (k === ' ') {
        var v = app.current ? app.activeVideo : null;
        /* An ended clip stays on its last frame; Space must not replay it. */
        if (v && v.style.display !== 'none' && v._fcSrc && !v.ended) {
          if (v.paused) { v.play(); } else { v.pause(); }
          e.preventDefault();
        }
      } else if (k === 'm' || k === 'M') {
        app.muted = !app.muted;
        if (app.videos) {
          each(app.videos, function (v) { v.muted = app.muted; });
        }
        if (app.waitAudio) { app.waitAudio.volume = app.muted ? 0 : 1; }
        if (app.musicAudio) { app.musicAudio.muted = app.muted; }
        if (app.titleAudio) { app.titleAudio.muted = app.muted; }
      } else if (app.current && k >= '1' && k <= '4' && app.choiceEls.length) {
        var n = parseInt(k, 10) - 1;
        if (n < app.choiceEls.length && app.choiceEls[n]) {
          app.choiceEls[n].click();
        }
      }
    });
  }

  /* ----------------------------------------------------------------------
     Public API
     ---------------------------------------------------------------------- */

  var api = {
    story: story,
    analyse: parseStory,
    checkMedia: checkMedia,
    mediaKind: mediaKind,
    start: start,
    mapSvg: buildMapSvg,
    version: '1'
  };

  if (typeof window !== 'undefined') {
    window.FireCut = api;
    /* Any error before the story arrives is almost certainly story.js.
       Some browsers hide the file name and line for file:// scripts, so
       the source is only used to prefer a story.js error when both exist. */
    window.onerror = function (msg, src, line) {
      if (rawStory === null) {
        var fromStory = !!(src && src.indexOf('story.js') >= 0);
        if (!storyJsError || (fromStory && !storyJsError.fromStory)) {
          storyJsError = { message: msg, line: line || 0, fromStory: fromStory };
        }
      }
      return false;
    };
  }

  api._rawStory = function () { return rawStory; };
  api._storyJsError = function () { return storyJsError; };

  return api;
})();
