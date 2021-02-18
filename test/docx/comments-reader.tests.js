'use strict';

const assert = require('assert');

const createCommentsReader = require('../../lib/docx/comments-reader').createCommentsReader;
const createBodyReader = require('../../lib/docx/body-reader').createBodyReader;
const documents = require('../../lib/documents');
const xml = require('../../lib/xml');

function readComment(element) {
  const bodyReader = createBodyReader({});
  const commentsReader = createCommentsReader(bodyReader);
  const comments = commentsReader(element);
  assert.strictEqual(comments.value.length, 1);
  return comments.value[0];
}

it('ID and body of comment are read', function() {
  const body = [ xml.element('w:p') ];
  const comment = readComment(xml.element('w:comments', {}, [
    xml.element('w:comment', { 'w:id': '1' }, body),
  ]));
  assert.deepStrictEqual(comment.body, [ new documents.Paragraph([]) ]);
  assert.deepStrictEqual(comment.commentId, '1');
});


it('when optional attributes of comment are missing then they are read as null', function() {
  const comment = readComment(xml.element('w:comments', {}, [
    xml.element('w:comment', { 'w:id': '1' }),
  ]));
  assert.strictEqual(comment.authorName, null);
  assert.strictEqual(comment.authorInitials, null);
});


it('when optional attributes of comment are blank then they are read as null', function() {
  const comment = readComment(xml.element('w:comments', {}, [
    xml.element('w:comment', { 'w:id': '1', 'w:author': ' ', 'w:initials': ' ' }),
  ]));
  assert.strictEqual(comment.authorName, null);
  assert.strictEqual(comment.authorInitials, null);
});


it('when optional attributes of comment are not blank then they are read', function() {
  const comment = readComment(xml.element('w:comments', {}, [
    xml.element('w:comment', { 'w:id': '1', 'w:author': 'The Piemaker', 'w:initials': 'TP' }),
  ]));
  assert.strictEqual(comment.authorName, 'The Piemaker');
  assert.strictEqual(comment.authorInitials, 'TP');
});
