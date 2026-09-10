/*
 * backend/events.js
 *
 * If the site already has a backend/events.js, do NOT replace it - append the
 * handlers below to the end of the existing file, keeping its own handlers.
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
