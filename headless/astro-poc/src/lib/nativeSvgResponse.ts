type NativeSvgEntry = { body: string; sha256: string; bytes: number };
type BundleSpec = {
  bundlePath: string;
  bundleSha256: string;
  bundleBytes: number;
  sha256: string;
  count: number;
};
export type NativeSvgDescriptor = {
  version: 1;
  bundles: Record<string, BundleSpec>;
  files: Record<string, string>;
};

type LoadPhase = 'origin' | 'fetch' | 'http' | 'read' | 'length' | 'hash' | 'json' | 'base64' | 'inflate' | 'decoded-hash' | 'decoded-json';
class BundleLoadError extends Error {
  constructor(readonly phase: LoadPhase, readonly status: number) { super('Native SVG bundle load failed'); }
}

const SVG_REL = /^G[789]-(?:T[0-9]+|ASSESS1|CIRCLE|INTERP|TWOSRC|3060|KITE|SIDEANG|TRAP)\/[abc]\/figures\/[A-Za-z0-9_-]+\.svg$/;

async function sha256(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Wix Managed Hosting terminates TLS before SSR. x-wix-forwarded-url is the
 * public URL. Loopback is accepted only on the request URL so local preview
 * can read the bundle, never from a forwarded header.
 */
export function resolveNativeSvgPublicOrigin(requestUrl: string, forwardedUrl?: string | null): string | undefined {
  const forwarded = forwardedUrl ? approvedOrigin(forwardedUrl, false) : undefined;
  if (forwarded) return forwarded;
  return approvedOrigin(requestUrl, true);
}

function approvedOrigin(candidate: string, allowLoopback: boolean): string | undefined {
  try {
    const url = new URL(candidate);
    if (url.username || url.password) return undefined;
    const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (allowLoopback && loopback && (url.protocol === 'http:' || url.protocol === 'https:')) return url.origin;
    if (url.protocol !== 'https:' || url.port) return undefined;
    if (url.hostname === 'www.noamdoronmath.co.il' || url.hostname === 'noamdoronmath.co.il'
      || /^[a-z0-9]{6}-noam-math-astro-poc-amiramnoam-130a\.wix-site-host\.com$/.test(url.hostname)) return url.origin;
  } catch { /* Invalid public URLs are never used as fetch destinations. */ }
  return undefined;
}

/** Same URL as before. The body is the original SVG, read from one grade bundle. */
export function createNativeSvgResponder(descriptor: NativeSvgDescriptor, fetchBundle: typeof fetch = (...args) => fetch(...args)) {
  if (descriptor.version !== 1) throw new Error('Invalid native SVG bundle descriptor');
  const decoded = new Map<string, Promise<Record<string, NativeSvgEntry>>>();
  return async (asset: string | undefined, requestUrl: string, _assetsBindingAvailable = false, forwardedUrl?: string | null, fetchOverride?: typeof fetch): Promise<Response> => {
    const loadBundle = fetchOverride ?? fetchBundle;
    if (!asset || !SVG_REL.test(asset) || asset.split('/').some((part) => part === '.' || part === '..')) {
      return new Response(null, { status: 404 });
    }
    if (!Object.hasOwn(descriptor.files, asset)) return new Response(null, { status: 404 });
    const grade = descriptor.files[asset];
    const spec = descriptor.bundles[grade];
    if (!spec || !/^\/noam-ai\/native-svg\/G[789]\.[a-f0-9]{64}\.json$/.test(spec.bundlePath)
      || !spec.bundlePath.endsWith(`.${spec.bundleSha256}.json`)) {
      return new Response(null, { status: 404 });
    }
    let pending = decoded.get(grade);
    if (!pending) {
      pending = (async () => {
        let phase: LoadPhase = 'origin';
        let status = 0;
        try {
          const origin = resolveNativeSvgPublicOrigin(requestUrl, forwardedUrl);
          if (!origin) throw new Error('No approved native SVG public origin');
          phase = 'fetch';
          const response = await loadBundle(new URL(spec.bundlePath, origin), { redirect: 'error', credentials: 'omit' });
          status = response.status;
          phase = 'http';
          if (!response.ok) throw new Error('Native SVG bundle unavailable');
          phase = 'read';
          const publicBytes = await response.arrayBuffer();
          phase = 'length';
          if (publicBytes.byteLength !== spec.bundleBytes) throw new Error('Native SVG static bundle length mismatch');
          phase = 'hash';
          if (await sha256(publicBytes) !== spec.bundleSha256) throw new Error('Native SVG static bundle integrity mismatch');
          phase = 'json';
          const bundle = JSON.parse(new TextDecoder().decode(publicBytes));
          phase = 'base64';
          const compressed = Uint8Array.from(atob(bundle.gzipBase64), (char) => char.charCodeAt(0));
          phase = 'inflate';
          const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
          const bytes = await new Response(stream).arrayBuffer();
          phase = 'decoded-hash';
          if (await sha256(bytes) !== spec.sha256) throw new Error('Native SVG decoded bundle integrity mismatch');
          phase = 'decoded-json';
          return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, NativeSvgEntry>;
        } catch (error) {
          if (error instanceof BundleLoadError) throw error;
          throw new BundleLoadError(phase, status);
        }
      })().catch((error) => { decoded.delete(grade); throw error; });
      decoded.set(grade, pending);
    }
    let entries: Record<string, NativeSvgEntry>;
    try { entries = await pending; } catch (error) {
      return new Response(null, { status: 503, headers: {
        'X-Noam-Native-Svg-Error': 'bundle-unavailable',
        'X-Noam-Native-Svg-Phase': error instanceof BundleLoadError ? error.phase : 'unknown',
        'X-Noam-Native-Svg-Upstream': String(error instanceof BundleLoadError ? error.status : 0),
        'X-Noam-Native-Svg-Assets': _assetsBindingAvailable ? 'available' : 'absent',
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
