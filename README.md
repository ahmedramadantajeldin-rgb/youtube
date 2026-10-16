# YouTube Shortcut (PWA)

A tiny, installable Progressive Web App. Install it, tap its Home Screen icon, and it **goes straight to the official YouTube website** (https://www.youtube.com/) with YouTube Shorts prevention controls and custom launch feeds. There is no launcher screen in between.

It does not recreate YouTube, proxy it, embed it, download videos, or touch your account. Videos, sign-in, subscriptions, playlists, comments and search are all provided by youtube.com itself.

> This is an unofficial shortcut and is not affiliated with YouTube or Google. The icon is a generic play symbol, not YouTube's logo. Replace the files in `icons/` with your own artwork if you like (keep the same names and sizes).

## How launching works

| How you open it | What happens |
|---|---|
| Tap the installed Home Screen icon | `app.js` (loaded in `<head>`) sees it is running as an installed app and immediately calls `location.replace(...)` to your preferred feed (Home or Subscriptions). Served from cache with zero network wait. |
| Long-press the icon, pick Home / Subscriptions / Library | Goes directly to that YouTube page (`?go=home`, `?go=subscriptions`, `?go=library`). |
| Open the site URL in a normal browser tab | **No redirect.** This is the setup and configuration page where you can set your default launch feed, test links, read Shorts blocking solutions, or install the app. |
| Open with a Shorts link or `?url=...` | Intercepted immediately: opening the Shorts player is blocked, redirecting you to standard video playback (`watch?v=`) or your preferred feed. |
| Installed app, but offline | No redirect (avoids browser error). The offline message plus one button appears, and the app goes to YouTube automatically once connection returns. |

`location.replace` is used, not `location.href`, so the start page never sits in the Back history and Back can never loop you into it.

## YouTube Shorts Prevention & Support Status

### What is active and enforced directly in this PWA

1. **Shorts Playback & Navigation Blocked:**
   - Any YouTube Shorts URL (e.g. `https://www.youtube.com/shorts/{id}`) entered into the app, passed as a query parameter, or clicked from launcher links is intercepted.
   - Direct launch into the vertical swipeable Shorts player is prevented.
   - Users are offered options to **Return to Regular Feed** or **Watch as Standard Video** (converting `/shorts/{id}` to standard `https://www.youtube.com/watch?v={id}` without the Shorts UI).
   - Raw Shorts URLs are prevented from being saved in device storage.

2. **Shorts-Free Default Feed Launch:**
   - You can configure the **Default Launch Feed** to **Subscriptions**.
   - Launching the PWA opens `https://www.youtube.com/feed/subscriptions` directly, bypassing the YouTube Home feed's algorithmic Shorts carousel and recommendations upon launch.

3. **Preservation of Regular Videos:**
   - Normal videos, channels, playlists, search, subscriptions, comments, and accounts are completely preserved.
   - Shorts are detected strictly via reliable URL signatures (`/shorts/`), **never by video duration or aspect ratio**. Ordinary short or vertical long-form videos uploaded as standard videos are not blocked.

### What cannot be implemented directly by a Web PWA (and why)

- **Hiding Shorts shelves/carousels on `youtube.com` Home feed once navigated.**
- **Filtering Shorts from sidebar/up-next recommendations while watching on `youtube.com`.**
- **Hiding Shorts sections from YouTube internal search result pages on `youtube.com`.**

**Technical reason (Same-Origin Policy & Web Security):**
A PWA hosted on an external origin (e.g., GitHub Pages or a custom domain) navigates top-level to `https://www.youtube.com/`. Web platform security (Same-Origin Policy) strictly isolates origins: no web page or service worker from another origin can execute JavaScript, inject styles, access the DOM, or intercept network traffic on `youtube.com`. Furthermore, YouTube enforces `X-Frame-Options: SAMEORIGIN` and `Content-Security-Policy: frame-ancestors 'self'`, which strictly prevents framing YouTube in an `<iframe>`.

### Recommended Solutions for Complete In-Page Shorts Removal

If you want complete DOM-level removal of Shorts carousels and recommendations while browsing `youtube.com`:

1. **Content Blocker Filter Rules (uBlock Origin / Adblock):**
   Add these cosmetic filter rules to your content blocker:
   ```adblock
   ! Hide YouTube Shorts shelves on Home and Search
   youtube.com##ytd-rich-shelf-renderer[is-shorts]
   youtube.com##ytd-reel-shelf-renderer
   youtube.com##ytm-reel-shelf-renderer

   ! Hide Shorts navigation buttons and links
   youtube.com##ytd-guide-entry-renderer:has(a[title="Shorts"])
   youtube.com##ytd-mini-guide-entry-renderer[aria-label="Shorts"]
   youtube.com##a[href^="/shorts"]

   ! Hide Shorts in search results & recommendations
   youtube.com##ytd-video-renderer:has(a[href*="/shorts/"])
   youtube.com##ytd-compact-video-renderer:has(a[href*="/shorts/"])
   ```

2. **Dedicated Browser Extensions (Desktop & Mobile):**
   - **Unhook (Remove YouTube Recommended Videos)**: Available for Chrome, Firefox, and Edge. Has dedicated toggles to hide Shorts tabs and shelves completely.
   - **Hide YouTube Shorts**: Automatically redirects Shorts URLs to regular video players and hides Shorts shelves.
   - **Mobile browsers with extension support**: Firefox for Android, Kiwi Browser (Android), or Orion (iOS) support installing uBlock Origin or Unhook.

3. **Native YouTube Setting:**
   - On any Shorts shelf on YouTube's Home feed, tap the three dots (⋮) and choose **Show fewer Shorts** (suppresses Shorts shelves on Home for 30 days).

## Feature Matrix

| Feature | Supported in this PWA | Implementation / Alternative |
|---|---|---|
| Block Shorts URL navigation | **Yes** | Intercepts `/shorts/` URLs and redirects to regular feed or standard player |
| Convert Shorts to regular player | **Yes** | Rewrites `/shorts/{id}` to `/watch?v={id}` |
| Bypass Home Shorts carousel on launch | **Yes** | Configurable default launch feed (Subscriptions feed) |
| Preserve ordinary short/vertical videos | **Yes** | Filters exclusively by `/shorts/` signal, never by duration |
| Hide Shorts shelves inside youtube.com DOM | **No** (Cross-origin boundary) | Use uBlock Origin cosmetic rules or *Unhook* extension |
| Hide Shorts from YouTube recommendations | **No** (Cross-origin boundary) | Use uBlock Origin cosmetic rules or *Unhook* extension |
| Fullscreen with no browser bar | **No** (Cross-origin boundary) | Install YouTube directly via browser menu (*Install app* on youtube.com) |
| Ad blocking | **No** (Platform limit) | YouTube Premium or browser content blocker |

## Browser Branding, Top Toolbar & Scrolling Behavior (Brave on Android / Galaxy S22)

- **The Exact Source of the Brave Branding and YouTube.com Header:**
  The top interface that appears when scrolling up is **Brave's native Android Custom Tab (CCT) toolbar**. It does not come from your HTML, CSS, or JavaScript.
- **Why it appears:**
  The installed PWA is hosted on an external origin (e.g., GitHub Pages) with `scope: "./"`. When opened, it redirects top-level to `https://www.youtube.com/`. Because `youtube.com` is outside the PWA's manifest scope, Android's Chromium security sandbox forces the page into an out-of-scope Custom Tab. When you scroll down, Brave auto-hides this bar. When you **scroll up**, Brave pulls the bar back down into view to show the user they are browsing an external domain (`youtube.com`).
- **Webpage CSS cannot hide native browser UI:**
  No CSS rules (like `display: none`) can hide Brave's native toolbar because it is rendered by the Android OS / Brave app layer, completely outside the web page DOM.
- **The 100% Borderless Standalone Solution in Brave:**
  To browse YouTube in Brave on Android with **ZERO browser toolbar, zero Brave branding, and zero header on scrolling**:
  1. Open Brave on your Samsung Galaxy S22.
  2. Navigate directly to `https://www.youtube.com/`.
  3. Tap the three dots menu (⋮) on the bottom right or top right.
  4. Select **Install app** (or **Add to Home screen**).
  5. Launch the app from the newly created Home Screen icon.
  
  **Why this works:** YouTube's official Web App Manifest has `scope: "https://www.youtube.com/"`. Because you are browsing within the manifest's declared scope, Brave launches it as an **in-scope WebAPK**. Brave's Custom Tab toolbar is completely suppressed, and scrolling up or down will never reveal any browser branding.

## Privacy and safety

- No analytics, no tracking, no third-party scripts, fonts or libraries.
- No passwords, cookies or tokens are read or stored.
- The service worker only handles requests to its own origin; all YouTube traffic bypasses it entirely.
- The redirect only ever goes to validated `https://www.youtube.com/...` addresses; the `?go=` value is looked up, never used as an open redirect.

## Deploy with GitHub Pages

1. **Arrange the files.** Keep the folder structure exactly as shown above. `index.html` must be at the top level of the repository.
2. **Upload to GitHub.** Create a public repo, commit the files, and push to `main`.
3. **Enable GitHub Pages.** Under Settings → Pages, choose Deploy from branch `main` / `root`.
4. **Get your HTTPS URL.** The address will be `https://USER.github.io/youtube-launcher/`.
5. **Install on Android (Chrome).** Open your URL, tap **Install on this device** or Chrome menu → **Install app**.
6. **Add to Home Screen on iPhone (Safari).** Open in Safari, tap **Share** → **Add to Home Screen**.
7. **Update the app.** Raise `VERSION` in `service-worker.js` (e.g. `'v4'`) so devices pull the new files.

## Testing note

- **Automated verification:** Tested JavaScript syntax, URL validation, Shorts path detection, conversion to standard video URLs, and feed preference persistence in Node.js.
- **Cross-origin security verification:** Confirmed that service worker and client scripts respect Same-Origin Policy and do not use unauthorized injection or private APIs.
