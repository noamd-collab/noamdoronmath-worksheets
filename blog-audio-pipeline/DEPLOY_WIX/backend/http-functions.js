/*
 * backend/http-functions.js
 *
 * Routes for the blog narration audio.
 *
 * If the site already has a backend/http-functions.js, do NOT replace it - append
 * everything from the import line down to the end of the existing file instead.
 *
 * These wrappers are deliberately explicit rather than `export ... from`, so the
 * exported names Wix looks for are unambiguous.
 */

import * as blogAudio from 'backend/blog-audio';

// Public
export function get_blogAudioInfo(request) { return blogAudio.get_blogAudioInfo(request); }
export function get_blogAudio(request) { return blogAudio.get_blogAudio(request); }

// Worker only - Authorization: Bearer <NOAM_AUDIO_WORKER_TOKEN>
export function get_blogAudioPosts(request) { return blogAudio.get_blogAudioPosts(request); }
export function get_blogAudioPost(request) { return blogAudio.get_blogAudioPost(request); }
export function get_blogAudioQueue(request) { return blogAudio.get_blogAudioQueue(request); }
export function post_blogAudioUploadUrl(request) { return blogAudio.post_blogAudioUploadUrl(request); }
export function post_blogAudioRegister(request) { return blogAudio.post_blogAudioRegister(request); }
