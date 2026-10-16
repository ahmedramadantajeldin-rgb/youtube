(function () {
  'use strict';

  var YT_HOME = 'https://www.youtube.com/';
  var STORAGE_KEY = 'ytLauncher.playlistUrl';

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
      return u.protocol === 'https:' && ALLOWED_HOSTS.indexOf(u.hostname) !== -1;
    } catch (e) {
      return false;
    }
  }

  // ---- Direct launch ----------------------------------------------------
  // This runs immediately (app.js is loaded in <head>), before the page body
  // is parsed, so there is no launcher screen when started from the Home Screen.
  //
  // - Installed app (standalone / fullscreen / minimal-ui / iOS standalone):
  //   go straight to YouTube Home.
  // - Manifest shortcut (?go=...): go to that YouTube page.
  // - Plain browser tab: stay on this page, because this is where the install
  //   button / iOS instructions live. Redirecting here would make it
  //   impossible to install the app.
  function detectStandalone() {
    try {
      if (window.navigator.standalone === true) return true; // iOS Home Screen
      if (window.matchMedia) {
        return window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches ||
          window.matchMedia('(display-mode: minimal-ui)').matches;
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

  var isStandalone = detectStandalone();
  var goKey = readGoKey();
  var launchTarget = goKey ? GO_TARGETS[goKey] : (isStandalone ? YT_HOME : null);
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
        location.replace(launchTarget || YT_HOME);
      }
    });
    window.addEventListener('offline', updateOnlineState);
    updateOnlineState();

    // Block navigation to YouTube while offline so the user sees a message
    // instead of a browser error page.
    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[href^="https://www.youtube.com"]');
      if (link && !isOnline()) {
        event.preventDefault();
        banner.hidden = false;
        banner.scrollIntoView({ block: 'nearest' });
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

    // ---- User playlist link --------------------------------------------
    var playlistInput = $('playlist-input');
    var playlistMsg = $('playlist-msg');

    function setMsg(text) { playlistMsg.textContent = text; }

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
    if (saved && isOfficialYouTubeUrl(saved)) playlistInput.value = saved;

    function validatedInput() {
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
      setMsg('');
      location.href = value;
    });

    $('playlist-save').addEventListener('click', function () {
      var value = validatedInput();
      if (!value) return;
      setMsg(writeSaved(value) ? 'Saved on this device.' : 'Could not save in this browser.');
    });

    $('playlist-clear').addEventListener('click', function () {
      playlistInput.value = '';
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

    // ---- Service worker -------------------------------------------------
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', function () {
        // Relative path so it works under /repository-name/ on GitHub Pages.
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
