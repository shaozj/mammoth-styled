'use strict';

const fs = require('fs');
const assert = require('assert');
const path = require('path');


const unzip = require('../lib/unzip');
const promises = require('../lib/promises');

it('unzip fails if given empty object', function() {
  return unzip.openZip({}).then(function() {
    assert.ok(false, 'Expected failure');
  }, function(error) {
    assert.strictEqual('Could not find file in options', error.message);
  });
});

it('unzip can open local zip file', function() {
  const zipPath = path.join(__dirname, 'test-data/hello.zip');
  return unzip.openZip({ path: zipPath }).then(function(zipFile) {
    return zipFile.read('hello', 'utf8');
  }).then(function(contents) {
    assert.strictEqual(contents, 'Hello world\n');
  });
});

it('unzip can open Buffer', function() {
  const zipPath = path.join(__dirname, 'test-data/hello.zip');
  return promises.nfcall(fs.readFile, zipPath)
    .then(function(buffer) {
      return unzip.openZip({ buffer });
    })
    .then(function(zipFile) {
      return zipFile.read('hello', 'utf8');
    })
    .then(function(contents) {
      assert.strictEqual(contents, 'Hello world\n');
    });
});
