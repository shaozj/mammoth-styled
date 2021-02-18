const assert = require('assert');


const htmlPaths = require('../../lib/styles/html-paths');


it('element can match multiple tag names', function() {
  const pathPart = htmlPaths.element([ 'ul', 'ol' ]);
  assert.ok(pathPart.matchesElement({ tagName: 'ul' }));
  assert.ok(pathPart.matchesElement({ tagName: 'ol' }));
  assert.ok(!pathPart.matchesElement({ tagName: 'p' }));
});

it('element matches if attributes are the same', function() {
  const pathPart = htmlPaths.element([ 'p' ], { class: 'tip' });
  assert.ok(!pathPart.matchesElement({ tagName: 'p' }));
  assert.ok(!pathPart.matchesElement({ tagName: 'p', attributes: { class: 'tip help' } }));
  assert.ok(pathPart.matchesElement({ tagName: 'p', attributes: { class: 'tip' } }));
});

