'use strict';

const assert = require('assert');
const child_process = require('child_process'); // eslint-disable-line camelcase
const path = require('path');
const fs = require('fs');

const temp = require('temp').track();

const promises = require('../lib/promises');

const testPath = require('./testing').testPath;

it('HTML is printed to stdout if output file is not set', function() {
  return runMammoth(testPath('single-paragraph.docx')).then(function(result) {
    assert.strictEqual(result.stderrOutput, '');
    assert.strictEqual(result.output, '<p>Walking on imported air</p>');
  });
});

it('HTML is written to file if output file is set', function() {
  return createTempDir().then(function(tempDir) {
    const outputPath = path.join(tempDir, 'output.html');
    return runMammoth(testPath('single-paragraph.docx'), outputPath).then(function(result) {
      assert.strictEqual(result.stderrOutput, '');
      assert.strictEqual(result.output, '');
      assert.strictEqual(fs.readFileSync(outputPath, 'utf8'), '<p>Walking on imported air</p>');
    });
  });
});

const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAAXNSR0IArs4c6QAAAAlwSFlzAAAOvgAADr4B6kKxwAAAABNJREFUKFNj/M+ADzDhlWUYqdIAQSwBE8U+X40AAAAASUVORK5CYII=';

it('inline images are included in output if writing to single file', function() {
  return runMammoth(testPath('tiny-picture.docx')).then(function(result) {
    assert.strictEqual(result.stderrOutput, '');
    assert.strictEqual(result.output, '<p><img src="data:image/png;base64,' + imageBase64 + '" /></p>');
  });
});

it('images are written to separate files if output dir is set', function() {
  return createTempDir().then(function(tempDir) {
    const outputPath = path.join(tempDir, 'tiny-picture.html');
    const imagePath = path.join(tempDir, '1.png');
    return runMammoth(testPath('tiny-picture.docx'), '--output-dir', tempDir).then(function(result) {
      assert.strictEqual(result.stderrOutput, '');
      assert.strictEqual(result.output, '');
      assert.strictEqual(fs.readFileSync(outputPath, 'utf8'), '<p><img src="1.png" /></p>');
      assert.strictEqual(fs.readFileSync(imagePath, 'base64'), imageBase64);
    });
  });
});

it('style map is used if set', function() {
  return createTempDir().then(function(tempDir) {
    const styleMapPath = path.join(tempDir, 'style-map');
    fs.writeFileSync(styleMapPath, 'p => span:fresh');
    return runMammoth(testPath('single-paragraph.docx'), '--style-map', styleMapPath).then(function(result) {
      assert.strictEqual(result.stderrOutput, '');
      assert.strictEqual(result.output, '<span>Walking on imported air</span>');
    });
  });
});

it('--output-format=markdown option generate markdown output', function() {
  return runMammoth(testPath('single-paragraph.docx'), '--output-format=markdown').then(function(result) {
    assert.strictEqual(result.stderrOutput, '');
    assert.strictEqual(result.output, 'Walking on imported air\n\n');
  });
});


function runMammoth() {
  const args = Array.prototype.slice.call(arguments, 0);
  const deferred = promises.defer();

  const processArgs = [ 'node', 'bin/mammoth' ].concat(args);
  // TODO: proper escaping of args
  const command = processArgs.join(' ');
  child_process.exec(command, function(error, stdout, stderr) { // eslint-disable-line camelcase
    console.log(stderr); // eslint-disable-line no-console
    assert.strictEqual(error, null);
    deferred.resolve({ output: stdout, stderrOutput: stderr });
  });

  return deferred.promise;
}

function createTempDir() {
  return promises.nfcall(temp.mkdir, null);
}
