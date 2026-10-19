type NativeSvgEntry = { body: string; sha256: string; bytes: number };
type NativeSvgDescriptor = {
  bundlePath: string;
  bundleSha256: string;
  bundleBytes: number;
  sha256: string;
};

type LoadPhase = 'origin' | 'fetch' | 'http' | 'read' | 'length' | 'hash' | 'json' | 'base64' | 'inflate' | 'decoded-hash' | 'decoded-json';
class BundleLoadError extends Error {
  constructor(readonly phase: LoadPhase, readonly status: number) { super('Native SVG bundle load failed'); }
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Wix Managed Hosting terminates TLS before SSR. Its installed html-embeds
 * middleware documents x-wix-forwarded-url as the edge-owned public URL;
 * x-forwarded-proto describes the internal HTTP hop and must not be used here.
 * Limit this fetch to this site's exact production and preview hostname family.
 */
export function resolveNativeSvgPublicOrigin(requestUrl: string, forwardedUrl?: string | null): string | undefined {
  for (const candidate of [forwardedUrl, requestUrl]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) continue;
      if (url.hostname === 'www.noamdoronmath.co.il' || url.hostname === 'noamdoronmath.co.il'
        || /^[a-z0-9]{6}-noam-math-astro-poc-amiramnoam-130a\.wix-site-host\.com$/.test(url.hostname)) return url.origin;
    } catch { /* Invalid public URLs are never used as fetch destinations. */ }
  }
  return undefined;
}

/** Fetch only the generated same-origin static asset; decode once after integrity checks. */
export function createNativeSvgResponder(descriptor: NativeSvgDescriptor, fetchBundle: typeof fetch = (...args) => fetch(...args)) {
  if (!/^\/noam-ai\/native-svg-bundle\.[a-f0-9]{64}\.json$/.test(descriptor.bundlePath)
    || !descriptor.bundlePath.endsWith(`.${descriptor.bundleSha256}.json`)) throw new Error('Invalid native SVG bundle descriptor');
  let decoded: Promise<Record<string, NativeSvgEntry>> | undefined;
  return async (asset: string | undefined, requestUrl: string, assetsBindingAvailable = false, forwardedUrl?: string | null): Promise<Response> => {
    if (!asset || !/^[A-Za-z0-9_-]+\/[abc]\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.svg$/.test(asset)
      || asset.split('/').some((part) => part === '.' || part === '..')) {
      return new Response(null, { status: 404 });
    }
    decoded ??= (async () => {
      let phase: LoadPhase = 'origin';
      let status = 0;
      try {
        const origin = resolveNativeSvgPublicOrigin(requestUrl, forwardedUrl);
        if (!origin) throw new Error('No approved native SVG public origin');
        phase = 'fetch';
        const response = await fetchBundle(new URL(descriptor.bundlePath, origin), { redirect: 'error', credentials: 'omit' });
        status = response.status;
        phase = 'http';
        if (!response.ok) throw new Error('Native SVG bundle unavailable');
        phase = 'read';
        const publicBytes = await response.arrayBuffer();
        phase = 'length';
        if (publicBytes.byteLength !== descriptor.bundleBytes) throw new Error('Native SVG static bundle length mismatch');
        phase = 'hash';
        if (await sha256(publicBytes) !== descriptor.bundleSha256) throw new Error('Native SVG static bundle integrity mismatch');
        phase = 'json';
        const bundle = JSON.parse(new TextDecoder().decode(publicBytes));
        phase = 'base64';
        const compressed = Uint8Array.from(atob(bundle.gzipBase64), (char) => char.charCodeAt(0));
        phase = 'inflate';
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
        const bytes = await new Response(stream).arrayBuffer();
        phase = 'decoded-hash';
        if (await sha256(bytes) !== descriptor.sha256) throw new Error('Native SVG decoded bundle integrity mismatch');
        phase = 'decoded-json';
        return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, NativeSvgEntry>;
      } catch { throw new BundleLoadError(phase, status); }
    })().catch((error) => { decoded = undefined; throw error; });
    let entries: Record<string, NativeSvgEntry>;
    try { entries = await decoded; } catch (error) {
      // Bounded diagnostics only: never expose URLs, environment or error text.
      return new Response(null, { status: 503, headers: {
        'X-Noam-Native-Svg-Error': 'bundle-unavailable',
        'X-Noam-Native-Svg-Phase': error instanceof BundleLoadError ? error.phase : 'unknown',
        'X-Noam-Native-Svg-Upstream': String(error instanceof BundleLoadError ? error.status : 0),
        'X-Noam-Native-Svg-Assets': assetsBindingAvailable ? 'available' : 'absent',
      } });
    }
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
