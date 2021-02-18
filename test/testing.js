'use strict';

const path = require('path');
const fs = require('fs');
const promises = require('../lib/promises');
const _ = require('underscore');

exports.testPath = testPath;
exports.testData = testData;
exports.createFakeDocxFile = createFakeDocxFile;
exports.createFakeFiles = createFakeFiles;


function testPath(filename) {
  return path.join(__dirname, 'test-data', filename);
}

function testData(testDataPath) {
  const fullPath = testPath(testDataPath);
  return promises.nfcall(fs.readFile, fullPath, 'utf-8');
}

function createFakeDocxFile(files) {
  function exists(path) {
    return !!files[path];
  }

  return {
    read: createRead(files),
    exists,
  };
}

function createFakeFiles(files) {
  return {
    read: createRead(files),
  };
}

function createRead(files) {
  function read(path, encoding) {
    return promises.when(files[path], function(buffer) {
      if (_.isString(buffer)) {
        buffer = Buffer.from(buffer);
      }

      if (!Buffer.isBuffer(buffer)) {
        return promises.reject(new Error('file was not a buffer'));
      } else if (encoding) {
        return promises.when(buffer.toString(encoding));
      }
      return promises.when(buffer);

    });
  }
  return read;
}
