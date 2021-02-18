'use strict';

const assert = require('assert');

const JSZip = require('jszip');

const zipfile = require('../../lib/zipfile');
const styleMap = require('../../lib/docx/style-map');


const expectedRelationshipsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
    '<Relationship Id="rMammothStyleMap" Type="http://schemas.zwobble.org/mammoth/style-map" Target="/mammoth/style-map"/>' +
    '</Relationships>';

const expectedContentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Override PartName="/mammoth/style-map" ContentType="text/prs.mammoth.style-map"/>' +
    '</Types>';


it('reading embedded style map on document without embedded style map returns null', function() {
  const zip = normalDocx();

  return styleMap.readStyleMap(zip).then(function(contents) {
    assert.strictEqual(contents, null);
  });
});

it('embedded style map can be read after being written', function() {
  const zip = normalDocx();

  return styleMap.writeStyleMap(zip, 'p => h1').then(function() {
    return styleMap.readStyleMap(zip).then(function(contents) {
      assert.strictEqual(contents, 'p => h1');
    });
  });
});

it('embedded style map is written to separate file', function() {
  const zip = normalDocx();

  return styleMap.writeStyleMap(zip, 'p => h1').then(function() {
    return zip.read('mammoth/style-map', 'utf8').then(function(contents) {
      assert.strictEqual(contents, 'p => h1');
    });
  });
});

it('embedded style map is referenced in relationships', function() {
  const zip = normalDocx();

  return styleMap.writeStyleMap(zip, 'p => h1').then(function() {
    return zip.read('word/_rels/document.xml.rels', 'utf8').then(function(contents) {
      assert.strictEqual(contents, expectedRelationshipsXml);
    });
  });
});

it('re-embedding style map replaces original', function() {
  const zip = normalDocx();

  return styleMap.writeStyleMap(zip, 'p => h1').then(function() {
    return styleMap.writeStyleMap(zip, 'p => h2');
  }).then(function() {
    return zip.read('word/_rels/document.xml.rels', 'utf8').then(function(contents) {
      assert.strictEqual(contents, expectedRelationshipsXml);
    });
  })
    .then(function() {
      return styleMap.readStyleMap(zip).then(function(contents) {
        assert.strictEqual(contents, 'p => h2');
      });
    });
});

it('embedded style map has override content type in [Content_Types].xml', function() {
  const zip = normalDocx();

  return styleMap.writeStyleMap(zip, 'p => h1').then(function() {
    return zip.read('[Content_Types].xml', 'utf8').then(function(contents) {
      assert.strictEqual(contents, expectedContentTypesXml);
    });
  });
});

it('replacing style map keeps content type', function() {
  const zip = normalDocx();

  return styleMap.writeStyleMap(zip, 'p => h1').then(function() {
    return styleMap.writeStyleMap(zip, 'p => h2');
  }).then(function() {
    return zip.read('[Content_Types].xml', 'utf8').then(function(contents) {
      assert.strictEqual(contents, expectedContentTypesXml);
    });
  });
});

function normalDocx() {
  const zip = new JSZip();
  const originalRelationshipsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
        '</Relationships>';
  const originalContentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="png" ContentType="image/png"/>' +
        '</Types>';
  zip.file('word/_rels/document.xml.rels', originalRelationshipsXml);
  zip.file('[Content_Types].xml', originalContentTypesXml);
  const buffer = zip.generate({ type: 'arraybuffer' });
  return zipfile.openArrayBuffer(buffer);
}

