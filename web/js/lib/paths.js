/** Paths as Tauri hands them over: "/" on a Mac, "\" on Windows. Plain functions, tested in test/paths.test.js. */

const trimSlashes = (path) => path.replace(/[/\\]+$/, '');
const parts = (path) => trimSlashes(path).split(/[/\\]/).filter(Boolean);

/** A path split into its folder and filename. */
export function splitPath(path) {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return { dir: path.slice(0, i), name: path.slice(i + 1) };
}

export function joinPath(folder, name) {
  const sep = folder.includes('\\') && !folder.includes('/') ? '\\' : '/';
  return trimSlashes(folder) + sep + name;
}

/** The folder's last part, for display ("cpm" for ".../UkeGeeks/cpm"). */
export function folderName(folder) {
  return parts(folder).pop() || folder;
}

/** The folder's parent's name ("UkeGeeks" for ".../UkeGeeks/cpm"), or ''. */
export function parentName(folder) {
  const all = parts(folder);
  return all.length > 1 ? all[all.length - 2] : '';
}

/** A path to compare with another: no trailing slash, one Unicode form (macOS hands back either). */
export function cleanPath(path) {
  return trimSlashes(path).normalize('NFC');
}
