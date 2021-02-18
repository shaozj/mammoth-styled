'use strict';

const assert = require('assert');

const hamjest = require('hamjest');
const assertThat = hamjest.assertThat;
const contains = hamjest.contains;
const hasProperties = hamjest.hasProperties;

const mammoth = require('../');
const documents = require('../lib/documents');
const promises = require('../lib/promises');


it('mammoth.images.inline() should be an alias of mammoth.images.imgElement()', function() {
  assert.ok(mammoth.images.inline === mammoth.images.imgElement);
});


it('mammoth.images.dataUri() encodes images in base64', function() {
  const imageBuffer = Buffer.from('abc');
  const image = new documents.Image({
    readImage(encoding) {
      return promises.when(imageBuffer.toString(encoding));
    },
    contentType: 'image/jpeg',
  });

  return mammoth.images.dataUri(image).then(function(result) {
    assertThat(result, contains(
      hasProperties({ tag: hasProperties({ attributes: { src: 'data:image/jpeg;base64,YWJj' } }) })
    ));
  });
});
