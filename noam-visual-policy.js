/* global globalThis:readonly */
/* Geometry worksheet visual policy. Explicitly reviewed worksheet identities only.
 * This gate controls Ramzi visual aids, not textual hints or the original PDF.
 * It does not replace exact exercise membership/source integrity validation.
 * Mixed review/assessment, arithmetic, algebra-only, statistics/probability and
 * motion word-problem worksheets are denied even when one question has a graph.
 * Named native-package and catalog reuse aliases are explicit below.
 */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;}
  if(root){root.NoamVisualPolicy=api;}
})(typeof globalThis!=='undefined'?globalThis:typeof self!=='undefined'?self:this,function(){
  'use strict';
  var worksheets={
  "G7-T08": {
    "grade": 7,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G7-T08"
    ]
  },
  "G7-T09": {
    "grade": 7,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G7-T09"
    ]
  },
  "G7-T10": {
    "grade": 7,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G7-T10"
    ]
  },
  "G7-T11": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T11"
    ]
  },
  "G7-T12": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T12"
    ]
  },
  "G7-T13": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T13"
    ]
  },
  "G7-T14": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T14"
    ]
  },
  "G7-T15": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T15"
    ]
  },
  "G7-T16": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T16"
    ]
  },
  "G7-T17": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T17"
    ]
  },
  "G7-T18": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T18"
    ]
  },
  "G7-T19": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T19"
    ]
  },
  "G7-T20": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T20"
    ]
  },
  "G7-T31": {
    "grade": 7,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G7-T31"
    ]
  },
  "G7-T42": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T42"
    ]
  },
  "G7-T43": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T43"
    ]
  },
  "G7-T44": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T44"
    ]
  },
  "G7-T45": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T45"
    ]
  },
  "G7-T46": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T46"
    ]
  },
  "G7-T47": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T47"
    ]
  },
  "G7-T48": {
    "grade": 7,
    "category": "geometry",
    "exercisePrefixes": [
      "G7-T48"
    ]
  },
  "G8-CIRCLE": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T63"
    ]
  },
  "G8-INTERP": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T61"
    ]
  },
  "G8-T05": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T05"
    ]
  },
  "G8-T06": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T06"
    ]
  },
  "G8-T11": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T11"
    ]
  },
  "G8-T12": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T12"
    ]
  },
  "G8-T13": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T13"
    ]
  },
  "G8-T14": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T14"
    ]
  },
  "G8-T15": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T15"
    ]
  },
  "G8-T16": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T16"
    ]
  },
  "G8-T17": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T17"
    ]
  },
  "G8-T18": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T18"
    ]
  },
  "G8-T19": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T19"
    ]
  },
  "G8-T25": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T25"
    ]
  },
  "G8-T38": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T38"
    ]
  },
  "G8-T39": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T39"
    ]
  },
  "G8-T40": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T40"
    ]
  },
  "G8-T41": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T41"
    ]
  },
  "G8-T42": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T42"
    ]
  },
  "G8-T43": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T43"
    ]
  },
  "G8-T44": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T44"
    ]
  },
  "G8-T45": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T45"
    ]
  },
  "G8-T46": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T46"
    ]
  },
  "G8-T47": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T47"
    ]
  },
  "G8-T49": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T49"
    ]
  },
  "G8-T50": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T50"
    ]
  },
  "G8-T51": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T51"
    ]
  },
  "G8-T52": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T52"
    ]
  },
  "G8-T53": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T53"
    ]
  },
  "G8-T54": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T54"
    ]
  },
  "G8-T55": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T55"
    ]
  },
  "G8-T61": {
    "grade": 8,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G8-T61"
    ]
  },
  "G8-T62": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T62"
    ]
  },
  "G8-T63": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T63"
    ]
  },
  "G8-T65": {
    "grade": 8,
    "category": "geometry",
    "exercisePrefixes": [
      "G8-T65"
    ]
  },
  "G9-3060": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T37"
    ]
  },
  "G9-KITE": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T46"
    ]
  },
  "G9-SIDEANG": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T38"
    ]
  },
  "G9-T06": {
    "grade": 9,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G9-T06"
    ]
  },
  "G9-T07": {
    "grade": 9,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G9-T07"
    ]
  },
  "G9-T08": {
    "grade": 9,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G9-T08"
    ]
  },
  "G9-T12": {
    "grade": 9,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G9-T12"
    ]
  },
  "G9-T15": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T15"
    ]
  },
  "G9-T16": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T16",
      "G7-T16"
    ]
  },
  "G9-T17": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T17"
    ]
  },
  "G9-T18": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T18"
    ]
  },
  "G9-T19": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T19"
    ]
  },
  "G9-T20": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T20"
    ]
  },
  "G9-T21": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T21",
      "G7-T17"
    ]
  },
  "G9-T22": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T22",
      "G7-T42"
    ]
  },
  "G9-T23": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T23",
      "G7-T43"
    ]
  },
  "G9-T24": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T24",
      "G7-T18"
    ]
  },
  "G9-T25": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T25",
      "G7-T19"
    ]
  },
  "G9-T26": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T26",
      "G7-T45"
    ]
  },
  "G9-T27": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T27",
      "G7-T46"
    ]
  },
  "G9-T28": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T28",
      "G7-T47"
    ]
  },
  "G9-T29": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T29",
      "G7-T48"
    ]
  },
  "G9-T30": {
    "grade": 9,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G9-T30",
      "G7-T10"
    ]
  },
  "G9-T32": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T32"
    ]
  },
  "G9-T33": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T33"
    ]
  },
  "G9-T34": {
    "grade": 9,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G9-T34"
    ]
  },
  "G9-T35": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T35"
    ]
  },
  "G9-T36": {
    "grade": 9,
    "category": "analytic_geometry",
    "exercisePrefixes": [
      "G9-T36"
    ]
  },
  "G9-T37": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T37"
    ]
  },
  "G9-T38": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T38"
    ]
  },
  "G9-T39": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T39"
    ]
  },
  "G9-T40": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T40",
      "G9-T32"
    ]
  },
  "G9-T46": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T46"
    ]
  },
  "G9-TRAP": {
    "grade": 9,
    "category": "geometry",
    "exercisePrefixes": [
      "G9-T39"
    ]
  }
};
  var own=function(value,key){return Object.prototype.hasOwnProperty.call(value,key);};
  var exercisePrefixes=Object.create(null);
  Object.keys(worksheets).forEach(function(prefix){
    var row=worksheets[prefix];
    row.exercisePrefixes.forEach(function(p){exercisePrefixes[p]=true;});
    Object.freeze(row.exercisePrefixes);Object.freeze(row);
  });
  Object.freeze(worksheets);Object.freeze(exercisePrefixes);
  function exercisePrefix(id){
    if(typeof id!=='string'){return null;}
    var match=/^(G[789]-T[0-9]{2})-(?:A|B|E|E2)-Q([0-9]{1,3})(?:[א-ת][0-9]{0,2})?$/.exec(id);
    return match&&Number(match[2])>0&&own(exercisePrefixes,match[1])?match[1]:null;
  }
  function allowsExerciseId(id){return exercisePrefix(id)!==null;}
  function allowsWorksheet(meta){
    if(!meta||typeof meta!=='object'||Array.isArray(meta)||!own(meta,'grade')||!own(meta,'prefix')){return false;}
    var grade=meta.grade;
    if(typeof grade==='string'&&/^[789]$/.test(grade)){grade=Number(grade);}
    if(typeof grade!=='number'||!Number.isInteger(grade)||typeof meta.prefix!=='string'||!own(worksheets,meta.prefix)){return false;}
    var row=worksheets[meta.prefix];if(row.grade!==grade){return false;}
    // Presence with an undefined/malformed value fails closed as well.
    if('exerciseId' in meta){var prefix=exercisePrefix(meta.exerciseId);return !!prefix&&row.exercisePrefixes.indexOf(prefix)>=0;}
    return true;
  }
  return Object.freeze({version:'20261029-geometry-only-v1',allowsWorksheet:allowsWorksheet,allowsExerciseId:allowsExerciseId});
});
