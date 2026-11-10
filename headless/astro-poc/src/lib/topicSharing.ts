/** Copy the server-provided topic landing URL, including on a preview host. */
export function setupTopicSharing(
  root: ParentNode = document,
  clipboard: Pick<Clipboard, 'writeText'> | undefined = globalThis.navigator?.clipboard,
): void {
  root.querySelectorAll<HTMLElement>('[data-topic-share]').forEach((control) => {
    const button = control.querySelector<HTMLButtonElement>('[data-copy-topic-url]');
    const status = control.querySelector<HTMLElement>('[data-topic-share-status]');
    const fallback = control.querySelector<HTMLElement>('[data-topic-share-fallback]');
    const input = fallback?.querySelector<HTMLInputElement>('input');
    if (!button || !status || !fallback || !input || button.dataset.ready === '1') return;
    button.dataset.ready = '1';
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = '';
      try {
        if (!clipboard) throw new Error('Clipboard unavailable');
        await clipboard.writeText(input.value);
        fallback.hidden = true;
        status.textContent = 'הקישור לנושא הועתק';
      } catch {
        fallback.hidden = false;
        status.textContent = 'אפשר להעתיק את הקישור שמופיע כאן';
        input.focus();
        input.select();
      } finally {
        button.disabled = false;
      }
    });
  });
}
