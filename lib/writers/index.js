'use strict';

const htmlWriter = require('./html-writer');
const markdownWriter = require('./markdown-writer');

exports.writer = writer;


function writer(options) {
  options = options || {};
  if (options.outputFormat === 'markdown') {
    return markdownWriter.writer();
  }
  return htmlWriter.writer(options);

}
