'use strict';

const assert = require('assert');
const promises = require('../lib/promises');

const documents = require('../lib/documents');
const documentToHtml = require('../lib/document-to-html');
const DocumentConverter = documentToHtml.DocumentConverter;
const commentAuthorLabel = documentToHtml.commentAuthorLabel;

const htmlPaths = require('../lib/styles/html-paths');
const xml = require('../lib/xml');
const results = require('../lib/results');
const documentMatchers = require('../lib/styles/document-matchers');
const Html = require('../lib/html');


it('should empty document to empty string', function() {
  const document = new documents.Document([]);
  const converter = new DocumentConverter();
  return converter.convertToHtml(document).then(function(result) {
    assert.strictEqual(result.value, '');
  });
});

it('should convert document containing one paragraph to single p element', function() {
  const document = new documents.Document([
    paragraphOfText('Hello.'),
  ]);
  const converter = new DocumentConverter();
  return converter.convertToHtml(document).then(function(result) {
    assert.strictEqual(result.value, '<p>Hello.</p>');
  });
});

it('ignores empty paragraphs', function() {
  const document = new documents.Document([
    paragraphOfText(''),
  ]);
  const converter = new DocumentConverter();
  return converter.convertToHtml(document).then(function(result) {
    assert.strictEqual(result.value, '');
  });
});

it('text is HTML-escaped', function() {
  const document = new documents.Document([
    paragraphOfText('1 < 2'),
  ]);
  const converter = new DocumentConverter();
  return converter.convertToHtml(document).then(function(result) {
    assert.strictEqual(result.value, '<p>1 &lt; 2</p>');
  });
});

it('should convert document containing multiple paragraphs to multiple p elements', function() {
  const document = new documents.Document([
    paragraphOfText('Hello.'),
    paragraphOfText('Goodbye.'),
  ]);
  const converter = new DocumentConverter();
  return converter.convertToHtml(document).then(function(result) {
    assert.strictEqual(result.value, '<p>Hello.</p><p>Goodbye.</p>');
  });
});

it('uses style mappings to pick HTML element for docx paragraph', function() {
  const document = new documents.Document([
    paragraphOfText('Hello.', 'Heading1', 'Heading 1'),
  ]);
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.paragraph({ styleName: documentMatchers.equalTo('Heading 1') }),
        to: htmlPaths.topLevelElement('h1'),
      },
    ],
  });
  return converter.convertToHtml(document).then(function(result) {
    assert.strictEqual(result.value, '<h1>Hello.</h1>');
  });
});

it('mappings for style names are case insensitive', function() {
  const document = new documents.Document([
    paragraphOfText('Hello.', 'Heading1', 'heading 1'),
  ]);
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.paragraph({ styleName: documentMatchers.equalTo('Heading 1') }),
        to: htmlPaths.topLevelElement('h1'),
      },
    ],
  });
  return converter.convertToHtml(document).then(function(result) {
    assert.strictEqual(result.value, '<h1>Hello.</h1>');
  });
});

it('can use non-default HTML element for unstyled paragraphs', function() {
  const document = new documents.Document([
    paragraphOfText('Hello.'),
  ]);
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.paragraph(),
        to: htmlPaths.topLevelElement('h1'),
      },
    ],
  });
  return converter.convertToHtml(document).then(function(result) {
    assert.strictEqual(result.value, '<h1>Hello.</h1>');
  });
});

it('warning is emitted if paragraph style is unrecognised', function() {
  const document = new documents.Document([
    paragraphOfText('Hello.', 'Heading1', 'Heading 1'),
  ]);
  const converter = new DocumentConverter();
  return converter.convertToHtml(document).then(function(result) {
    assert.deepStrictEqual(result.messages, [ results.warning("Unrecognised paragraph style: 'Heading 1' (Style ID: Heading1)") ]);
  });
});

it('can use stacked styles to generate nested HTML elements', function() {
  const document = new documents.Document([
    paragraphOfText('Hello.'),
  ]);
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.paragraph(),
        to: htmlPaths.elements([ 'h1', 'span' ]),
      },
    ],
  });
  return converter.convertToHtml(document).then(function(result) {
    assert.strictEqual(result.value, '<h1><span>Hello.</span></h1>');
  });
});

it('bold runs are wrapped in <strong> tags by default', function() {
  const run = runOfText('Hello.', { isBold: true });
  const converter = new DocumentConverter();
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<strong>Hello.</strong>');
  });
});

it('bold runs can be configured with style mapping', function() {
  const run = runOfText('Hello.', { isBold: true });
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.bold,
        to: htmlPaths.elements([ htmlPaths.element('em') ]),
      },
    ],
  });
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<em>Hello.</em>');
  });
});

it('bold runs can exist inside other tags', function() {
  const run = new documents.Paragraph([
    runOfText('Hello.', { isBold: true }),
  ]);
  const converter = new DocumentConverter();
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<p><strong>Hello.</strong></p>');
  });
});

it('consecutive bold runs are wrapped in a single <strong> element', function() {
  const paragraph = new documents.Paragraph([
    runOfText('Hello', { isBold: true }),
    runOfText('.', { isBold: true }),
  ]);
  const converter = new DocumentConverter();
  return converter.convertToHtml(paragraph).then(function(result) {
    assert.strictEqual(result.value, '<p><strong>Hello.</strong></p>');
  });
});

it('underline runs are ignored by default', function() {
  const run = runOfText('Hello.', { isUnderline: true });
  const converter = new DocumentConverter();
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, 'Hello.');
  });
});

it('underline runs can be mapped using style mapping', function() {
  const run = runOfText('Hello.', { isUnderline: true });
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.underline,
        to: htmlPaths.elements([ htmlPaths.element('u') ]),
      },
    ],
  });
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<u>Hello.</u>');
  });
});

it('style mapping for underline runs does not close parent elements', function() {
  const run = runOfText('Hello.', { isUnderline: true, isBold: true });
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.underline,
        to: htmlPaths.elements([ htmlPaths.element('u') ]),
      },
    ],
  });
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<strong><u>Hello.</u></strong>');
  });
});

it('strikethrough runs are wrapped in <s> tags by default', function() {
  const run = runOfText('Hello.', { isStrikethrough: true });
  const converter = new DocumentConverter();
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<s>Hello.</s>');
  });
});

it('strikethrough runs can be configured with style mapping', function() {
  const run = runOfText('Hello.', { isStrikethrough: true });
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.strikethrough,
        to: htmlPaths.elements([ htmlPaths.element('del') ]),
      },
    ],
  });
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<del>Hello.</del>');
  });
});

it('italic runs are wrapped in <em> tags', function() {
  const run = runOfText('Hello.', { isItalic: true });
  const converter = new DocumentConverter();
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<em>Hello.</em>');
  });
});

it('italic runs can be configured with style mapping', function() {
  const run = runOfText('Hello.', { isItalic: true });
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.italic,
        to: htmlPaths.elements([ htmlPaths.element('strong') ]),
      },
    ],
  });
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<strong>Hello.</strong>');
  });
});

it('run can be both bold and italic', function() {
  const run = runOfText('Hello.', { isBold: true, isItalic: true });
  const converter = new DocumentConverter();
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<strong><em>Hello.</em></strong>');
  });
});

it('superscript runs are wrapped in <sup> tags', function() {
  const run = runOfText('Hello.', {
    verticalAlignment: documents.verticalAlignment.superscript,
  });
  const converter = new DocumentConverter();
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<sup>Hello.</sup>');
  });
});

it('subscript runs are wrapped in <sub> tags', function() {
  const run = runOfText('Hello.', {
    verticalAlignment: documents.verticalAlignment.subscript,
  });
  const converter = new DocumentConverter();
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<sub>Hello.</sub>');
  });
});

it('all caps runs are ignored by default', function() {
  const run = runOfText('Hello.', { isAllCaps: true });
  const converter = new DocumentConverter();
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, 'Hello.');
  });
});

it('all caps runs can be configured with style mapping', function() {
  const run = runOfText('Hello.', { isAllCaps: true });
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.allCaps,
        to: htmlPaths.elements([ htmlPaths.element('span') ]),
      },
    ],
  });
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<span>Hello.</span>');
  });
});


it('small caps runs are ignored by default', function() {
  const run = runOfText('Hello.', { isSmallCaps: true });
  const converter = new DocumentConverter();
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, 'Hello.');
  });
});

it('small caps runs can be configured with style mapping', function() {
  const run = runOfText('Hello.', { isSmallCaps: true });
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.smallCaps,
        to: htmlPaths.elements([ htmlPaths.element('span') ]),
      },
    ],
  });
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<span>Hello.</span>');
  });
});


it('run styles are converted to HTML if mapping exists', function() {
  const run = runOfText('Hello.', { styleId: 'Heading1Char', styleName: 'Heading 1 Char' });
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.run({ styleName: documentMatchers.equalTo('Heading 1 Char') }),
        to: htmlPaths.elements([ 'strong' ]),
      },
    ],
  });
  return converter.convertToHtml(run).then(function(result) {
    assert.strictEqual(result.value, '<strong>Hello.</strong>');
  });
});

it('warning is emitted if run style is unrecognised', function() {
  const run = runOfText('Hello.', { styleId: 'Heading1Char', styleName: 'Heading 1 Char' });
  const converter = new DocumentConverter();
  return converter.convertToHtml(run).then(function(result) {
    assert.deepStrictEqual(result.messages, [ results.warning("Unrecognised run style: 'Heading 1 Char' (Style ID: Heading1Char)") ]);
  });
});

it('docx hyperlink is converted to <a>', function() {
  const hyperlink = new documents.Hyperlink(
    [ runOfText('Hello.') ],
    { href: 'http://www.example.com' }
  );
  const converter = new DocumentConverter();
  return converter.convertToHtml(hyperlink).then(function(result) {
    assert.strictEqual(result.value, '<a href="http://www.example.com">Hello.</a>');
  });
});

it('docx hyperlink can be collapsed', function() {
  const hyperlink = new documents.Document([
    new documents.Hyperlink(
      [ runOfText('Hello ') ],
      { href: 'http://www.example.com' }
    ),
    new documents.Hyperlink(
      [ runOfText('world') ],
      { href: 'http://www.example.com' }
    ),
  ]);
  const converter = new DocumentConverter();
  return converter.convertToHtml(hyperlink).then(function(result) {
    assert.strictEqual(result.value, '<a href="http://www.example.com">Hello world</a>');
  });
});

it('docx hyperlink with anchor is converted to <a>', function() {
  const hyperlink = new documents.Hyperlink(
    [ runOfText('Hello.') ],
    { anchor: '_Peter' }
  );
  const converter = new DocumentConverter({
    idPrefix: 'doc-42-',
  });
  return converter.convertToHtml(hyperlink).then(function(result) {
    assert.strictEqual(result.value, '<a href="#doc-42-_Peter">Hello.</a>');
  });
});

it('hyperlink target frame is used as anchor target', function() {
  const hyperlink = new documents.Hyperlink(
    [ runOfText('Hello.') ],
    { anchor: 'start', targetFrame: '_blank' }
  );
  const converter = new DocumentConverter();
  return converter.convertToHtml(hyperlink).then(function(result) {
    assert.strictEqual(result.value, '<a href="#start" target="_blank">Hello.</a>');
  });
});

it('bookmarks are converted to anchors', function() {
  const bookmarkStart = new documents.BookmarkStart({ name: '_Peter' });
  const converter = new DocumentConverter({
    idPrefix: 'doc-42-',
  });
  const document = new documents.Document([ bookmarkStart ]);
  return converter.convertToHtml(document).then(function(result) {
    assert.strictEqual(result.value, '<a id="doc-42-_Peter"></a>');
  });
});

it('docx tab is converted to tab in HTML', function() {
  const tab = new documents.Tab();
  const converter = new DocumentConverter();
  return converter.convertToHtml(tab).then(function(result) {
    assert.strictEqual(result.value, '\t');
  });
});

it('docx table is converted to table in HTML', function() {
  const table = new documents.Table([
    new documents.TableRow([
      new documents.TableCell([ paragraphOfText('Top left') ]),
      new documents.TableCell([ paragraphOfText('Top right') ]),
    ]),
    new documents.TableRow([
      new documents.TableCell([ paragraphOfText('Bottom left') ]),
      new documents.TableCell([ paragraphOfText('Bottom right') ]),
    ]),
  ]);
  const converter = new DocumentConverter();

  return converter.convertToHtml(table).then(function(result) {
    const expectedHtml = '<table>' +
            '<tr><td><p>Top left</p></td><td><p>Top right</p></td></tr>' +
            '<tr><td><p>Bottom left</p></td><td><p>Bottom right</p></td></tr>' +
            '</table>';
    assert.strictEqual(result.value, expectedHtml);
  });
});

it('table style mappings can be used to map tables', function() {
  const table = new documents.Table([], { styleName: 'Normal Table' });
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.table({ styleName: documentMatchers.equalTo('Normal Table') }),
        to: htmlPaths.topLevelElement('table', { class: 'normal-table' }),
      },
    ],
  });

  return converter.convertToHtml(table).then(function(result) {
    const expectedHtml = '<table class="normal-table"></table>';
    assert.strictEqual(result.value, expectedHtml);
  });
});

it('header rows are wrapped in thead', function() {
  const table = new documents.Table([
    new documents.TableRow([ new documents.TableCell([]) ], { isHeader: true }),
    new documents.TableRow([ new documents.TableCell([]) ], { isHeader: true }),
    new documents.TableRow([ new documents.TableCell([]) ], { isHeader: false }),
  ]);
  const converter = new DocumentConverter();

  return converter.convertToHtml(table).then(function(result) {
    const expectedHtml = '<table>' +
            '<thead><tr><th></th></tr><tr><th></th></tr></thead>' +
            '<tbody><tr><td></td></tr></tbody>' +
            '</table>';
    assert.strictEqual(result.value, expectedHtml);
  });
});

it('tbody is omitted if all rows are headers', function() {
  const table = new documents.Table([
    new documents.TableRow([ new documents.TableCell([]) ], { isHeader: true }),
  ]);
  const converter = new DocumentConverter();

  return converter.convertToHtml(table).then(function(result) {
    const expectedHtml = '<table>' +
            '<thead><tr><th></th></tr></thead>' +
            '</table>';
    assert.strictEqual(result.value, expectedHtml);
  });
});

it('unexpected table children do not cause error', function() {
  const table = new documents.Table([
    new documents.tab(),
  ]);
  const converter = new DocumentConverter();

  return converter.convertToHtml(table).then(function(result) {
    const expectedHtml = '<table>\t</table>';
    assert.strictEqual(result.value, expectedHtml);
  });
});

it('empty cells are preserved in table', function() {
  const table = new documents.Table([
    new documents.TableRow([
      new documents.TableCell([ paragraphOfText('') ]),
      new documents.TableCell([ paragraphOfText('Top right') ]),
    ]),
  ]);
  const converter = new DocumentConverter();

  return converter.convertToHtml(table).then(function(result) {
    const expectedHtml = '<table>' +
            '<tr><td></td><td><p>Top right</p></td></tr>' +
            '</table>';
    assert.strictEqual(result.value, expectedHtml);
  });
});

it('empty rows are preserved in table', function() {
  const table = new documents.Table([
    new documents.TableRow([
      new documents.TableCell([ paragraphOfText('Row 1') ]),
    ]),
    new documents.TableRow([]),
  ]);
  const converter = new DocumentConverter();

  return converter.convertToHtml(table).then(function(result) {
    const expectedHtml = '<table>' +
            '<tr><td><p>Row 1</p></td></tr><tr></tr>' +
            '</table>';
    assert.strictEqual(result.value, expectedHtml);
  });
});

it('table cells are written with colSpan if not equal to one', function() {
  const table = new documents.Table([
    new documents.TableRow([
      new documents.TableCell([ paragraphOfText('Top left') ], { colSpan: 2 }),
      new documents.TableCell([ paragraphOfText('Top right') ]),
    ]),
  ]);
  const converter = new DocumentConverter();

  return converter.convertToHtml(table).then(function(result) {
    const expectedHtml = '<table>' +
            '<tr><td colspan="2"><p>Top left</p></td><td><p>Top right</p></td></tr>' +
            '</table>';
    assert.strictEqual(result.value, expectedHtml);
  });
});

it('table cells are written with rowSpan if not equal to one', function() {
  const table = new documents.Table([
    new documents.TableRow([
      new documents.TableCell([], { rowSpan: 2 }),
    ]),
  ]);
  const converter = new DocumentConverter();

  return converter.convertToHtml(table).then(function(result) {
    const expectedHtml = '<table>' +
            '<tr><td rowspan="2"></td></tr>' +
            '</table>';
    assert.strictEqual(result.value, expectedHtml);
  });
});

it('line break is converted to <br>', function() {
  const converter = new DocumentConverter();

  return converter.convertToHtml(documents.lineBreak).then(function(result) {
    assert.strictEqual(result.value, '<br />');
  });
});

it('breaks that are not line breaks are ignored', function() {
  const converter = new DocumentConverter();

  return converter.convertToHtml(documents.pageBreak).then(function(result) {
    assert.strictEqual(result.value, '');
  });
});

it('breaks can be mapped using style mappings', function() {
  const converter = new DocumentConverter({
    styleMap: [
      {
        from: documentMatchers.pageBreak,
        to: htmlPaths.topLevelElement('hr'),
      },
    ],
  });

  return converter.convertToHtml(documents.pageBreak).then(function(result) {
    assert.strictEqual(result.value, '<hr />');
  });
});

it('footnote reference is converted to superscript intra-page link', function() {
  const footnoteReference = new documents.NoteReference({
    noteType: 'footnote',
    noteId: '4',
  });
  const converter = new DocumentConverter({
    idPrefix: 'doc-42-',
  });
  return converter.convertToHtml(footnoteReference).then(function(result) {
    assert.strictEqual(result.value, '<sup><a href="#doc-42-footnote-4" id="doc-42-footnote-ref-4">[1]</a></sup>');
  });
});

it('footnotes are included after the main body', function() {
  const footnoteReference = new documents.NoteReference({
    noteType: 'footnote',
    noteId: '4',
  });
  const document = new documents.Document(
    [ new documents.Paragraph([
      runOfText('Knock knock'),
      new documents.Run([ footnoteReference ]),
    ]) ],
    {
      notes: new documents.Notes({
        4: new documents.Note({
          noteType: 'footnote',
          noteId: '4',
          body: [ paragraphOfText("Who's there?") ],
        }),
      }),
    }
  );

  const converter = new DocumentConverter({
    idPrefix: 'doc-42-',
  });
  return converter.convertToHtml(document).then(function(result) {
    const expectedOutput = '<p>Knock knock<sup><a href="#doc-42-footnote-4" id="doc-42-footnote-ref-4">[1]</a></sup></p>' +
            '<ol><li id="doc-42-footnote-4"><p>Who\'s there? <a href="#doc-42-footnote-ref-4">↑</a></p></li></ol>';
    assert.strictEqual(result.value, expectedOutput);
  });
});

it('comments are ignored by default', function() {
  const reference = documents.commentReference({ commentId: '4' });
  const comment = documents.comment({
    commentId: '4',
    body: [ paragraphOfText("Who's there?") ],
  });
  const document = documents.document([
    documents.paragraph([
      runOfText('Knock knock'),
      documents.run([ reference ]),
    ]),
  ], { comments: [ comment ] });

  const converter = new DocumentConverter({});
  return converter.convertToHtml(document).then(function(result) {
    assert.strictEqual(result.value, '<p>Knock knock</p>');
    assert.deepStrictEqual(result.messages, []);
  });
});

it('comment references are linked to comment after main body', function() {
  const reference = documents.commentReference({ commentId: '4' });
  const comment = documents.comment({
    commentId: '4',
    body: [ paragraphOfText("Who's there?") ],
    authorName: 'The Piemaker',
    authorInitials: 'TP',
  });
  const document = documents.document([
    documents.paragraph([
      runOfText('Knock knock'),
      documents.run([ reference ]),
    ]),
  ], { comments: [ comment ] });

  const converter = new DocumentConverter({
    idPrefix: 'doc-42-',
    styleMap: [
      { from: documentMatchers.commentReference, to: htmlPaths.element('sup') },
    ],
  });
  return converter.convertToHtml(document).then(function(result) {
    const expectedHtml = (
      '<p>Knock knock<sup><a href="#doc-42-comment-4" id="doc-42-comment-ref-4">[TP1]</a></sup></p>' +
            '<dl><dt id="doc-42-comment-4">Comment [TP1]</dt><dd><p>Who\'s there? <a href="#doc-42-comment-ref-4">↑</a></p></dd></dl>'
    );
    assert.strictEqual(result.value, expectedHtml);
    assert.deepStrictEqual(result.messages, []);
  });
});

it('images are written with data URIs', function() {
  const imageBuffer = Buffer.from('Not an image at all!');
  const image = new documents.Image({
    readImage(encoding) {
      return promises.when(imageBuffer.toString(encoding));
    },
    contentType: 'image/png',
  });
  const converter = new DocumentConverter();
  return converter.convertToHtml(image).then(function(result) {
    assert.strictEqual(result.value, '<img src="data:image/png;base64,' + imageBuffer.toString('base64') + '" />');
  });
});

it('images have alt attribute if available', function() {
  const imageBuffer = Buffer.from('Not an image at all!');
  const image = new documents.Image({
    readImage() {
      return promises.when(imageBuffer);
    },
    altText: "It's a hat",
  });
  const converter = new DocumentConverter();
  return converter.convertToHtml(image)
    .then(function(result) {
      return xml.readString(result.value);
    })
    .then(function(htmlImageElement) {
      assert.strictEqual(htmlImageElement.attributes.alt, "It's a hat");
    });
});

it('can add custom handler for images', function() {
  const imageBuffer = Buffer.from('Not an image at all!');
  const image = new documents.Image({
    readImage(encoding) {
      return promises.when(imageBuffer.toString(encoding));
    },
    contentType: 'image/png',
  });
  const converter = new DocumentConverter({
    convertImage(element) {
      return element.read('utf8').then(function(altText) {
        return [ Html.freshElement('img', { alt: altText }) ];
      });
    },
  });
  return converter.convertToHtml(image).then(function(result) {
    assert.strictEqual(result.value, '<img alt="Not an image at all!" />');
  });
});

it('when custom image handler throws error then error is stored in error message', function() {
  const error = new Error('Failed to convert image');
  const image = new documents.Image({
    readImage(encoding) {
      return promises.when(Buffer.from().toString(encoding));
    },
    contentType: 'image/png',
  });
  const converter = new DocumentConverter({
    convertImage() {
      throw error;
    },
  });
  return converter.convertToHtml(image).then(function(result) {
    assert.strictEqual(result.value, '');
    assert.strictEqual(result.messages.length, 1);
    const message = result.messages[0];
    assert.strictEqual('error', message.type);
    assert.strictEqual('Failed to convert image', message.message);
    assert.strictEqual(error, message.error);
  });
});

it('long documents do not cause stack overflow', function() {
  const paragraphs = [];
  for (let i = 0; i < 1000; i++) {
    paragraphs.push(paragraphOfText('Hello.'));
  }
  const document = new documents.Document(paragraphs);
  const converter = new DocumentConverter();
  return converter.convertToHtml(document).then(function(result) {
    assert.strictEqual(result.value.indexOf('<p>Hello.</p>'), 0);
  });
});

function paragraphOfText(text, styleId, styleName) {
  const run = runOfText(text);
  return new documents.Paragraph([ run ], {
    styleId,
    styleName,
  });
}

function runOfText(text, properties) {
  const textElement = new documents.Text(text);
  return new documents.Run([ textElement ], properties);
}

it('when initials are not blank then comment author label is initials', function() {
  assert.strictEqual(commentAuthorLabel({ authorInitials: 'TP' }), 'TP');
});

it('when initials are blank then comment author label is blank', function() {
  assert.strictEqual(commentAuthorLabel({ authorInitials: '' }), '');
  assert.strictEqual(commentAuthorLabel({ authorInitials: undefined }), '');
  assert.strictEqual(commentAuthorLabel({ authorInitials: null }), '');
});
