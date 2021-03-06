'use strict';

const _ = require('underscore');

exports.readNumberingXml = readNumberingXml;
exports.Numbering = Numbering;
exports.defaultNumbering = new Numbering({}, {});

function Numbering(nums, abstractNums, styles) {
  const allLevels = _.flatten(_.values(abstractNums).map(function(abstractNum) {
    return _.values(abstractNum.levels);
  }));

  const levelsByParagraphStyleId = _.indexBy(
    allLevels.filter(function(level) {
      return level.paragraphStyleId != null;
    }),
    'paragraphStyleId'
  );

  function findLevel(numId, level) {
    const num = nums[numId];
    if (num) {
      const abstractNum = abstractNums[num.abstractNumId];
      if (abstractNum.numStyleLink == null) {
        return abstractNums[num.abstractNumId].levels[level];
      }
      const style = styles.findNumberingStyleById(abstractNum.numStyleLink);
      return findLevel(style.numId, level);

    }
    return null;

  }

  function findLevelByParagraphStyleId(styleId) {
    return levelsByParagraphStyleId[styleId] || null;
  }

  return {
    findLevel,
    findLevelByParagraphStyleId,
  };
}

function readNumberingXml(root, options) {
  if (!options || !options.styles) {
    throw new Error('styles is missing');
  }

  const abstractNums = readAbstractNums(root);
  const nums = readNums(root, abstractNums);
  return new Numbering(nums, abstractNums, options.styles);
}

function readAbstractNums(root) {
  const abstractNums = {};
  root.getElementsByTagName('w:abstractNum').forEach(function(element) {
    const id = element.attributes['w:abstractNumId'];
    abstractNums[id] = readAbstractNum(element);
  });
  return abstractNums;
}

function readAbstractNum(element) {
  const levels = {};
  element.getElementsByTagName('w:lvl').forEach(function(levelElement) {
    const levelIndex = levelElement.attributes['w:ilvl'];
    const numFmt = levelElement.first('w:numFmt').attributes['w:val'];
    const paragraphStyleId = levelElement.firstOrEmpty('w:pStyle').attributes['w:val'];

    levels[levelIndex] = {
      isOrdered: numFmt !== 'bullet',
      level: levelIndex,
      paragraphStyleId,
    };
  });

  const numStyleLink = element.firstOrEmpty('w:numStyleLink').attributes['w:val'];

  return { levels, numStyleLink };
}

function readNums(root) {
  const nums = {};
  root.getElementsByTagName('w:num').forEach(function(element) {
    const numId = element.attributes['w:numId'];
    const abstractNumId = element.first('w:abstractNumId').attributes['w:val'];
    nums[numId] = { abstractNumId };
  });
  return nums;
}
