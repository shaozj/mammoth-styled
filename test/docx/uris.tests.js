'use strict';

const assert = require('assert');

const zipfile = require('../../lib/docx/uris');


describe('uriToZipEntryName', function() {
  it('when path does not have leading slash then path is resolved relative to base', function() {
    assert.strictEqual(
      zipfile.uriToZipEntryName('one/two', 'three/four'),
      'one/two/three/four'
    );
  });

  it('when path has leading slash then base is ignored', function() {
    assert.strictEqual(
      zipfile.uriToZipEntryName('one/two', '/three/four'),
      'three/four'
    );
  });
});

