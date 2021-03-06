'use strict';

const _ = require('underscore');
const cloneDeep = require('lodash.clonedeep');

const promises = require('./promises');
const documents = require('./documents');
const htmlPaths = require('./styles/html-paths');
const results = require('./results');
const images = require('./images');
const Html = require('./html');
const writers = require('./writers');

exports.DocumentConverter = DocumentConverter;

const commentAuthorLabel = exports.commentAuthorLabel = function commentAuthorLabel(comment) {
  return comment.authorInitials || '';
};


function DocumentConverter(options) {
  return {
    convertToHtml(element) {
      const comments = _.indexBy(
        element.type === documents.types.document ? element.comments : [],
        'commentId'
      );
      const conversion = new DocumentConversion(options, comments);
      return conversion.convertToHtml(element);
    },
  };
}

function DocumentConversion(options, comments) {
  let noteNumber = 1;

  const noteReferences = [];

  const referencedComments = [];

  options = _.extend({ ignoreEmptyParagraphs: true }, options);
  const idPrefix = options.idPrefix === undefined ? '' : options.idPrefix;
  const ignoreEmptyParagraphs = options.ignoreEmptyParagraphs;

  const defaultParagraphStyle = htmlPaths.topLevelElement('p');

  const styleMap = options.styleMap || [];

  const elementConverters = {
    document(document, messages, options) {
      const children = convertElements(document.children, messages, options);
      const notes = noteReferences.map(function(noteReference) {
        return document.notes.resolve(noteReference);
      });
      const notesNodes = convertElements(notes, messages, options);
      return children.concat([
        Html.freshElement('ol', {}, notesNodes),
        Html.freshElement('dl', {}, flatMap(referencedComments, function(referencedComment) {
          return convertComment(referencedComment, messages, options);
        })),
      ]);
    },
    paragraph: convertParagraph,
    run: convertRun,
    text(element) {
      return [ Html.text(element.value) ];
    },
    tab() {
      return [ Html.text('\t') ];
    },
    hyperlink(element, messages, options) {
      const href = element.anchor ? '#' + htmlId(element.anchor) : element.href;
      const attributes = { href };
      if (element.targetFrame != null) {
        attributes.target = element.targetFrame;
      }

      const children = convertElements(element.children, messages, options);
      return [ Html.nonFreshElement('a', attributes, children) ];
    },
    bookmarkStart(element) {
      const anchor = Html.freshElement('a', {
        id: htmlId(element.name),
      }, [ Html.forceWrite ]);
      return [ anchor ];
    },
    noteReference(element) {
      noteReferences.push(element);
      const anchor = Html.freshElement('a', {
        href: '#' + noteHtmlId(element),
        id: noteRefHtmlId(element),
      }, [ Html.text('[' + (noteNumber++) + ']') ]);

      return [ Html.freshElement('sup', {}, [ anchor ]) ];
    },
    note(element, messages, options) {
      const children = convertElements(element.body, messages, options);
      const backLink = Html.elementWithTag(htmlPaths.element('p', {}, { fresh: false }), [
        Html.text(' '),
        Html.freshElement('a', { href: '#' + noteRefHtmlId(element) }, [ Html.text('↑') ]),
      ]);
      const body = children.concat([ backLink ]);

      return Html.freshElement('li', { id: noteHtmlId(element) }, body);
    },
    commentReference: convertCommentReference,
    comment: convertComment,
    image: deferredConversion(recoveringConvertImage(options.convertImage || images.dataUri)),
    table: convertTable,
    tableRow: convertTableRow,
    tableCell: convertTableCell,
    break: convertBreak,
  };

  function convertToHtml(document) {
    const messages = [];

    const html = elementToHtml(document, messages, {});

    const deferredNodes = [];
    walkHtml(html, function(node) {
      if (node.type === 'deferred') {
        deferredNodes.push(node);
      }
    });
    const deferredValues = {};
    return promises.mapSeries(deferredNodes, function(deferred) {
      return deferred.value().then(function(value) {
        deferredValues[deferred.id] = value;
      });
    }).then(function() {
      function replaceDeferred(nodes) {
        return flatMap(nodes, function(node) {
          if (node.type === 'deferred') {
            return deferredValues[node.id];
          } else if (node.children) {
            return [
              _.extend({}, node, {
                children: replaceDeferred(node.children),
              }),
            ];
          }
          return [ node ];

        });
      }
      const writer = writers.writer({
        prettyPrint: options.prettyPrint,
        outputFormat: options.outputFormat,
      });
      Html.write(writer, Html.simplify(replaceDeferred(html)));
      return new results.Result(writer.asString(), messages);
    });
  }

  function convertElements(elements, messages, options) {
    return flatMap(elements, function(element) {
      return elementToHtml(element, messages, options);
    });
  }

  function elementToHtml(element, messages, options) {
    if (!options) {
      throw new Error('options not set');
    }
    const handler = elementConverters[element.type];
    if (handler) {
      return handler(element, messages, options);
    }
    return [];

  }

  function convertParagraph(element, messages, options) {
    return htmlPathForParagraph(element, messages).wrap(function() {
      const content = convertElements(element.children, messages, options);
      if (ignoreEmptyParagraphs) {
        return content;
      }
      return [ Html.forceWrite ].concat(content);

    });
  }

  function htmlPathForParagraph(element, messages) {
    const style = findStyle(element);
    let path;

    if (style) {
      path = cloneDeep(style.to);
    } else {
      if (element.styleId) {
        messages.push(unrecognisedStyleWarning('paragraph', element));
      }
      path = cloneDeep(defaultParagraphStyle);
    }

    if (element.alignment) {
      const alignStyle = 'text-align:' + element.alignment + ';';
      path._elements.forEach(ele => {
        if (ele.addAttribute) {
          ele.addAttribute({
            style: ele.attributes.style ? alignStyle + ele.attributes.style : alignStyle,
          });
        }
      });
    }

    return path;
  }

  function convertRun(run, messages, options) {
    let nodes = function() {
      return convertElements(run.children, messages, options);
    };
    const paths = [];
    if (run.isSmallCaps) {
      paths.push(findHtmlPathForRunProperty('smallCaps'));
    }
    if (run.isAllCaps) {
      paths.push(findHtmlPathForRunProperty('allCaps'));
    }
    if (run.isStrikethrough) {
      paths.push(findHtmlPathForRunProperty('strikethrough', 's'));
    }
    if (run.isUnderline) {
      paths.push(findHtmlPathForRunProperty('underline'));
    }
    if (run.verticalAlignment === documents.verticalAlignment.subscript) {
      paths.push(htmlPaths.element('sub', {}, { fresh: false }));
    }
    if (run.verticalAlignment === documents.verticalAlignment.superscript) {
      paths.push(htmlPaths.element('sup', {}, { fresh: false }));
    }
    if (run.isItalic) {
      paths.push(findHtmlPathForRunProperty('italic', 'em'));
    }
    if (run.isBold) {
      paths.push(findHtmlPathForRunProperty('bold', 'strong'));
    }
    const inlineStyle = [];
    if (run.color) {
      inlineStyle.push('color:#' + run.color);
    }
    if (run.highlight) {
      inlineStyle.push('background-color:' + run.highlight);
    }
    if (inlineStyle.length > 0) {
      paths.push(htmlPaths.element('span', { style: inlineStyle.join(';') }, { fresh: false }));
    }

    let stylePath = htmlPaths.empty;
    const style = findStyle(run);
    if (style) {
      stylePath = style.to;
    } else if (run.styleId) {
      messages.push(unrecognisedStyleWarning('run', run));
    }
    paths.push(stylePath);

    paths.forEach(function(path) {
      nodes = path.wrap.bind(path, nodes);
    });

    return nodes();
  }

  function findHtmlPathForRunProperty(elementType, defaultTagName) {
    const path = findHtmlPath({ type: elementType });
    if (path) {
      return path;
    } else if (defaultTagName) {
      return htmlPaths.element(defaultTagName, {}, { fresh: false });
    }
    return htmlPaths.empty;

  }

  function findHtmlPath(element, defaultPath) {
    const style = findStyle(element);
    return style ? style.to : defaultPath;
  }

  function findStyle(element) {
    for (let i = 0; i < styleMap.length; i++) {
      if (styleMap[i].from.matches(element)) {
        return styleMap[i];
      }
    }
  }

  function recoveringConvertImage(convertImage) {
    return function(image, messages) {
      return promises.attempt(function() {
        return convertImage(image, messages);
      }).caught(function(error) {
        messages.push(results.error(error));
        return [];
      });
    };
  }

  function noteHtmlId(note) {
    return referentHtmlId(note.noteType, note.noteId);
  }

  function noteRefHtmlId(note) {
    return referenceHtmlId(note.noteType, note.noteId);
  }

  function referentHtmlId(referenceType, referenceId) {
    return htmlId(referenceType + '-' + referenceId);
  }

  function referenceHtmlId(referenceType, referenceId) {
    return htmlId(referenceType + '-ref-' + referenceId);
  }

  function htmlId(suffix) {
    return idPrefix + suffix;
  }

  const defaultTablePath = htmlPaths.elements([
    htmlPaths.element('table', {}, { fresh: true }),
  ]);

  function convertTable(element, messages, options) {
    return findHtmlPath(element, defaultTablePath).wrap(function() {
      return convertTableChildren(element, messages, options);
    });
  }

  function convertTableChildren(element, messages, options) {
    let bodyIndex = _.findIndex(element.children, function(child) {
      return !child.type === documents.types.tableRow || !child.isHeader;
    });
    if (bodyIndex === -1) {
      bodyIndex = element.children.length;
    }
    let children;
    if (bodyIndex === 0) {
      children = convertElements(
        element.children,
        messages,
        _.extend({}, options, { isTableHeader: false })
      );
    } else {
      const headRows = convertElements(
        element.children.slice(0, bodyIndex),
        messages,
        _.extend({}, options, { isTableHeader: true })
      );
      const bodyRows = convertElements(
        element.children.slice(bodyIndex),
        messages,
        _.extend({}, options, { isTableHeader: false })
      );
      children = [
        Html.freshElement('thead', {}, headRows),
        Html.freshElement('tbody', {}, bodyRows),
      ];
    }
    return [ Html.forceWrite ].concat(children);
  }

  function convertTableRow(element, messages, options) {
    const children = convertElements(element.children, messages, options);
    return [
      Html.freshElement('tr', {}, [ Html.forceWrite ].concat(children)),
    ];
  }

  function convertTableCell(element, messages, options) {
    const tagName = options.isTableHeader ? 'th' : 'td';
    const children = convertElements(element.children, messages, options);
    const attributes = {};
    if (element.colSpan !== 1) {
      attributes.colspan = element.colSpan.toString();
    }
    if (element.rowSpan !== 1) {
      attributes.rowspan = element.rowSpan.toString();
    }

    return [
      Html.freshElement(tagName, attributes, [ Html.forceWrite ].concat(children)),
    ];
  }

  function convertCommentReference(reference) {
    return findHtmlPath(reference, htmlPaths.ignore).wrap(function() {
      const comment = comments[reference.commentId];
      const count = referencedComments.length + 1;
      const label = '[' + commentAuthorLabel(comment) + count + ']';
      referencedComments.push({ label, comment });
      // TODO: remove duplication with note references
      return [
        Html.freshElement('a', {
          href: '#' + referentHtmlId('comment', reference.commentId),
          id: referenceHtmlId('comment', reference.commentId),
        }, [ Html.text(label) ]),
      ];
    });
  }

  function convertComment(referencedComment, messages, options) {
    // TODO: remove duplication with note references

    const label = referencedComment.label;
    const comment = referencedComment.comment;
    const body = convertElements(comment.body, messages, options).concat([
      Html.nonFreshElement('p', {}, [
        Html.text(' '),
        Html.freshElement('a', { href: '#' + referenceHtmlId('comment', comment.commentId) }, [
          Html.text('↑'),
        ]),
      ]),
    ]);

    return [
      Html.freshElement(
        'dt',
        { id: referentHtmlId('comment', comment.commentId) },
        [ Html.text('Comment ' + label) ]
      ),
      Html.freshElement('dd', {}, body),
    ];
  }

  function convertBreak(element) {
    return htmlPathForBreak(element).wrap(function() {
      return [];
    });
  }

  function htmlPathForBreak(element) {
    const style = findStyle(element);
    if (style) {
      return style.to;
    } else if (element.breakType === 'line') {
      return htmlPaths.topLevelElement('br');
    }
    return htmlPaths.empty;

  }

  return {
    convertToHtml,
  };
}

let deferredId = 1;

function deferredConversion(func) {
  return function(element, messages, options) {
    return [
      {
        type: 'deferred',
        id: deferredId++,
        value() {
          return func(element, messages, options);
        },
      },
    ];
  };
}

function unrecognisedStyleWarning(type, element) {
  return results.warning(
    'Unrecognised ' + type + " style: '" + element.styleName + "'" +
        ' (Style ID: ' + element.styleId + ')'
  );
}

function flatMap(values, func) {
  return _.flatten(values.map(func), true);
}

function walkHtml(nodes, callback) {
  nodes.forEach(function(node) {
    callback(node);
    if (node.children) {
      walkHtml(node.children, callback);
    }
  });
}

