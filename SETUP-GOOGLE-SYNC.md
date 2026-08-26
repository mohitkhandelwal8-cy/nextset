# Setting up Google Drive cloud backup

NextSet's cloud backup stores one file (`nextset-backup.json`) in the **user's own
Google Drive**, in the hidden per-app folder (`drive.appdata` scope). NextSet can only
see its own file — never the rest of anyone's Drive — and there is no NextSet server:
each phone talks directly to Google. All you host is still the static app.

The feature stays hidden ("Not available in this build") until you paste a Google
OAuth **Client ID** into `index.html`. One-time setup, ~10 minutes, free:

## 1. Create the OAuth client

1. Go to https://console.cloud.google.com/ and create a project (e.g. "NextSet").
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** → app name "NextSet", your support email.
   - Scopes: add `https://www.googleapis.com/auth/drive.appdata` and
     `.../auth/userinfo.email`.
   - Publishing status stays **Testing** for the friend beta. Add each friend's
     Gmail address under **Test users** (max 100). Anyone not listed will be
     blocked by Google at the consent screen.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins: your hosted URL (e.g.
     `https://nextset.netlify.app`) **and** `http://localhost:4178` for local dev.
   - No redirect URIs needed (token flow).
5. Copy the Client ID (ends in `.apps.googleusercontent.com`).

## 2. Wire it into the app

In `index.html`, find:

```js
const GOOGLE_CLIENT_ID = "PASTE-YOUR-CLIENT-ID.apps.googleusercontent.com";
```

Paste your Client ID, bump `APP_VERSION`/`CACHE`, deploy. The "Cloud backup" card in
**More** now shows the Connect button.

## Notes & caveats

- **Testing mode**: Google shows an "unverified app" notice and only listed test
  users can connect. Going public later requires Google's app verification for the
  `drive.appdata` scope (free, takes days–weeks).
- **What syncs**: everything — gyms, exercises, workouts, sets, plans, settings.
  Device-local bookkeeping (device id, backup timestamps) intentionally stays out.
- **Model**: backup + restore, not live multi-device sync. The Drive file is
  whole-file last-write-wins; if a *different* device wrote a newer backup, the app
  refuses to clobber it silently and offers "bring that data in first" instead.
- **Tokens** last ~1 hour. Auto-backup uses a still-valid token when it can;
  otherwise the card shows "Backup pending — tap Back up now" (one tap re-grants).
- **Verify on a real iPhone home-screen install**: Google's popup sign-in inside a
  standalone PWA is the flakiest part of this whole flow. Test Connect on-device
  before telling friends about the feature.
