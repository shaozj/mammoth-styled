'use strict';

const assert = require('assert');

const xml = require('../../lib/xml');
const writer = require('../../lib/xml/writer');


it('writing empty root element writes out xml declaration and empty root element', function() {
  assertXmlString(xml.element('root'), {}, '<root/>');
});

it('can write empty child elements', function() {
  assertXmlString(xml.element('root', {}, [ xml.element('album'), xml.element('single') ]), {},
    '<root><album/><single/></root>');
});

it('can write empty descendant elements', function() {
  const element = xml.element('root', {}, [
    xml.element('album', {}, [
      xml.element('year'),
      xml.element('song'),
    ]),
  ]);
  assertXmlString(element, {},
    '<root><album><year/><song/></album></root>');
});

it('can write element attributes', function() {
  const element = xml.element('root', {}, [
    xml.element('album', { title: 'Everything in Transit' }),
  ]);
  assertXmlString(element, {},
    '<root><album title="Everything in Transit"/></root>');
});

it('can write text nodes', function() {
  const element = xml.element('root', {}, [
    xml.element('album', {}, [
      xml.text('Everything in Transit'),
    ]),
  ]);
  assertXmlString(element, {},
    '<root><album>Everything in Transit</album></root>');
});

it('can write root element with long-form prefix when URI is namespace', function() {
  const element = xml.element('{music}root');
  assertXmlString(element, { m: 'music' },
    '<m:root xmlns:m="music"/>');
});

it('can write child elements with long-form prefix when URI is namespace', function() {
  const element = xml.element('root', {}, [
    xml.element('{music}album'),
  ]);
  assertXmlString(element, { m: 'music' },
    '<root xmlns:m="music"><m:album/></root>');
});

it('can write child elements with short-form prefix when URI is namespace', function() {
  const element = xml.element('root', {}, [
    xml.element('m:album'),
  ]);
  assertXmlString(element, { m: 'music' },
    '<root xmlns:m="music"><m:album/></root>');
});

it('default namespace has key of empty string', function() {
  const element = xml.element('root', {}, [
    xml.element('{music}album'),
  ]);
  assertXmlString(element, { '': 'music' },
    '<root xmlns="music"><album/></root>');
});


function assertXmlString(element, namespaces, expectedString) {
  assert.strictEqual(writer.writeString(element, namespaces),
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        expectedString);
}
