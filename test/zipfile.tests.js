'use strict';

const assert = require('assert');

const JSZip = require('jszip');

const zipfile = require('../lib/zipfile');


it('file in zip can be read after being written', function() {
  const zip = emptyZipFile();
  assert(!zip.exists('song/title'));

  zip.write('song/title', 'Dark Blue');

  assert(zip.exists('song/title'));
  return zip.read('song/title', 'utf8').then(function(contents) {
    assert.strictEqual(contents, 'Dark Blue');
  });
});

function emptyZipFile() {
  const zip = new JSZip();
  const buffer = zip.generate({ type: 'arraybuffer' });
  return zipfile.openArrayBuffer(buffer);
}


it('splitPath splits zip paths on last forward slash', function() {
  assert.deepStrictEqual(zipfile.splitPath('a/b'), { dirname: 'a', basename: 'b' });
  assert.deepStrictEqual(zipfile.splitPath('a/b/c'), { dirname: 'a/b', basename: 'c' });
  assert.deepStrictEqual(zipfile.splitPath('/a/b/c'), { dirname: '/a/b', basename: 'c' });
});


it('when path has no forward slashes then splitPath returns empty dirname', function() {
  assert.deepStrictEqual(zipfile.splitPath('name'), { dirname: '', basename: 'name' });
});


it('joinPath joins arguments with forward slashes', function() {
  assert.strictEqual(zipfile.joinPath('a', 'b'), 'a/b');
  assert.strictEqual(zipfile.joinPath('a/b', 'c'), 'a/b/c');
  assert.strictEqual(zipfile.joinPath('a', 'b/c'), 'a/b/c');
  assert.strictEqual(zipfile.joinPath('/a/b', 'c'), '/a/b/c');
});


it('empty parts are ignored when joining paths', function() {
  assert.strictEqual(zipfile.joinPath('a', ''), 'a');
  assert.strictEqual(zipfile.joinPath('', 'b'), 'b');
  assert.strictEqual(zipfile.joinPath('a', '', 'b'), 'a/b');
});


it('when joining paths then absolute paths ignore earlier paths', function() {
  assert.strictEqual(zipfile.joinPath('a', '/b'), '/b');
  assert.strictEqual(zipfile.joinPath('a', '/b', 'c'), '/b/c');
  assert.strictEqual(zipfile.joinPath('/a', '/b'), '/b');
  assert.strictEqual(zipfile.joinPath('/a'), '/a');
});
