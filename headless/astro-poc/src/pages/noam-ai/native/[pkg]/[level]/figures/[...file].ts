/**
 * GET /noam-ai/native/{package}/{level}/figures/{file}.svg
 * Original URL and original SVG bytes. The file lives in a grade bundle.
 */
import type { APIRoute } from 'astro';
import descriptor from '../../../../../../generated/native-svg-bundles.json';
import { createNativeSvgResponder, type NativeSvgDescriptor } from '../../../../../../lib/nativeSvgResponse';

export const prerender = false;

const respond = createNativeSvgResponder(descriptor as NativeSvgDescriptor);

export const GET: APIRoute = ({ params, request, locals }) => {
  const rest = Array.isArray(params.file) ? params.file.join('/') : String(params.file || '');
  const asset = `${params.pkg}/${params.level}/figures/${rest}`;
  const context = (locals ?? {}) as { runtime?: { env?: { ASSETS?: { fetch?: typeof fetch } } }; env?: { ASSETS?: { fetch?: typeof fetch } } };
  const assets = context.runtime?.env?.ASSETS ?? context.env?.ASSETS;
  const fetchBundle = typeof assets?.fetch === 'function'
    ? ((url: URL | RequestInfo, _options?: RequestInit) => assets.fetch!(url instanceof URL ? url.toString() : url))
    : undefined;
  return respond(asset, request.url, typeof assets?.fetch === 'function', request.headers.get('x-wix-forwarded-url'), fetchBundle);
};
