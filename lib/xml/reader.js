'use strict';

const promises = require('../promises');
const sax = require('sax');
const _ = require('underscore');

const nodes = require('./nodes');
const Element = nodes.Element;

exports.readString = readString;

function readString(xmlString, namespaceMap) {
  namespaceMap = namespaceMap || {};

  let finished = false;
  const parser = sax.parser(true, { xmlns: true, position: false });

  const rootElement = { children: [] };
  let currentElement = rootElement;
  const stack = [];

  const deferred = promises.defer();

  parser.onopentag = function(node) {
    const attributes = mapObject(node.attributes, function(attribute) {
      return attribute.value;
    }, mapName);

    const element = new Element(mapName(node), attributes);
    currentElement.children.push(element);
    stack.push(currentElement);
    currentElement = element;
  };

  function mapName(node) {
    if (node.uri) {
      const mappedPrefix = namespaceMap[node.uri];
      let prefix;
      if (mappedPrefix) {
        prefix = mappedPrefix + ':';
      } else {
        prefix = '{' + node.uri + '}';
      }
      return prefix + node.local;
    }
    return node.local;

  }

  parser.onclosetag = function() {
    currentElement = stack.pop();
  };

  parser.ontext = function(text) {
    if (currentElement !== rootElement) {
      currentElement.children.push(nodes.text(text));
    }
  };

  parser.onend = function() {
    if (!finished) {
      finished = true;
      deferred.resolve(rootElement.children[0]);
    }
  };

  parser.onerror = function(error) {
    if (!finished) {
      finished = true;
      deferred.reject(error);
    }
  };

  parser.write(xmlString).close();

  return deferred.promise;
}

function mapObject(input, valueFunc, keyFunc) {
  return _.reduce(input, function(result, value, key) {
    const mappedKey = keyFunc(value, key, input);
    result[mappedKey] = valueFunc(value, key, input);
    return result;
  }, {});
}
