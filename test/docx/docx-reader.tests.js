'use strict';

const assert = require('assert');

const docxReader = require('../../lib/docx/docx-reader');
const documents = require('../../lib/documents');
const xml = require('../../lib/xml');

const testing = require('../testing');

const testData = testing.testData;
const createFakeDocxFile = testing.createFakeDocxFile;


it('can read document with single paragraph with single run of text', function() {
  const expectedDocument = documents.Document([
    documents.Paragraph([
      documents.Run([
        documents.Text('Hello.'),
      ]),
    ]),
  ]);
  const docxFile = createFakeDocxFile({
    'word/document.xml': testData('simple/word/document.xml'),
  });
  return docxReader.read(docxFile).then(function(result) {
    assert.deepStrictEqual(expectedDocument, result.value);
  });
});

it('hyperlink hrefs are read from relationships file', function() {
  const docxFile = createFakeDocxFile({
    'word/document.xml': testData('hyperlinks/word/document.xml'),
    'word/_rels/document.xml.rels': testData('hyperlinks/word/_rels/document.xml.rels'),
  });
  return docxReader.read(docxFile).then(function(result) {
    const paragraph = result.value.children[0];
    assert.strictEqual(1, paragraph.children.length);
    const hyperlink = paragraph.children[0];
    assert.strictEqual(hyperlink.href, 'http://www.example.com');
    assert.strictEqual(hyperlink.children.length, 1);
  });
});

const relationshipNamespaces = {
  r: 'http://schemas.openxmlformats.org/package/2006/relationships',
};

it('main document is found using _rels/.rels', function() {
  const relationships = xml.element('r:Relationships', {}, [
    xml.element('r:Relationship', {
      Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
      Target: '/word/document2.xml',
    }),
  ]);

  const docxFile = createFakeDocxFile({
    'word/document2.xml': testData('simple/word/document.xml'),
    '_rels/.rels': xml.writeString(relationships, relationshipNamespaces),
  });
  const expectedDocument = documents.Document([
    documents.Paragraph([
      documents.Run([
        documents.Text('Hello.'),
      ]),
    ]),
  ]);
  return docxReader.read(docxFile).then(function(result) {
    assert.deepStrictEqual(expectedDocument, result.value);
  });
});


it('error is thrown when main document part does not exist', function() {
  const relationships = xml.element('r:Relationships', {}, [
    xml.element('r:Relationship', {
      Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
      Target: '/word/document2.xml',
    }),
  ]);

  const docxFile = createFakeDocxFile({
    '_rels/.rels': xml.writeString(relationships, relationshipNamespaces),
  });
  return docxReader.read(docxFile).then(function() {
    assert.ok(false, 'Expected error');
  }, function(error) {
    assert.strictEqual(error.message, 'Could not find main document part. Are you sure this is a valid .docx file?');
  });
});


describe('part paths', function() {
  it('main document part is found using package relationships', function() {
    const relationships = xml.element('r:Relationships', {}, [
      xml.element('r:Relationship', {
        Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
        Target: '/word/document2.xml',
      }),
    ]);

    const docxFile = createFakeDocxFile({
      'word/document2.xml': ' ',
      '_rels/.rels': xml.writeString(relationships, relationshipNamespaces),
    });
    return docxReader._findPartPaths(docxFile).then(function(partPaths) {
      assert.strictEqual(partPaths.mainDocument, 'word/document2.xml');
    });
  });

  it('word/document.xml is used as fallback location for main document part', function() {
    const docxFile = createFakeDocxFile({
      'word/document.xml': ' ',
    });
    return docxReader._findPartPaths(docxFile).then(function(partPaths) {
      assert.strictEqual(partPaths.mainDocument, 'word/document.xml');
    });
  });
});

[
  {
    name: 'comments',
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
  },
  {
    name: 'endnotes',
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes',
  },
  {
    name: 'footnotes',
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes',
  },
  {
    name: 'numbering',
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',
  },
  {
    name: 'styles',
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  },
].forEach(function(options) {
  it(options.name + ' part is found using main document relationships', function() {
    const docxFile = createFakeDocxFile({
      '_rels/.rels': createPackageRelationships('word/document.xml'),
      'word/document.xml': ' ',
      'word/_rels/document.xml.rels': xml.writeString(xml.element('r:Relationships', {}, [
        xml.element('r:Relationship', {
          Type: options.type,
          Target: 'target-path.xml',
        }),
      ]), relationshipNamespaces),
      'word/target-path.xml': ' ',
    });
    return docxReader._findPartPaths(docxFile).then(function(partPaths) {
      assert.strictEqual(partPaths[options.name], 'word/target-path.xml');
    });
  });

  it('word/' + options.name + '.xml is used as fallback location for ' + options.name + ' part', function() {
    const zipContents = {
      '_rels/.rels': createPackageRelationships('word/document.xml'),
      'word/document.xml': ' ',
    };
    zipContents['word/' + options.name + '.xml'] = ' ';
    const docxFile = createFakeDocxFile(zipContents);
    return docxReader._findPartPaths(docxFile).then(function(partPaths) {
      assert.strictEqual(partPaths[options.name], 'word/' + options.name + '.xml');
    });
  });
});


function createPackageRelationships(mainDocumentPath) {
  return xml.writeString(xml.element('r:Relationships', {}, [
    xml.element('r:Relationship', {
      Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
      Target: mainDocumentPath,
    }),
  ]), relationshipNamespaces);
}
