(function () {
  'use strict';

  var YT_HOME = 'https://www.youtube.com/';
  var STORAGE_KEY = 'ytLauncher.playlistUrl';
  var PREF_FEED_KEY = 'ytLauncher.defaultDestination';

  // Targets used by manifest shortcuts (e.g. ./?go=subscriptions).
  // Manifest shortcuts must stay inside the app scope, so they point here
  // and this page forwards to the official YouTube URL.
  var GO_TARGETS = {
    home: YT_HOME,
    subscriptions: 'https://www.youtube.com/feed/subscriptions',
    library: 'https://www.youtube.com/feed/library'
  };

  var ALLOWED_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];

  // If the page is still visible this long after we asked the browser to go to
  // YouTube, the navigation was handed to an in-app window (or was blocked).
  // We then show a single "Open YouTube" button so the user is never stranded.
  var FALLBACK_DELAY_MS = 1500;

  function isOnline() {
    return navigator.onLine !== false;
  }

  function isOfficialYouTubeUrl(value) {
    try {
      var u = new URL(value);
      return (u.protocol === 'https:' || u.protocol === 'http:') && ALLOWED_HOSTS.indexOf(u.hostname.toLowerCase()) !== -1;
    } catch (e) {
      return false;
    }
  }

  // Identifies YouTube Shorts URLs specifically using reliable URL path signatures,
  // never relying on video duration or aspect ratio.
  function isShortsUrl(value) {
    try {
      var u = new URL(value);
      if (ALLOWED_HOSTS.indexOf(u.hostname.toLowerCase()) === -1) return false;
      return /^\/shorts(\/.*)?$/i.test(u.pathname);
    } catch (e) {
      return false;
    }
  }

  // Extracts the video identifier from a /shorts/{videoId} path.
  function extractShortsId(value) {
    try {
      var u = new URL(value);
      var match = u.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/i);
      return match ? match[1] : null;
    } catch (e) {
      return null;
    }
  }

  // Converts a Shorts URL into a standard YouTube watch URL, bypassing the vertical
  // Shorts player and opening the standard web player instead.
  function convertShortsToRegularUrl(value) {
    try {
      var u = new URL(value);
      var id = extractShortsId(value);
      if (!id) return null;
      var regularUrl = new URL('https://www.youtube.com/watch');
      regularUrl.searchParams.set('v', id);
      if (u.searchParams.has('t')) {
        regularUrl.searchParams.set('t', u.searchParams.get('t'));
      }
      return regularUrl.toString();
    } catch (e) {
      return null;
    }
  }

  // Returns the user's preferred launch feed (e.g. Subscriptions to bypass the Home Shorts shelf).
  function getPreferredFeed() {
    try {
      var saved = localStorage.getItem(PREF_FEED_KEY);
      if (saved && Object.prototype.hasOwnProperty.call(GO_TARGETS, saved)) {
        return GO_TARGETS[saved];
      }
    } catch (e) { /* ignore */ }
    return YT_HOME;
  }

  // ---- Direct launch ----------------------------------------------------
  // This runs immediately (app.js is loaded in <head>), before the page body
  // is parsed, so there is no launcher screen when started from the Home Screen.
  //
  // - Installed app (standalone / fullscreen / minimal-ui / iOS standalone):
  //   go straight to preferred YouTube feed (Home or Subscriptions).
  // - Manifest shortcut (?go=...): go to that YouTube page.
  // - Direct video target (?url=...): if a Shorts URL is passed, intercept and
  //   redirect to regular watch URL or preferred feed, preventing Shorts player launch.
  // - Plain browser tab: stay on this page, because this is where the install
  //   button / settings / instructions live.
  function detectStandalone() {
    try {
      if (window.navigator.standalone === true) return true; // iOS Home Screen
      var params = new URLSearchParams(location.search);
      if (params.get('mode') === 'standalone') return true;
      if (window.matchMedia) {
        return window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches ||
          window.matchMedia('(display-mode: minimal-ui)').matches ||
          window.matchMedia('(display-mode: window-controls-overlay)').matches;
      }
    } catch (e) { /* fall through */ }
    return false;
  }

  function readGoKey() {
    try {
      var go = new URLSearchParams(location.search).get('go');
      if (go && Object.prototype.hasOwnProperty.call(GO_TARGETS, go)) return go;
    } catch (e) { /* ignore */ }
    return null;
  }

  function readTargetUrl() {
    try {
      var urlParam = new URLSearchParams(location.search).get('url');
      if (urlParam && isOfficialYouTubeUrl(urlParam)) {
        if (isShortsUrl(urlParam)) {
          var regular = convertShortsToRegularUrl(urlParam);
          return regular || getPreferredFeed();
        }
        return urlParam;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  var isStandalone = detectStandalone();
  var goKey = readGoKey();
  var targetUrl = readTargetUrl();
  var launchTarget = targetUrl ? targetUrl : (goKey ? GO_TARGETS[goKey] : (isStandalone ? getPreferredFeed() : null));
  var redirected = false;

  if (isStandalone) document.documentElement.classList.add('is-standalone');

  if (launchTarget && isOnline()) {
    redirected = true;
    // replace(), not href=: the launcher never enters the history stack, so
    // Back never returns to it and never re-triggers the redirect.
    location.replace(launchTarget);
  }

  // ---- Everything below needs the DOM ----------------------------------
  function init() {
    function $(id) { return document.getElementById(id); }

    // ---- Offline handling ----------------------------------------------
    var banner = $('offline-banner');
    var resume = $('resume');
    var resumeMsg = $('resume-msg');
    var resumeOpen = $('resume-open');

    function updateResumeLink() {
      if (resumeOpen) {
        resumeOpen.href = getPreferredFeed();
      }
    }
    updateResumeLink();

    function showResume(text) {
      if (!resume) return;
      resumeMsg.textContent = text || '';
      resumeMsg.hidden = !text;
      resume.hidden = false;
    }

    function updateOnlineState() {
      banner.hidden = isOnline();
    }

    window.addEventListener('online', function () {
      updateOnlineState();
      // Installed app that was launched offline: go in as soon as we're back.
      if (isStandalone && !redirected) {
        redirected = true;
        location.replace(launchTarget || getPreferredFeed());
      }
    });
    window.addEventListener('offline', updateOnlineState);
    updateOnlineState();

    // Prevent navigation to YouTube while offline, and intercept any direct Shorts
    // links clicked in the app to prevent opening the vertical Shorts player.
    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href') || '';
      if (!href) return;

      if (!isOnline() && href.indexOf('https://www.youtube.com') === 0) {
        event.preventDefault();
        banner.hidden = false;
        banner.scrollIntoView({ block: 'nearest' });
        return;
      }

      if (isShortsUrl(href)) {
        event.preventDefault();
        var regular = convertShortsToRegularUrl(href);
        location.href = regular || getPreferredFeed();
      }
    });

    $('search-form').addEventListener('submit', function (event) {
      if (!isOnline()) {
        event.preventDefault();
        banner.hidden = false;
      }
    });

    // ---- Installed app: fallback screen --------------------------------
    if (isStandalone) {
      if (!redirected) {
        // Launched offline: the banner explains it; no extra text needed.
        showResume('');
      } else {
        setTimeout(function () {
          // Still here => the browser opened YouTube in an in-app window on
          // top of us (it does this for any site outside the app's scope).
          // If the user closes that window they land back here.
          showResume('YouTube opens in its own window. If you closed it, tap below to reopen it.');
        }, FALLBACK_DELAY_MS);
      }
    }

    // ---- Default launch feed preference --------------------------------
    var prefHome = $('pref-feed-home');
    var prefSubs = $('pref-feed-subs');
    var prefMsg = $('pref-msg');

    function loadFeedPref() {
      try {
        var saved = localStorage.getItem(PREF_FEED_KEY);
        if (saved === 'subscriptions') {
          if (prefSubs) prefSubs.checked = true;
        } else {
          if (prefHome) prefHome.checked = true;
        }
      } catch (e) {
        if (prefHome) prefHome.checked = true;
      }
    }
    loadFeedPref();

    function onPrefChange(value) {
      try {
        localStorage.setItem(PREF_FEED_KEY, value);
        updateResumeLink();
        if (prefMsg) {
          prefMsg.textContent = value === 'subscriptions'
            ? 'Saved: App will launch directly into Subscriptions (bypassing the Home Shorts shelf).'
            : 'Saved: App will launch to YouTube Home.';
        }
      } catch (e) {
        if (prefMsg) prefMsg.textContent = 'Could not save setting in this browser.';
      }
    }

    if (prefHome) {
      prefHome.addEventListener('change', function () {
        if (prefHome.checked) onPrefChange('home');
      });
    }
    if (prefSubs) {
      prefSubs.addEventListener('change', function () {
        if (prefSubs.checked) onPrefChange('subscriptions');
      });
    }

    // ---- User playlist / video link & Shorts interceptor ---------------
    var playlistInput = $('playlist-input');
    var playlistMsg = $('playlist-msg');
    var shortsNotice = $('shorts-notice');
    var shortsConvertBtn = $('shorts-convert-btn');
    var shortsFeedBtn = $('shorts-feed-btn');
    var pendingShortsUrl = null;

    function setMsg(text) { if (playlistMsg) playlistMsg.textContent = text; }

    function hideShortsNotice() {
      if (shortsNotice) shortsNotice.hidden = true;
      pendingShortsUrl = null;
    }

    function showShortsNotice(url) {
      pendingShortsUrl = url;
      if (shortsNotice) {
        shortsNotice.hidden = false;
        shortsNotice.scrollIntoView({ block: 'nearest' });
      }
    }

    if (shortsConvertBtn) {
      shortsConvertBtn.addEventListener('click', function () {
        if (!pendingShortsUrl) return;
        var regular = convertShortsToRegularUrl(pendingShortsUrl);
        if (regular) {
          location.href = regular;
        } else {
          location.href = getPreferredFeed();
        }
      });
    }

    if (shortsFeedBtn) {
      shortsFeedBtn.addEventListener('click', function () {
        location.href = getPreferredFeed();
      });
    }

    function readSaved() {
      try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; }
    }

    function writeSaved(value) {
      try {
        if (value) localStorage.setItem(STORAGE_KEY, value);
        else localStorage.removeItem(STORAGE_KEY);
        return true;
      } catch (e) {
        return false;
      }
    }

    var saved = readSaved();
    if (saved && isOfficialYouTubeUrl(saved)) {
      if (isShortsUrl(saved)) {
        // Discard any previously saved Shorts URLs
        writeSaved('');
      } else {
        playlistInput.value = saved;
      }
    }

    function validatedInput() {
      hideShortsNotice();
      var value = playlistInput.value.trim();
      if (!value) { setMsg('Paste a YouTube link first.'); return null; }
      if (!isOfficialYouTubeUrl(value)) {
        setMsg('Only https links on youtube.com or youtu.be are allowed.');
        return null;
      }
      return value;
    }

    $('playlist-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var value = validatedInput();
      if (!value) return;
      if (!isOnline()) { banner.hidden = false; setMsg('You are offline.'); return; }

      // Intercept Shorts URLs: do not navigate directly to the Shorts player
      if (isShortsUrl(value)) {
        setMsg('YouTube Shorts playback is blocked in this app.');
        showShortsNotice(value);
        return;
      }

      setMsg('');
      location.href = value;
    });

    $('playlist-save').addEventListener('click', function () {
      var value = validatedInput();
      if (!value) return;

      if (isShortsUrl(value)) {
        setMsg('Shorts links cannot be saved. Please use a regular video or playlist link.');
        showShortsNotice(value);
        return;
      }

      setMsg(writeSaved(value) ? 'Saved on this device.' : 'Could not save in this browser.');
    });

    $('playlist-clear').addEventListener('click', function () {
      playlistInput.value = '';
      hideShortsNotice();
      writeSaved('');
      setMsg('Cleared.');
    });

    // ---- Install prompt (Android/Chromium) and iOS hint ----------------
    var installCard = $('install-card');
    var installBtn = $('install-btn');
    var iosHint = $('ios-hint');
    var deferredPrompt = null;

    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (!isStandalone) {
      if (isIOS) {
        installCard.hidden = false;
        iosHint.hidden = false;
      }

      window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        deferredPrompt = event;
        installCard.hidden = false;
        installBtn.hidden = false;
      });

      installBtn.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
          installBtn.hidden = true;
          installCard.hidden = true;
        });
      });

      window.addEventListener('appinstalled', function () {
        installCard.hidden = true;
      });
    }

    // ---- Device Detection & Filter Helper -------------------------------
    var detectedDeviceEl = $('detected-device-name');
    var copyBtn = $('copy-filters-btn');
    var copyStatus = $('copy-status');

    var isIOSDevice = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isAndroidDevice = /android/i.test(navigator.userAgent);
    var isWindowsDevice = /windows/i.test(navigator.userAgent);
    var isMacDevice = /macintosh|mac os x/i.test(navigator.userAgent) && !isIOSDevice;

    var detectedName = 'Desktop / Unknown Browser';
    if (isIOSDevice) detectedName = 'iOS / iPadOS (Safari)';
    else if (isAndroidDevice) detectedName = 'Android (' + (/chrome|crios/i.test(navigator.userAgent) ? 'Chrome' : 'Mobile Browser') + ')';
    else if (isWindowsDevice) detectedName = 'Windows (' + (/edg/i.test(navigator.userAgent) ? 'Edge' : (/chrome/i.test(navigator.userAgent) ? 'Chrome' : 'Browser')) + ')';
    else if (isMacDevice) detectedName = 'macOS (Safari / Chrome)';

    if (detectedDeviceEl) detectedDeviceEl.textContent = detectedName;

    var adviceAndroid = $('advice-android');
    var adviceIos = $('advice-ios');
    var adviceDesktop = $('advice-desktop');

    if (isAndroidDevice && adviceAndroid) adviceAndroid.hidden = false;
    else if (isIOSDevice && adviceIos) adviceIos.hidden = false;
    else if (adviceDesktop) adviceDesktop.hidden = false;

    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        if (copyStatus) copyStatus.textContent = 'Filter rules copied to clipboard!';
        setTimeout(function () { if (copyStatus) copyStatus.textContent = ''; }, 3000);
      } catch (e) {
        if (copyStatus) copyStatus.textContent = 'Select and copy the rules from the box below.';
      }
      document.body.removeChild(ta);
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var codeEl = $('filter-rules-code');
        var text = codeEl ? codeEl.textContent : '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            if (copyStatus) copyStatus.textContent = 'Filter rules copied to clipboard!';
            setTimeout(function () { if (copyStatus) copyStatus.textContent = ''; }, 3000);
          }).catch(function () {
            fallbackCopy(text);
          });
        } else {
          fallbackCopy(text);
        }
      });
    }

    // ---- Service worker -------------------------------------------------
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('service-worker.js').catch(function () {
          /* The app still works without a service worker. */
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
