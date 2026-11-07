/**
 * The Settings window (UkeGeeks Studio > Settings…, Cmd+,). Changes save at once, as
 * Mac settings windows do; the song list hears about them and lists the songs again.
 *
 * This page doesn't load menu.js: the menu's events (Save, Quit) are for the main
 * window, which asks about unsaved changes.
 */
import { getSettings, loadSettings, saveSettings } from './songbook.js';

const typeBoxes = [...document.querySelectorAll('input[name="songType"]')];
const reopenBox = document.getElementById('reopenLastSongbook');
const typeProblem = document.getElementById('songTypeProblem');
const saveProblem = document.getElementById('saveProblem');

/** Each box stands for one or more extensions (its value, space-separated). */
const extensionsOf = (box) => box.value.split(' ');

function show(settings) {
  for (const box of typeBoxes) {
    box.checked = extensionsOf(box).some((ext) => settings.songExtensions.includes(ext));
  }
  reopenBox.checked = settings.reopenLastSongbook;
}

async function save() {
  const songExtensions = typeBoxes.filter((box) => box.checked).flatMap(extensionsOf);
  typeProblem.hidden = songExtensions.length > 0;
  if (!songExtensions.length) {
    show(getSettings()); // put the last box back
    return;
  }
  try {
    show(await saveSettings({ ...getSettings(), songExtensions, reopenLastSongbook: reopenBox.checked }));
    saveProblem.hidden = true;
  } catch (err) {
    console.error('[studio] settings_set:', err);
    saveProblem.textContent = `Couldn't save the settings. (${err && err.message ? err.message : err})`;
    saveProblem.hidden = false;
  }
}

for (const box of [...typeBoxes, reopenBox]) box.addEventListener('change', save);
show(await loadSettings());
