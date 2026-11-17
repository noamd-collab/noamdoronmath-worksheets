// Astro repeats shared inline CSS in each route. Intern only repeated, long
// style strings in the built JavaScript; the deserializer receives the exact
// original data tree. Source assets, style bytes and route membership stay put.
const binding = '__noamManifestStyleStrings';
const stringToken = /"(?:[^"\\]|\\.)*"/g;

export function compactManifestStyleStrings(source) {
  const declarations = [...source.matchAll(/const manifest = deserializeManifest\((\{[^\n]+\})\);/g)];
  if (declarations.length !== 1) throw new Error('Unsupported built Astro manifest serialization');
  if (source.includes(binding)) throw new Error('Astro manifest style binding already exists');
  const declaration = declarations[0];
  const json = declaration[1];
  const manifest = JSON.parse(json);
  if (!Array.isArray(manifest.routes)) throw new Error('Built Astro manifest has no routes array');
  const counts = new Map();
  for (const route of manifest.routes) {
    if (!Array.isArray(route.styles)) throw new Error('Built Astro route has no styles array');
    for (const style of route.styles) {
      if (style.type !== 'inline' || typeof style.content !== 'string') continue;
      const token = JSON.stringify(style.content);
      if (Buffer.byteLength(token) >= 128) counts.set(token, (counts.get(token) || 0) + 1);
    }
  }
  const tokens = [...counts].filter(([, count]) => count > 1).map(([token]) => token);
  if (!tokens.length) return { source, strings: 0, references: 0, savedBytes: 0 };
  const indexes = new Map(tokens.map((token, index) => [token, index]));
  let references = 0;
  const expression = json.replace(stringToken, (token, offset) => {
    // Keys remain JSON string literals even if they equal a CSS value.
    if (!indexes.has(token) || /^\s*:/.test(json.slice(offset + token.length))) return token;
    references++;
    return `${binding}[${indexes.get(token)}]`;
  });
  // This verifies the complete serialized tree without evaluating build input.
  // No field, value, route, whitespace inside a string or source URL can change.
  const restored = expression.replace(/__noamManifestStyleStrings\[(\d+)\]/g, (_, index) => tokens[Number(index)]);
  if (restored !== json) throw new Error('Astro manifest string compaction changed its data');
  const replacement = `const ${binding}=[${tokens.join(',')}];\nconst manifest = deserializeManifest(${expression});`;
  const savedBytes = Buffer.byteLength(declaration[0]) - Buffer.byteLength(replacement);
  if (savedBytes <= 0) return { source, strings: 0, references: 0, savedBytes: 0 };
  return {
    source: source.slice(0, declaration.index) + replacement + source.slice(declaration.index + declaration[0].length),
    strings: tokens.length,
    references,
    savedBytes,
  };
}
