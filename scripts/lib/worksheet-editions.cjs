'use strict';
// Node >=22.12 synchronously loads this ESM module (no top-level await).
// Explicit named exports preserve existing Node ESM and CJS consumers.
const api = require('./worksheet-editions.mjs');
exports.mergeWorksheetEditions = api.mergeWorksheetEditions;
exports.worksheetLearningId = api.worksheetLearningId;
exports.validateRamziReadiness = api.validateRamziReadiness;
