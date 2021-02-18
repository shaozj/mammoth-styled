'use strict';

const path = require('path');
const fs = require('fs');
const assert = require('assert');

const promises = require('../../lib/promises');
const Files = require('../../lib/docx/files').Files;
const uriToPath = require('../../lib/docx/files').uriToPath;

const testing = require('../testing');


const readFile = promises.promisify(fs.readFile.bind(fs));


describe('Files', function() {
  it('can open files with file URI', function() {
    const filePath = path.resolve(testing.testPath('tiny-picture.png'));
    const files = new Files(null);
    return files.read('file:///' + filePath.replace(/^\//, ''), 'base64').then(function(contents) {
      return readFile(filePath, 'base64').then(function(expectedContents) {
        assert.deepStrictEqual(contents, expectedContents);
      });
    });
  });

  it('can open files with relative URI', function() {
    const filePath = path.resolve(testing.testPath('tiny-picture.png'));
    const files = new Files(testing.testPath('.'));
    return files.read('tiny-picture.png', 'base64').then(function(contents) {
      return readFile(filePath, 'base64').then(function(expectedContents) {
        assert.deepStrictEqual(contents, expectedContents);
      });
    });
  });

  it('given base is not set when opening relative uri then error is raised', function() {
    const files = new Files(null);
    return assertError(files.read('not-a-real-file.png', 'base64'), function(err) {
      assert.strictEqual(err.message, "could not find external image 'not-a-real-file.png', path of input document is unknown");
    });
  });

  it('error if relative uri cannot be opened', function() {
    const files = new Files('/tmp');
    return assertError(files.read('not-a-real-file.png', 'base64'), function(err) {
      assertRegex(err.message, /could not open external image: 'not-a-real-file.png' \(document directory: '\/tmp'\)\nENOENT.*\/tmp\/not-a-real-file.png.*/);
    });
  });
});

function assertError(promise, func) {
  return promise.then(function() {
    assert(false, 'Expected error');
  }, func);
}

function assertRegex(actual, expected) {
  assert.ok(expected.test(actual), 'Expected regex: ' + expected + '\nbut was: ' + actual);
}


describe('uriToPath', function() {
  it('leading slash is retained on non-Windows file URIs', function() {
    assert.strictEqual(uriToPath('file:///a/b/c', 'linux'), '/a/b/c');
    assert.strictEqual(uriToPath('file:///a/b/c', 'win32'), '/a/b/c');
  });

  it('URI is unquoted', function() {
    assert.strictEqual(uriToPath('file:///a%20b'), '/a b');
  });

  it('when host is set to localhost then path can be found', function() {
    assert.strictEqual(uriToPath('file://localhost/a/b/c'), '/a/b/c');
  });

  it('when host is set but not localhost then path cannot be found', function() {
    assert.throws(function() {
      uriToPath('file://example/a/b/c');
    }, /Could not convert URI to path: file:\/\/example\/a\/b\/c/);
  });

  it('leading slash is not dropped on Windows file URIs when platform is not Windows', function() {
    assert.strictEqual(uriToPath('file:///c:/a', 'linux'), '/c:/a');
  });

  it('leading slash is dropped on Windows file URIs when platform is Windows', function() {
    assert.strictEqual(uriToPath('file:///c:/a', 'win32'), 'c:/a');
    assert.strictEqual(uriToPath('file:///C:/a', 'win32'), 'C:/a');
  });

  it('relative URI is unquoted', function() {
    assert.strictEqual(uriToPath('a%20b/c'), 'a b/c');
  });
});
