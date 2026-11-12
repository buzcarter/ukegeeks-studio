/**
 * The rows of the song list: each a ☆/★ (Favorites) and a link that opens the song.
 * The same row serves a songbook's songs, All Songs, Favorites and search results;
 * the last three also say which songbook a song is from.
 */
import { showStar, starLook } from '../lib/favorites.js';
import { escapeHtml, escapeText } from '../lib/html.js';

/**
 * One row's HTML.
 * @param {object} song
 * @param {string} song.folder its songbook's folder
 * @param {string} song.filename
 * @param {string} song.title
 * @param {string[]} [song.details] artist, subtitle: shown after the title
 * @param {string} [song.songbook] its songbook's name, when the list spans songbooks
 * @param {string} [song.snippetHtml] a lyric line with the search's words marked (HTML)
 * @param {boolean} [song.missing] a favorite whose file is gone
 * @param {boolean} starred
 */
export function songRow({ folder, filename, title, details = [], songbook, snippetHtml, missing = false }, starred) {
  const { symbol, label } = starLook(starred);
  const where = `data-folder="${escapeText(folder)}" data-filename="${escapeText(filename)}"`;
  const shownDetails = details.filter(Boolean).map(escapeHtml).join(' · ');
  return `<li class="songRow${missing ? ' isMissing' : ''}">`
    + `<button type="button" class="songStar" ${where} aria-pressed="${starred}" title="${label}" aria-label="${label}">${symbol}</button>`
    + `<a href="#" ${where}${missing ? ' data-missing="1"' : ''}>`
    + `<span class="songTitle">${escapeHtml(title)}</span>`
    + (shownDetails ? ` <span class="songDetails">${shownDetails}</span>` : '')
    + (songbook ? `<span class="songSongbook" title="${escapeText(folder)}">${escapeText(songbook)}</span>` : '')
    + (missing ? ' <span class="songMissing">not found</span>' : '')
    + (snippetHtml ? `<span class="songSnippet">${snippetHtml}</span>` : '')
    + '</a></li>';
}

/** Shows every row's star again, after a star changed. isStarred(folder, filename) */
export function updateStars(listEl, isStarred) {
  for (const star of listEl.querySelectorAll('button.songStar')) {
    showStar(star, isStarred(star.dataset.folder, star.dataset.filename));
  }
}
