// Cost accounting. Estimates are labelled as estimates; once a call returns, the
// real token counts from the API response are what land in the ledger.

export function priceFor(cfg, model) {
  const pr = cfg.pricing[model];
  if (!pr) throw new Error(`no pricing entry for model ${model} in config.json`);
  return pr;
}

export function actualCostUsd(cfg, model, usage) {
  const pr = priceFor(cfg, model);
  const inUsd = ((usage.inputTextTokens || 0) / 1e6) * (pr.inputTextPerMTok || 0);
  const outUsd = ((usage.outputAudioTokens || 0) / 1e6) * (pr.outputAudioPerMTok || 0);
  return Number((inUsd + outUsd).toFixed(6));
}

// Pre-flight estimate from character counts only. Two assumptions are involved and
// both are in config.pricing: Hebrew narration speed and audio tokens per second.
export function estimateForChars(cfg, chars, { model = cfg.tts.model, chunks = 1 } = {}) {
  const pr = priceFor(cfg, model);
  const a = cfg.pricing;
  const seconds = chars / a.assumedHebrewCharsPerSecond;
  const audioTokens = seconds * a.assumedAudioTokensPerSecond;
  const styleTokens = (cfg.tts.styleInstruction.length / a.assumedHebrewCharsPerToken) * chunks;
  const textTokens = chars / a.assumedHebrewCharsPerToken + styleTokens;
  const usd = (textTokens / 1e6) * (pr.inputTextPerMTok || 0) + (audioTokens / 1e6) * (pr.outputAudioPerMTok || 0);
  return {
    model,
    chars,
    chunks,
    estSeconds: Math.round(seconds),
    estAudioTokens: Math.round(audioTokens),
    estTextTokens: Math.round(textTokens),
    estUsd: Number(usd.toFixed(4)),
  };
}

export function fmtUsd(n) { return `$${Number(n).toFixed(2)}`; }
export function fmtDuration(sec) {
  const s = Math.round(Number(sec) || 0);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
