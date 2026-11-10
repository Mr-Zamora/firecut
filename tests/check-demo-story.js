// Validate the real story.js files from the template and demo folders.
// Run: cscript //E:jscript //Nologo tests/check-demo-story.js
function readFile(path) {
  var fso = new ActiveXObject('Scripting.FileSystemObject');
  var f = fso.OpenTextFile(path, 1);
  var s = f.ReadAll();
  f.Close();
  return s;
}
eval(readFile('firecut-template/firecut/firecut.js'));

var files = ['firecut-template/story.js', 'firecut-demo/story.js'];
var bad = 0;
for (var i = 0; i < files.length; i++) {
  var src = readFile(files[i]);
  var m = /FireCut\.story\s*\(\s*`([\s\S]*)`\s*\)/.exec(src);
  if (!m) { WScript.Echo('FAIL  ' + files[i] + ' - could not extract story'); bad++; continue; }
  var out = FireCut.analyse(m[1]);
  WScript.Echo(files[i] + ': ' + out.errors.length + ' errors, ' + out.warnings.length + ' warnings');
  for (var j = 0; j < out.errors.length; j++) { WScript.Echo('  ' + out.errors[j].text); }
  for (var j = 0; j < out.warnings.length; j++) { WScript.Echo('  ' + out.warnings[j].text); }
  if (out.errors.length > 0) { bad++; }
}
WScript.Quit(bad);
