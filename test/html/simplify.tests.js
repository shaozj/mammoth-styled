const assert = require('assert');

const _ = require('underscore');


const html = require('../../lib/html');
const htmlPaths = require('../../lib/styles/html-paths');

const nonFreshElement = html.nonFreshElement;
const text = html.text;

it('empty text nodes are removed', function() {
  assert.deepStrictEqual(
    simplifyNode(text('')),
    []
  );
});

it('elements with no children are removed', function() {
  assert.deepStrictEqual(
    simplifyNode(nonFreshElement('p', {}, [])),
    []
  );
});

it('elements only containing empty nodes are removed', function() {
  assert.deepStrictEqual(
    simplifyNode(nonFreshElement('p', {}, [ text('') ])),
    []
  );
});

it('empty children of element are removed', function() {
  assert.deepStrictEqual(
    simplifyNode(nonFreshElement('p', {}, [ text('Hello'), text('') ])),
    [ nonFreshElement('p', {}, [ text('Hello') ]) ]
  );
});

it('successive fresh elements are not collapsed', function() {
  const path = htmlPaths.elements([
    htmlPaths.element('p', {}, { fresh: true }),
  ]);
  const original = concat(
    pathToNodes(path, [ text('Hello') ]),
    pathToNodes(path, [ text(' there') ])
  );

  assert.deepStrictEqual(
    html.simplify(original),
    original);
});

it('successive plain non-fresh elements are collapsed if they have the same tag name', function() {
  const path = htmlPaths.elements([
    htmlPaths.element('p', {}, { fresh: false }),
  ]);
  assert.deepStrictEqual(
    html.simplify(concat(
      pathToNodes(path, [ text('Hello') ]),
      pathToNodes(path, [ text(' there') ])
    )),
    pathToNodes(path, [ text('Hello'), text(' there') ])
  );
});

it('non-fresh can collapse into preceding fresh element', function() {
  const freshPath = htmlPaths.elements([
    htmlPaths.element('p', {}, { fresh: true }) ]);
  const nonFreshPath = htmlPaths.elements([
    htmlPaths.element('p', {}, { fresh: false }) ]);
  assert.deepStrictEqual(
    html.simplify(concat(
      pathToNodes(freshPath, [ text('Hello') ]),
      pathToNodes(nonFreshPath, [ text(' there') ])
    )),
    pathToNodes(freshPath, [ text('Hello'), text(' there') ])
  );
});

it('children of collapsed element can collapse with children of another collapsed element', function() {
  assert.deepStrictEqual(
    html.simplify([
      nonFreshElement('blockquote', {}, [ nonFreshElement('p', {}, [ text('Hello') ]) ]),
      nonFreshElement('blockquote', {}, [ nonFreshElement('p', {}, [ text('there') ]) ]),
    ]),
    [ nonFreshElement('blockquote', {}, [ nonFreshElement('p', {}, [ text('Hello'), text('there') ]) ]) ]
  );
});

it('empty elements are removed before collapsing', function() {
  const freshPath = htmlPaths.elements([
    htmlPaths.element('p', {}, { fresh: true }) ]);
  const nonFreshPath = htmlPaths.elements([
    htmlPaths.element('p', {}, { fresh: false }) ]);
  assert.deepStrictEqual(
    html.simplify(concat(
      pathToNodes(nonFreshPath, [ text('Hello') ]),
      pathToNodes(freshPath, []),
      pathToNodes(nonFreshPath, [ text(' there') ])
    )),
    pathToNodes(nonFreshPath, [ text('Hello'), text(' there') ])
  );
});

it('when separator is present then separator is prepended to collapsed element', function() {
  const unseparatedPath = htmlPaths.elements([
    htmlPaths.element('pre', {}, { fresh: false }),
  ]);
  const separatedPath = htmlPaths.elements([
    htmlPaths.element('pre', {}, { fresh: false, separator: '\n' }),
  ]);
  assert.deepStrictEqual(
    html.simplify(concat(
      pathToNodes(unseparatedPath, [ text('Hello') ]),
      pathToNodes(separatedPath, [ text(' the'), text('re') ])
    )),
    pathToNodes(unseparatedPath, [ text('Hello'), text('\n'), text(' the'), text('re') ])
  );
});

function simplifyNode(node) {
  return html.simplify([ node ]);
}

function concat() {
  return _.flatten(arguments, true);
}

function pathToNodes(path, nodes) {
  return path.wrap(function() {
    return nodes;
  });
}
