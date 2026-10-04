// Offline analysis helpers (used by tools/audio-test.mjs and src/demos/audio_spectro.js): level metrics, spectral centroid, band energies,
// and a log-frequency spectrogram painted on a canvas so audio can be "looked at" when it can't be listened to.

function fft(re, im) { // in-place radix-2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2; const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
const mono = (buf) => { const a = buf.getChannelData(0); if (buf.numberOfChannels < 2) return a; const b = buf.getChannelData(1), m = new Float32Array(a.length); for (let i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) * 0.5; return m; };

/** peak / rms / nan / active duration / spectral centroid / band energy split */
export function analyze(buf) {
  const sr = buf.sampleRate, n = buf.length; let peak = 0, sumSq = 0, nan = 0, N = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) { const v = d[i]; if (!Number.isFinite(v)) { nan++; continue; } const a = Math.abs(v); if (a > peak) peak = a; sumSq += v * v; N++; } }
  const m = mono(buf); const win = Math.floor(sr * 0.05); const rmsW = []; let maxW = 0;
  for (let i = 0; i + win <= n; i += win) { let s = 0; for (let j = 0; j < win; j++) { const v = m[i + j]; s += v * v; } const r = Math.sqrt(s / win); rmsW.push(r); if (r > maxW) maxW = r; }
  const thr = maxW * Math.pow(10, -40 / 20); let first = -1, last = -1; for (let i = 0; i < rmsW.length; i++) if (rmsW[i] > thr) { if (first < 0) first = i; last = i; }
  const active = first < 0 ? 0 : (last - first + 1) * 0.05, onset = first < 0 ? 0 : first * 0.05;
  // spectrum
  const F = 2048, re = new Float32Array(F), im = new Float32Array(F), hann = new Float32Array(F); for (let i = 0; i < F; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (F - 1));
  const bins = F / 2, pw = new Float64Array(bins); let frames = 0; const hop = Math.max(F, Math.floor(n / 24));
  for (let s = 0; s + F <= n; s += hop) { for (let i = 0; i < F; i++) { re[i] = m[s + i] * hann[i]; im[i] = 0; } fft(re, im); for (let k = 0; k < bins; k++) pw[k] += re[k] * re[k] + im[k] * im[k]; frames++; }
  let cs = 0, ct = 0; const bands = { sub: 0, low: 0, mid: 0, high: 0, air: 0 }; const edges = [[0, 80, 'sub'], [80, 300, 'low'], [300, 2500, 'mid'], [2500, 8000, 'high'], [8000, 1e9, 'air']];
  for (let k = 1; k < bins; k++) { const f = (k * sr) / F; cs += f * pw[k]; ct += pw[k]; for (const [a, b, nm] of edges) if (f >= a && f < b) bands[nm] += pw[k]; }
  const tot = ct || 1; for (const k in bands) bands[k] = Math.round((100 * bands[k]) / tot);
  const db = (x) => (x > 1e-9 ? 20 * Math.log10(x) : -180);
  return { peak, peakDb: db(peak), rmsDb: db(Math.sqrt(sumSq / Math.max(1, N))), nan, activeSec: active, onsetSec: onset, centroid: cs / tot, bands, length: n / sr, maxWinDb: db(maxW) };
}

/** canvas spectrogram (log freq 30Hz..16k) + level envelope strip. returns data URL */
export function spectrogram(buf, { w = 900, h = 320, minDb = -85, label = '' } = {}) {
  const sr = buf.sampleRate, n = buf.length, m = mono(buf); const F = 2048, re = new Float32Array(F), im = new Float32Array(F), hann = new Float32Array(F);
  for (let i = 0; i < F; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (F - 1));
  const specH = h - 70; const cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h; const g = cvs.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const img = g.createImageData(w, specH); const fmin = 30, fmax = Math.min(16000, sr / 2);
  const col = new Float32Array(w * specH); let gmax = -200;
  for (let x = 0; x < w; x++) {
    const s0 = Math.floor((x / w) * (n - F)); if (s0 < 0) continue; for (let i = 0; i < F; i++) { re[i] = (m[s0 + i] || 0) * hann[i]; im[i] = 0; } fft(re, im);
    for (let y = 0; y < specH; y++) {
      const f = fmin * Math.pow(fmax / fmin, 1 - y / (specH - 1)); const kf = (f * F) / sr; const k0 = Math.floor(kf), fr = kf - k0;
      const a = Math.hypot(re[k0], im[k0]), b = Math.hypot(re[k0 + 1] || 0, im[k0 + 1] || 0); const mag = (a * (1 - fr) + b * fr) / (F / 4);
      const d = 20 * Math.log10(mag + 1e-9); col[y * w + x] = d; if (d > gmax) gmax = d;
    }
  }
  const lo = gmax + minDb + 25, hi = gmax;
  const cmap = (t) => { t = Math.max(0, Math.min(1, t)); const r = Math.min(255, 255 * Math.pow(t, 0.8) * 1.6), gg = Math.min(255, 255 * Math.pow(Math.max(0, t - 0.25) / 0.75, 1.2)), bb = Math.min(255, 255 * (t < 0.5 ? t * 1.6 : Math.max(0, 1.6 - t * 1.6) * 0.6 + (t > 0.9 ? (t - 0.9) * 10 * 255 / 255 : 0))); return [r, gg, bb]; };
  for (let y = 0; y < specH; y++) for (let x = 0; x < w; x++) { const [r, gg, bb] = cmap((col[y * w + x] - lo) / (hi - lo)); const o = (y * w + x) * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = bb; img.data[o + 3] = 255; }
  g.putImageData(img, 0, 0);
  // level envelope strip
  const y0 = specH + 4; g.fillStyle = '#111'; g.fillRect(0, y0, w, 62); g.strokeStyle = '#6cf'; g.beginPath();
  for (let x = 0; x < w; x++) { const s0 = Math.floor((x / w) * n), s1 = Math.floor(((x + 1) / w) * n); let pk = 0; for (let i = s0; i < s1; i++) { const a = Math.abs(m[i]); if (a > pk) pk = a; } const db = Math.max(minDb, 20 * Math.log10(pk + 1e-9)); const yy = y0 + 60 - ((db - minDb) / -minDb) * 58; if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy); }
  g.stroke();
  g.fillStyle = '#fff'; g.font = '11px monospace'; g.fillText(label + `   ${(n / sr).toFixed(1)}s`, 6, 12);
  for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) { if (f > fmax) continue; const y = (1 - Math.log(f / fmin) / Math.log(fmax / fmin)) * (specH - 1); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y, 6, 1); g.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), 8, y + 4); }
  const secs = n / sr, step = secs > 40 ? 10 : secs > 12 ? 5 : secs > 4 ? 1 : 0.5; for (let s = step; s < secs; s += step) { const x = (s / secs) * w; g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x, specH - 6, 1, 6); g.fillText(s + 's', x + 2, specH - 8); }
  return cvs.toDataURL('image/png');
}

/** 16-bit stereo WAV bytes (Uint8Array) for an AudioBuffer */
export function wavBytes(buf) {
  const ch = Math.min(2, buf.numberOfChannels), n = buf.length, sr = buf.sampleRate; const out = new Uint8Array(44 + n * ch * 2); const dv = new DataView(out.buffer);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); wr(8, 'WAVE'); wr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); wr(36, 'data'); dv.setUint32(40, n * ch * 2, true);
  let o = 44; const d = []; for (let c = 0; c < ch; c++) d.push(buf.getChannelData(c));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, d[c][i])); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return out;
}
