const assert = require('assert');


const documentMatchers = require('../../lib/styles/document-matchers');
const documents = require('../../lib/documents');
const Paragraph = documents.Paragraph;

it('paragraph with no options matches any paragraph', function() {
  const matcher = documentMatchers.paragraph();
  assert.ok(matcher.matches(new Paragraph()));
  assert.ok(matcher.matches(paragraphWithStyle('Heading1', 'Heading 1')));
});

it('paragraph style ID only matches paragraphs with that style ID', function() {
  const matcher = documentMatchers.paragraph({ styleId: 'Heading1' });
  assert.ok(!matcher.matches(new Paragraph()));
  assert.ok(matcher.matches(paragraphWithStyle('Heading1', 'Heading 1')));
  assert.ok(!matcher.matches(paragraphWithStyle('Heading2', 'Heading 2')));
});

it('paragraph style name only matches paragraphs with that style name', function() {
  const matcher = documentMatchers.paragraph({ styleName: documentMatchers.equalTo('Heading 1') });
  assert.ok(!matcher.matches(new Paragraph()));
  assert.ok(matcher.matches(paragraphWithStyle('Heading1', 'Heading 1')));
  assert.ok(!matcher.matches(paragraphWithStyle('Heading2', 'Heading 2')));
});

it('ordered-list(index) matches an ordered list with specified level index', function() {
  const matcher = documentMatchers.paragraph({ list: { isOrdered: true, levelIndex: 1 } });
  assert.ok(!matcher.matches(new Paragraph()));
  assert.ok(matcher.matches(new Paragraph([], { numbering: { level: 1, isOrdered: true } })));
  assert.ok(!matcher.matches(new Paragraph([], { numbering: { level: 0, isOrdered: true } })));
  assert.ok(!matcher.matches(new Paragraph([], { numbering: { level: 1, isOrdered: false } })));
});

it('unordered-list(index) matches an unordered list with specified level index', function() {
  const matcher = documentMatchers.paragraph({ list: { isOrdered: false, levelIndex: 1 } });
  assert.ok(!matcher.matches(new Paragraph()));
  assert.ok(matcher.matches(new Paragraph([], { numbering: { level: 1, isOrdered: false } })));
  assert.ok(!matcher.matches(new Paragraph([], { numbering: { level: 1, isOrdered: true } })));
});

it('matchers for lists with index 0 do not match elements that are not lists', function() {
  const matcher = documentMatchers.paragraph({ list: { isOrdered: true, levelIndex: 0 } });
  assert.ok(!matcher.matches(new Paragraph()));
});

function paragraphWithStyle(styleId, styleName) {
  return new Paragraph([], { styleId, styleName });
}


it('equalTo matcher is case insensitive', function() {
  const matcher = documentMatchers.equalTo('Heading 1');
  assert.ok(matcher.operator(matcher.operand, 'heaDING 1'));
  assert.ok(!matcher.operator(matcher.operand, 'heaDING 2'));
});

it('startsWith matches strings with prefix', function() {
  const matcher = documentMatchers.startsWith('Heading');
  assert.ok(matcher.operator(matcher.operand, 'Heading'));
  assert.ok(matcher.operator(matcher.operand, 'Heading 1'));
  assert.ok(!matcher.operator(matcher.operand, 'Custom Heading'));
  assert.ok(!matcher.operator(matcher.operand, 'Head'));
  assert.ok(!matcher.operator(matcher.operand, 'Header 2'));
});

it('startsWith matcher is case insensitive', function() {
  const matcher = documentMatchers.startsWith('Heading');
  assert.ok(matcher.operator(matcher.operand, 'heaDING'));
});
