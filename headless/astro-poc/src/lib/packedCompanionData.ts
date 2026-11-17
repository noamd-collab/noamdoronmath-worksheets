/** Local immutable payload only: no network, Node runtime dependency or new trust source. */
export interface CompanionPack {
  version: number;
  kind: string;
  count: number;
  rawBytes: number;
  sha256: string;
  gzipBase64: string;
}
export const PACKED_DATA_UNAVAILABLE = 'PACKED_COMPANION_DATA_UNAVAILABLE';

export async function decompressCompanionPack(pack: CompanionPack): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = Uint8Array.from(atob(pack.gzipBase64), char => char.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const output = new Uint8Array(pack.rawBytes);
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > output.byteLength) throw Error(PACKED_DATA_UNAVAILABLE);
      output.set(value, size); size += value.byteLength;
    }
    if (size !== output.byteLength) throw Error(PACKED_DATA_UNAVAILABLE);
    return output;
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** One promise per isolate, shared by cold concurrent calls; rejected loads retry. */
export function createCompanionPackLoader(
  pack: CompanionPack,
  decompress: (pack: CompanionPack) => Promise<Uint8Array<ArrayBuffer>> = decompressCompanionPack,
): () => Promise<any> {
  let loading: Promise<any> | undefined;
  return () => {
    if (!loading) loading = Promise.resolve().then(async () => {
      if (pack.version !== 1 || !['guide', 'teacherIndex'].includes(pack.kind) ||
        !Number.isSafeInteger(pack.rawBytes) || pack.rawBytes < 1 || pack.rawBytes > 8_000_000 ||
        !Number.isSafeInteger(pack.count) || pack.count < 1 || !/^[0-9a-f]{64}$/.test(pack.sha256) ||
        typeof pack.gzipBase64 !== 'string' || pack.gzipBase64.length > 4_000_000) throw Error(PACKED_DATA_UNAVAILABLE);
      const bytes = await decompress(pack);
      if (bytes.byteLength !== pack.rawBytes) throw Error(PACKED_DATA_UNAVAILABLE);
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      if (Array.from(digest, n => n.toString(16).padStart(2, '0')).join('') !== pack.sha256) throw Error(PACKED_DATA_UNAVAILABLE);
      const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      const count = pack.kind === 'guide' ? value?.records?.length : Array.isArray(value) ? value.length : undefined;
      if (count !== pack.count) throw Error(PACKED_DATA_UNAVAILABLE);
      return value;
    }).catch(() => { loading = undefined; throw Error(PACKED_DATA_UNAVAILABLE); });
    return loading;
  };
}
