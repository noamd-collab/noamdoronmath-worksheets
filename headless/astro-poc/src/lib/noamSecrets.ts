/** Read a Wix secret from the Astro schema value or from the process env. Never throws. */
export function secretFromEnv(name: string, schemaValue?: string | null): string {
  if (typeof schemaValue === 'string' && schemaValue.trim()) return schemaValue.trim();
  try {
    const value = process.env[name];
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}
