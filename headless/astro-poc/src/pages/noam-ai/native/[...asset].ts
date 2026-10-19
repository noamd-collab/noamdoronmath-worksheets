import type { APIRoute } from 'astro';
import bundle from '../../../generated/native-svg-bundle.json';
import { createNativeSvgResponder } from '../../../lib/nativeSvgResponse';

export const prerender = false;
const respond = createNativeSvgResponder(bundle);
export const GET: APIRoute = ({ params, request }) => respond(params.asset, request.url);
