/*
 * Loader for the narration player, added once in the site's Custom Code
 * (Settings -> Custom Code -> Body - end, on all pages).
 *
 * The site's editor offers no Custom Element and placing an embed inside the blog
 * post layout is awkward, so this script does the placing instead: on a post page
 * it loads the player and attaches it as a bar fixed to the bottom of the window.
 *
 * It does nothing at all on any page that is not a blog post, it never autoplays,
 * and if it cannot find an anchor it gives up quietly rather than moving anything.
 */

(function () {
  // Readable from the page, so which build is running can be established from
  // outside instead of inferred.
  window.__noamAudioLoader = { build: 5, startedAt: new Date().toISOString(), state: 'loaded' };

  var PLAYER_SRC = 'https://noamd-collab.github.io/noamdoronmath-worksheets/blog-audio/noam-audio-player.js';
  var TAG = 'noam-audio-player';
  var MARK = 'data-noam-audio-mounted';
  // Wix renders the post body well after this script runs, and the tag manager
  // that loads this script is itself late, so the window has to be generous.
  var GIVE_UP_MS = 90000;
  var MAX_MOUNTS = 40;

  function isPostPage() {
    return /\/post\//.test(window.location.pathname);
  }

  // The title is the most stable anchor Wix exposes on a post page. The fallbacks
  // below are only used if that hook ever disappears.
  function findAnchor() {
    var selectors = [
      '[data-hook="post-title"]',
      '[data-hook="post-page-title"]',
      '[data-hook="post-header"]',
      'article h1',
      'main h1',
      'h1',
    ];
    // Visibility is deliberately not required here: the site shows a disclaimer
    // gate over the article, and a title that is momentarily unrendered is still
    // the right place to mount.
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) return el;
    }
    return null;
  }

  function loadPlayerScript() {
    if (document.querySelector('script[data-noam-audio-player]')) return;
    var s = document.createElement('script');
    s.src = PLAYER_SRC;
    s.async = true;
    s.setAttribute('data-noam-audio-player', '1');
    document.head.appendChild(s);
  }

  // The player is deliberately NOT inserted into the article. Wix re-renders the
  // post after any insertion and takes the block with it, which showed up as a
  // player that flashed and vanished. A bar attached to the body sits outside the
  // part of the page Wix owns, so nothing removes it - and it stays in reach while
  // the reader scrolls, which suits a narration control better anyway.
  function mount() {
    if (document.querySelector('[' + MARK + ']')) return true;
    if (!document.body) return false;

    if (!document.getElementById('noam-audio-bar-style')) {
      var style = document.createElement('style');
      style.id = 'noam-audio-bar-style';
      style.textContent = [
        '[' + MARK + ']{position:fixed;inset-inline:0;bottom:0;z-index:2147483000;direction:rtl;',
        'padding:8px 12px calc(8px + env(safe-area-inset-bottom));background:rgba(255,255,255,.94);',
        '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);',
        'border-top:1px solid rgba(0,0,0,.12);box-shadow:0 -6px 24px rgba(0,0,0,.10);color:#14181f}',
        '[' + MARK + '] > div{max-width:760px;margin:0 auto}',
        '@media (prefers-color-scheme: dark){[' + MARK + ']{background:rgba(20,24,31,.94);',
        'border-top-color:rgba(255,255,255,.16);color:#f2f4f7}}',
      ].join('');
      document.head.appendChild(style);
    }

    var holder = document.createElement('div');
    holder.setAttribute(MARK, '1');
    var inner = document.createElement('div');
    var player = document.createElement(TAG);
    player.setAttribute('bare', '1');
    inner.appendChild(player);
    holder.appendChild(inner);

    document.body.appendChild(holder);
    return true;
  }

  function start() {
    if (!isPostPage()) return;
    loadPlayerScript();

    var deadline = Date.now() + GIVE_UP_MS;
    var observer = null;
    var timer = null;
    var mounts = 0;

    function stop() {
      if (timer) clearInterval(timer);
      if (observer) observer.disconnect();
      timer = null;
      observer = null;
    }

    // The site re-renders the post after the player is inserted and takes it with
    // it, so mounting once is not enough: the block has to be put back each time
    // it disappears. The cap is there so a render loop cannot become a fight.
    function attempt() {
      if (!isPostPage()) { window.__noamAudioLoader.state = 'left the post page'; stop(); return; }
      if (document.querySelector('[' + MARK + ']')) return;
      if (mounts >= MAX_MOUNTS) { window.__noamAudioLoader.state = 'the page kept removing the player'; stop(); return; }
      if (Date.now() > deadline && mounts === 0) {
        window.__noamAudioLoader.state = 'gave up waiting for the post to render';
        stop();
        return;
      }
      // The title is still what tells us the post has actually rendered; the bar
      // itself no longer attaches to it.
      if (!findAnchor()) { window.__noamAudioLoader.state = 'waiting for the post to render'; return; }
      try {
        if (mount()) {
          mounts++;
          window.__noamAudioLoader.state = 'mounted';
          window.__noamAudioLoader.mounts = mounts;
          if (timer) { clearInterval(timer); timer = null; }
        } else {
          window.__noamAudioLoader.state = 'no body to attach the bar to';
        }
      } catch (e) {
        window.__noamAudioLoader.state = 'mount threw: ' + (e && e.message);
        stop();
      }
    }

    // The observer catches both the moment the post renders and the moment a
    // re-render removes the player; the interval is the backstop until first mount.
    if (window.MutationObserver) {
      observer = new MutationObserver(attempt);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    timer = setInterval(attempt, 500);
    attempt();
  }

  // Wix routes between posts without a full page load, so re-run on navigation.
  var lastPath = window.location.pathname;
  setInterval(function () {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      var old = document.querySelector('[' + MARK + ']');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      start();
    }
  }, 700);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
