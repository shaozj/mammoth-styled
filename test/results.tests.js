'use strict';

const assert = require('assert');

const results = require('../lib/results');
const Result = results.Result;


it('Result.combine removes any duplicate messages', function() {
  const first = new Result(null, [ results.warning('Warning...') ]);
  const second = new Result(null, [ results.warning('Warning...') ]);

  const combined = Result.combine([ first, second ]);

  assert.deepStrictEqual(combined.messages, [ results.warning('Warning...') ]);
});
