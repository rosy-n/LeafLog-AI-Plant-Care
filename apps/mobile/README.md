# Mobile App

React Native / Expo implementation for the LeafLog login and signup flow.

## Screens

- Landing screen
- Login screen
- Signup screen
- Nickname onboarding screen
- Auth completion screen

The visual style is ported from `Login_UI/index.html`.

## Setup

```bash
cd apps/mobile
npm install
npm start
```

The app calls the backend at `EXPO_PUBLIC_API_BASE_URL`.

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000 npm start
```

When testing on a physical phone, replace `localhost` with your computer's LAN IP address.

This project uses Expo SDK 54 so it remains compatible with the store version of Expo Go during the SDK 55 transition period.
