/* FireCut parser test harness - run under Windows Script Host:
 *     cscript //Nologo tests\run-check-tests.js
 * Reads the real engine file and the shared fixtures, then checks every
 * expected error and warning (type, line number, message substring).
 */

function readFile(path) {
  var fso = new ActiveXObject('Scripting.FileSystemObject');
  var f = fso.OpenTextFile(path, 1);
  var s = f.ReadAll();
  f.Close();
  return s;
}

/* Forward slashes: FSO on some OneDrive-synced machines fails oddly
   when resolving backslash paths. */
eval(readFile('tests/stories.js'));
eval(readFile('firecut-template/firecut/firecut.js'));

function findMsg(list, line, has) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].line === line && list[i].text.indexOf(has) >= 0) {
      return true;
    }
  }
  return false;
}

var pass = 0, fail = 0;

for (var t = 0; t < TEST_STORIES.length; t++) {
  var fix = TEST_STORIES[t];
  var out = FireCut.analyse(fix.text);
  var problems = [];

  /* Expected items must be present. */
  var i;
  for (i = 0; i < (fix.errors || []).length; i++) {
    if (!findMsg(out.errors, fix.errors[i].line, fix.errors[i].has)) {
      problems.push('missing expected error line ' + fix.errors[i].line +
        ' containing "' + fix.errors[i].has + '"');
    }
  }
  for (i = 0; i < (fix.warnings || []).length; i++) {
    if (!findMsg(out.warnings, fix.warnings[i].line, fix.warnings[i].has)) {
      problems.push('missing expected warning line ' + fix.warnings[i].line +
        ' containing "' + fix.warnings[i].has + '"');
    }
  }

  /* Counts must match exactly so surprise errors get caught. */
  var eCount = (fix.errors || []).length;
  var wCount = (fix.warnings || []).length;
  if (out.errors.length !== countUnique(out.errors)) { /* noop */ }
  if (out.errors.length !== eCount) {
    problems.push('expected ' + eCount + ' error(s), got ' + out.errors.length);
  }
  if (out.warnings.length !== wCount) {
    problems.push('expected ' + wCount + ' warning(s), got ' + out.warnings.length);
  }

  if (problems.length === 0) {
    pass++;
    WScript.Echo('PASS  ' + fix.name);
  } else {
    fail++;
    WScript.Echo('FAIL  ' + fix.name);
    for (i = 0; i < problems.length; i++) {
      WScript.Echo('        ' + problems[i]);
    }
    WScript.Echo('        actual errors:');
    for (i = 0; i < out.errors.length; i++) {
      WScript.Echo('          ' + out.errors[i].text);
    }
    WScript.Echo('        actual warnings:');
    for (i = 0; i < out.warnings.length; i++) {
      WScript.Echo('          ' + out.warnings[i].text);
    }
  }
}

function countUnique(list) { return list.length; }

WScript.Echo('----------------------------------------');
WScript.Echo(pass + ' passed, ' + fail + ' failed');
WScript.Quit(fail === 0 ? 0 : 1);
