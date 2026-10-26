# Bezel mobile application

This directory contains the Expo SDK 57 / React Native 0.86 application. The original package and folder names are retained for compatibility.

See the [repository README](../README.md) for setup, the two-account walkthrough, architecture, accounting behavior, and limitations.

From this directory:

```sh
npm ci
npm start
npm run typecheck
npm test
npm run export:mobile
```

Tests require a full Git checkout containing baseline commit `6f975e9`. Native launch requires a compatible Expo Go installation or an iOS/Android simulator. All money and account operations use the local demo engine.
