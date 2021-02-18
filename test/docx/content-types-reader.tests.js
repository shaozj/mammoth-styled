'use strict';

const assert = require('assert');

const readContentTypesFromXml = require('../../lib/docx/content-types-reader').readContentTypesFromXml;
const XmlElement = require('../../lib/xml').Element;


it('reads default-per-extension from XML', function() {
  const contentTypes = readContentTypesFromXml(
    new XmlElement('content-types:Types', {}, [
      new XmlElement('content-types:Default', { Extension: 'png', ContentType: 'image/png' }),
    ])
  );
  assert.strictEqual(contentTypes.findContentType('word/media/hat.png'), 'image/png');
});

it('reads overrides in preference to defaults', function() {
  const contentTypes = readContentTypesFromXml(
    new XmlElement('content-types:Types', {}, [
      new XmlElement('content-types:Default', { Extension: 'png', ContentType: 'image/png' }),
      new XmlElement('content-types:Override', { PartName: '/word/media/hat.png', ContentType: 'image/hat' }),
    ])
  );
  assert.strictEqual(contentTypes.findContentType('word/media/hat.png'), 'image/hat');
});

it('fallback content types have common image types', function() {
  const contentTypes = readContentTypesFromXml(
    new XmlElement('content-types:Types', {}, [])
  );
  assert.strictEqual(contentTypes.findContentType('word/media/hat.png'), 'image/png');
  assert.strictEqual(contentTypes.findContentType('word/media/hat.gif'), 'image/gif');
  assert.strictEqual(contentTypes.findContentType('word/media/hat.jpg'), 'image/jpeg');
  assert.strictEqual(contentTypes.findContentType('word/media/hat.jpeg'), 'image/jpeg');
  assert.strictEqual(contentTypes.findContentType('word/media/hat.bmp'), 'image/bmp');
  assert.strictEqual(contentTypes.findContentType('word/media/hat.tif'), 'image/tiff');
  assert.strictEqual(contentTypes.findContentType('word/media/hat.tiff'), 'image/tiff');
});

it('fallback content types are case insensitive on extension', function() {
  const contentTypes = readContentTypesFromXml(
    new XmlElement('content-types:Types', {}, [])
  );
  assert.strictEqual(contentTypes.findContentType('word/media/hat.PnG'), 'image/png');
});
