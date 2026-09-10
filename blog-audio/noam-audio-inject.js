/*
 * Loader for the narration player, added once in the site's Custom Code
 * (Settings -> Custom Code -> Body - end, on all pages).
 *
 * The site's editor offers no Custom Element and placing an embed inside the blog
 * post layout is awkward, so this script does the placing instead: on a post page
 * it loads the player and inserts it directly under the post title.
 *
 * It does nothing at all on any page that is not a blog post, it never autoplays,
 * and if it cannot find an anchor it gives up quietly rather than moving anything.
 */

(function () {
  var PLAYER_SRC = 'https://noamd-collab.github.io/noamdoronmath-worksheets/blog-audio/noam-audio-player.js';
  var TAG = 'noam-audio-player';
  var MARK = 'data-noam-audio-mounted';
  var GIVE_UP_MS = 20000;

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
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.offsetParent !== null) return el;
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

  function mount(anchor) {
    if (document.querySelector('[' + MARK + ']')) return true;
    var holder = document.createElement('div');
    holder.setAttribute(MARK, '1');
    holder.style.margin = '18px 0';
    holder.style.direction = 'rtl';
    var player = document.createElement(TAG);
    holder.appendChild(player);

    // Sit after the title's own block, so the player does not land inside a
    // heading container that Wix may re-render.
    var target = anchor.closest('[data-hook]') || anchor;
    if (target.parentNode) {
      target.parentNode.insertBefore(holder, target.nextSibling);
      return true;
    }
    return false;
  }

  function start() {
    if (!isPostPage()) return;
    loadPlayerScript();

    var deadline = Date.now() + GIVE_UP_MS;
    var timer = setInterval(function () {
      if (!isPostPage() || Date.now() > deadline) { clearInterval(timer); return; }
      var anchor = findAnchor();
      if (anchor && mount(anchor)) clearInterval(timer);
    }, 400);
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
