import { accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Find a browser binary without accessing an existing browser profile. */
export function chromiumCandidates(
  platform = process.platform,
  home = homedir(),
  env = process.env,
): string[] {
  if (env.CHROME_PATH) return [env.CHROME_PATH];
  if (platform === 'darwin') {
    return [
      join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }
  if (platform === 'win32') {
    return [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA]
      .filter((root): root is string => Boolean(root))
      .flatMap(root => [
        join(root, 'Google/Chrome/Application/chrome.exe'),
        join(root, 'Microsoft/Edge/Application/msedge.exe'),
      ]);
  }
  return ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

export function chromiumExecutable(): string {
  const executable = chromiumCandidates().find(path => {
    try { accessSync(path, constants.X_OK); return true; } catch { return false; }
  });
  if (!executable) throw new Error('No executable Chromium browser found. Set CHROME_PATH to its executable path.');
  return executable;
}
