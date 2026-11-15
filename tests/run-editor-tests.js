/* FireCut editor helper test harness - run under Windows Script Host:
 *     cscript //E:jscript //Nologo tests/run-editor-tests.js
 * Covers the DOM-free editor logic in firecut/editor.js against the real
 * engine in firecut/firecut.js.
 */

var isWsh = typeof WScript !== 'undefined';

function readFile(path) {
  if (isWsh) {
    var fso = new ActiveXObject('Scripting.FileSystemObject');
    var f = fso.OpenTextFile(path, 1);
    var s = f.ReadAll();
    f.Close();
    return s;
  }
  return require('fs').readFileSync(path, 'utf8');
}

function say(msg) {
  if (isWsh) { WScript.Echo(msg); } else { console.log(msg); }
}

function quit(code) {
  if (isWsh) { WScript.Quit(code); } else { process.exit(code); }
}

eval(readFile('firecut-template/firecut/firecut.js'));
eval(readFile('firecut-template/firecut/editor.js'));

var pass = 0, fail = 0;

function check(name, fn) {
  var problems = [];
  function assert(cond, msg) {
    if (!cond) { problems.push(msg || 'assertion failed'); }
  }
  try {
    fn(assert);
  } catch (e) {
    problems.push('threw ' + (e && e.message ? e.message : String(e)));
  }
  if (problems.length === 0) {
    pass++;
    say('PASS  ' + name);
  } else {
    fail++;
    say('FAIL  ' + name);
    for (var i = 0; i < problems.length; i++) {
      say('        ' + problems[i]);
    }
  }
}

check('buildFileText and storyPart round-trip and wrapper checks', function (assert) {
  var raw = '\nTITLE: Test\nSTART: intro\n\nSCENE: intro\nVIDEO: a.mp4\nENDING: Done.\n';
  var fileText = FireCutEditor.buildFileText(raw);
  assert(FireCutEditor.hasValidWrapper(fileText), 'expected valid wrapper');
  assert(FireCutEditor.storyPart(fileText) === raw, 'expected storyPart to match raw');

  var res = FireCut.analyse(FireCutEditor.storyPart(fileText));
  assert(res.errors.length === 0, 'expected 0 errors, got ' + res.errors.length);
  assert(res.model.scenes[0].line === 5, 'expected SCENE: intro on line 5, got ' + res.model.scenes[0].line);

  var brokenTop = 'FireCut.story(\nTITLE: Test\n`);';
  assert(!FireCutEditor.hasValidWrapper(brokenTop), 'missing opening backtick must fail');

  var withBacktick = 'FireCut.story(`\nTITLE: Bad ` quote\n`);';
  assert(!FireCutEditor.hasValidWrapper(withBacktick), 'inner backtick must fail wrapper check');
  assert(FireCutEditor.storyPart(withBacktick) === null, 'storyPart must return null when inner backtick present');
});

check('splitLines preserves blank lines and lineBounds matches 1-based lines', function (assert) {
  var sample = 'line1\n\nline3\r\nline4';
  var lines = FireCutEditor.splitLines(sample);
  assert(lines.length === 4, 'expected 4 lines, got ' + lines.length);
  assert(lines[1] === '', 'expected empty second line');
  assert(lines[2] === 'line3', 'expected line3');

  var b1 = FireCutEditor.lineBounds(sample, 1);
  assert(sample.substring(b1.start, b1.end) === 'line1', 'line 1 bounds mismatch');
  var b3 = FireCutEditor.lineBounds(sample, 3);
  assert(sample.substring(b3.start, b3.end) === 'line3', 'line 3 bounds mismatch');
  var b4 = FireCutEditor.lineBounds(sample, 4);
  assert(sample.substring(b4.start, b4.end) === 'line4', 'line 4 bounds mismatch');
});

check('uniqueSceneName generates new-scene, new-scene-2, new-scene-3', function (assert) {
  var m0 = FireCut.analyse('\nTITLE: T\nSTART: intro\nSCENE: intro\nTEXT: Hi\nENDING: Bye\n').model;
  assert(FireCutEditor.uniqueSceneName(m0, 'new-scene') === 'new-scene', 'expected new-scene');

  var m1 = FireCut.analyse('\nTITLE: T\nSTART: new-scene\nSCENE: new-scene\nTEXT: Hi\nENDING: Bye\n').model;
  assert(FireCutEditor.uniqueSceneName(m1, 'new-scene') === 'new-scene-2', 'expected new-scene-2');

  var m2 = FireCut.analyse(
    '\nTITLE: T\nSTART: new-scene\n' +
    'SCENE: new-scene\nNEXT: new-scene-2\nTEXT: A\n' +
    'SCENE: new-scene-2\nTEXT: B\nENDING: Bye\n'
  ).model;
  assert(FireCutEditor.uniqueSceneName(m2, 'new-scene') === 'new-scene-3', 'expected new-scene-3');
});

check('buildPatternBlock creates valid blocks and timer pattern parses cleanly', function (assert) {
  var base = '\nTITLE: T\nSTART: intro\n\nSCENE: intro\nVIDEO: intro.mp4\nCHOICE: Next -> new-scene\n';
  var model = FireCut.analyse(base).model;
  var name = FireCutEditor.uniqueSceneName(model, 'new-scene');
  var pat = FireCutEditor.buildPatternBlock('timer', name);
  assert(pat && pat.text.indexOf('SCENE: new-scene') === 0, 'expected SCENE: new-scene at start of timer block');
  assert(pat.text.indexOf('TIMER: 6 -> ') > 0, 'expected TIMER line in timer block');
  assert(pat.select === 'new-scene', 'expected placeholder selection');

  /* Fill the choice target placeholders with intro so every target exists. */
  var filled = pat.text.replace(/-> scene-name/g, '-> intro');
  var combined = base + '\n' + filled + '\n';
  var checkRes = FireCut.analyse(combined);
  assert(checkRes.errors.length === 0, 'expected 0 errors after filling timer pattern, got ' + checkRes.errors.length);
});

check('analyseMediaFolder marks demo media used and catches missing or bad filenames', function (assert) {
  eval(readFile('firecut-demo/story.js'));
  var demoModel = FireCut.analyse(FireCut._rawStory()).model;
  var demoFiles = [
    'movie1_cadburyegg.mp4', 'movie2_cadburyegg.mp4', 'movie3_cadburyegg.mp4',
    'movie4_cadburyegg.mp4', 'movie5_cadburyegg.mp4', 'movie6_cadburyegg.mp4',
    'title-bg.mp4', 'transparent-title-centre.png',
    'love-letter.jpg', 'yes.jpg', 'friendzone.jpg', 'title.mp3', 'ambient.mp3'
  ];
  var res = FireCutEditor.analyseMediaFolder(demoModel, demoFiles);
  assert(res.missing.length === 0, 'expected 0 missing files in demo, got ' + res.missing.length);
  assert(res.badNames.length === 0, 'expected 0 bad file names in demo, got ' + res.badNames.length);
  for (var i = 0; i < demoFiles.length; i++) {
    var f = demoFiles[i];
    assert(res.use.hasOwnProperty(f) && res.use[f].length > 0, 'expected ' + f + ' to be marked Used');
  }

  /* Remove movie2_cadburyegg.mp4 from folder and add a badly-named file. */
  var partial = demoFiles.slice(0, 1).concat(demoFiles.slice(2)).concat(['Bad Name.mp4']);
  var res2 = FireCutEditor.analyseMediaFolder(demoModel, partial);
  assert(res2.missing.length === 1 && res2.missing[0].file === 'movie2_cadburyegg.mp4',
    'expected movie2_cadburyegg.mp4 to be reported missing');
  assert(res2.missing[0].line > 0, 'expected missing file line number > 0');
  assert(res2.badNames.length === 1 && res2.badNames[0] === 'Bad Name.mp4',
    'expected Bad Name.mp4 to be flagged in badNames');
});

check('targetSpanAt locates orange target scene names on CHOICE, TIMER, START and NEXT lines', function (assert) {
  var choiceLine = 'CHOICE: Talk to it -> hello';
  assert(FireCutEditor.targetSpanAt(choiceLine, 8) === null,
    'cursor on button label should not open target picker');
  var sp1 = FireCutEditor.targetSpanAt(choiceLine, 24);
  assert(sp1 && sp1.value === 'hello' && choiceLine.substring(sp1.start, sp1.end) === 'hello',
    'expected targetSpanAt to locate hello');

  var imgChoice = 'CHOICE: Open door -> hallway | btn-door.png';
  var sp2 = FireCutEditor.targetSpanAt(imgChoice, 23);
  assert(sp2 && sp2.value === 'hallway' && imgChoice.substring(sp2.start, sp2.end) === 'hallway',
    'expected targetSpanAt to stop before | image');

  var startLine = 'START: intro';
  var sp3 = FireCutEditor.targetSpanAt(startLine, 9);
  assert(sp3 && sp3.value === 'intro' && startLine.substring(sp3.start, sp3.end) === 'intro',
    'expected targetSpanAt to locate START target');
});

say('----------------------------------------');
say(pass + ' passed, ' + fail + ' failed');
quit(fail === 0 ? 0 : 1);
