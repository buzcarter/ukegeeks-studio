# Releasing UkeGeeks Studio

How a release build is made and signed. The plan behind it is Phase 5 in [ROADMAP.md](ROADMAP.md); the items are UGS-0044 to UGS-0048 in [BACKLOG.md](BACKLOG.md).

## Mac: `npm run release:mac`

A universal (Apple Silicon + Intel) `.app` and `.dmg`, signed with the owner's Developer ID and notarized by Apple, so it opens with no warnings. It runs on the owner's Mac; signing in GitHub Actions is for later. The script ([scripts/release-mac.js](../scripts/release-mac.js)) finds the certificate, builds, has Tauri sign, notarize and staple the app, notarizes and staples the `.dmg`, then checks both with `codesign`, `spctl` and `stapler`.

`npm run build:mac` is the same build, ad-hoc signed and not notarized: fine on this Mac, but a Mac that downloads it asks to right-click > Open the first time.

### One-time setup

Needs the Apple Developer Program membership. The Command Line Tools are enough (`notarytool` and `stapler` come with them); Xcode isn't needed.

1. **A Developer ID Application certificate,** in the login keychain:
   1. In Keychain Access, select **login** in the sidebar. Then, from the app menu (the bold "Keychain Access" beside File, not the File menu): Certificate Assistant > Request a Certificate From a Certificate Authority…. Your email and name, CA Email Address empty, "Saved to disk".
   2. On developer.apple.com, Certificates, Identifiers & Profiles > Certificates > +: **Developer ID Application**, then Continue. The next page asks for a Profile Type: **G2 Sub-CA** (it says "Xcode 11.4.1 or later", but Xcode isn't needed). Upload the request, download the `.cer`.
   3. Double-click the `.cer`. If Keychain Access says the "System Roots" keychain can't be modified, click OK: that's harmless, and the certificate lands in another keychain (System or login; either works).
   4. **Apple's intermediate certificate,** which Xcode would otherwise install. Without it the certificate shows "is not trusted" and counts as invalid:

```bash
curl -fsSL -o ~/Downloads/DeveloperIDG2CA.cer https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer && security import ~/Downloads/DeveloperIDG2CA.cer -k ~/Library/Keychains/login.keychain-db
```

   5. Check: `security find-identity -v -p codesigning` says "1 valid identities found" and lists "Developer ID Application: <name> (<TEAM ID>)". The ten characters in brackets are the team ID.
   6. The first signing may ask whether `codesign` may use the key: **Always Allow**, so release builds don't stop to ask.
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
