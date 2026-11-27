# Releasing UkeGeeks Studio

How a release build is made and signed. The plan behind it is Phase 5 in [ROADMAP.md](ROADMAP.md); the items are UGS-0044 to UGS-0048 in [BACKLOG.md](BACKLOG.md).

## Mac: `npm run release:mac`

A universal (Apple Silicon + Intel) `.app` and `.dmg`, signed with the owner's Developer ID and notarized by Apple, so it opens with no warnings. It runs on the owner's Mac; signing in GitHub Actions is for later. The script ([scripts/release-mac.js](../scripts/release-mac.js)) finds the certificate, builds, has Tauri sign, notarize and staple the app, notarizes and staples the `.dmg`, then checks both with `codesign`, `spctl` and `stapler`.

`npm run build:mac` is the same build, ad-hoc signed and not notarized: fine on this Mac, but a Mac that downloads it asks to right-click > Open the first time.

### One-time setup

Needs the Apple Developer Program membership. The Command Line Tools are enough (`notarytool` and `stapler` come with them); Xcode isn't needed.

1. **A Developer ID Application certificate,** in the login keychain:
   1. Keychain Access > Certificate Assistant > Request a Certificate From a Certificate Authority…: your email, "Saved to disk".
   2. On developer.apple.com, Certificates, Identifiers & Profiles > Certificates > +: **Developer ID Application** (G2 Sub-CA), upload that request, download the `.cer`.
   3. Double-click the `.cer` to add it to the login keychain.
   4. Check: `security find-identity -v -p codesigning` lists "Developer ID Application: <name> (<TEAM ID>)". The ten characters in brackets are the team ID.
2. **An app-specific password** for notarizing: account.apple.com > Sign-In and Security > App-Specific Passwords, named "UkeGeeks Studio notary".
3. **Keep the password in the keychain,** never in a file or the shell history. This asks for it:

```bash
security add-generic-password -s ukegeeks-studio-notary -a "<your Apple ID email>" -w
```

(An App Store Connect API key works instead: set `APPLE_API_KEY`, `APPLE_API_ISSUER` and `APPLE_API_KEY_PATH`.)

### Each release

```bash
cd ~/Code/UkeGeeks/ugs-ukegeeks-studio && APPLE_ID="<your Apple ID email>" APPLE_TEAM_ID="<TEAM ID>" npm run release:mac
```

Notarizing usually takes a few minutes per upload (two uploads: the app, then the `.dmg`). The result is `src-tauri/target/universal-apple-darwin/release/bundle/dmg/UkeGeeks Studio_<version>_universal.dmg`. If Apple rejects an upload, `xcrun notarytool log <submission id> …` (same credentials) says why.

## Windows

The CI's `windows` job (`.github/workflows/ci.yml`) builds an unsigned NSIS installer on every push and PR; it's under the run's Artifacts as `ukegeeks-studio-windows`. Until Windows signing is set up, SmartScreen says "Windows protected your PC": testers click More info > Run anyway.
