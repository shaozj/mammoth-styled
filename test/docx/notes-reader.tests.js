'use strict';

const assert = require('assert');

const createFootnotesReader = require('../../lib/docx/notes-reader').createFootnotesReader;
const createBodyReader = require('../../lib/docx/body-reader').createBodyReader;
const documents = require('../../lib/documents');
const XmlElement = require('../../lib/xml').Element;


it('ID and body of footnote are read', function() {
  const bodyReader = new createBodyReader({});
  const footnoteBody = [ new XmlElement('w:p', {}, []) ];
  const footnotes = createFootnotesReader(bodyReader)(
    new XmlElement('w:footnotes', {}, [
      new XmlElement('w:footnote', { 'w:id': '1' }, footnoteBody),
    ])
  );
  assert.strictEqual(footnotes.value.length, 1);
  assert.deepStrictEqual(footnotes.value[0].body, [ new documents.Paragraph([]) ]);
  assert.deepStrictEqual(footnotes.value[0].noteId, '1');
});

footnoteTypeIsIgnored('continuationSeparator');
footnoteTypeIsIgnored('separator');

function footnoteTypeIsIgnored(type) {
  it('footnotes of type ' + type + ' are ignored', function() {
    const footnotes = createFootnotesReader()(
      new XmlElement('w:footnotes', {}, [
        new XmlElement('w:footnote', { 'w:id': '1', 'w:type': type }, []),
      ])
    );
    assert.strictEqual(footnotes.value.length, 0);
  });
}
