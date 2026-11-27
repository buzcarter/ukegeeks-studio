/**
 * `npm run release:mac`: the Mac release. Builds the universal app and .dmg, signed
 * with the owner's Developer ID and notarized by Apple, so it opens with no warnings.
 * The one-time setup (certificate, app-specific password) is in docs/RELEASING.md.
 *
 * 1. Finds the "Developer ID Application" identity in the keychain (or uses
 *    APPLE_SIGNING_IDENTITY).
 * 2. Notarization credentials: an App Store Connect API key (APPLE_API_KEY,
 *    APPLE_API_ISSUER, APPLE_API_KEY_PATH), or APPLE_ID + APPLE_TEAM_ID with the
 *    app-specific password read from the keychain item "ukegeeks-studio-notary"
 *    (or APPLE_PASSWORD). Nothing secret is written to disk.
 * 3. `tauri build`: Tauri signs the app with the hardened runtime, notarizes and
 *    staples it, then makes the .dmg from it.
 * 4. Notarizes and staples the .dmg too, so it opens without a check online.
 * 5. Verifies: codesign, Gatekeeper (spctl) and the stapled tickets.
 *
 * Rust's tools are often only on the PATH of shells that load ~/.cargo/env, so
 * ~/.cargo/bin is added when `cargo` isn't found.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BUNDLE = path.join(ROOT, 'src-tauri/target/universal-apple-darwin/release/bundle');
const KEYCHAIN_ITEM = 'ukegeeks-studio-notary';

const output = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();

function fail(message) {
  console.error(`\nrelease:mac: ${message}\nSee docs/RELEASING.md.`);
  process.exit(1);
}

/** Runs a step, its output shown; a failed step ends the script with its name. */
function run(cmd, args, env = process.env) {
  try {
    execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env });
  } catch {
    fail(`this step failed: ${cmd} ${args.slice(0, 2).join(' ')}…`);
  }
}

/** Finds `cargo`, adding ~/.cargo/bin to the PATH if needed. */
function ensureCargo() {
  const has = () => {
    try {
      execFileSync('cargo', ['--version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  if (has()) return;
  process.env.PATH = `${path.join(os.homedir(), '.cargo/bin')}${path.delimiter}${process.env.PATH}`;
  if (!has()) fail('cargo (Rust) not found, not even in ~/.cargo/bin.');
}

/** The one Developer ID Application identity in the keychain, by its full name. */
function signingIdentity() {
  if (process.env.APPLE_SIGNING_IDENTITY) return process.env.APPLE_SIGNING_IDENTITY;
  const found = output('security', ['find-identity', '-v', '-p', 'codesigning'])
    .split('\n')
    .map((line) => line.match(/"(Developer ID Application: [^"]+)"/)?.[1])
    .filter(Boolean);
  const unique = [...new Set(found)];
  if (unique.length === 0) fail('no "Developer ID Application" certificate in the keychain.');
  if (unique.length > 1) fail(`several Developer ID identities; set APPLE_SIGNING_IDENTITY to one of:\n  ${unique.join('\n  ')}`);
  return unique[0];
}

/** Environment for Tauri's notarization, and the matching notarytool arguments. */
function notaryCredentials() {
  const { APPLE_API_KEY, APPLE_API_ISSUER, APPLE_API_KEY_PATH, APPLE_ID, APPLE_TEAM_ID } = process.env;
  if (APPLE_API_KEY && APPLE_API_ISSUER && APPLE_API_KEY_PATH) {
    return {
      env: { APPLE_API_KEY, APPLE_API_ISSUER, APPLE_API_KEY_PATH },
      args: ['--key', APPLE_API_KEY_PATH, '--key-id', APPLE_API_KEY, '--issuer', APPLE_API_ISSUER],
    };
  }
  if (!APPLE_ID || !APPLE_TEAM_ID) fail('set APPLE_ID and APPLE_TEAM_ID (or the APPLE_API_* key variables).');
  let password = process.env.APPLE_PASSWORD;
  if (!password) {
    try {
      password = output('security', ['find-generic-password', '-s', KEYCHAIN_ITEM, '-a', APPLE_ID, '-w']);
    } catch {
      fail(`no app-specific password in the keychain item "${KEYCHAIN_ITEM}" for that Apple ID.`);
    }
  }
  return {
    env: { APPLE_ID, APPLE_TEAM_ID, APPLE_PASSWORD: password },
    args: ['--apple-id', APPLE_ID, '--team-id', APPLE_TEAM_ID, '--password', password],
  };
}

function onlyFile(dir, ext) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(ext));
  if (files.length !== 1) fail(`expected one ${ext} in ${dir}, found ${files.length}.`);
  return path.join(dir, files[0]);
}

ensureCargo();
const identity = signingIdentity();
const notary = notaryCredentials();
console.log(`Signing as: ${identity}`);

// a clean bundle folder, so the .app and .dmg found below are this build's
fs.rmSync(BUNDLE, { recursive: true, force: true });
run('npx', ['tauri', 'build', '--target', 'universal-apple-darwin', '--bundles', 'app,dmg'], {
  ...process.env,
  ...notary.env,
  APPLE_SIGNING_IDENTITY: identity,
});

const app = onlyFile(path.join(BUNDLE, 'macos'), '.app');
const dmg = onlyFile(path.join(BUNDLE, 'dmg'), '.dmg');

console.log(`\nNotarizing ${path.basename(dmg)}…`);
run('xcrun', ['notarytool', 'submit', dmg, ...notary.args, '--wait']);
run('xcrun', ['stapler', 'staple', dmg]);

console.log('\nChecking…');
run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app]);
run('spctl', ['--assess', '--type', 'execute', '--verbose=2', app]);
run('xcrun', ['stapler', 'validate', app]);
run('xcrun', ['stapler', 'validate', dmg]);
run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose=2', dmg]);

console.log(`\nReady: ${dmg}`);
