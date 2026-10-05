// Offline rendering helper (OfflineAudioContext + the engine's virtual clock): used by tools/audio-test.mjs-style tests and the audio demos.
//   const buf = await renderItem({ kind: 'sfx'|'music'|'stinger'|'amb'|'voice', name, secs, sr, opts, intensity });
import { createAudio } from './engine.js';

export async function renderItem({ kind, name, secs = 8, sr = 32000, opts = {}, intensity = 0.6, quality = 1, mix } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(secs * sr), sr);
  const a = createAudio({ ctx, offline: true, quality, mix });
  if (kind === 'sfx') { a.sfx.play(name, opts); a.advance(secs); }
  else if (kind === 'music') { a.music.play(name, { fade: 0.05, intensity }); let t = 0; while (t < secs) { const dt = Math.min(0.5, secs - t); a.advance(dt); t += dt; } }
  else if (kind === 'stinger') { a.music.stinger(name); a.advance(secs); }
  else if (kind === 'amb') { a.amb.set(name, 1, 0.2); a.advance(secs); }
  else if (kind === 'voice') { a.voice.setMode('babble'); a.voice.say({ text: name, ...opts }); a.advance(secs); }
  const buf = await ctx.startRendering(); a.dispose(); return buf;
}
