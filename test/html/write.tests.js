const assert = require('assert');


const html = require('../../lib/html');
const writers = require('../../lib/writers');


it('text is HTML escaped', function() {
  assert.strictEqual(
    generateString(html.text('<>&')),
    '&lt;&gt;&amp;');
});

it('double quotes outside of attributes are not escaped', function() {
  assert.strictEqual(
    generateString(html.text('"')),
    '"');
});

it('element attributes are HTML escaped', function() {
  assert.strictEqual(
    generateString(html.freshElement('p', { x: '<' })),
    '<p x="&lt;"></p>');
});

it('double quotes inside attributes are escaped', function() {
  assert.strictEqual(
    generateString(html.freshElement('p', { x: '"' })),
    '<p x="&quot;"></p>');
});

it('element children are written', function() {
  assert.strictEqual(
    generateString(html.freshElement('p', {}, [ html.text('Hello') ])),
    '<p>Hello</p>');
});

function generateString(node) {
  const writer = writers.writer();
  html.write(writer, [ node ]);
  return writer.asString();
}
