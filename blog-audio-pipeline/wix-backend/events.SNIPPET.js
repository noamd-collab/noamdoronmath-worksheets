/*
 * Append to backend/events.js (create the file if the site does not have one).
 *
 * These handlers only flag work. Nothing here calls Gemini, and nothing here runs
 * while a visitor is on the page. Backend events do not fire in Preview - test on
 * the published site.
 */

import { onPostPublishedOrUpdated, onPostRemoved } from 'backend/blog-audio';

export function wixBlog_onPostCreated(event) {
  return onPostPublishedOrUpdated(event.metadata.entityId);
}

export function wixBlog_onPostUpdated(event) {
  return onPostPublishedOrUpdated(event.metadata.entityId);
}

export function wixBlog_onPostDeleted(event) {
  return onPostRemoved(event.metadata.entityId);
}
