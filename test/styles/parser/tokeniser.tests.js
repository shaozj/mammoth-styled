'use strict';

const hamjest = require('hamjest');
const assertThat = hamjest.assertThat;
const contains = hamjest.contains;
const hasProperties = hamjest.hasProperties;

const tokenise = require('../../../lib/styles/parser/tokeniser').tokenise;


it('unknown tokens are tokenised', function() {
  assertTokens('~', [ isToken('unrecognisedCharacter', '~') ]);
});

it('empty string is tokenised to end of file token', function() {
  assertTokens('', []);
});

it('whitespace is tokenised', function() {
  assertTokens(' \t\t  ', [ isToken('whitespace') ]);
});

it('identifiers are tokenised', function() {
  assertTokens('Overture', [ isToken('identifier', 'Overture') ]);
});

it('integers are tokenised', function() {
  assertTokens('123', [ isToken('integer', '123') ]);
});

it('strings are tokenised', function() {
  assertTokens("'Tristan'", [ isToken('string', 'Tristan') ]);
});

it('unterminated strings are tokenised', function() {
  assertTokens("'Tristan", [ isToken('unterminated-string', 'Tristan') ]);
});

it('arrows are tokenised', function() {
  assertTokens('=>', [ isToken('arrow') ]);
});

it('classes are tokenised', function() {
  assertTokens('.overture', [ isToken('dot'), isToken('identifier', 'overture') ]);
});

it('colons are tokenised', function() {
  assertTokens('::', [ isToken('colon'), isToken('colon') ]);
});

it('greater thans are tokenised', function() {
  assertTokens('>>', [ isToken('gt'), isToken('gt') ]);
});

it('equals are tokenised', function() {
  assertTokens('==', [ isToken('equals'), isToken('equals') ]);
});

it('startsWith symbols are tokenised', function() {
  assertTokens('^=^=', [ isToken('startsWith'), isToken('startsWith') ]);
});

it('open parens are tokenised', function() {
  assertTokens('((', [ isToken('open-paren'), isToken('open-paren') ]);
});

it('close parens are tokenised', function() {
  assertTokens('))', [ isToken('close-paren'), isToken('close-paren') ]);
});

it('open square brackets are tokenised', function() {
  assertTokens('[[', [ isToken('open-square-bracket'), isToken('open-square-bracket') ]);
});

it('close square brackets are tokenised', function() {
  assertTokens(']]', [ isToken('close-square-bracket'), isToken('close-square-bracket') ]);
});

it('choices are tokenised', function() {
  assertTokens('||', [ isToken('choice'), isToken('choice') ]);
});

it('can tokenise multiple tokens', function() {
  assertTokens('The Magic Position', [
    isToken('identifier', 'The'),
    isToken('whitespace'),
    isToken('identifier', 'Magic'),
    isToken('whitespace'),
    isToken('identifier', 'Position'),
  ]);
});

function assertTokens(input, expectedTokens) {
  assertThat(
    tokenise(input),
    contains.apply(null, expectedTokens.concat([ isToken('end', null) ]))
  );
}

function isToken(tokenType, value) {
  return hasProperties({
    name: tokenType,
    value,
  });
}
