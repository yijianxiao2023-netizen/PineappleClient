# PineappleClient

**Website:** https://yijianxiao2023-netizen.github.io/pineappleclient/ (after the first deploy)
**macOS download:** [PineappleClient.dmg](https://github.com/yijianxiao2023-netizen/pineappleclient/releases/latest/download/PineappleClient.dmg)

A Minecraft 1.21.1 client in two parts:

- **mod/**: a Fabric mod with an in-game HUD and utilities
- **launcher/**: a Python launcher that installs Minecraft + Fabric into its own folder, adds Fabric API and the PineappleClient mod, and starts the game

## What you need

- **Java 21 (JDK)** to build the mod. Get Temurin 21 from adoptium.net.
- **Python 3.10+** with Tkinter for the launcher. The python.org installer on Windows/macOS includes it. On Linux, install `python3-tk`.
- A copy of Minecraft Java Edition that you own.

## 1. Build the mod

Windows: double-click `build_mod.bat`
macOS/Linux: `./build_mod.sh`

The first build downloads Minecraft and the Fabric toolchain, so it takes a few minutes. When it finishes, `pineappleclient-1.0.0.jar` is copied into `launcher/mods/`.

You can also open the `mod` folder in IntelliJ IDEA and run the `runClient` Gradle task to test it without the launcher.

## 2. Run the launcher

Windows: double-click `launcher/start.bat`
macOS/Linux: `./launcher/start.sh`

Pick a version (keep **1.21.1** with **Fabric + PineappleClient mod** checked), set RAM, and press **PLAY**. The first launch downloads the game and the right Java runtime automatically. Everything goes in a separate folder (`%APPDATA%\.pineappleclient` on Windows, `~/.pineappleclient` on Linux, `~/Library/Application Support/pineappleclient` on macOS), so your normal `.minecraft` is untouched.

**Add mod jar…** lets you add other Fabric 1.21.1 mods (Sodium, for example). They're copied into the instance's `mods` folder on every launch.

### Accounts

- **Offline**: works for singleplayer and LAN or servers in offline mode. Not for online servers like Hypixel.
- **Microsoft**: required for online servers. You need your own Azure app:
  1. In the Azure portal, go to *App registrations* > *New registration*. Under supported account types, pick *Personal Microsoft accounts only*.
  2. Add a *Mobile and desktop applications* redirect URI: `http://localhost:8765/callback`
  3. Copy the *Application (client) ID* into the launcher, then click **Sign in**.
  4. Mojang has to approve new apps before they can use Minecraft sign-in, so you may need to submit their app-review form for your client ID first.

## In-game controls

| Key | Action |
|---|---|
| C (hold) | Zoom (smooth camera while zooming) |
| Return (Enter) | PineappleClient settings menu |
| G | Toggle fullbright |
| V | Toggle sprint |

You can rebind them in Options > Controls > Key Binds > PineappleClient.

HUD (each part can be turned on or off in the menu): FPS, XYZ, facing direction, left/right CPS, WASD/mouse/space keystrokes, and an armor and held-item display with durability. The window title also gets a "PineappleClient |" prefix.

Settings are saved to `config/pineappleclient.json`.

## Project layout

```
mod/src/main/java/com/slaxy/pineappleclient/
  PineappleClient.java        entrypoint, keybinds, tick logic (zoom, sprint)
  HudRenderer.java       all HUD drawing
  SettingsScreen.java    Return-key menu
  Config.java            JSON config
  CpsTracker.java        clicks-per-second counter
  Fullbright.java        gamma override
  mixin/                 zoom FOV, mouse clicks, window title, gamma accessor
launcher/launcher.py     the launcher
```

## Website and macOS .dmg

- `docs/` is a static website (open `docs/index.html` or upload the folder to any static host). It describes the client, shows screenshots, and has a **Download for macOS** button.
- The button downloads `docs/downloads/PineappleClient.dmg`. If that file isn't there, it uses the latest GitHub release instead.
- `.github/workflows/build-and-deploy.yml` runs on every push to `main`. It builds the mod and `PineappleClient.app` on a macOS runner and packs them into `PineappleClient.dmg`, which it publishes as the `client-latest` release. It then deploys `docs/` with the .dmg to GitHub Pages.
- One-time setup: in the repo, go to **Settings > Pages > Build and deployment > Source** and choose **GitHub Actions**.
- To build the .dmg yourself on a Mac, run `./build_mod.sh && ./packaging/macos/build_dmg.sh`. The result is `dist/PineappleClient.dmg`.
- The app is ad-hoc signed, not notarized, so the first time you open it, right-click it and choose **Open**.
- The pictures on the site are pixel-art mockups made by `tools/make_images.py`. To show the real game, replace the files in `docs/img/` with real screenshots, keeping the same names.

## Changing the Minecraft version

Edit `mod/gradle.properties` (`minecraft_version`, `yarn_mappings`, `fabric_version`, and `minecraft` in `fabric.mod.json`) using the values from fabricmc.net/develop, then change `DEFAULT_MC_VERSION` in `launcher.py`. Some Minecraft method names change between versions, so the mixins may need small fixes.
