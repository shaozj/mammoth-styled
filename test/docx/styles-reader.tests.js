'use strict';

const assert = require('assert');

const readStylesXml = require('../../lib/docx/styles-reader').readStylesXml;
const XmlElement = require('../../lib/xml').Element;


it('paragraph style is undefined if no style with that ID exists', function() {
  const styles = readStylesXml(
    new XmlElement('w:styles', {}, [])
  );
  assert.strictEqual(styles.findParagraphStyleById('Heading1'), undefined);
});

it('paragraph style can be found by ID', function() {
  const styles = readStylesXml(
    new XmlElement('w:styles', {}, [
      paragraphStyleElement('Heading1', 'Heading 1'),
    ])
  );
  assert.strictEqual(styles.findParagraphStyleById('Heading1').styleId, 'Heading1');
});

it('table style can be found by ID', function() {
  const styles = readStylesXml(
    new XmlElement('w:styles', {}, [
      tableStyleElement('TableNormal', 'Normal Table'),
    ])
  );
  assert.strictEqual(styles.findTableStyleById('TableNormal').styleId, 'TableNormal');
});

it('character style can be found by ID', function() {
  const styles = readStylesXml(
    new XmlElement('w:styles', {}, [
      characterStyleElement('Heading1Char', 'Heading 1 Char'),
    ])
  );
  assert.strictEqual(styles.findCharacterStyleById('Heading1Char').styleId, 'Heading1Char');
});

it('paragraph and character styles are distinct', function() {
  const styles = readStylesXml(
    new XmlElement('w:styles', {}, [
      paragraphStyleElement('Heading1', 'Heading 1'),
      characterStyleElement('Heading1Char', 'Heading 1 Char'),
    ])
  );
  assert.strictEqual(styles.findCharacterStyleById('Heading1'), undefined);
  assert.strictEqual(styles.findParagraphStyleById('Heading1Char'), undefined);
});

it('character and table styles are distinct', function() {
  const styles = readStylesXml(
    new XmlElement('w:styles', {}, [
      tableStyleElement('Heading1', 'Heading 1'),
    ])
  );
  assert.strictEqual(styles.findCharacterStyleById('Heading1'), undefined);
});

it('styles include names', function() {
  const styles = readStylesXml(
    new XmlElement('w:styles', {}, [
      paragraphStyleElement('Heading1', 'Heading 1'),
    ])
  );
  assert.strictEqual(styles.findParagraphStyleById('Heading1').name, 'Heading 1');
});

it('style name is undefined if w:name element does not exist', function() {
  const styles = readStylesXml(
    new XmlElement('w:styles', {}, [
      styleWithoutWNameElement('paragraph', 'Heading1'),
      styleWithoutWNameElement('character', 'Heading1Char'),
    ])
  );
  assert.strictEqual(styles.findParagraphStyleById('Heading1').name, null);
  assert.strictEqual(styles.findCharacterStyleById('Heading1Char').name, null);
});

it('numbering style is undefined if no style with that ID exists', function() {
  const styles = readStylesXml(
    new XmlElement('w:styles', {}, [])
  );
  assert.strictEqual(styles.findNumberingStyleById('List1'), undefined);
});

it('numbering style has undefined numId if style has no paragraph properties', function() {
  const styles = readStylesXml(
    new XmlElement('w:styles', {}, [
      new XmlElement('w:style', { 'w:type': 'numbering', 'w:styleId': 'List1' }),
    ])
  );
  assert.strictEqual(styles.findNumberingStyleById('List1').numId, undefined);
});

it('numbering style has numId read from paragraph properties', function() {
  const styles = readStylesXml(
    new XmlElement('w:styles', {}, [
      new XmlElement('w:style', { 'w:type': 'numbering', 'w:styleId': 'List1' }, [
        new XmlElement('w:pPr', {}, [
          new XmlElement('w:numPr', {}, [
            new XmlElement('w:numId', { 'w:val': '42' }),
          ]),
        ]),
      ]),
    ])
  );
  assert.strictEqual(styles.findNumberingStyleById('List1').numId, '42');
});

function paragraphStyleElement(id, name) {
  return styleElement('paragraph', id, name);
}

function characterStyleElement(id, name) {
  return styleElement('character', id, name);
}

function tableStyleElement(id, name) {
  return styleElement('table', id, name);
}

function styleElement(type, id, name) {
  return new XmlElement('w:style', { 'w:type': type, 'w:styleId': id }, [
    new XmlElement('w:name', { 'w:val': name }, []),
  ]);
}

function styleWithoutWNameElement(type, id) {
  return new XmlElement('w:style', { 'w:type': type, 'w:styleId': id }, []);
}
