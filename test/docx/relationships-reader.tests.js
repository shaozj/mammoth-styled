'use strict';

const assert = require('assert');

const readRelationships = require('../../lib/docx/relationships-reader').readRelationships;
const xml = require('../../lib/xml');


it('relationships can be found by ID', function() {
  const relationships = readRelationships(relationshipsElement([
    relationshipElement({
      Id: 'rId1',
      Target: 'http://example.com/',
      Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
    }),
    relationshipElement({
      Id: 'rId2',
      Target: 'http://example.net/',
      Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
    }),
  ]));
  assert.strictEqual(relationships.findTargetByRelationshipId('rId1'), 'http://example.com/');
});


it('relationships can be found by type', function() {
  const relationships = readRelationships(relationshipsElement([
    relationshipElement({
      Id: 'rId2',
      Target: 'docProps/core.xml',
      Type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
    }),
    relationshipElement({
      Id: 'rId1',
      Target: 'word/document.xml',
      Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
    }),
    relationshipElement({
      Id: 'rId3',
      Target: 'word/document2.xml',
      Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
    }),
  ]));
  assert.deepStrictEqual(
    relationships.findTargetsByType('http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'),
    [ 'word/document.xml', 'word/document2.xml' ]
  );
});


it('when there are no relationships of requested type then empty array is returned', function() {
  const relationships = readRelationships(relationshipsElement([]));
  assert.deepStrictEqual(
    relationships.findTargetsByType('http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'),
    []
  );
});


function relationshipsElement(children) {
  return xml.element('{http://schemas.openxmlformats.org/package/2006/relationships}Relationships', {}, children);
}

function relationshipElement(attributes) {
  return xml.element('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship', attributes, []);
}
