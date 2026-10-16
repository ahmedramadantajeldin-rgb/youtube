# YouTube Shortcut (PWA)

A tiny, installable Progressive Web App. Install it, tap its Home Screen icon, and it **goes straight to the official YouTube website** (https://www.youtube.com/). There is no launcher screen in between.

It does not recreate YouTube, proxy it, embed it, download videos, or touch your account. Videos, sign-in, subscriptions, playlists, comments and search are all provided by youtube.com itself.

> This is an unofficial shortcut and is not affiliated with YouTube or Google. The icon is a generic play symbol, not YouTube's logo. Replace the files in `icons/` with your own artwork if you like (keep the same names and sizes).

## How launching works

| How you open it | What happens |
|---|---|
| Tap the installed Home Screen icon | `app.js` (loaded in `<head>`) sees it is running as an installed app and immediately calls `location.replace('https://www.youtube.com/')`. The start page is served from the service worker cache, so there is no network wait before the redirect. |
| Long-press the icon, pick Home / Subscriptions / Library | Same, but to that YouTube page (`?go=home`, `?go=subscriptions`, `?go=library`). |
| Open the site URL in a normal browser tab | **No redirect.** This is the setup page with the install button / iPhone instructions. If it redirected here, you could never install the app. |
| Installed app, but offline | No redirect (it would only show a browser error). The offline message plus one button appears, and the app goes to YouTube by itself as soon as the connection returns. |

`location.replace` is used, not `location.href`, so the start page never sits in the Back history and Back can never loop you into it.

## Important limitations (please read)

These are limits of the web platform, not bugs in this project.

- **The browser bar cannot be fully removed for youtube.com from this app.** A PWA hosted on `github.io` owns only its own pages. When an installed PWA navigates to a different site, Chrome on Android shows an "out of scope" window UI (a Custom-Tab-style bar with the site address) and iOS shows an in-app browser with a close button. Only youtube.com could opt out of that (via a web-manifest feature, "scope extensions"), and only YouTube can add that. So: **expect a thin in-app bar over YouTube, or a hand-off to the YouTube app if it is installed.** Which one you get depends on your device, OS version and browser.
- **If you close that in-app window you land on a small "Open YouTube" screen.** It appears about 1.5 seconds after launch only if the page is still visible (i.e. the browser opened YouTube *on top of* the app). It exists so you are never left on a blank screen. It is not a launcher menu.
- **YouTube cannot be embedded in this app instead.** youtube.com forbids being framed by other sites, and Google sign-in refuses to run inside embedded frames/web views. This is a security rule; there is no supported way around it.
- **No offline videos.** Offline, only the small start screen loads. YouTube content is never cached.
- **Install support varies.** Android Chrome and other Chromium browsers support the install flow; iPhone uses Safari's *Add to Home Screen*. Other browsers may only offer a plain bookmark.
- **Playlist link** (optional field on the setup page): saved with `localStorage` on your device only. Only `https` links on `youtube.com` / `youtu.be` are accepted.

## What this app cannot do (and what to use instead)

All of the following need code running *inside* youtube.com, which a separate site cannot do (and which would require injected scripts, which this project deliberately does not use).

| You want | Possible here? | Supported alternative |
|---|---|---|
| Truly no browser UI, full screen | No, see limitations above | **Install YouTube itself as the PWA**: open youtube.com in Chrome (Android) or Safari (iPhone), then *Install app* / *Add to Home Screen*. The window is then in-scope, so it has no browser bar. Availability of the install option can vary by browser and device. |
| Hide Shorts | No | In YouTube: Settings → Time management → **Shorts feed limit → 0 minutes** (removes the Shorts shelf from Home; individual Shorts can still show in search, subscriptions and notifications). Also the ⋮ menu on a Shorts shelf → **Show fewer Shorts**. |
| Triple-tap thumbnail → "Not interested" | No | Use the ⋮ menu on the video → **Not interested** / **Don't recommend channel**. YouTube offers no public API for "Not interested", so even a custom client could not do it. |
| No ads | No | **YouTube Premium** (availability and price vary by country). Nothing in a PWA can remove ads served by YouTube. |

## Privacy and safety

- No analytics, no tracking, no third-party scripts, fonts or libraries.
- No passwords, cookies or tokens are read or stored.
- The service worker only handles requests to its own origin; all YouTube traffic bypasses it entirely.
- The redirect only ever goes to fixed `https://www.youtube.com/...` addresses chosen from a built-in list; the `?go=` value is looked up, never used as a URL.

## Deploy with GitHub Pages

1. **Arrange the files.** Keep the folder structure exactly as shown above. `index.html` must be at the top level of the repository (not inside an extra folder).
2. **Upload to GitHub.**
   - Sign in at https://github.com and click **New repository**. Name it, for example, `youtube-launcher`, set it to **Public**, and create it.
   - On the repo page click **Add file → Upload files**, drag in *the contents* of the project folder (including the `icons` folder), and click **Commit changes**.
   - Or from a terminal:
     ```
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/USER/youtube-launcher.git
     git push -u origin main
     ```
3. **Enable GitHub Pages.** In the repo go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, select branch **main** and folder **/ (root)**, then **Save**.
4. **Get your HTTPS URL.** After a minute or two the page shows your address: `https://USER.github.io/youtube-launcher/`. (Pages serves HTTPS automatically; PWAs require it.)
5. **Install on Android (Chrome).**
   - Open your URL in Chrome.
   - Tap the **Install on this device** button on the page, or open the Chrome menu (⋮) and choose **Install app** / **Add to Home screen**.
   - Launch it from your Home Screen: it should go straight to YouTube. Long-press the icon for the Home, Subscriptions and Library shortcuts.
6. **Add to Home Screen on iPhone (Safari).**
   - Open your URL in **Safari** (other iOS browsers may not offer this).
   - Tap the **Share** button, then **Add to Home Screen**, then **Add**.
7. **Update the app after changing files.**
   - Edit and re-upload (or push) the changed files.
   - In `service-worker.js`, raise `var VERSION = 'v2';` to `'v3'` (and so on). This makes phones fetch the new files.
   - Close and reopen the app once or twice; the new version activates on the next launch. If it still looks old, clear the site's data in the browser settings, or remove and re-add the app.

## Troubleshooting

| Problem | What to try |
|---|---|
| No install option on Android | Use Chrome, open the **https** URL (not `http`), wait for the page to finish loading, and reload once so the service worker registers. |
| Icon or name looks old after an update | Bump `VERSION` in `service-worker.js`, then remove and re-add the Home Screen icon. Android caches the icon at install time. |
| Blank page or 404 on GitHub Pages | Confirm `index.html` is at the repo root, Pages is set to branch **main** / **root**, and wait a couple of minutes after the first deploy. |
| Old files keep showing | Bump `VERSION`, hard-refresh in the browser, or clear site data. |
| YouTube opens with a bar at the top, in the browser, or in the YouTube app | Expected. The OS chooses; this app cannot control it. See *Important limitations*. |
| Installed app opens the setup page instead of YouTube | You are in a browser tab, or you have an old cached version. Open it from the Home Screen icon, and raise `VERSION` in `service-worker.js` if it still happens. |
| Update does not show up on first launch | The start page is served from cache and refreshed in the background, so a new version appears on the **second** launch. |
| "You appear to be offline" message | Check your connection. Nothing can play offline. |
| iPhone has no install button | iOS never shows one. Use Safari → Share → Add to Home Screen. |

## Testing note

Checked without a phone: JavaScript syntax, JSON validity, and automated logic tests of the launch rules and the service worker in a simulated browser (browser tab does not redirect; installed Android and iOS launches redirect to YouTube Home; shortcuts go to the right page; unknown `?go=` values are ignored; offline launch shows the fallback and redirects once when back online; the start page is served from cache; YouTube and other origins are never touched by the service worker).

**Not verified, because it needs a physical device:** whether your phone shows an in-app bar over YouTube, hands off to the YouTube app, or stays fully clean; the real install flow; and Google sign-in inside the installed window. Please test on your phone after deploying and see *Important limitations*.
