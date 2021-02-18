'use strict';

const assert = require('assert');

const _ = require('underscore');

const optionsReader = require('../lib/options-reader');
const standardOptions = optionsReader._standardOptions;
const readOptions = optionsReader.readOptions;


it('standard options are used if options is undefined', function() {
  const options = readOptions(undefined);
  assert.deepStrictEqual(standardOptions, _.omit(options, 'customStyleMap', 'readStyleMap'));
  assert.deepStrictEqual(options.customStyleMap, []);
});

it('standard options are used if options is empty', function() {
  const options = readOptions({});
  assert.deepStrictEqual(standardOptions, _.omit(options, 'customStyleMap', 'readStyleMap'));
  assert.deepStrictEqual(options.customStyleMap, []);
});

it('custom style map as string is prepended to standard style map', function() {
  const options = readOptions({
    styleMap: 'p.SectionTitle => h2',
  });
  const styleMap = options.readStyleMap();
  assert.deepStrictEqual('p.SectionTitle => h2', styleMap[0]);
  assert.deepStrictEqual(optionsReader._defaultStyleMap, styleMap.slice(1));
});

it('custom style map as array is prepended to standard style map', function() {
  const options = readOptions({
    styleMap: [ 'p.SectionTitle => h2' ],
  });
  const styleMap = options.readStyleMap();
  assert.deepStrictEqual('p.SectionTitle => h2', styleMap[0]);
  assert.deepStrictEqual(optionsReader._defaultStyleMap, styleMap.slice(1));
});

it('lines starting with # in custom style map are ignored', function() {
  const options = readOptions({
    styleMap: '# p.SectionTitle => h3\np.SectionTitle => h2',
  });
  const styleMap = options.readStyleMap();
  assert.deepStrictEqual('p.SectionTitle => h2', styleMap[0]);
  assert.deepStrictEqual(optionsReader._defaultStyleMap, styleMap.slice(1));
});

it('blank lines in custom style map are ignored', function() {
  const options = readOptions({
    styleMap: '\n\n',
  });
  assert.deepStrictEqual(optionsReader._defaultStyleMap, options.readStyleMap());
});

it('default style mappings are ignored if includeDefaultStyleMap is false', function() {
  const options = readOptions({
    styleMap: 'p.SectionTitle => h2',
    includeDefaultStyleMap: false,
  });
  assert.deepStrictEqual([ 'p.SectionTitle => h2' ], options.readStyleMap());
});
