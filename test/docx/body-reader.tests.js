'use strict';

const assert = require('assert');
const path = require('path');

const _ = require('underscore');
const hamjest = require('hamjest');
const assertThat = hamjest.assertThat;
const promiseThat = hamjest.promiseThat;
const allOf = hamjest.allOf;
const contains = hamjest.contains;
const hasProperties = hamjest.hasProperties;
const willBe = hamjest.willBe;
const FeatureMatcher = hamjest.FeatureMatcher;

const documentMatchers = require('./document-matchers');
const isEmptyRun = documentMatchers.isEmptyRun;
const isHyperlink = documentMatchers.isHyperlink;
const isRun = documentMatchers.isRun;
const isText = documentMatchers.isText;
const isTable = documentMatchers.isTable;
const isRow = documentMatchers.isRow;

const createBodyReader = require('../../lib/docx/body-reader').createBodyReader;
const _readNumberingProperties = require('../../lib/docx/body-reader')._readNumberingProperties;
const documents = require('../../lib/documents');
const xml = require('../../lib/xml');
const XmlElement = xml.Element;
const defaultNumbering = require('../../lib/docx/numbering-xml').defaultNumbering;
const Relationships = require('../../lib/docx/relationships-reader').Relationships;
const Styles = require('../../lib/docx/styles-reader').Styles;
const warning = require('../../lib/results').warning;

const testing = require('../testing');

const createFakeDocxFile = testing.createFakeDocxFile;

function readXmlElement(element, options) {
  options = Object.create(options || {});
  options.styles = options.styles || new Styles({}, {});
  options.numbering = options.numbering || defaultNumbering;
  return createBodyReader(options).readXmlElement(element);
}

function readXmlElementValue(element, options) {
  const result = readXmlElement(element, options);
  assert.deepStrictEqual(result.messages, []);
  return result.value;
}

const fakeContentTypes = {
  findContentType(filePath) {
    const extensionTypes = {
      '.png': 'image/png',
      '.emf': 'image/x-emf',
    };
    return extensionTypes[path.extname(filePath)];
  },
};

it('paragraph has no style if it has no properties', function() {
  const paragraphXml = new XmlElement('w:p', {}, []);
  const paragraph = readXmlElementValue(paragraphXml);
  assert.deepStrictEqual(paragraph.styleId, null);
});

it('paragraph has style ID and name read from paragraph properties if present', function() {
  const styleXml = new XmlElement('w:pStyle', { 'w:val': 'Heading1' }, []);
  const propertiesXml = new XmlElement('w:pPr', {}, [ styleXml ]);
  const paragraphXml = new XmlElement('w:p', {}, [ propertiesXml ]);

  const styles = new Styles({ Heading1: { name: 'Heading 1' } }, {});

  const paragraph = readXmlElementValue(paragraphXml, { styles });
  assert.deepStrictEqual(paragraph.styleId, 'Heading1');
  assert.deepStrictEqual(paragraph.styleName, 'Heading 1');
});

it('warning is emitted when paragraph style cannot be found', function() {
  const styleXml = new XmlElement('w:pStyle', { 'w:val': 'Heading1' }, []);
  const propertiesXml = new XmlElement('w:pPr', {}, [ styleXml ]);
  const paragraphXml = new XmlElement('w:p', {}, [ propertiesXml ]);

  const styles = new Styles({}, {});

  const result = readXmlElement(paragraphXml, { styles });
  const paragraph = result.value;
  assert.deepStrictEqual(paragraph.styleId, 'Heading1');
  assert.deepStrictEqual(paragraph.styleName, null);
  assert.deepStrictEqual(result.messages, [ warning('Paragraph style with ID Heading1 was referenced but not defined in the document') ]);
});

it('paragraph has justification read from paragraph properties if present', function() {
  const justificationXml = new XmlElement('w:jc', { 'w:val': 'center' }, []);
  const propertiesXml = new XmlElement('w:pPr', {}, [ justificationXml ]);
  const paragraphXml = new XmlElement('w:p', {}, [ propertiesXml ]);
  const paragraph = readXmlElementValue(paragraphXml);
  assert.deepStrictEqual(paragraph.alignment, 'center');
});

describe('paragraph indent', () => {
  it('when w:start is set then start indent is read from w:start', function() {
    const paragraphXml = paragraphWithIndent({ 'w:start': '720', 'w:left': '40' });
    const paragraph = readXmlElementValue(paragraphXml);
    assert.strictEqual(paragraph.indent.start, '720');
  });

  it('when w:start is not set then start indent is read from w:left', function() {
    const paragraphXml = paragraphWithIndent({ 'w:left': '720' });
    const paragraph = readXmlElementValue(paragraphXml);
    assert.strictEqual(paragraph.indent.start, '720');
  });

  it('when w:end is set then end indent is read from w:end', function() {
    const paragraphXml = paragraphWithIndent({ 'w:end': '720', 'w:right': '40' });
    const paragraph = readXmlElementValue(paragraphXml);
    assert.strictEqual(paragraph.indent.end, '720');
  });

  it('when w:end is not set then end indent is read from w:right', function() {
    const paragraphXml = paragraphWithIndent({ 'w:right': '720' });
    const paragraph = readXmlElementValue(paragraphXml);
    assert.strictEqual(paragraph.indent.end, '720');
  });

  it('paragraph has indent firstLine read from paragraph properties if present', function() {
    const paragraphXml = paragraphWithIndent({ 'w:firstLine': '720' });
    const paragraph = readXmlElementValue(paragraphXml);
    assert.strictEqual(paragraph.indent.firstLine, '720');
  });

  it('paragraph has indent hanging read from paragraph properties if present', function() {
    const paragraphXml = paragraphWithIndent({ 'w:hanging': '720' });
    const paragraph = readXmlElementValue(paragraphXml);
    assert.strictEqual(paragraph.indent.hanging, '720');
  });

  it("when indent attributes aren't set then indents are null", function() {
    const paragraphXml = paragraphWithIndent({});
    const paragraph = readXmlElementValue(paragraphXml);
    assert.strictEqual(paragraph.indent.start, null);
    assert.strictEqual(paragraph.indent.end, null);
    assert.strictEqual(paragraph.indent.firstLine, null);
    assert.strictEqual(paragraph.indent.hanging, null);
  });
});

function paragraphWithIndent(indentAttributes) {
  const indentXml = new XmlElement('w:ind', indentAttributes, []);
  const propertiesXml = new XmlElement('w:pPr', {}, [ indentXml ]);
  return new XmlElement('w:p', {}, [ propertiesXml ]);
}

it('paragraph has numbering properties from paragraph properties if present', function() {
  const numberingPropertiesXml = new XmlElement('w:numPr', {}, [
    new XmlElement('w:ilvl', { 'w:val': '1' }),
    new XmlElement('w:numId', { 'w:val': '42' }),
  ]);
  const propertiesXml = new XmlElement('w:pPr', {}, [ numberingPropertiesXml ]);
  const paragraphXml = new XmlElement('w:p', {}, [ propertiesXml ]);

  const numbering = new NumberingMap({
    findLevel: { 42: { 1: { isOrdered: true, level: '1' } } },
  });

  const paragraph = readXmlElementValue(paragraphXml, { numbering });
  assert.deepStrictEqual(paragraph.numbering, { level: '1', isOrdered: true });
});

it('numbering on paragraph style takes precedence over numPr', function() {
  const numberingPropertiesXml = new XmlElement('w:numPr', {}, [
    new XmlElement('w:ilvl', { 'w:val': '1' }),
    new XmlElement('w:numId', { 'w:val': '42' }),
  ]);
  const propertiesXml = new XmlElement('w:pPr', {}, [
    new XmlElement('w:pStyle', { 'w:val': 'List' }),
    numberingPropertiesXml,
  ]);
  const paragraphXml = new XmlElement('w:p', {}, [ propertiesXml ]);

  const numbering = new NumberingMap({
    findLevelByParagraphStyleId: { List: { isOrdered: true, level: '1' } },
  });
  const styles = new Styles({ List: { name: 'List' } }, {});

  const paragraph = readXmlElementValue(paragraphXml, { numbering, styles });
  assert.deepStrictEqual(paragraph.numbering, { level: '1', isOrdered: true });
});

it('numbering properties are converted to numbering at specified level', function() {
  const numberingPropertiesXml = new XmlElement('w:numPr', {}, [
    new XmlElement('w:ilvl', { 'w:val': '1' }),
    new XmlElement('w:numId', { 'w:val': '42' }),
  ]);

  const numbering = new NumberingMap({
    findLevel: { 42: { 1: { isOrdered: true, level: '1' } } },
  });

  const numberingLevel = _readNumberingProperties(null, numberingPropertiesXml, numbering);
  assert.deepStrictEqual(numberingLevel, { level: '1', isOrdered: true });
});

it('numbering properties are ignored if w:ilvl is missing', function() {
  const numberingPropertiesXml = new XmlElement('w:numPr', {}, [
    new XmlElement('w:numId', { 'w:val': '42' }),
  ]);

  const numbering = new NumberingMap({
    findLevel: { 42: { 1: { isOrdered: true, level: '1' } } },
  });

  const numberingLevel = _readNumberingProperties(null, numberingPropertiesXml, numbering);
  assert.strictEqual(numberingLevel, null);
});

it('numbering properties are ignored if w:numId is missing', function() {
  const numberingPropertiesXml = new XmlElement('w:numPr', {}, [
    new XmlElement('w:ilvl', { 'w:val': '1' }),
  ]);

  const numbering = new NumberingMap({
    findLevel: { 42: { 1: { isOrdered: true, level: '1' } } },
  });

  const numberingLevel = _readNumberingProperties(null, numberingPropertiesXml, numbering);
  assert.strictEqual(numberingLevel, null);
});

describe('complex fields', function() {
  const uri = 'http://example.com';
  const beginXml = new XmlElement('w:r', {}, [
    new XmlElement('w:fldChar', { 'w:fldCharType': 'begin' }),
  ]);
  const endXml = new XmlElement('w:r', {}, [
    new XmlElement('w:fldChar', { 'w:fldCharType': 'end' }),
  ]);
  const separateXml = new XmlElement('w:r', {}, [
    new XmlElement('w:fldChar', { 'w:fldCharType': 'separate' }),
  ]);
  const hyperlinkInstrText = new XmlElement('w:instrText', {}, [
    xml.text(' HYPERLINK "' + uri + '"'),
  ]);
  const hyperlinkRunXml = runOfText('this is a hyperlink');

  const isEmptyHyperlinkedRun = isHyperlinkedRun({ children: [] });

  function isHyperlinkedRun(hyperlinkProperties) {
    return isRun({
      children: contains(
        isHyperlink(_.extend({ href: uri }, hyperlinkProperties))
      ),
    });
  }

  it('stores instrText returns empty result', function() {
    const instrText = readXmlElementValue(hyperlinkInstrText);
    assert.deepStrictEqual(instrText, []);
  });

  it('runs in a complex field for hyperlinks are read as hyperlinks', function() {
    const hyperlinkRunXml = runOfText('this is a hyperlink');
    const paragraphXml = new XmlElement('w:p', {}, [
      beginXml,
      hyperlinkInstrText,
      separateXml,
      hyperlinkRunXml,
      endXml,
    ]);
    const paragraph = readXmlElementValue(paragraphXml);

    assertThat(paragraph.children, contains(
      isEmptyRun,
      isEmptyHyperlinkedRun,
      isHyperlinkedRun({
        children: contains(
          isText('this is a hyperlink')
        ),
      }),
      isEmptyRun
    ));
  });

  it('runs after a complex field for hyperlinks are not read as hyperlinks', function() {
    const afterEndXml = runOfText('this will not be a hyperlink');
    const paragraphXml = new XmlElement('w:p', {}, [
      beginXml,
      hyperlinkInstrText,
      separateXml,
      endXml,
      afterEndXml,
    ]);
    const paragraph = readXmlElementValue(paragraphXml);

    assertThat(paragraph.children, contains(
      isEmptyRun,
      isEmptyHyperlinkedRun,
      isEmptyRun,
      isRun({
        children: contains(
          isText('this will not be a hyperlink')
        ),
      })
    ));
  });

  it('can handle split instrText elements', function() {
    const hyperlinkInstrTextPart1 = new XmlElement('w:instrText', {}, [
      xml.text(' HYPE'),
    ]);
    const hyperlinkInstrTextPart2 = new XmlElement('w:instrText', {}, [
      xml.text('RLINK "' + uri + '"'),
    ]);
    const paragraphXml = new XmlElement('w:p', {}, [
      beginXml,
      hyperlinkInstrTextPart1,
      hyperlinkInstrTextPart2,
      separateXml,
      hyperlinkRunXml,
      endXml,
    ]);
    const paragraph = readXmlElementValue(paragraphXml);

    assertThat(paragraph.children, contains(
      isEmptyRun,
      isEmptyHyperlinkedRun,
      isHyperlinkedRun({
        children: contains(
          isText('this is a hyperlink')
        ),
      }),
      isEmptyRun
    ));
  });

  it('hyperlink is not ended by end of nested complex field', function() {
    const authorInstrText = new XmlElement('w:instrText', {}, [
      xml.text(' AUTHOR "John Doe"'),
    ]);
    const paragraphXml = new XmlElement('w:p', {}, [
      beginXml,
      hyperlinkInstrText,
      separateXml,
      beginXml,
      authorInstrText,
      separateXml,
      endXml,
      hyperlinkRunXml,
      endXml,
    ]);
    const paragraph = readXmlElementValue(paragraphXml);

    assertThat(paragraph.children, contains(
      isEmptyRun,
      isEmptyHyperlinkedRun,
      isEmptyHyperlinkedRun,
      isEmptyHyperlinkedRun,
      isEmptyHyperlinkedRun,
      isHyperlinkedRun({
        children: contains(
          isText('this is a hyperlink')
        ),
      }),
      isEmptyRun
    ));
  });

  it('complex field nested within a hyperlink complex field is wrapped with the hyperlink', function() {
    const authorInstrText = new XmlElement('w:instrText', {}, [
      xml.text(' AUTHOR "John Doe"'),
    ]);
    const paragraphXml = new XmlElement('w:p', {}, [
      beginXml,
      hyperlinkInstrText,
      separateXml,
      beginXml,
      authorInstrText,
      separateXml,
      runOfText('John Doe'),
      endXml,
      endXml,
    ]);
    const paragraph = readXmlElementValue(paragraphXml);

    assertThat(paragraph.children, contains(
      isEmptyRun,
      isEmptyHyperlinkedRun,
      isEmptyHyperlinkedRun,
      isEmptyHyperlinkedRun,
      isHyperlinkedRun({
        children: contains(
          isText('John Doe')
        ),
      }),
      isEmptyHyperlinkedRun,
      isEmptyRun
    ));
  });

  it('field without separate w:fldChar is ignored', function() {
    const hyperlinkRunXml = runOfText('this is a hyperlink');
    const paragraphXml = new XmlElement('w:p', {}, [
      beginXml,
      hyperlinkInstrText,
      separateXml,
      beginXml,
      endXml,
      hyperlinkRunXml,
      endXml,
    ]);
    const paragraph = readXmlElementValue(paragraphXml);

    assertThat(paragraph.children, contains(
      isEmptyRun,
      isEmptyHyperlinkedRun,
      isEmptyHyperlinkedRun,
      isEmptyHyperlinkedRun,
      isHyperlinkedRun({
        children: contains(
          isText('this is a hyperlink')
        ),
      }),
      isEmptyRun
    ));
  });
});

it('run has no style if it has no properties', function() {
  const runXml = runWithProperties([]);
  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.styleId, null);
});

it('run has style ID and name read from run properties if present', function() {
  const runStyleXml = new XmlElement('w:rStyle', { 'w:val': 'Heading1Char' });
  const runXml = runWithProperties([ runStyleXml ]);

  const styles = new Styles({}, { Heading1Char: { name: 'Heading 1 Char' } });

  const run = readXmlElementValue(runXml, { styles });
  assert.deepStrictEqual(run.styleId, 'Heading1Char');
  assert.deepStrictEqual(run.styleName, 'Heading 1 Char');
});

it('warning is emitted when run style cannot be found', function() {
  const runStyleXml = new XmlElement('w:rStyle', { 'w:val': 'Heading1Char' });
  const runXml = runWithProperties([ runStyleXml ]);

  const styles = new Styles({}, {});

  const result = readXmlElement(runXml, { styles });
  const run = result.value;
  assert.deepStrictEqual(run.styleId, 'Heading1Char');
  assert.deepStrictEqual(run.styleName, null);
  assert.deepStrictEqual(result.messages, [ warning('Run style with ID Heading1Char was referenced but not defined in the document') ]);
});

it('isBold is false if bold element is not present', function() {
  const runXml = runWithProperties([]);
  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.isBold, false);
});

it('isBold is true if bold element is present', function() {
  const boldXml = new XmlElement('w:b');
  const runXml = runWithProperties([ boldXml ]);
  const run = readXmlElementValue(runXml);
  assert.strictEqual(run.isBold, true);
});

it('isBold is false if bold element is present and w:val is false', function() {
  const boldXml = new XmlElement('w:b', { 'w:val': 'false' });
  const runXml = runWithProperties([ boldXml ]);
  const run = readXmlElementValue(runXml);
  assert.strictEqual(run.isBold, false);
});

it('isUnderline is false if underline element is not present', function() {
  const runXml = runWithProperties([]);
  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.isUnderline, false);
});

it('isUnderline is true if underline element is present without w:val attribute', function() {
  const underlineXml = new XmlElement('w:u');
  const runXml = runWithProperties([ underlineXml ]);
  const run = readXmlElementValue(runXml);
  assert.strictEqual(run.isUnderline, true);
});

it('isUnderline is false if underline element is present and w:val is false', function() {
  const underlineXml = new XmlElement('w:u', { 'w:val': 'false' });
  const runXml = runWithProperties([ underlineXml ]);
  const run = readXmlElementValue(runXml);
  assert.strictEqual(run.isUnderline, false);
});

it('isUnderline is false if underline element is present and w:val is 0', function() {
  const underlineXml = new XmlElement('w:u', { 'w:val': '0' });
  const runXml = runWithProperties([ underlineXml ]);
  const run = readXmlElementValue(runXml);
  assert.strictEqual(run.isUnderline, false);
});

it('isUnderline is false if underline element is present and w:val is none', function() {
  const underlineXml = new XmlElement('w:u', { 'w:val': 'none' });
  const runXml = runWithProperties([ underlineXml ]);
  const run = readXmlElementValue(runXml);
  assert.strictEqual(run.isUnderline, false);
});

it('isUnderline is false if underline element is present and w:val is not none or falsy', function() {
  const underlineXml = new XmlElement('w:u', { 'w:val': 'single' });
  const runXml = runWithProperties([ underlineXml ]);
  const run = readXmlElementValue(runXml);
  assert.strictEqual(run.isUnderline, true);
});

it('isStrikethrough is false if strikethrough element is not present', function() {
  const runXml = runWithProperties([]);
  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.isStrikethrough, false);
});

it('isStrikethrough is true if strikethrough element is present', function() {
  const strikethroughXml = new XmlElement('w:strike');
  const runXml = runWithProperties([ strikethroughXml ]);
  const run = readXmlElementValue(runXml);
  assert.strictEqual(run.isStrikethrough, true);
});

it('isItalic is false if bold element is not present', function() {
  const runXml = runWithProperties([]);
  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.isItalic, false);
});

it('isItalic is true if bold element is present', function() {
  const italicXml = new XmlElement('w:i');
  const runXml = runWithProperties([ italicXml ]);
  const run = readXmlElementValue(runXml);
  assert.strictEqual(run.isItalic, true);
});

it('isSmallCaps is false if smallcaps element is not present', function() {
  const runXml = runWithProperties([]);
  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.isSmallCaps, false);
});

it('isSmallCaps is true if smallcaps element is present', function() {
  const smallCapsXml = new XmlElement('w:smallCaps');
  const runXml = runWithProperties([ smallCapsXml ]);
  const run = readXmlElementValue(runXml);
  assert.strictEqual(run.isSmallCaps, true);
});

const booleanRunProperties = [
  { name: 'isBold', tagName: 'w:b' },
  { name: 'isUnderline', tagName: 'w:u' },
  { name: 'isItalic', tagName: 'w:i' },
  { name: 'isStrikethrough', tagName: 'w:strike' },
  { name: 'isAllCaps', tagName: 'w:caps' },
  { name: 'isSmallCaps', tagName: 'w:smallCaps' },
];

booleanRunProperties.forEach(function(runProperty) {
  it(runProperty.name + ' is false if ' + runProperty.tagName + ' is present and w:val is false', function() {
    const propertyXml = new XmlElement(runProperty.tagName, { 'w:val': 'false' });
    const runXml = runWithProperties([ propertyXml ]);
    const run = readXmlElementValue(runXml);
    assert.strictEqual(run[runProperty.name], false);
  });

  it(runProperty.name + ' is false if ' + runProperty.tagName + ' is present and w:val is 0', function() {
    const propertyXml = new XmlElement(runProperty.tagName, { 'w:val': '0' });
    const runXml = runWithProperties([ propertyXml ]);
    const run = readXmlElementValue(runXml);
    assert.strictEqual(run[runProperty.name], false);
  });

  it(runProperty.name + ' is true if ' + runProperty.tagName + ' is present and w:val is true', function() {
    const propertyXml = new XmlElement(runProperty.tagName, { 'w:val': 'true' });
    const runXml = runWithProperties([ propertyXml ]);
    const run = readXmlElementValue(runXml);
    assert.strictEqual(run[runProperty.name], true);
  });

  it(runProperty.name + ' is true if ' + runProperty.tagName + ' is present and w:val is 1', function() {
    const propertyXml = new XmlElement(runProperty.tagName, { 'w:val': '1' });
    const runXml = runWithProperties([ propertyXml ]);
    const run = readXmlElementValue(runXml);
    assert.strictEqual(run[runProperty.name], true);
  });
});

it('run has baseline vertical alignment by default', function() {
  const runXml = runWithProperties([]);
  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.verticalAlignment, documents.verticalAlignment.baseline);
});

it('run has vertical alignment read from properties', function() {
  const verticalAlignmentXml = new XmlElement('w:vertAlign', { 'w:val': 'superscript' });
  const runXml = runWithProperties([ verticalAlignmentXml ]);

  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.verticalAlignment, documents.verticalAlignment.superscript);
});

it('run has null font by default', function() {
  const runXml = runWithProperties([]);

  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.font, null);
});

it('run has font read from properties', function() {
  const fontXml = new XmlElement('w:rFonts', { 'w:ascii': 'Arial' });
  const runXml = runWithProperties([ fontXml ]);

  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.font, 'Arial');
});

it('run has null fontSize by default', function() {
  const runXml = runWithProperties([]);

  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.fontSize, null);
});

it('run has fontSize read from properties', function() {
  const fontSizeXml = new XmlElement('w:sz', { 'w:val': '28' });
  const runXml = runWithProperties([ fontSizeXml ]);

  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.fontSize, 14);
});

it('run with invalid w:sz has null font size', function() {
  const fontSizeXml = new XmlElement('w:sz', { 'w:val': '28a' });
  const runXml = runWithProperties([ fontSizeXml ]);

  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run.fontSize, null);
});

it('run properties not included as child of run', function() {
  const runStyleXml = new XmlElement('w:rStyle');
  const runPropertiesXml = new XmlElement('w:rPr', {}, [ runStyleXml ]);
  const runXml = new XmlElement('w:r', {}, [ runPropertiesXml ]);
  const result = readXmlElement(runXml);
  assert.deepStrictEqual(result.value.children, []);
});

it('w:tab is read as document tab element', function() {
  const tabXml = new XmlElement('w:tab');
  const result = readXmlElement(tabXml);
  assert.deepStrictEqual(result.value, new documents.Tab());
});

it('w:noBreakHyphen is read as non-breaking hyphen character', function() {
  const noBreakHyphenXml = new XmlElement('w:noBreakHyphen');
  const result = readXmlElement(noBreakHyphenXml);
  assert.deepStrictEqual(result.value, new documents.Text('\u2011'));
});

it('soft hyphens are read as text', function() {
  const element = new XmlElement('w:softHyphen', {}, []);
  const text = readXmlElementValue(element);
  assert.deepStrictEqual(text, new documents.Text('\u00AD'));
});

it('w:sym with supported font and supported code point in ASCII range is converted to text', function() {
  const element = new XmlElement('w:sym', { 'w:font': 'Wingdings', 'w:char': '28' }, []);
  const text = readXmlElementValue(element);
  assert.deepStrictEqual(text, new documents.Text('🕿'));
});

it('w:sym with supported font and supported code point in private use area is converted to text', function() {
  const element = new XmlElement('w:sym', { 'w:font': 'Wingdings', 'w:char': 'F028' }, []);
  const text = readXmlElementValue(element);
  assert.deepStrictEqual(text, new documents.Text('🕿'));
});

it('w:sym with unsupported font and code point produces empty result with warning', function() {
  const element = new XmlElement('w:sym', { 'w:font': 'Dingwings', 'w:char': '28' }, []);

  const result = readXmlElement(element);

  assert.deepStrictEqual(result.value, []);
  assert.deepStrictEqual(result.messages, [ warning('A w:sym element with an unsupported character was ignored: char 28 in font Dingwings') ]);
});

it('w:tbl is read as document table element', function() {
  const tableXml = new XmlElement('w:tbl', {}, [
    new XmlElement('w:tr', {}, [
      new XmlElement('w:tc', {}, [
        new XmlElement('w:p', {}, []),
      ]),
    ]),
  ]);
  const result = readXmlElement(tableXml);
  assert.deepStrictEqual(result.value, new documents.Table([
    new documents.TableRow([
      new documents.TableCell([
        new documents.Paragraph([]),
      ]),
    ]),
  ]));
});

it('table has no style if it has no properties', function() {
  const tableXml = new XmlElement('w:tbl', {}, []);
  const table = readXmlElementValue(tableXml);
  assert.deepStrictEqual(table.styleId, null);
});

it('table has style ID and name read from table properties if present', function() {
  const styleXml = new XmlElement('w:tblStyle', { 'w:val': 'TableNormal' }, []);
  const propertiesXml = new XmlElement('w:tblPr', {}, [ styleXml ]);
  const tableXml = new XmlElement('w:tbl', {}, [ propertiesXml ]);

  const styles = new Styles({}, {}, { TableNormal: { name: 'Normal Table' } });

  const table = readXmlElementValue(tableXml, { styles });
  assert.deepStrictEqual(table.styleId, 'TableNormal');
  assert.deepStrictEqual(table.styleName, 'Normal Table');
});

it('warning is emitted when table style cannot be found', function() {
  const styleXml = new XmlElement('w:tblStyle', { 'w:val': 'TableNormal' }, []);
  const propertiesXml = new XmlElement('w:tblPr', {}, [ styleXml ]);
  const tableXml = new XmlElement('w:tbl', {}, [ propertiesXml ]);

  const result = readXmlElement(tableXml, { styles: Styles.EMPTY });
  const table = result.value;
  assert.deepStrictEqual(table.styleId, 'TableNormal');
  assert.deepStrictEqual(table.styleName, null);
  assert.deepStrictEqual(result.messages, [ warning('Table style with ID TableNormal was referenced but not defined in the document') ]);
});

it('w:tblHeader marks table row as header', function() {
  const tableXml = new XmlElement('w:tbl', {}, [
    new XmlElement('w:tr', {}, [
      new XmlElement('w:trPr', {}, [
        new XmlElement('w:tblHeader'),
      ]),
    ]),
    new XmlElement('w:tr'),
  ]);
  const result = readXmlElementValue(tableXml);
  assertThat(result, isTable({
    children: contains(
      isRow({ isHeader: true }),
      isRow({ isHeader: false })
    ),
  }));
});

it('w:gridSpan is read as colSpan for table cell', function() {
  const tableXml = new XmlElement('w:tbl', {}, [
    new XmlElement('w:tr', {}, [
      new XmlElement('w:tc', {}, [
        new XmlElement('w:tcPr', {}, [
          new XmlElement('w:gridSpan', { 'w:val': '2' }),
        ]),
        new XmlElement('w:p', {}, []),
      ]),
    ]),
  ]);
  const result = readXmlElement(tableXml);
  assert.deepStrictEqual(result.value, new documents.Table([
    new documents.TableRow([
      new documents.TableCell([
        new documents.Paragraph([]),
      ], { colSpan: 2 }),
    ]),
  ]));
});

it('w:vMerge is read as rowSpan for table cell', function() {
  const tableXml = new XmlElement('w:tbl', {}, [
    row(emptyCell()),
    row(emptyCell(vMerge('restart'))),
    row(emptyCell(vMerge('continue'))),
    row(emptyCell(vMerge('continue'))),
    row(emptyCell()),
  ]);
  const result = readXmlElement(tableXml);
  assert.deepStrictEqual(result.value, new documents.Table([
    docRow([ docEmptyCell() ]),
    docRow([ docEmptyCell({ rowSpan: 3 }) ]),
    docRow([]),
    docRow([]),
    docRow([ docEmptyCell() ]),
  ]));
});

it('w:vMerge without val is treated as continue', function() {
  const tableXml = new XmlElement('w:tbl', {}, [
    row(emptyCell(vMerge('restart'))),
    row(emptyCell(vMerge())),
  ]);
  const result = readXmlElement(tableXml);
  assert.deepStrictEqual(result.value, new documents.Table([
    docRow([ docEmptyCell({ rowSpan: 2 }) ]),
    docRow([]),
  ]));
});

it('w:vMerge accounts for cells spanning columns', function() {
  const tableXml = new XmlElement('w:tbl', {}, [
    row(emptyCell(), emptyCell(), emptyCell(vMerge('restart'))),
    row(emptyCell(gridSpan('2')), emptyCell(vMerge('continue'))),
    row(emptyCell(), emptyCell(), emptyCell(vMerge('continue'))),
    row(emptyCell(), emptyCell(), emptyCell()),
  ]);
  const result = readXmlElement(tableXml);
  assert.deepStrictEqual(result.value, new documents.Table([
    docRow([ docEmptyCell(), docEmptyCell(), docEmptyCell({ rowSpan: 3 }) ]),
    docRow([ docEmptyCell({ colSpan: 2 }) ]),
    docRow([ docEmptyCell(), docEmptyCell() ]),
    docRow([ docEmptyCell(), docEmptyCell(), docEmptyCell() ]),
  ]));
});

it('no vertical cell merging if merged cells do not line up', function() {
  const tableXml = new XmlElement('w:tbl', {}, [
    row(emptyCell(gridSpan('2'), vMerge('restart'))),
    row(emptyCell(), emptyCell(vMerge('continue'))),
  ]);
  const result = readXmlElement(tableXml);
  assert.deepStrictEqual(result.value, new documents.Table([
    docRow([ docEmptyCell({ colSpan: 2 }) ]),
    docRow([ docEmptyCell(), docEmptyCell() ]),
  ]));
});

it('warning if non-row in table', function() {
  const tableXml = new XmlElement('w:tbl', {}, [
    new XmlElement('w:p'),
  ]);
  const result = readXmlElement(tableXml);
  assert.deepStrictEqual(result.messages, [ warning('unexpected non-row element in table, cell merging may be incorrect') ]);
});

it('warning if non-cell in table row', function() {
  const tableXml = new XmlElement('w:tbl', {}, [
    row(new XmlElement('w:p')),
  ]);
  const result = readXmlElement(tableXml);
  assert.deepStrictEqual(result.messages, [ warning('unexpected non-cell element in table row, cell merging may be incorrect') ]);
});

function row() {
  return new XmlElement('w:tr', {}, Array.prototype.slice.call(arguments));
}

function emptyCell() {
  return new XmlElement('w:tc', {}, [
    new XmlElement('w:tcPr', {}, Array.prototype.slice.call(arguments)),
  ]);
}

function vMerge(val) {
  return new XmlElement('w:vMerge', { 'w:val': val }, []);
}

function gridSpan(val) {
  return new XmlElement('w:gridSpan', { 'w:val': val });
}

function docRow(children) {
  return new documents.TableRow(children);
}

function docEmptyCell(properties) {
  return new documents.TableCell([], properties);
}

it('w:bookmarkStart is read as a bookmarkStart', function() {
  const bookmarkStart = new XmlElement('w:bookmarkStart', { 'w:name': '_Peter', 'w:id': '42' });
  const result = readXmlElement(bookmarkStart);
  assert.deepStrictEqual(result.value.name, '_Peter');
  assert.deepStrictEqual(result.value.type, 'bookmarkStart');
});

it('_GoBack bookmark is ignored', function() {
  const bookmarkStart = new XmlElement('w:bookmarkStart', { 'w:name': '_GoBack' });
  const result = readXmlElement(bookmarkStart);
  assert.deepStrictEqual(result.value, []);
});

const IMAGE_BUFFER = Buffer.from('Not an image at all!');
const IMAGE_RELATIONSHIP_ID = 'rId5';

function isSuccess(valueMatcher) {
  return hasProperties({
    messages: [],
    value: valueMatcher,
  });
}

function isImage(options) {
  const matcher = hasProperties(_.extend({ type: 'image' }, _.omit(options, 'buffer')));
  if (options.buffer) {
    return allOf(
      matcher,
      new FeatureMatcher(willBe(options.buffer), 'buffer', 'buffer', function(element) {
        return element.read();
      })
    );
  }
  return matcher;

}

function readEmbeddedImage(element) {
  return readXmlElement(element, {
    relationships: new Relationships([
      imageRelationship('rId5', 'media/hat.png'),
    ]),
    contentTypes: fakeContentTypes,
    docxFile: createFakeDocxFile({
      'word/media/hat.png': IMAGE_BUFFER,
    }),
  });
}

it('can read imagedata elements with r:id attribute', function() {
  const imagedataElement = new XmlElement('v:imagedata', {
    'r:id': IMAGE_RELATIONSHIP_ID,
    'o:title': "It's a hat",
  });

  const result = readEmbeddedImage(imagedataElement);

  return promiseThat(result, isSuccess(isImage({
    altText: "It's a hat",
    contentType: 'image/png',
    buffer: IMAGE_BUFFER,
  })));
});

it('when v:imagedata element has no relationship ID then it is ignored with warning', function() {
  const imagedataElement = new XmlElement('v:imagedata');

  const result = readXmlElement(imagedataElement);

  assert.deepStrictEqual(result.value, []);
  assert.deepStrictEqual(result.messages, [ warning('A v:imagedata element without a relationship ID was ignored') ]);
});

it('can read inline pictures', function() {
  const drawing = createInlineImage({
    blip: createEmbeddedBlip(IMAGE_RELATIONSHIP_ID),
    description: "It's a hat",
  });

  const result = readEmbeddedImage(drawing);

  return promiseThat(result, isSuccess(contains(isImage({
    altText: "It's a hat",
    contentType: 'image/png',
    buffer: IMAGE_BUFFER,
  }))));
});

it('alt text title is used if alt text description is missing', function() {
  const drawing = createInlineImage({
    blip: createEmbeddedBlip(IMAGE_RELATIONSHIP_ID),
    title: "It's a hat",
  });

  const result = readEmbeddedImage(drawing);

  return promiseThat(result, isSuccess(contains(isImage({
    altText: "It's a hat",
  }))));
});

it('alt text title is used if alt text description is blank', function() {
  const drawing = createInlineImage({
    blip: createEmbeddedBlip(IMAGE_RELATIONSHIP_ID),
    description: ' ',
    title: "It's a hat",
  });

  const result = readEmbeddedImage(drawing);

  return promiseThat(result, isSuccess(contains(isImage({
    altText: "It's a hat",
  }))));
});

it('alt text description is preferred to alt text title', function() {
  const drawing = createInlineImage({
    blip: createEmbeddedBlip(IMAGE_RELATIONSHIP_ID),
    description: "It's a hat",
    title: 'hat',
  });

  const result = readEmbeddedImage(drawing);

  return promiseThat(result, isSuccess(contains(isImage({
    altText: "It's a hat",
  }))));
});

it('can read anchored pictures', function() {
  const drawing = new XmlElement('w:drawing', {}, [
    new XmlElement('wp:anchor', {}, [
      new XmlElement('wp:docPr', { descr: "It's a hat" }),
      new XmlElement('a:graphic', {}, [
        new XmlElement('a:graphicData', {}, [
          new XmlElement('pic:pic', {}, [
            new XmlElement('pic:blipFill', {}, [
              new XmlElement('a:blip', { 'r:embed': IMAGE_RELATIONSHIP_ID }),
            ]),
          ]),
        ]),
      ]),
    ]),
  ]);

  const result = readEmbeddedImage(drawing);

  return promiseThat(result, isSuccess(contains(isImage({
    altText: "It's a hat",
    contentType: 'image/png',
    buffer: IMAGE_BUFFER,
  }))));
});

it('can read linked pictures', function() {
  const drawing = createInlineImage({
    blip: createLinkedBlip('rId5'),
    description: "It's a hat",
  });

  const element = single(readXmlElementValue(drawing, {
    relationships: new Relationships([
      imageRelationship('rId5', 'file:///media/hat.png'),
    ]),
    contentTypes: fakeContentTypes,
    files: testing.createFakeFiles({
      'file:///media/hat.png': IMAGE_BUFFER,
    }),
  }));
  return promiseThat(element, isImage({
    altText: "It's a hat",
    contentType: 'image/png',
    buffer: IMAGE_BUFFER,
  }));
});

it('warning if unsupported image type', function() {
  const drawing = createInlineImage({
    blip: createEmbeddedBlip('rId5'),
    description: "It's a hat",
  });

  const result = readXmlElement(drawing, {
    relationships: new Relationships([
      imageRelationship('rId5', 'media/hat.emf'),
    ]),
    contentTypes: fakeContentTypes,
    docxFile: createFakeDocxFile({
      'word/media/hat.emf': IMAGE_BUFFER,
    }),
  });
  assert.deepStrictEqual(result.messages, [ warning('Image of type image/x-emf is unlikely to display in web browsers') ]);
  const element = single(result.value);
  assert.strictEqual(element.contentType, 'image/x-emf');
});

it('no elements created if image cannot be found in w:drawing', function() {
  const drawing = new XmlElement('w:drawing', {}, []);

  const result = readXmlElement(drawing);
  assert.deepStrictEqual(result.messages, []);
  assert.deepStrictEqual(result.value, []);
});

it('no elements created if image cannot be found in wp:inline', function() {
  const drawing = new XmlElement('wp:inline', {}, []);

  const result = readXmlElement(drawing);
  assert.deepStrictEqual(result.messages, []);
  assert.deepStrictEqual(result.value, []);
});

it('children of w:ins are converted normally', function() {
  assertChildrenAreConvertedNormally('w:ins');
});

it('children of w:object are converted normally', function() {
  assertChildrenAreConvertedNormally('w:object');
});

it('children of w:smartTag are converted normally', function() {
  assertChildrenAreConvertedNormally('w:smartTag');
});

it('children of v:group are converted normally', function() {
  assertChildrenAreConvertedNormally('v:group');
});

it('children of v:rect are converted normally', function() {
  assertChildrenAreConvertedNormally('v:rect');
});

function assertChildrenAreConvertedNormally(tagName) {
  const runXml = new XmlElement('w:r', {}, []);
  const result = readXmlElement(new XmlElement(tagName, {}, [ runXml ]));
  assert.deepStrictEqual(result.value[0].type, 'run');
}

describe('w:hyperlink', function() {
  it('is read as external hyperlink if it has a relationship ID', function() {
    const runXml = new XmlElement('w:r', {}, []);
    const hyperlinkXml = new XmlElement('w:hyperlink', { 'r:id': 'r42' }, [ runXml ]);
    const relationships = new Relationships([
      hyperlinkRelationship('r42', 'http://example.com'),
    ]);
    const result = readXmlElement(hyperlinkXml, { relationships });
    assert.deepStrictEqual(result.value.href, 'http://example.com');
    assert.deepStrictEqual(result.value.children[0].type, 'run');
  });

  it('is read as external hyperlink if it has a relationship ID and an anchor', function() {
    const runXml = new XmlElement('w:r', {}, []);
    const hyperlinkXml = new XmlElement('w:hyperlink', { 'r:id': 'r42', 'w:anchor': 'fragment' }, [ runXml ]);
    const relationships = new Relationships([
      hyperlinkRelationship('r42', 'http://example.com/'),
    ]);
    const result = readXmlElement(hyperlinkXml, { relationships });
    assert.deepStrictEqual(result.value.href, 'http://example.com/#fragment');
    assert.deepStrictEqual(result.value.children[0].type, 'run');
  });

  it('existing fragment is replaced when anchor is set on external link', function() {
    const runXml = new XmlElement('w:r', {}, []);
    const hyperlinkXml = new XmlElement('w:hyperlink', { 'r:id': 'r42', 'w:anchor': 'fragment' }, [ runXml ]);
    const relationships = new Relationships([
      hyperlinkRelationship('r42', 'http://example.com/#previous'),
    ]);
    const result = readXmlElement(hyperlinkXml, { relationships });
    assert.deepStrictEqual(result.value.href, 'http://example.com/#fragment');
    assert.deepStrictEqual(result.value.children[0].type, 'run');
  });

  it('is read as internal hyperlink if it has an anchor', function() {
    const runXml = new XmlElement('w:r', {}, []);
    const hyperlinkXml = new XmlElement('w:hyperlink', { 'w:anchor': '_Peter' }, [ runXml ]);
    const result = readXmlElement(hyperlinkXml);
    assert.deepStrictEqual(result.value.anchor, '_Peter');
    assert.deepStrictEqual(result.value.children[0].type, 'run');
  });

  it('is ignored if it does not have a relationship ID nor anchor', function() {
    const runXml = new XmlElement('w:r', {}, []);
    const hyperlinkXml = new XmlElement('w:hyperlink', {}, [ runXml ]);
    const result = readXmlElement(hyperlinkXml);
    assert.deepStrictEqual(result.value[0].type, 'run');
  });

  it('target frame is read', function() {
    const hyperlinkXml = new XmlElement('w:hyperlink', {
      'w:anchor': 'Introduction',
      'w:tgtFrame': '_blank',
    });
    const result = readXmlElementValue(hyperlinkXml);
    assertThat(result, hasProperties({ targetFrame: '_blank' }));
  });

  it('empty target frame is ignored', function() {
    const hyperlinkXml = new XmlElement('w:hyperlink', {
      'w:anchor': 'Introduction',
      'w:tgtFrame': '',
    });
    const result = readXmlElementValue(hyperlinkXml);
    assertThat(result, hasProperties({ targetFrame: null }));
  });
});

it('w:br without explicit type is read as line break', function() {
  const breakXml = new XmlElement('w:br', {}, []);
  const result = readXmlElementValue(breakXml);
  assert.deepStrictEqual(result, documents.lineBreak);
});

it('w:br with textWrapping type is read as line break', function() {
  const breakXml = new XmlElement('w:br', { 'w:type': 'textWrapping' }, []);
  const result = readXmlElementValue(breakXml);
  assert.deepStrictEqual(result, documents.lineBreak);
});

it('w:br with page type is read as page break', function() {
  const breakXml = new XmlElement('w:br', { 'w:type': 'page' }, []);
  const result = readXmlElementValue(breakXml);
  assert.deepStrictEqual(result, documents.pageBreak);
});

it('w:br with column type is read as column break', function() {
  const breakXml = new XmlElement('w:br', { 'w:type': 'column' }, []);
  const result = readXmlElementValue(breakXml);
  assert.deepStrictEqual(result, documents.columnBreak);
});

it("warning on breaks that aren't recognised", function() {
  const breakXml = new XmlElement('w:br', { 'w:type': 'unknownBreakType' }, []);
  const result = readXmlElement(breakXml);
  assert.deepStrictEqual(result.value, []);
  assert.deepStrictEqual(result.messages, [ warning('Unsupported break type: unknownBreakType') ]);
});

it('w:footnoteReference has ID read', function() {
  const referenceXml = new XmlElement('w:footnoteReference', { 'w:id': '4' });
  const result = readXmlElement(referenceXml);
  assert.deepStrictEqual(
    result.value,
    documents.noteReference({ noteType: 'footnote', noteId: '4' })
  );
  assert.deepStrictEqual(result.messages, []);
});

it('w:commentReference has ID read', function() {
  const referenceXml = new XmlElement('w:commentReference', { 'w:id': '4' });
  const result = readXmlElement(referenceXml);
  assert.deepStrictEqual(
    result.value,
    documents.commentReference({ commentId: '4' })
  );
  assert.deepStrictEqual(result.messages, []);
});

it('emits warning on unrecognised element', function() {
  const unrecognisedElement = new XmlElement('w:not-an-element');
  const result = readXmlElement(unrecognisedElement);
  assert.deepStrictEqual(
    result.messages,
    [{
      type: 'warning',
      message: 'An unrecognised element was ignored: w:not-an-element',
    }]
  );
  assert.deepStrictEqual(result.value, []);
});

it('w:bookmarkEnd is ignored without warning', function() {
  const ignoredElement = new XmlElement('w:bookmarkEnd');
  const result = readXmlElement(ignoredElement);
  assert.deepStrictEqual(result.messages, []);
  assert.deepStrictEqual([], result.value);
});

it('text boxes have content appended after containing paragraph', function() {
  const textbox = new XmlElement('w:pict', {}, [
    new XmlElement('v:shape', {}, [
      new XmlElement('v:textbox', {}, [
        new XmlElement('w:txbxContent', {}, [
          paragraphWithStyleId('textbox-content'),
        ]),
      ]),
    ]),
  ]);
  const paragraph = new XmlElement('w:p', {}, [
    new XmlElement('w:r', {}, [ textbox ]),
  ]);
  const result = readXmlElement(paragraph);
  assert.deepStrictEqual(result.value[1].styleId, 'textbox-content');
});

it('mc:Fallback is used when mc:AlternateContent is read', function() {
  const styles = new Styles({ first: { name: 'First' }, second: { name: 'Second' } }, {});
  const textbox = new XmlElement('mc:AlternateContent', {}, [
    new XmlElement('mc:Choice', { Requires: 'wps' }, [
      paragraphWithStyleId('first'),
    ]),
    new XmlElement('mc:Fallback', {}, [
      paragraphWithStyleId('second'),
    ]),
  ]);
  const result = readXmlElement(textbox, { styles });
  assert.deepStrictEqual(result.value[0].styleId, 'second');
});

it('w:sdtContent is used when w:sdt is read', function() {
  const element = xml.element('w:sdt', {}, [
    xml.element('w:sdtContent', {}, [
      xml.element('w:t', {}, [ xml.text('Blackdown') ]),
    ]),
  ]);
  const result = readXmlElement(element);
  assert.deepStrictEqual(result.value, [ new documents.Text('Blackdown') ]);
});

it('text nodes are ignored when reading children', function() {
  const runXml = new XmlElement('w:r', {}, [ xml.text('[text]') ]);
  const run = readXmlElementValue(runXml);
  assert.deepStrictEqual(run, new documents.Run([]));
});

function paragraphWithStyleId(styleId) {
  return new XmlElement('w:p', {}, [
    new XmlElement('w:pPr', {}, [
      new XmlElement('w:pStyle', { 'w:val': styleId }, []),
    ]),
  ]);
}

function runWithProperties(children) {
  return new XmlElement('w:r', {}, [ createRunPropertiesXml(children) ]);
}

function createRunPropertiesXml(children) {
  return new XmlElement('w:rPr', {}, children);
}

function single(array) {
  if (array.length === 1) {
    return array[0];
  }
  throw new Error('Array has ' + array.length + ' elements');

}

function createInlineImage(options) {
  return new XmlElement('w:drawing', {}, [
    new XmlElement('wp:inline', {}, [
      new XmlElement('wp:docPr', { descr: options.description, title: options.title }),
      new XmlElement('a:graphic', {}, [
        new XmlElement('a:graphicData', {}, [
          new XmlElement('pic:pic', {}, [
            new XmlElement('pic:blipFill', {}, [
              options.blip,
            ]),
          ]),
        ]),
      ]),
    ]),
  ]);
}

function createEmbeddedBlip(relationshipId) {
  return new XmlElement('a:blip', { 'r:embed': relationshipId });
}

function createLinkedBlip(relationshipId) {
  return new XmlElement('a:blip', { 'r:link': relationshipId });
}

function runOfText(text) {
  const textXml = new XmlElement('w:t', {}, [ xml.text(text) ]);
  return new XmlElement('w:r', {}, [ textXml ]);
}

function hyperlinkRelationship(relationshipId, target) {
  return {
    relationshipId,
    target,
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
  };
}

function imageRelationship(relationshipId, target) {
  return {
    relationshipId,
    target,
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  };
}

function NumberingMap(options) {
  const findLevel = options.findLevel;
  const findLevelByParagraphStyleId = options.findLevelByParagraphStyleId || {};

  return {
    findLevel(numId, level) {
      return findLevel[numId][level];
    },
    findLevelByParagraphStyleId(styleId) {
      return findLevelByParagraphStyleId[styleId];
    },
  };
}
