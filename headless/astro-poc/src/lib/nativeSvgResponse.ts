type NativeSvgEntry = { body: string; sha256: string; bytes: number };
type NativeSvgDescriptor = {
  bundlePath: string;
  bundleSha256: string;
  bundleBytes: number;
  sha256: string;
};

async function sha256(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Fetch only the generated same-origin static asset; decode once after integrity checks. */
export function createNativeSvgResponder(descriptor: NativeSvgDescriptor, fetchBundle: typeof fetch = (...args) => fetch(...args)) {
  if (!/^\/noam-ai\/native-svg-bundle\.[a-f0-9]{64}\.json$/.test(descriptor.bundlePath)
    || !descriptor.bundlePath.endsWith(`.${descriptor.bundleSha256}.json`)) throw new Error('Invalid native SVG bundle descriptor');
  let decoded: Promise<Record<string, NativeSvgEntry>> | undefined;
  return async (asset: string | undefined, requestUrl: string): Promise<Response> => {
    if (!asset || !/^[A-Za-z0-9_-]+\/[abc]\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.svg$/.test(asset)
      || asset.split('/').some((part) => part === '.' || part === '..')) {
      return new Response(null, { status: 404 });
    }
    decoded ??= (async () => {
      const origin = new URL(requestUrl).origin;
      const response = await fetchBundle(new URL(descriptor.bundlePath, origin), { redirect: 'error', credentials: 'omit' });
      if (!response.ok) throw new Error('Native SVG bundle unavailable');
      const publicBytes = await response.arrayBuffer();
      if (publicBytes.byteLength !== descriptor.bundleBytes || await sha256(publicBytes) !== descriptor.bundleSha256) throw new Error('Native SVG static bundle integrity mismatch');
      const bundle = JSON.parse(new TextDecoder().decode(publicBytes));
      const compressed = Uint8Array.from(atob(bundle.gzipBase64), (char) => char.charCodeAt(0));
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
      const bytes = await new Response(stream).arrayBuffer();
      if (await sha256(bytes) !== descriptor.sha256) throw new Error('Native SVG decoded bundle integrity mismatch');
      return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, NativeSvgEntry>;
    })().catch((error) => { decoded = undefined; throw error; });
    let entries: Record<string, NativeSvgEntry>;
    try { entries = await decoded; } catch { return new Response(null, { status: 503, headers: { 'X-Noam-Native-Svg-Error': 'bundle-unavailable' } }); }
    if (!Object.hasOwn(entries, asset)) return new Response(null, { status: 404 });
    const entry = entries[asset];
    return new Response(entry.body, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        ETag: `"${entry.sha256}"`,
      },
    });
  };
}
