/**
 * The editor page: one song per page (the editor finds its parts by id, so
 * opening another song means loading this page again).
 *
 * For now it opens the bundled sample song and Save writes nothing; reading and
 * writing songbook files comes next.
 */
(() => {
  const editor = ugsEditorPlus.songAmatic.mount(document.getElementById('songEditor'), {
    song: window.sampleSong,
    // @ukegeeks/ace-chordpro-extension's dist/, copied in by scripts/vendor.js
    aceUrl: 'vendor/ace/',
    save: async (text) => {
      console.log('[studio] save()', text.length, 'characters');
      return 'Not saved: this is the sample song.';
    },
  });

  window.studioEditor = editor; // studioEditor.getSong() in the Web Inspector console
})();
