'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const _ = require('underscore');

const mammoth = require('../');
const promises = require('../lib/promises');
const results = require('../lib/results');

const testing = require('./testing');

const testData = testing.testData;
const createFakeDocxFile = testing.createFakeDocxFile;


it('should convert docx containing one paragraph to single p element', function() {
  const docxPath = path.join(__dirname, 'test-data/single-paragraph.docx');
  return mammoth.convertToHtml({ path: docxPath }).then(function(result) {
    assert.strictEqual(result.value, '<p>Walking on imported air</p>');
    assert.deepStrictEqual(result.messages, []);
  });
});

it('should convert docx represented by a Buffer', function() {
  const docxPath = path.join(__dirname, 'test-data/single-paragraph.docx');
  return promises.nfcall(fs.readFile, docxPath)
    .then(function(buffer) {
      return mammoth.convertToHtml({ buffer });
    })
    .then(function(result) {
      assert.strictEqual(result.value, '<p>Walking on imported air</p>');
      assert.deepStrictEqual(result.messages, []);
    });
});

it('should read docx xml files with unicode byte order mark', function() {
  const docxPath = path.join(__dirname, 'test-data/utf8-bom.docx');
  return mammoth.convertToHtml({ path: docxPath }).then(function(result) {
    assert.strictEqual(result.value, '<p>This XML has a byte order mark.</p>');
    assert.deepStrictEqual(result.messages, []);
  });
});

it('empty paragraphs are ignored by default', function() {
  const docxPath = path.join(__dirname, 'test-data/empty.docx');
  return mammoth.convertToHtml({ path: docxPath }).then(function(result) {
    assert.strictEqual(result.value, '');
    assert.deepStrictEqual(result.messages, []);
  });
});

it('empty paragraphs are preserved if ignoreEmptyParagraphs is false', function() {
  const docxPath = path.join(__dirname, 'test-data/empty.docx');
  return mammoth.convertToHtml({ path: docxPath }, { ignoreEmptyParagraphs: false }).then(function(result) {
    assert.strictEqual(result.value, '<p></p>');
    assert.deepStrictEqual(result.messages, []);
  });
});

it('style map can be expressed as string', function() {
  const docxFile = createFakeDocxFile({
    'word/document.xml': testData('simple/word/document.xml'),
  });
  const options = {
    styleMap: 'p => h1',
  };
  return mammoth.convertToHtml({ file: docxFile }, options).then(function(result) {
    assert.strictEqual('<h1>Hello.</h1>', result.value);
  });
});

it('style map can be expressed as array of style mappings', function() {
  const docxFile = createFakeDocxFile({
    'word/document.xml': testData('simple/word/document.xml'),
  });
  const options = {
    styleMap: [ 'p => h1' ],
  };
  return mammoth.convertToHtml({ file: docxFile }, options).then(function(result) {
    assert.strictEqual('<h1>Hello.</h1>', result.value);
  });
});

it('embedded style map is used if present', function() {
  const docxPath = path.join(__dirname, 'test-data/embedded-style-map.docx');
  return mammoth.convertToHtml({ path: docxPath }).then(function(result) {
    assert.strictEqual(result.value, '<h1>Walking on imported air</h1>');
    assert.deepStrictEqual(result.messages, []);
  });
});

it('explicit style map takes precedence over embedded style map', function() {
  const docxPath = path.join(__dirname, 'test-data/embedded-style-map.docx');
  const options = {
    styleMap: [ 'p => p' ],
  };
  return mammoth.convertToHtml({ path: docxPath }, options).then(function(result) {
    assert.strictEqual(result.value, '<p>Walking on imported air</p>');
    assert.deepStrictEqual(result.messages, []);
  });
});

it('explicit style map is combined with embedded style map', function() {
  const docxPath = path.join(__dirname, 'test-data/embedded-style-map.docx');
  const options = {
    styleMap: [ 'r => strong' ],
  };
  return mammoth.convertToHtml({ path: docxPath }, options).then(function(result) {
    assert.strictEqual(result.value, '<h1><strong>Walking on imported air</strong></h1>');
    assert.deepStrictEqual(result.messages, []);
  });
});

it('embedded style maps can be disabled', function() {
  const docxPath = path.join(__dirname, 'test-data/embedded-style-map.docx');
  const options = {
    includeEmbeddedStyleMap: false,
  };
  return mammoth.convertToHtml({ path: docxPath }, options).then(function(result) {
    assert.strictEqual(result.value, '<p>Walking on imported air</p>');
    assert.deepStrictEqual(result.messages, []);
  });
});

it('embedded style map can be written and then read', function() {
  const docxPath = path.join(__dirname, 'test-data/single-paragraph.docx');
  return promises.nfcall(fs.readFile, docxPath)
    .then(function(buffer) {
      return mammoth.embedStyleMap({ buffer }, 'p => h1');
    })
    .then(function(docx) {
      return mammoth.convertToHtml({ buffer: docx.toBuffer() });
    })
    .then(function(result) {
      assert.strictEqual(result.value, '<h1>Walking on imported air</h1>');
      assert.deepStrictEqual(result.messages, []);
    });
});

it('embedded style map can be retrieved', function() {
  const docxPath = path.join(__dirname, 'test-data/single-paragraph.docx');
  return promises.nfcall(fs.readFile, docxPath)
    .then(function(buffer) {
      return mammoth.embedStyleMap({ buffer }, 'p => h1');
    })
    .then(function(docx) {
      return mammoth.readEmbeddedStyleMap({ buffer: docx.toBuffer() });
    })
    .then(function(styleMap) {
      assert.strictEqual(styleMap, 'p => h1');
    });
});

it('warning if style mapping is not understood', function() {
  const docxPath = path.join(__dirname, 'test-data/single-paragraph.docx');
  const options = {
    styleMap: '????\np => h1',
  };
  return mammoth.convertToHtml({ path: docxPath }, options).then(function(result) {
    assert.strictEqual('<h1>Walking on imported air</h1>', result.value);
    const warning = 'Did not understand this style mapping, so ignored it: ????\n' +
            'Error was at character number 1: Expected element type but got unrecognisedCharacter "?"';
    assert.deepStrictEqual(result.messages, [ results.warning(warning) ]);
  });
});

it('options are passed to document converter when calling mammoth.convertToHtml', function() {
  const docxFile = createFakeDocxFile({
    'word/document.xml': testData('simple/word/document.xml'),
  });
  const options = {
    styleMap: 'p => h1',
  };
  return mammoth.convertToHtml({ file: docxFile }, options).then(function(result) {
    assert.strictEqual('<h1>Hello.</h1>', result.value);
  });
});

it('options.transformDocument is used to transform document if set', function() {
  const docxFile = createFakeDocxFile({
    'word/document.xml': testData('simple/word/document.xml'),
  });
  const options = {
    transformDocument(document) {
      document.children[0].styleId = 'Heading1';
      return document;
    },
  };
  return mammoth.convertToHtml({ file: docxFile }, options).then(function(result) {
    assert.strictEqual('<h1>Hello.</h1>', result.value);
  });
});

it('mammoth.transforms.paragraph only transforms paragraphs', function() {
  const docxFile = createFakeDocxFile({
    'word/document.xml': testData('simple/word/document.xml'),
  });
  const options = {
    transformDocument: mammoth.transforms.paragraph(function(paragraph) {
      return _.extend(paragraph, { styleId: 'Heading1' });
    }),
  };
  return mammoth.convertToHtml({ file: docxFile }, options).then(function(result) {
    assert.strictEqual('<h1>Hello.</h1>', result.value);
  });
});

it('inline images referenced by path relative to part are included in output', function() {
  const docxPath = path.join(__dirname, 'test-data/tiny-picture.docx');
  return mammoth.convertToHtml({ path: docxPath }).then(function(result) {
    assert.strictEqual(result.value, '<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAAXNSR0IArs4c6QAAAAlwSFlzAAAOvgAADr4B6kKxwAAAABNJREFUKFNj/M+ADzDhlWUYqdIAQSwBE8U+X40AAAAASUVORK5CYII=" /></p>');
  });
});

it('inline images referenced by path relative to base are included in output', function() {
  const docxPath = path.join(__dirname, 'test-data/tiny-picture-target-base-relative.docx');
  return mammoth.convertToHtml({ path: docxPath }).then(function(result) {
    assert.strictEqual(result.value, '<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAAXNSR0IArs4c6QAAAAlwSFlzAAAOvgAADr4B6kKxwAAAABNJREFUKFNj/M+ADzDhlWUYqdIAQSwBE8U+X40AAAAASUVORK5CYII=" /></p>');
  });
});

it('src of inline images can be changed', function() {
  const docxPath = path.join(__dirname, 'test-data/tiny-picture.docx');
  const convertImage = mammoth.images.imgElement(function(element) {
    return element.read('base64').then(function(encodedImage) {
      return { src: encodedImage.substring(0, 2) + ',' + element.contentType };
    });
  });
  return mammoth.convertToHtml({ path: docxPath }, { convertImage }).then(function(result) {
    assert.strictEqual(result.value, '<p><img src="iV,image/png" /></p>');
  });
});

it('images stored outside of document are included in output', function() {
  const docxPath = path.join(__dirname, 'test-data/external-picture.docx');
  return mammoth.convertToHtml({ path: docxPath }).then(function(result) {
    assert.strictEqual(result.value, '<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAAXNSR0IArs4c6QAAAAlwSFlzAAAOvgAADr4B6kKxwAAAABNJREFUKFNj/M+ADzDhlWUYqdIAQSwBE8U+X40AAAAASUVORK5CYII=" /></p>');
    assert.deepStrictEqual(result.messages, []);
  });
});

it('error if images stored outside of document are specified when passing file without path', function() {
  const docxPath = path.join(__dirname, 'test-data/external-picture.docx');
  const buffer = fs.readFileSync(docxPath);
  return mammoth.convertToHtml({ buffer }).then(function(result) {
    assert.strictEqual(result.value, '');
    assert.strictEqual(result.messages[0].message, "could not find external image 'tiny-picture.png', path of input document is unknown");
    assert.strictEqual(result.messages[0].type, 'error');
  });
});

it('simple list is converted to list elements', function() {
  const docxPath = path.join(__dirname, 'test-data/simple-list.docx');
  return mammoth.convertToHtml({ path: docxPath }).then(function(result) {
    assert.strictEqual(result.value, '<ul><li>Apple</li><li>Banana</li></ul>');
  });
});

it('word tables are converted to html tables', function() {
  const docxPath = path.join(__dirname, 'test-data/tables.docx');
  return mammoth.convertToHtml({ path: docxPath }).then(function(result) {
    const expectedHtml = '<p>Above</p>' +
            '<table>' +
            '<tr><td><p>Top left</p></td><td><p>Top right</p></td></tr>' +
            '<tr><td><p>Bottom left</p></td><td><p>Bottom right</p></td></tr>' +
            '</table>' +
            '<p>Below</p>';
    assert.strictEqual(result.value, expectedHtml);
    assert.deepStrictEqual(result.messages, []);
  });
});

it('footnotes are appended to text', function() {
  // TODO: don't duplicate footnotes with multiple references
  const docxPath = path.join(__dirname, 'test-data/footnotes.docx');
  const options = {
    idPrefix: 'doc-42-',
  };
  return mammoth.convertToHtml({ path: docxPath }, options).then(function(result) {
    const expectedOutput = '<p>Ouch' +
            '<sup><a href="#doc-42-footnote-1" id="doc-42-footnote-ref-1">[1]</a></sup>.' +
            '<sup><a href="#doc-42-footnote-2" id="doc-42-footnote-ref-2">[2]</a></sup></p>' +
            '<ol><li id="doc-42-footnote-1"><p> A tachyon walks into a bar. <a href="#doc-42-footnote-ref-1">↑</a></p></li>' +
            '<li id="doc-42-footnote-2"><p> Fin. <a href="#doc-42-footnote-ref-2">↑</a></p></li></ol>';
    assert.strictEqual(result.value, expectedOutput);
    assert.deepStrictEqual(result.messages, []);
  });
});

it('endnotes are appended to text', function() {
  const docxPath = path.join(__dirname, 'test-data/endnotes.docx');
  const options = {
    idPrefix: 'doc-42-',
  };
  return mammoth.convertToHtml({ path: docxPath }, options).then(function(result) {
    const expectedOutput = '<p>Ouch' +
            '<sup><a href="#doc-42-endnote-2" id="doc-42-endnote-ref-2">[1]</a></sup>.' +
            '<sup><a href="#doc-42-endnote-3" id="doc-42-endnote-ref-3">[2]</a></sup></p>' +
            '<ol><li id="doc-42-endnote-2"><p> A tachyon walks into a bar. <a href="#doc-42-endnote-ref-2">↑</a></p></li>' +
            '<li id="doc-42-endnote-3"><p> Fin. <a href="#doc-42-endnote-ref-3">↑</a></p></li></ol>';
    assert.strictEqual(result.value, expectedOutput);
    assert.deepStrictEqual(result.messages, []);
  });
});

it('relationships are handled properly in footnotes', function() {
  const docxPath = path.join(__dirname, 'test-data/footnote-hyperlink.docx');
  const options = {
    idPrefix: 'doc-42-',
  };
  return mammoth.convertToHtml({ path: docxPath }, options).then(function(result) {
    const expectedOutput =
            '<p><sup><a href="#doc-42-footnote-1" id="doc-42-footnote-ref-1">[1]</a></sup></p>' +
            '<ol><li id="doc-42-footnote-1"><p> <a href="http://www.example.com">Example</a> <a href="#doc-42-footnote-ref-1">↑</a></p></li></ol>';
    assert.strictEqual(result.value, expectedOutput);
    assert.deepStrictEqual(result.messages, []);
  });
});

it('when style mapping is defined for comment references then comments are included', function() {
  const docxPath = path.join(__dirname, 'test-data/comments.docx');
  const options = {
    idPrefix: 'doc-42-',
    styleMap: 'comment-reference => sup',
  };
  return mammoth.convertToHtml({ path: docxPath }, options).then(function(result) {
    const expectedOutput = (
      '<p>Ouch' +
            '<sup><a href="#doc-42-comment-0" id="doc-42-comment-ref-0">[MW1]</a></sup>.' +
            '<sup><a href="#doc-42-comment-2" id="doc-42-comment-ref-2">[MW2]</a></sup></p>' +
            '<dl><dt id="doc-42-comment-0">Comment [MW1]</dt><dd><p>A tachyon walks into a bar. <a href="#doc-42-comment-ref-0">↑</a></p></dd>' +
            '<dt id="doc-42-comment-2">Comment [MW2]</dt><dd><p>Fin. <a href="#doc-42-comment-ref-2">↑</a></p></dd></dl>'
    );
    assert.strictEqual(result.value, expectedOutput);
    assert.deepStrictEqual(result.messages, []);
  });
});

it('textboxes are read', function() {
  const docxPath = path.join(__dirname, 'test-data/text-box.docx');
  return mammoth.convertToHtml({ path: docxPath }).then(function(result) {
    const expectedOutput = '<p>Datum plane</p>';
    assert.strictEqual(result.value, expectedOutput);
  });
});

it('underline is ignored by default', function() {
  const docxPath = path.join(__dirname, 'test-data/underline.docx');
  return mammoth.convertToHtml({ path: docxPath }).then(function(result) {
    assert.strictEqual(result.value, '<p><strong>The Sunset Tree</strong></p>');
  });
});

it('underline can be configured with style mapping', function() {
  const docxPath = path.join(__dirname, 'test-data/underline.docx');
  return mammoth.convertToHtml({ path: docxPath }, { styleMap: 'u => em' }).then(function(result) {
    assert.strictEqual(result.value, '<p><strong>The <em>Sunset</em> Tree</strong></p>');
  });
});

it('strikethrough is converted to <s> by default', function() {
  const docxPath = path.join(__dirname, 'test-data/strikethrough.docx');
  return mammoth.convertToHtml({ path: docxPath }).then(function(result) {
    assert.strictEqual(result.value, "<p><s>Today's Special: Salmon</s> Sold out</p>");
  });
});

it('strikethrough conversion can be configured with style mappings', function() {
  const docxPath = path.join(__dirname, 'test-data/strikethrough.docx');
  return mammoth.convertToHtml({ path: docxPath }, { styleMap: 'strike => del' }).then(function(result) {
    assert.strictEqual(result.value, "<p><del>Today's Special: Salmon</del> Sold out</p>");
  });
});

it('indentation is used if prettyPrint is true', function() {
  const docxPath = path.join(__dirname, 'test-data/single-paragraph.docx');
  return mammoth.convertToHtml({ path: docxPath }, { prettyPrint: true }).then(function(result) {
    assert.strictEqual(result.value, '<p>\n  Walking on imported air\n</p>');
    assert.deepStrictEqual(result.messages, []);
  });
});

it('using styleMapping throws error', function() {
  try {
    mammoth.styleMapping();
  } catch (error) {
    assert.strictEqual(
      error.message,
      'Use a raw string instead of mammoth.styleMapping e.g. "p[style-name=\'Title\'] => h1" instead of mammoth.styleMapping("p[style-name=\'Title\'] => h1")'
    );
  }
});

it('can convert single paragraph to markdown', function() {
  const docxPath = path.join(__dirname, 'test-data/single-paragraph.docx');
  return mammoth.convertToMarkdown({ path: docxPath }).then(function(result) {
    assert.strictEqual(result.value, 'Walking on imported air\n\n');
    assert.deepStrictEqual(result.messages, []);
  });
});

it('extractRawText only retains raw text', function() {
  const docxPath = path.join(__dirname, 'test-data/simple-list.docx');
  return mammoth.extractRawText({ path: docxPath }).then(function(result) {
    assert.strictEqual(result.value, 'Apple\n\nBanana\n\n');
  });
});

it('extractRawText can use .docx files represented by a Buffer', function() {
  const docxPath = path.join(__dirname, 'test-data/single-paragraph.docx');
  return promises.nfcall(fs.readFile, docxPath)
    .then(function(buffer) {
      return mammoth.extractRawText({ buffer });
    })
    .then(function(result) {
      assert.strictEqual(result.value, 'Walking on imported air\n\n');
      assert.deepStrictEqual(result.messages, []);
    });
});


it('should throw error if file is not a valid docx document', function() {
  const docxPath = path.join(__dirname, 'test-data/empty.zip');
  return mammoth.convertToHtml({ path: docxPath }).then(function() {
    assert.ok(false, 'Expected error');
  }, function(error) {
    assert.strictEqual(error.message, 'Could not find main document part. Are you sure this is a valid .docx file?');
  });
});
