import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, join, win32 } from 'node:path';

interface BrowserLookupOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  canExecute?: (path: string) => boolean;
}

function executableFile(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Find an installed browser for isolated headless fixtures; never use a user's profile. */
export function resolveTestBrowser({
  env = process.env,
  platform = process.platform,
  canExecute = executableFile,
}: BrowserLookupOptions = {}): string {
  const explicit = env.CHROME_PATH?.trim();
  if (explicit) {
    if (!canExecute(explicit)) throw new Error('CHROME_PATH must name an executable Chromium browser file');
    return explicit;
  }

  const macApplications = ['Google Chrome', 'Chromium', 'Brave Browser', 'Brave Origin', 'Microsoft Edge'];
  const macPaths = macApplications.flatMap((name) => {
    const roots = ['/Applications', ...(env.HOME ? [join(env.HOME, 'Applications')] : [])];
    return roots.map((root) => join(root, `${name}.app`, 'Contents', 'MacOS', name));
  });
  const windowsRoots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(
    (path): path is string => !!path,
  );
  const windowsPaths = windowsRoots.flatMap((root) => [
    win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    win32.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    win32.join(root, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  ]);
  const linuxPaths = [
    '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
    '/usr/bin/brave-browser', '/usr/bin/brave-browser-stable',
  ];
  const candidates = platform === 'darwin' ? macPaths : platform === 'win32' ? windowsPaths : linuxPaths;
  const names = platform === 'win32' ? ['chrome.exe', 'msedge.exe', 'chromium.exe', 'brave.exe']
    : ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'brave-browser', 'brave-browser-stable'];
  const pathJoin = platform === 'win32' ? win32.join : join;
  for (const directory of (env.PATH || '').split(platform === 'win32' ? ';' : delimiter).filter(Boolean)) {
    for (const name of names) candidates.push(pathJoin(directory, name));
  }
  const browser = candidates.find(canExecute);
  if (!browser) throw new Error('No Chromium browser found. Install Chrome, Chromium or Brave, or set CHROME_PATH to its executable.');
  return browser;
}
