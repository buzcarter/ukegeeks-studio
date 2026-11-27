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
2. **An app-specific password** for notarizing: sign in at account.apple.com **with the Apple ID of the Developer account** (the one you use on developer.apple.com), then Sign-In and Security > App-Specific Passwords > +, named "UkeGeeks Studio notary". It looks like `abcd-efgh-ijkl-mnop` and is shown only once.
3. **Keep the password in the keychain,** never in a file or the shell history. In the command below, replace `you@example.com` with that Apple ID (keep the quotes). At `password data for new item:` and again at `retype password data for new item:`, paste the **app-specific password**. `-U` replaces an earlier one.

```bash
security add-generic-password -U -s ukegeeks-studio-notary -a "you@example.com" -w
```

(An App Store Connect API key works instead: set `APPLE_API_KEY`, `APPLE_API_ISSUER` and `APPLE_API_KEY_PATH`.)

### Which password is which

| Where it asks | What it wants |
|---|---|
| A macOS dialog while signing: "codesign wants to sign using key … in your keychain" | Your **Mac login password** (the one that unlocks this Mac), then **Always Allow** |
| The Terminal, after `security add-generic-password … -w`: "password data for new item" | The **app-specific password** (`abcd-efgh-ijkl-mnop`) |
| Anywhere in this setup | **Never** your regular Apple ID password |

If notarizing fails with **HTTP 401, "Invalid credentials"**: the keychain item holds the wrong password, or it's under a different Apple ID than the Developer account. Make a new app-specific password and run step 3 again.

### Each release

Replace `you@example.com` and `ABCDE12345` with the Apple ID and team ID (keep the quotes):

```bash
cd ~/Code/UkeGeeks/ugs-ukegeeks-studio && APPLE_ID="you@example.com" APPLE_TEAM_ID="ABCDE12345" npm run release:mac
```

Notarizing usually takes a few minutes per upload (two uploads: the app, then the `.dmg`). The result is `src-tauri/target/universal-apple-darwin/release/bundle/dmg/UkeGeeks Studio_<version>_universal.dmg`. If Apple rejects an upload, `xcrun notarytool log <submission id> …` (same credentials) says why.

## Windows

The CI's `windows` job (`.github/workflows/ci.yml`) builds an unsigned NSIS installer on every push and PR; it's under the run's Artifacts as `ukegeeks-studio-windows`. Until Windows signing is set up, SmartScreen says "Windows protected your PC": testers click More info > Run anyway.

## Publishing a beta

A beta is a GitHub pre-release with both installers and the tester notes in [release-notes/](release-notes/). The owner runs these steps.

1. **The version,** in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` (the same in all three, like `0.2.0-beta.1`), through a PR. `npm install --package-lock-only` and `cargo test` update the two lock files. The installers' names come from it.
2. **The tester notes:** `docs/release-notes/v<version>.md`, in the same PR.
3. **The Mac `.dmg`:** after the PR is merged, on `main`, run `npm run release:mac` (above).
4. **The Windows `.exe`:** from the CI run of that same commit on `main` (Actions > CI > the run > Artifacts > `ukegeeks-studio-windows`), unzipped into `~/Downloads`.
5. **The pre-release,** tagged on `main`:

```bash
cd ~/Code/UkeGeeks/ugs-ukegeeks-studio && gh release create v0.2.0-beta.1 --prerelease --target main --title "UkeGeeks Studio 0.2.0 beta 1" --notes-file docs/release-notes/v0.2.0-beta.1.md "src-tauri/target/universal-apple-darwin/release/bundle/dmg/UkeGeeks Studio_0.2.0-beta.1_universal.dmg" "$HOME/Downloads/UkeGeeks Studio_0.2.0-beta.1_x64-setup.exe"
```

Testers download from the release's page. Before sending the link, download the `.dmg` from it on another Mac (or another user account) and open the app: it should open with no warning.
