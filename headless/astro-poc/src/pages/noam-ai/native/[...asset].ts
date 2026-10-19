import type { APIRoute } from 'astro';
import bundle from '../../../generated/native-svg-bundle.json';
import { createNativeSvgResponder } from '../../../lib/nativeSvgResponse';

export const prerender = false;
const respond = createNativeSvgResponder(bundle);
export const GET: APIRoute = ({ params, request, locals }) => {
  const context = (locals ?? {}) as { runtime?: { env?: { ASSETS?: { fetch?: unknown } } }; env?: { ASSETS?: { fetch?: unknown } } };
  const assets = context.runtime?.env?.ASSETS ?? context.env?.ASSETS;
  return respond(params.asset, request.url, typeof assets?.fetch === 'function', request.headers.get('x-wix-forwarded-url'));
};
