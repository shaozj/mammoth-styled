const assert = require('assert');


const mdWriter = require('../../lib/writers/markdown-writer');

it('special markdown characters are escaped', function() {
  const writer = mdWriter.writer();
  writer.text('\\*');
  return assert.strictEqual(writer.asString(), '\\\\\\*');
});

it('unrecognised elements are treated as normal text', function() {
  const writer = mdWriter.writer();
  writer.open('blah');
  writer.text('Hello');
  writer.close('blah');
  return assert.strictEqual(writer.asString(), 'Hello');
});

it('paragraphs are terminated with double new line', function() {
  const writer = mdWriter.writer();
  writer.open('p');
  writer.text('Hello');
  writer.close('p');
  return assert.strictEqual(writer.asString(), 'Hello\n\n');
});

it('h1 elements are converted to heading with leading hash', function() {
  const writer = mdWriter.writer();
  writer.open('h1');
  writer.text('Hello');
  writer.close('h1');
  return assert.strictEqual(writer.asString(), '# Hello\n\n');
});

it('h6 elements are converted to heading with six leading hashes', function() {
  const writer = mdWriter.writer();
  writer.open('h6');
  writer.text('Hello');
  writer.close('h6');
  return assert.strictEqual(writer.asString(), '###### Hello\n\n');
});

it('br is written as two spaces followed by new line', function() {
  const writer = mdWriter.writer();
  writer.text('Hello World');
  writer.selfClosing('br');
  return assert.strictEqual(writer.asString(), 'Hello World  \n');
});

it('strong text is surrounded by two underscores', function() {
  const writer = mdWriter.writer();
  writer.text('Hello ');
  writer.open('strong');
  writer.text('World');
  writer.close('strong');
  return assert.strictEqual(writer.asString(), 'Hello __World__');
});

it('emphasised text is surrounded by one asterix', function() {
  const writer = mdWriter.writer();
  writer.text('Hello ');
  writer.open('em');
  writer.text('World');
  writer.close('em');
  return assert.strictEqual(writer.asString(), 'Hello *World*');
});

it('anchor tags are written as hyperlinks', function() {
  const writer = mdWriter.writer();
  writer.open('a', { href: 'http://example.com' });
  writer.text('Hello');
  writer.close('a');
  return assert.strictEqual(writer.asString(), '[Hello](http://example.com)');
});

it('anchor tags without href attribute are treated as ordinary text', function() {
  const writer = mdWriter.writer();
  writer.open('a');
  writer.text('Hello');
  writer.close('a');
  return assert.strictEqual(writer.asString(), 'Hello');
});

it('elements with IDs have anchor tags with IDs appended to start of markdown element', function() {
  const writer = mdWriter.writer();
  writer.open('h1', { id: 'start' });
  writer.text('Hello');
  writer.close('h1');
  return assert.strictEqual(writer.asString(), '# <a id="start"></a>Hello\n\n');
});

it('links have anchors before opening square bracket', function() {
  const writer = mdWriter.writer();
  writer.open('a', { href: 'http://example.com', id: 'start' });
  writer.text('Hello');
  writer.close('a');
  return assert.strictEqual(writer.asString(), '<a id="start"></a>[Hello](http://example.com)');
});

it('can generate images', function() {
  const writer = mdWriter.writer();
  writer.selfClosing('img', { src: 'http://example.com/image.jpg', alt: 'Alt Text' });
  return assert.strictEqual(writer.asString(), '![Alt Text](http://example.com/image.jpg)');
});

it('can generate images with missing alt attribute', function() {
  const writer = mdWriter.writer();
  writer.selfClosing('img', { src: 'http://example.com/image.jpg' });
  return assert.strictEqual(writer.asString(), '![](http://example.com/image.jpg)');
});

it('can generate images with missing src attribute', function() {
  const writer = mdWriter.writer();
  writer.selfClosing('img', { alt: 'Alt Text' });
  return assert.strictEqual(writer.asString(), '![Alt Text]()');
});

it("doesn't display empty images", function() {
  const writer = mdWriter.writer();
  writer.selfClosing('img');
  return assert.strictEqual(writer.asString(), '');
});

it('list item outside of list is treated as unordered list', function() {
  const writer = mdWriter.writer();
  writer.open('li');
  writer.text('Hello');
  writer.close('li');
  return assert.strictEqual(writer.asString(), '- Hello\n');
});

it('can generate an ordered list', function() {
  const writer = mdWriter.writer();
  writer.open('ol');
  writer.open('li');
  writer.text('Hello');
  writer.close('li');
  writer.open('li');
  writer.text('World');
  writer.close('li');
  writer.close('ol');
  return assert.strictEqual(writer.asString(), '1. Hello\n2. World\n\n');
});

it('can generate an unordered list', function() {
  const writer = mdWriter.writer();
  writer.open('ul');
  writer.open('li');
  writer.text('Hello');
  writer.close('li');
  writer.open('li');
  writer.text('World');
  writer.close('li');
  writer.close('ul');
  return assert.strictEqual(writer.asString(), '- Hello\n- World\n\n');
});

it('can generate a nested ordered list with correct numbering', function() {
  const writer = mdWriter.writer();
  writer.open('ol');
  writer.open('li');
  writer.text('Outer One');

  writer.open('ol');
  writer.open('li');
  writer.text('Nested One');
  writer.close('li');
  writer.open('li');
  writer.text('Nested Two');
  writer.close('li');
  writer.close('ol');

  writer.close('li');
  writer.open('li');
  writer.text('Outer Two');
  writer.close('li');
  writer.close('ol');
  return assert.strictEqual(writer.asString(), '1. Outer One\n\t1. Nested One\n\t2. Nested Two\n2. Outer Two\n\n');
});

it('can generate a multi-level nested ordered list', function() {
  const writer = mdWriter.writer();
  writer.open('ol');
  writer.open('li');
  writer.text('Outer One');

  writer.open('ol');
  writer.open('li');
  writer.text('Nested One');

  writer.open('ol');
  writer.open('li');
  writer.text('Inner One');
  writer.close('li');
  writer.close('ol');

  writer.close('li');
  writer.close('ol');

  writer.close('li');
  writer.close('ol');
  return assert.strictEqual(writer.asString(), '1. Outer One\n\t1. Nested One\n\t\t1. Inner One\n\n');
});

it('new ordered list resets numbering', function() {
  const writer = mdWriter.writer();
  writer.open('ol');
  writer.open('li');
  writer.text('First');
  writer.close('li');
  writer.close('ol');

  writer.open('p');
  writer.text('Hello');
  writer.close('p');

  writer.open('ol');
  writer.open('li');
  writer.text('Second');
  writer.close('li');
  writer.close('ol');

  return assert.strictEqual(writer.asString(), '1. First\n\nHello\n\n1. Second\n\n');
});

it('can generate a nested unordered list', function() {
  const writer = mdWriter.writer();
  writer.open('ul');
  writer.open('li');
  writer.text('Outer One');

  writer.open('ul');
  writer.open('li');
  writer.text('Nested One');
  writer.close('li');
  writer.open('li');
  writer.text('Nested Two');
  writer.close('li');
  writer.close('ul');

  writer.close('li');
  writer.open('li');
  writer.text('Outer Two');
  writer.close('li');
  writer.close('ul');
  return assert.strictEqual(writer.asString(), '- Outer One\n\t- Nested One\n\t- Nested Two\n- Outer Two\n\n');
});

it('can nest inline elements', function() {
  const writer = mdWriter.writer();
  writer.open('p');
  writer.text('Lorem ');
  writer.open('strong');
  writer.text('ipsum ');
  writer.open('em');
  writer.text('dolor');
  writer.close('em');
  writer.text(' sit');
  writer.close('strong');
  writer.text(' amet');
  writer.close('p');
  return assert.strictEqual(writer.asString(), 'Lorem __ipsum *dolor* sit__ amet\n\n');
});

it('can emphasise list text', function() {
  const writer = mdWriter.writer();
  writer.open('ol');
  writer.open('li');
  writer.text('Hello ');
  writer.open('strong');
  writer.text('Strong');
  writer.close('strong');
  writer.text(' World');
  writer.close('li');
  writer.open('li');
  writer.text('Hello ');
  writer.open('em');
  writer.text('Emphasis');
  writer.close('em');
  writer.text(' World');
  writer.close('li');
  writer.close('ol');
  return assert.strictEqual(writer.asString(), '1. Hello __Strong__ World\n2. Hello *Emphasis* World\n\n');
});

it('generates correct spacing between paragraphs and lists', function() {
  const writer = mdWriter.writer();
  writer.open('p');
  writer.text('Hello World');
  writer.close('p');
  writer.open('ul');
  writer.open('li');
  writer.text('First Item');
  writer.close('li');
  writer.open('li');
  writer.text('Second Item');
  writer.close('li');
  writer.close('ul');
  writer.open('p');
  writer.text('Hello World');
  writer.close('p');
  return assert.strictEqual(writer.asString(), 'Hello World\n\n- First Item\n- Second Item\n\nHello World\n\n');
});
