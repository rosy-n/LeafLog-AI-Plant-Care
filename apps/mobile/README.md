# Mobile App

LeafLog mobile app, using Expo SDK 57, React 19.2 and React Native 0.86.

## Setup

Requirements: Node.js 22.13 or newer (Node.js 24 LTS recommended), and Expo Go
with SDK 57 support. iOS 16.4 or newer is required.

Current iOS Expo Go requires the same Expo account in the phone app and Expo CLI.
Sign in through the avatar on Expo Go's Home screen, then sign in on the computer:

```sh
cd apps/mobile
npx expo login --browser
npx expo whoami
```

Use your own Expo account on both devices, not your LeafLog app login. Each
teammate signs in on their own computer and phone; do not share passwords.
See [Expo's login requirement](https://expo.dev/changelog/expo-go-57-login).

After pulling this upgrade, stop any old Expo server and reinstall from the
lockfile so everyone uses the same package versions:

```sh
cd apps/mobile
npm ci
npm start -- --clear
```

The app calls the backend at `EXPO_PUBLIC_API_BASE_URL`. Set it in the local,
git-ignored `apps/mobile/.env.local` file, using the shared API address supplied
privately by the team:

```ini
EXPO_PUBLIC_API_BASE_URL=http://<shared-api-host>:8000
```

For the current school API test setup, both the computer and phone need access
through Tailscale. Keep the phone on the same Wi-Fi as the computer for the Expo
QR code. The shared API handles SDXL and background removal; running the mobile
app does not require installing those models on each teammate's computer.

If testing a local backend instead, use the computer's reachable LAN IP, not
`localhost` (which points to the phone itself). Restart Expo after changing the
environment file. Never put secrets in `EXPO_PUBLIC_*` values; they are bundled
into the app.

## Upgrade Checks

```sh
npx expo install --check
npx expo-doctor
npm run test:upgrade
npx tsc --noEmit
```

The active entry point is `expo/AppEntry.js` -> `App.tsx` -> `App.js`, with React
Navigation. Unused Expo Router entry/layout files were removed because SDK 57
does not support mixing these navigation packages. The actual registration
screens under `app/add-plant/` remain connected through `AddPlantNavigator`.
`metro.config.js` disables Expo Router's React Navigation import rewriting, since
Expo CLI still installs Router transitively. No per-developer environment flag is
needed for this setting.
Photo uploads use `expo-file-system` File objects for SDK 57's default Expo fetch.

`test:upgrade` covers multipart uploads, character layer loading, late search and
generation responses, calendar date/photo handling, and notification scheduling.
Screen tests simulate callbacks and focus cleanup, not native device rendering.
Type checking should pass without suppressions before merging changes.

On a physical phone, check login, photo selection and camera capture, plant
identification, character generation and selection, then the registered plant's
expression/effects. Also check calendar photos, audio and notification settings.

Existing unfinished features, separate from the SDK upgrade:

- Calendar diary text/photos are only held in screen state. Leaving that screen
  can discard them; only watering/fertilizer care records are backed by the API.
- The photo buttons in the fertilizer and repotting forms have no picker/upload
  handlers yet. Do not treat those photos as saved records.
