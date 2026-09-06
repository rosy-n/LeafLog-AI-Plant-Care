// This app uses React Navigation only. Expo CLI also installs Router transitively;
// disable its import rewriting so every screen uses the same navigation context.
process.env.EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK = '1';

const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
