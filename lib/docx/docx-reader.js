'use strict';

exports.read = read;
exports._findPartPaths = findPartPaths;

const path = require('path');

const promises = require('../promises');
const documents = require('../documents');
const Result = require('../results').Result;
const zipfile = require('../zipfile');

const readXmlFromZipFile = require('./office-xml-reader').readXmlFromZipFile;
const createBodyReader = require('./body-reader').createBodyReader;
const DocumentXmlReader = require('./document-xml-reader').DocumentXmlReader;
const relationshipsReader = require('./relationships-reader');
const contentTypesReader = require('./content-types-reader');
const numberingXml = require('./numbering-xml');
const stylesReader = require('./styles-reader');
const notesReader = require('./notes-reader');
const commentsReader = require('./comments-reader');
const Files = require('./files').Files;

const readContentTypesFromZipFile = xmlFileReader({
  filename: '[Content_Types].xml',
  readElement: contentTypesReader.readContentTypesFromXml,
  defaultValue: contentTypesReader.defaultContentTypes,
});

function read(docxFile, input) {
  input = input || {};

  return promises.props({
    contentTypes: readContentTypesFromZipFile(docxFile),
    partPaths: findPartPaths(docxFile),
    docxFile,
    files: new Files(input.path ? path.dirname(input.path) : null),
  }).also(function(result) {
    return {
      styles: readStylesFromZipFile(docxFile, result.partPaths.styles),
    };
  }).also(function(result) {
    return {
      numbering: readNumberingFromZipFile(docxFile, result.partPaths.numbering, result.styles),
    };
  })
    .also(function(result) {
      return {
        footnotes: readXmlFileWithBody(result.partPaths.footnotes, result, function(bodyReader, xml) {
          if (xml) {
            return notesReader.createFootnotesReader(bodyReader)(xml);
          }
          return new Result([]);

        }),
        endnotes: readXmlFileWithBody(result.partPaths.endnotes, result, function(bodyReader, xml) {
          if (xml) {
            return notesReader.createEndnotesReader(bodyReader)(xml);
          }
          return new Result([]);

        }),
        comments: readXmlFileWithBody(result.partPaths.comments, result, function(bodyReader, xml) {
          if (xml) {
            return commentsReader.createCommentsReader(bodyReader)(xml);
          }
          return new Result([]);

        }),
      };
    })
    .also(function(result) {
      return {
        notes: result.footnotes.flatMap(function(footnotes) {
          return result.endnotes.map(function(endnotes) {
            return new documents.Notes(footnotes.concat(endnotes));
          });
        }),
      };
    })
    .then(function(result) {
      return readXmlFileWithBody(result.partPaths.mainDocument, result, function(bodyReader, xml) {
        return result.notes.flatMap(function(notes) {
          return result.comments.flatMap(function(comments) {
            const reader = new DocumentXmlReader({
              bodyReader,
              notes,
              comments,
            });
            return reader.convertXmlToDocument(xml);
          });
        });
      });
    });
}

const readPackageRelationships = xmlFileReader({
  filename: '_rels/.rels',
  readElement: relationshipsReader.readRelationships,
  defaultValue: relationshipsReader.defaultValue,
});

function findPartPaths(docxFile) {
  return readPackageRelationships(docxFile).then(function(packageRelationships) {
    const mainDocumentPath = findPartPath({
      docxFile,
      relationships: packageRelationships,
      relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
      basePath: '',
      fallbackPath: 'word/document.xml',
    });

    if (!docxFile.exists(mainDocumentPath)) {
      throw new Error('Could not find main document part. Are you sure this is a valid .docx file?');
    }

    return xmlFileReader({
      filename: relationshipsFilename(mainDocumentPath),
      readElement: relationshipsReader.readRelationships,
      defaultValue: relationshipsReader.defaultValue,
    })(docxFile).then(function(documentRelationships) {
      function findPartRelatedToMainDocument(name) {
        return findPartPath({
          docxFile,
          relationships: documentRelationships,
          relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/' + name,
          basePath: zipfile.splitPath(mainDocumentPath).dirname,
          fallbackPath: 'word/' + name + '.xml',
        });
      }

      return {
        mainDocument: mainDocumentPath,
        comments: findPartRelatedToMainDocument('comments'),
        endnotes: findPartRelatedToMainDocument('endnotes'),
        footnotes: findPartRelatedToMainDocument('footnotes'),
        numbering: findPartRelatedToMainDocument('numbering'),
        styles: findPartRelatedToMainDocument('styles'),
      };
    });
  });
}

function findPartPath(options) {
  const docxFile = options.docxFile;
  const relationships = options.relationships;
  const relationshipType = options.relationshipType;
  const basePath = options.basePath;
  const fallbackPath = options.fallbackPath;

  const targets = relationships.findTargetsByType(relationshipType);
  const normalisedTargets = targets.map(function(target) {
    return stripPrefix(zipfile.joinPath(basePath, target), '/');
  });
  const validTargets = normalisedTargets.filter(function(target) {
    return docxFile.exists(target);
  });
  if (validTargets.length === 0) {
    return fallbackPath;
  }
  return validTargets[0];

}

function stripPrefix(value, prefix) {
  if (value.substring(0, prefix.length) === prefix) {
    return value.substring(prefix.length);
  }
  return value;

}

function xmlFileReader(options) {
  return function(zipFile) {
    return readXmlFromZipFile(zipFile, options.filename)
      .then(function(element) {
        return element ? options.readElement(element) : options.defaultValue;
      });
  };
}

function readXmlFileWithBody(filename, options, func) {
  const readRelationshipsFromZipFile = xmlFileReader({
    filename: relationshipsFilename(filename),
    readElement: relationshipsReader.readRelationships,
    defaultValue: relationshipsReader.defaultValue,
  });

  return readRelationshipsFromZipFile(options.docxFile).then(function(relationships) {
    const bodyReader = new createBodyReader({
      relationships,
      contentTypes: options.contentTypes,
      docxFile: options.docxFile,
      numbering: options.numbering,
      styles: options.styles,
      files: options.files,
    });
    return readXmlFromZipFile(options.docxFile, filename)
      .then(function(xml) {
        return func(bodyReader, xml);
      });
  });
}

function relationshipsFilename(filename) {
  const split = zipfile.splitPath(filename);
  return zipfile.joinPath(split.dirname, '_rels', split.basename + '.rels');
}

function readNumberingFromZipFile(zipFile, path, styles) {
  return xmlFileReader({
    filename: path,
    readElement(element) {
      return numberingXml.readNumberingXml(element, { styles });
    },
    defaultValue: numberingXml.defaultNumbering,
  })(zipFile);
}

function readStylesFromZipFile(zipFile, path) {
  return xmlFileReader({
    filename: path,
    readElement: stylesReader.readStylesXml,
    defaultValue: stylesReader.defaultStyles,
  })(zipFile);
}
