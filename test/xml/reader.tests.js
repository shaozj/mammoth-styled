'use strict';

const assert = require('assert');

const xmlreader = require('../../lib/xml/reader');


it('should read self-closing element', function() {
  return xmlreader.readString('<body/>').then(function(result) {
    assert.deepStrictEqual({ type: 'element', name: 'body', attributes: {}, children: [] }, { ...result });
  });
});

it('should read empty element with separate closing tag', function() {
  return xmlreader.readString('<body></body>').then(function(result) {
    assert.deepStrictEqual({ type: 'element', name: 'body', attributes: {}, children: [] }, { ...result });
  });
});

it('should read attributes of tags', function() {
  return xmlreader.readString('<body name="bob"/>').then(function(result) {
    assert.deepStrictEqual({ name: 'bob' }, result.attributes);
  });
});

it('can read text element', function() {
  return xmlreader.readString('<body>Hello!</body>').then(function(result) {
    assert.deepStrictEqual({ type: 'text', value: 'Hello!' }, result.children[0]);
  });
});

it('should read element with children', function() {
  return xmlreader.readString('<body><a/><b/></body>').then(function(root) {
    assert.strictEqual(2, root.children.length);
    assert.strictEqual('a', root.children[0].name);
    assert.strictEqual('b', root.children[1].name);
  });
});

it('unmapped namespaces URIs are included in braces as prefix', function() {
  return xmlreader.readString('<w:body xmlns:w="word"/>').then(function(result) {
    assert.deepStrictEqual(result.name, '{word}body');
  });
});

it('mapped namespaces URIs are translated using map', function() {
  const namespaceMap = {
    word: 'x',
  };

  return xmlreader.readString('<w:body xmlns:w="word"/>', namespaceMap).then(function(result) {
    assert.deepStrictEqual(result.name, 'x:body');
  });
});

it('namespace of attributes is mapped to prefix', function() {
  const namespaceMap = {
    word: 'x',
  };
  const xmlString = '<w:body xmlns:w="word" w:val="Hello!"/>';
  return xmlreader.readString(xmlString, namespaceMap).then(function(result) {
    assert.deepStrictEqual(result.attributes['x:val'], 'Hello!');
  });
});

it('can find first element with name', function() {
  return xmlreader.readString('<body><a/><b index="1"/><b index="2"/></body>').then(function(result) {
    const first = result.first('b');
    assert.strictEqual('1', first.attributes.index);
  });
});

it('whitespace between xml declaration and root tag is ignored', function() {
  return xmlreader.readString('<?xml version="1.0" ?>\n<body/>').then(function(result) {
    assert.deepStrictEqual('body', result.name);
  });
});

it('error if XML is badly formed', function() {
  return xmlreader.readString('<bo').then(function() {
    throw new Error('Expected failure');
  }, function(error) {
    assert.ok(error);
    return 1;
  });
});
