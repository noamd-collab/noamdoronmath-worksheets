import { resolveNativeSvgPublicOrigin } from './nativeSvgResponse';
import type { WordBank } from './teacherWordSelection';

type Descriptor = { bundlePath: string; bundleSha256: string; bundleBytes: number };

/** Load immutable public questions separately from worker code. Integrity is
 * checked before decoding; a transient failure never poisons the cached bank. */
export function createWordBankLoader(descriptor: Descriptor, fetchBundle: typeof fetch = fetch, development = false) {
  if (!/^\/teachers\/word-content\.[a-f0-9]{64}\.json$/.test(descriptor.bundlePath)
    || !descriptor.bundlePath.endsWith(`.${descriptor.bundleSha256}.json`)
    || !Number.isSafeInteger(descriptor.bundleBytes) || descriptor.bundleBytes < 1 || descriptor.bundleBytes > 8_000_000) {
    throw new Error('Invalid Word bundle descriptor');
  }
  let loading: Promise<WordBank> | undefined;
  return async (requestUrl: string, forwardedUrl?: string | null): Promise<WordBank> => {
    let origin = resolveNativeSvgPublicOrigin(requestUrl, forwardedUrl);
    if (!origin && development) {
      const url = new URL(requestUrl);
      if (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
        && !url.username && !url.password) origin = url.origin;
    }
    if (!origin) throw new Error('No approved Word public origin');
    loading ??= (async () => {
      const response = await fetchBundle(new URL(descriptor.bundlePath, origin), {
        redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error('Word bundle unavailable');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== descriptor.bundleBytes) throw new Error('Word bundle length mismatch');
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map(b => b.toString(16).padStart(2, '0')).join('');
      if (digest !== descriptor.bundleSha256) throw new Error('Word bundle hash mismatch');
      const encoded = JSON.parse(new TextDecoder().decode(bytes));
      const compressed = Uint8Array.from(atob(encoded.gzipBase64), c => c.charCodeAt(0));
      const bank = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
      if (bank.version !== 1 || !bank.sheets || typeof bank.sheets !== 'object') throw new Error('Invalid Word bank');
      return bank as WordBank;
    })().catch(error => { loading = undefined; throw error; });
    return loading;
  };
}
