'use strict';

const assert = require('assert');

const _ = require('underscore');

const documents = require('../lib/documents');
const transforms = require('../lib/transforms');

describe('paragraph()', function() {
  it('paragraph is transformed', function() {
    const paragraph = documents.paragraph([]);
    const result = transforms.paragraph(function() {
      return documents.tab();
    })(paragraph);
    assert.deepStrictEqual(result, documents.tab());
  });

  it('non-paragraph elements are not transformed', function() {
    const run = documents.run([]);
    const result = transforms.paragraph(function() {
      return documents.tab();
    })(run);
    assert.deepStrictEqual(result, documents.run([]));
  });
});


describe('run()', function() {
  it('run is transformed', function() {
    const run = documents.run([]);
    const result = transforms.run(function() {
      return documents.tab();
    })(run);
    assert.deepStrictEqual(result, documents.tab());
  });

  it('non-run elements are not transformed', function() {
    const paragraph = documents.paragraph([]);
    const result = transforms.run(function() {
      return documents.tab();
    })(paragraph);
    assert.deepStrictEqual(result, documents.paragraph([]));
  });
});


describe('elements()', function() {
  it('all descendants are transformed', function() {
    const root = {
      children: [
        {
          children: [
            {},
          ],
        },
      ],
    };
    let currentCount = 0;
    function setCount(node) {
      currentCount++;
      return _.extend(node, { count: currentCount });
    }

    const result = transforms._elements(setCount)(root);

    assert.deepStrictEqual(result, {
      count: 3,
      children: [
        {
          count: 2,
          children: [
            { count: 1 },
          ],
        },
      ],
    });
  });
});


describe('getDescendants()', function() {
  it('returns nothing if element has no children property', function() {
    assert.deepStrictEqual(transforms.getDescendants({}), []);
  });

  it('returns nothing if element has empty children', function() {
    assert.deepStrictEqual(transforms.getDescendants({ children: [] }), []);
  });

  it('includes children', function() {
    const element = {
      children: [{ name: 'child 1' }, { name: 'child 2' }],
    };
    assert.deepStrictEqual(
      transforms.getDescendants(element),
      [{ name: 'child 1' }, { name: 'child 2' }]
    );
  });

  it('includes indirect descendants', function() {
    const grandchild = { name: 'grandchild' };
    const child = { name: 'child', children: [ grandchild ] };
    const element = { children: [ child ] };
    assert.deepStrictEqual(
      transforms.getDescendants(element),
      [ grandchild, child ]
    );
  });
});


it('getDescendantsOfType() filters descendants to type', function() {
  const paragraph = { type: 'paragraph' };
  const run = { type: 'run' };
  const element = {
    children: [ paragraph, run ],
  };
  assert.deepStrictEqual(
    transforms.getDescendantsOfType(element, 'run'),
    [ run ]
  );
});
