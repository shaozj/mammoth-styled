'use strict';

exports.createBodyReader = createBodyReader;
exports._readNumberingProperties = readNumberingProperties;

const dingbatToUnicode = require('dingbat-to-unicode');
const _ = require('underscore');

const documents = require('../documents');
const Result = require('../results').Result;
const warning = require('../results').warning;
const uris = require('./uris');

function createBodyReader(options) {
  return {
    readXmlElement(element) {
      return new BodyReader(options).readXmlElement(element);
    },
    readXmlElements(elements) {
      return new BodyReader(options).readXmlElements(elements);
    },
  };
}

function BodyReader(options) {
  const complexFieldStack = [];
  let currentInstrText = [];
  const relationships = options.relationships;
  const contentTypes = options.contentTypes;
  const docxFile = options.docxFile;
  const files = options.files;
  const numbering = options.numbering;
  const styles = options.styles;

  const xmlElementReaders = {
    'w:p': function(element) {
      return readXmlElements(element.children)
        .map(function(children) {
          const properties = _.find(children, isParagraphProperties);
          return new documents.Paragraph(
            children.filter(negate(isParagraphProperties)),
            properties
          );
        })
        .insertExtra();
    },
    'w:pPr': function(element) {
      return readParagraphStyle(element).map(function(style) {
        return {
          type: 'paragraphProperties',
          styleId: style.styleId,
          styleName: style.name,
          // TODO: 先不读取外联样式，后续优化
          alignment: element.firstOrEmpty('w:jc').attributes['w:val'], // || style.alignment
          numbering: readNumberingProperties(style.styleId, element.firstOrEmpty('w:numPr'), numbering),
          indent: readParagraphIndent(element.firstOrEmpty('w:ind')),
        };
      });
    },
    'w:r': function(element) {
      return readXmlElements(element.children)
        .map(function(children) {
          const properties = _.find(children, isRunProperties);
          children = children.filter(negate(isRunProperties));

          const hyperlinkHref = currentHyperlinkHref();
          if (hyperlinkHref !== null) {
            children = [ new documents.Hyperlink(children, { href: hyperlinkHref }) ];
          }

          return new documents.Run(children, properties);
        });
    },
    'w:rPr': readRunProperties,
    'w:fldChar': readFldChar,
    'w:instrText': readInstrText,
    'w:t': function(element) {
      return elementResult(new documents.Text(element.text()));
    },
    'w:tab': function() {
      return elementResult(new documents.Tab());
    },
    'w:noBreakHyphen': function() {
      return elementResult(new documents.Text('\u2011'));
    },
    'w:softHyphen': function() {
      return elementResult(new documents.Text('\u00AD'));
    },
    'w:sym': readSymbol,
    'w:hyperlink': function(element) {
      const relationshipId = element.attributes['r:id'];
      const anchor = element.attributes['w:anchor'];
      return readXmlElements(element.children).map(function(children) {
        function create(options) {
          const targetFrame = element.attributes['w:tgtFrame'] || null;

          return new documents.Hyperlink(
            children,
            _.extend({ targetFrame }, options)
          );
        }

        if (relationshipId) {
          let href = relationships.findTargetByRelationshipId(relationshipId);
          if (anchor) {
            href = uris.replaceFragment(href, anchor);
          }
          return create({ href });
        } else if (anchor) {
          return create({ anchor });
        }
        return children;

      });
    },
    'w:tbl': readTable,
    'w:tr': readTableRow,
    'w:tc': readTableCell,
    'w:footnoteReference': noteReferenceReader('footnote'),
    'w:endnoteReference': noteReferenceReader('endnote'),
    'w:commentReference': readCommentReference,
    'w:br': function(element) {
      const breakType = element.attributes['w:type'];
      if (breakType == null || breakType === 'textWrapping') {
        return elementResult(documents.lineBreak);
      } else if (breakType === 'page') {
        return elementResult(documents.pageBreak);
      } else if (breakType === 'column') {
        return elementResult(documents.columnBreak);
      }
      return emptyResultWithMessages([ warning('Unsupported break type: ' + breakType) ]);

    },
    'w:bookmarkStart': function(element) {
      const name = element.attributes['w:name'];
      if (name === '_GoBack') {
        return emptyResult();
      }
      return elementResult(new documents.BookmarkStart({ name }));

    },

    'mc:AlternateContent': function(element) {
      return readChildElements(element.first('mc:Fallback'));
    },

    'w:sdt': function(element) {
      return readXmlElements(element.firstOrEmpty('w:sdtContent').children);
    },

    'w:ins': readChildElements,
    'w:object': readChildElements,
    'w:smartTag': readChildElements,
    'w:drawing': readChildElements,
    'w:pict': function(element) {
      return readChildElements(element).toExtra();
    },
    'v:roundrect': readChildElements,
    'v:shape': readChildElements,
    'v:textbox': readChildElements,
    'w:txbxContent': readChildElements,
    'wp:inline': readDrawingElement,
    'wp:anchor': readDrawingElement,
    'v:imagedata': readImageData,
    'v:group': readChildElements,
    'v:rect': readChildElements,
  };

  const supportedImageTypes = {
    'image/png': true,
    'image/gif': true,
    'image/jpeg': true,
    'image/svg+xml': true,
    'image/tiff': true,
  };

  const ignoreElements = {
    'office-word:wrap': true,
    'v:shadow': true,
    'v:shapetype': true,
    'w:annotationRef': true,
    'w:bookmarkEnd': true,
    'w:sectPr': true,
    'w:proofErr': true,
    'w:lastRenderedPageBreak': true,
    'w:commentRangeStart': true,
    'w:commentRangeEnd': true,
    'w:del': true,
    'w:footnoteRef': true,
    'w:endnoteRef': true,
    'w:tblPr': true,
    'w:tblGrid': true,
    'w:trPr': true,
    'w:tcPr': true,
  };


  function readXmlElements(elements) {
    const results = elements.map(readXmlElement);
    return combineResults(results);
  }

  function readXmlElement(element) {
    if (element.type === 'element') {
      const handler = xmlElementReaders[element.name];
      if (handler) {
        return handler(element);
      } else if (!Object.prototype.hasOwnProperty.call(ignoreElements, element.name)) {
        const message = warning('An unrecognised element was ignored: ' + element.name);
        return emptyResultWithMessages([ message ]);
      }
    }
    return emptyResult();
  }

  function readParagraphIndent(element) {
    return {
      start: element.attributes['w:start'] || element.attributes['w:left'],
      end: element.attributes['w:end'] || element.attributes['w:right'],
      firstLine: element.attributes['w:firstLine'],
      hanging: element.attributes['w:hanging'],
    };
  }

  function readRunProperties(element) {
    return readRunStyle(element).map(function(style) {
      const fontSizeString = element.firstOrEmpty('w:sz').attributes['w:val'];
      // w:sz gives the font size in half points, so halve the value to get the size in points
      const fontSize = /^[0-9]+$/.test(fontSizeString) ? parseInt(fontSizeString, 10) / 2 : null;

      return {
        type: 'runProperties',
        highlight: element.firstOrEmpty('w:highlight').attributes['w:val'],
        color: element.firstOrEmpty('w:color').attributes['w:val'],
        styleId: style.styleId,
        styleName: style.name,
        verticalAlignment: element.firstOrEmpty('w:vertAlign').attributes['w:val'],
        font: element.firstOrEmpty('w:rFonts').attributes['w:ascii'],
        fontSize,
        isBold: readBooleanElement(element.first('w:b')),
        isUnderline: readUnderline(element.first('w:u')),
        isItalic: readBooleanElement(element.first('w:i')),
        isStrikethrough: readBooleanElement(element.first('w:strike')),
        isAllCaps: readBooleanElement(element.first('w:caps')),
        isSmallCaps: readBooleanElement(element.first('w:smallCaps')),
      };
    });
  }

  function readUnderline(element) {
    if (element) {
      const value = element.attributes['w:val'];
      return value !== 'false' && value !== '0' && value !== 'none';
    }
    return false;

  }

  function readBooleanElement(element) {
    if (element) {
      const value = element.attributes['w:val'];
      return value !== 'false' && value !== '0';
    }
    return false;

  }

  function readParagraphStyle(element) {
    return readStyle(element, 'w:pStyle', 'Paragraph', styles.findParagraphStyleById);
  }

  function readRunStyle(element) {
    return readStyle(element, 'w:rStyle', 'Run', styles.findCharacterStyleById);
  }

  function readTableStyle(element) {
    return readStyle(element, 'w:tblStyle', 'Table', styles.findTableStyleById);
  }

  function readStyle(element, styleTagName, styleType, findStyleById) {
    const messages = [];
    const styleElement = element.first(styleTagName);
    let styleId = null;
    let name = null;
    let style;
    if (styleElement) {
      styleId = styleElement.attributes['w:val'];
      if (styleId) {
        style = findStyleById(styleId);
        if (style) {
          name = style.name;
        } else {
          messages.push(undefinedStyleWarning(styleType, styleId));
        }
      }
    }
    return elementResultWithMessages({ ...style, styleId, name }, messages);
  }

  const unknownComplexField = { type: 'unknown' };

  function readFldChar(element) {
    const type = element.attributes['w:fldCharType'];
    if (type === 'begin') {
      complexFieldStack.push(unknownComplexField);
      currentInstrText = [];
    } else if (type === 'end') {
      complexFieldStack.pop();
    } else if (type === 'separate') {
      const href = parseHyperlinkFieldCode(currentInstrText.join(''));
      const complexField = href === null ? unknownComplexField : { type: 'hyperlink', href };
      complexFieldStack.pop();
      complexFieldStack.push(complexField);
    }
    return emptyResult();
  }

  function currentHyperlinkHref() {
    const topHyperlink = _.last(complexFieldStack.filter(function(complexField) {
      return complexField.type === 'hyperlink';
    }));
    return topHyperlink ? topHyperlink.href : null;
  }

  function parseHyperlinkFieldCode(code) {
    const result = /\s*HYPERLINK "(.*)"/.exec(code);
    if (result) {
      return result[1];
    }
    return null;

  }

  function readInstrText(element) {
    currentInstrText.push(element.text());
    return emptyResult();
  }

  function readSymbol(element) {
    // See 17.3.3.30 sym (Symbol Character) of ECMA-376 4th edition Part 1
    const font = element.attributes['w:font'];
    const char = element.attributes['w:char'];
    let unicodeCharacter = dingbatToUnicode.hex(font, char);
    if (unicodeCharacter == null && /^F0..$/.test(char)) {
      unicodeCharacter = dingbatToUnicode.hex(font, char.substring(2));
    }

    if (unicodeCharacter == null) {
      return emptyResultWithMessages([ warning(
        'A w:sym element with an unsupported character was ignored: char ' + char + ' in font ' + font
      ) ]);
    }
    return elementResult(new documents.Text(unicodeCharacter.string));

  }

  function noteReferenceReader(noteType) {
    return function(element) {
      const noteId = element.attributes['w:id'];
      return elementResult(new documents.NoteReference({
        noteType,
        noteId,
      }));
    };
  }

  function readCommentReference(element) {
    return elementResult(documents.commentReference({
      commentId: element.attributes['w:id'],
    }));
  }

  function readChildElements(element) {
    return readXmlElements(element.children);
  }

  return {
    readXmlElement,
    readXmlElements,
  };

  function readTable(element) {
    const propertiesResult = readTableProperties(element.firstOrEmpty('w:tblPr'));
    return readXmlElements(element.children)
      .flatMap(calculateRowSpans)
      .flatMap(function(children) {
        return propertiesResult.map(function(properties) {
          return documents.Table(children, properties);
        });
      });
  }

  function readTableProperties(element) {
    return readTableStyle(element).map(function(style) {
      return {
        styleId: style.styleId,
        styleName: style.name,
      };
    });
  }

  function readTableRow(element) {
    const properties = element.firstOrEmpty('w:trPr');
    const isHeader = !!properties.first('w:tblHeader');
    return readXmlElements(element.children).map(function(children) {
      return documents.TableRow(children, { isHeader });
    });
  }

  function readTableCell(element) {
    return readXmlElements(element.children).map(function(children) {
      const properties = element.firstOrEmpty('w:tcPr');

      const gridSpan = properties.firstOrEmpty('w:gridSpan').attributes['w:val'];
      const colSpan = gridSpan ? parseInt(gridSpan, 10) : 1;

      const cell = documents.TableCell(children, { colSpan });
      cell._vMerge = readVMerge(properties);
      return cell;
    });
  }

  function readVMerge(properties) {
    const element = properties.first('w:vMerge');
    if (element) {
      const val = element.attributes['w:val'];
      return val === 'continue' || !val;
    }
    return null;

  }

  function calculateRowSpans(rows) {
    const unexpectedNonRows = _.any(rows, function(row) {
      return row.type !== documents.types.tableRow;
    });
    if (unexpectedNonRows) {
      return elementResultWithMessages(rows, [ warning(
        'unexpected non-row element in table, cell merging may be incorrect'
      ) ]);
    }
    const unexpectedNonCells = _.any(rows, function(row) {
      return _.any(row.children, function(cell) {
        return cell.type !== documents.types.tableCell;
      });
    });
    if (unexpectedNonCells) {
      return elementResultWithMessages(rows, [ warning(
        'unexpected non-cell element in table row, cell merging may be incorrect'
      ) ]);
    }

    const columns = {};

    rows.forEach(function(row) {
      let cellIndex = 0;
      row.children.forEach(function(cell) {
        if (cell._vMerge && columns[cellIndex]) {
          columns[cellIndex].rowSpan++;
        } else {
          columns[cellIndex] = cell;
          cell._vMerge = false;
        }
        cellIndex += cell.colSpan;
      });
    });

    rows.forEach(function(row) {
      row.children = row.children.filter(function(cell) {
        return !cell._vMerge;
      });
      row.children.forEach(function(cell) {
        delete cell._vMerge;
      });
    });

    return elementResult(rows);
  }

  function readDrawingElement(element) {
    const blips = element
      .getElementsByTagName('a:graphic')
      .getElementsByTagName('a:graphicData')
      .getElementsByTagName('pic:pic')
      .getElementsByTagName('pic:blipFill')
      .getElementsByTagName('a:blip');

    return combineResults(blips.map(readBlip.bind(null, element)));
  }

  function readBlip(element, blip) {
    const properties = element.first('wp:docPr').attributes;
    const altText = isBlank(properties.descr) ? properties.title : properties.descr;
    return readImage(findBlipImageFile(blip), altText);
  }

  function isBlank(value) {
    return value == null || /^\s*$/.test(value);
  }

  function findBlipImageFile(blip) {
    const embedRelationshipId = blip.attributes['r:embed'];
    const linkRelationshipId = blip.attributes['r:link'];
    if (embedRelationshipId) {
      return findEmbeddedImageFile(embedRelationshipId);
    }
    const imagePath = relationships.findTargetByRelationshipId(linkRelationshipId);
    return {
      path: imagePath,
      read: files.read.bind(files, imagePath),
    };

  }

  function readImageData(element) {
    const relationshipId = element.attributes['r:id'];

    if (relationshipId) {
      return readImage(
        findEmbeddedImageFile(relationshipId),
        element.attributes['o:title']);
    }
    return emptyResultWithMessages([ warning('A v:imagedata element without a relationship ID was ignored') ]);

  }

  function findEmbeddedImageFile(relationshipId) {
    const path = uris.uriToZipEntryName('word', relationships.findTargetByRelationshipId(relationshipId));
    return {
      path,
      read: docxFile.read.bind(docxFile, path),
    };
  }

  function readImage(imageFile, altText) {
    const contentType = contentTypes.findContentType(imageFile.path);

    const image = documents.Image({
      readImage: imageFile.read,
      altText,
      contentType,
    });
    const warnings = supportedImageTypes[contentType] ?
      [] : warning('Image of type ' + contentType + ' is unlikely to display in web browsers');
    return elementResultWithMessages(image, warnings);
  }

  function undefinedStyleWarning(type, styleId) {
    return warning(
      type + ' style with ID ' + styleId + ' was referenced but not defined in the document');
  }
}


function readNumberingProperties(styleId, element, numbering) {
  if (styleId != null) {
    const levelByStyleId = numbering.findLevelByParagraphStyleId(styleId);
    if (levelByStyleId != null) {
      return levelByStyleId;
    }
  }

  const level = element.firstOrEmpty('w:ilvl').attributes['w:val'];
  const numId = element.firstOrEmpty('w:numId').attributes['w:val'];
  if (level === undefined || numId === undefined) {
    return null;
  }
  return numbering.findLevel(numId, level);

}

function isParagraphProperties(element) {
  return element.type === 'paragraphProperties';
}

function isRunProperties(element) {
  return element.type === 'runProperties';
}

function negate(predicate) {
  return function(value) {
    return !predicate(value);
  };
}

function emptyResultWithMessages(messages) {
  return new ReadResult(null, null, messages);
}

function emptyResult() {
  return new ReadResult(null);
}

function elementResult(element) {
  return new ReadResult(element);
}

function elementResultWithMessages(element, messages) {
  return new ReadResult(element, null, messages);
}

function ReadResult(element, extra, messages) {
  this.value = element || [];
  this.extra = extra;
  this._result = new Result({
    element: this.value,
    extra,
  }, messages);
  this.messages = this._result.messages;
}

ReadResult.prototype.toExtra = function() {
  return new ReadResult(null, joinElements(this.extra, this.value), this.messages);
};

ReadResult.prototype.insertExtra = function() {
  const extra = this.extra;
  if (extra && extra.length) {
    return new ReadResult(joinElements(this.value, extra), null, this.messages);
  }
  return this;

};

ReadResult.prototype.map = function(func) {
  const result = this._result.map(function(value) {
    return func(value.element);
  });
  return new ReadResult(result.value, this.extra, result.messages);
};

ReadResult.prototype.flatMap = function(func) {
  const result = this._result.flatMap(function(value) {
    return func(value.element)._result;
  });
  return new ReadResult(result.value.element, joinElements(this.extra, result.value.extra), result.messages);
};

function combineResults(results) {
  const result = Result.combine(_.pluck(results, '_result'));
  return new ReadResult(
    _.flatten(_.pluck(result.value, 'element')),
    _.filter(_.flatten(_.pluck(result.value, 'extra')), identity),
    result.messages
  );
}

function joinElements(first, second) {
  return _.flatten([ first, second ]);
}

function identity(value) {
  return value;
}
