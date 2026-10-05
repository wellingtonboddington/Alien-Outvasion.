// Spectrogram sheet of every music cue (and stingers).  node tools/render.mjs --demo audio_cues --out out/audio_cues --w 1800 --h 1100
import spectro from './audio_spectro.js';
const CUES = ['title', 'calm', 'everyday', 'curious', 'unease', 'news', 'dread', 'arrival', 'invasion', 'battle', 'chase', 'horror', 'sorrow', 'nuclear', 'hope', 'finale', 'credits', 'tension_low', 'tension_high', 'alien', 'wonder', 'resolve'];
export default function setup(stage, params = {}) { return spectro(stage, { cols: 3, items: (params.cues || CUES).map((c) => `music:${c}:${params.secs || 24}`), ...params }); }
