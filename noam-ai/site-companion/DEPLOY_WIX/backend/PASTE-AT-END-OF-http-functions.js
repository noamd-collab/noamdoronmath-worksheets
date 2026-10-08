/*
 * Paste this whole file at the BOTTOM of the existing backend/http-functions.js.
 * Do not delete or replace anything that is already in that file.
 * These wrappers are explicit, same as blog-audio-pipeline/DEPLOY_WIX/backend/http-functions.js.
 */
import * as noamSiteCompanion from 'backend/noam-site-companion';

export function options_noamSiteCompanion(request) {
  return noamSiteCompanion.options_noamSiteCompanion(request);
}

export function post_noamSiteCompanion(request) {
  return noamSiteCompanion.post_noamSiteCompanion(request);
}
