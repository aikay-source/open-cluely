# Contributing to Open Cluely

Thanks for your interest in improving Open Cluely! This guide covers how to get set up, make a change, and get it shipped.

## Prerequisites

- [Node.js](https://nodejs.org) 20 or newer
- Git
- macOS (Apple Silicon) or Windows to run the desktop app

## Get set up

```bash
git clone https://github.com/aikay-source/open-cluely.git
cd open-cluely
npm ci
```

If you hit a Sharp/native build error during install:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install --ignore-scripts
npm rebuild sharp
```

## Run it locally

```bash
npm start          # runs Vite + Electron in development with hot reload
```

To produce a packaged installer for your own OS:

```bash
npm run app:build  # output lands in release/
```

## Making a change

1. **Branch off `master`.** Use a short, descriptive name:
   - `fix/windows-tray-quit`
   - `feat/global-pause-shortcut`
   - `docs/readme-install`
2. **Keep the change focused.** One concern per PR. Don't bundle unrelated edits.
3. **Check it builds:** `npm run build` must pass (this is what CI runs).
4. **Test it in the running app** (`npm start`) and note which OS you tested on.
5. **Never commit secrets.** API keys live in the app's local settings, never in the repo. `.env` and `~/.open-cluely.env` are gitignored — keep it that way.

## Open a pull request

1. Push your branch and open a PR against `master`.
2. Fill in the PR template (what, why, how tested).
3. CI runs automatically — it typechecks the Electron main process and builds the renderer. **Your PR can't be merged until CI is green.**
4. A maintainer reviews and merges. `master` is protected, so changes only land through PRs.

## How releases ship

Releases are cut by a maintainer, not from a PR:

1. Bump the `version` in `package.json` (and the download links in `README.md`).
2. Commit, then tag it: `git tag v1.2.3 && git push origin v1.2.3`.
3. The [release workflow](.github/workflows/release.yml) builds the macOS `.dmg` and Windows `.exe` on tag push and attaches them to a draft GitHub Release.
4. The maintainer publishes the release once the build succeeds.

We follow [semantic versioning](https://semver.org): patch for fixes, minor for features, major for breaking changes.

## Questions

Open an issue if anything here is unclear or out of date.
