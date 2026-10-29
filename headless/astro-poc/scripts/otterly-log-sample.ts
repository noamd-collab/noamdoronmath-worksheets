#!/usr/bin/env node
/**
 * POST one sample AI-crawler event to OtterlyAI and print the HTTP status.
 *
 *   OTTERLY_API_KEY=... npx tsx scripts/otterly-log-sample.ts
 *
 * The key is read only from the environment. It is never printed.
 */
import { postOtterlyLogs, sampleOtterlyEvent } from '../src/lib/otterlyAiLogs.ts';

const apiKey = process.env.OTTERLY_API_KEY?.trim() ?? '';
if (!apiKey) {
  console.error('OTTERLY_API_KEY is not set');
  process.exit(1);
}

try {
  const status = await postOtterlyLogs([sampleOtterlyEvent()], { apiKey });
  console.log(String(status));
  process.exit(status >= 200 && status < 300 ? 0 : 1);
} catch {
  console.error('request failed');
  process.exit(1);
}
