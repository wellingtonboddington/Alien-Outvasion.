// Character profiles: main cast + defaults + ethnicity palettes. A profile is plain data; resolveProfile() fills every gap.
import { RNG, hashStr } from '../../engine/common.js';

export const DEFAULTS = {
  id: 'person', name: 'Person', gender: 'M', age: 25, heightCm: 172, ethnicity: 'filipino',
  build: { shoulder: 1, chest: 1, waist: 1, hip: 1, limbFat: 0.25, muscle: 0.25, belly: 0, bust: 0, neck: 1, hand: 1, legLen: 1, armLen: 1 },
  face: { width: 1, jaw: 1, chin: 1, cheek: 1, brow: 1, forehead: 1, noseLen: 1, noseWidth: 1, noseBridge: 1, noseTip: 0, noseUp: 0, lips: 1, lipWidth: 1, eyeSize: 1, eyeSpacing: 1, eyeTilt: 0, earSize: 1, jowl: 0, headLen: 1 },
  skin: { tone: '#c58f66', warm: 0.5, freckles: 0, moles: [], stubble: 0, blush: 0.25, lip: '#a85a56', eyeShadow: 0, lipstick: null, eyeliner: 0, wrinkles: 0, tattoos: [], scars: [], bodyHair: 0.3 },
  eyes: { color: '#4a2e1b', holo: false },
  brows: { color: null, thick: 1, arch: 0.5, spacing: 1 },
  facialHair: { type: 'none', color: null, density: 0.8 },
  hair: { style: 'crop', color: '#17110d', hi: null, length: 1, volume: 1, gray: 0 },
  outfit: {},
  accessories: [],
  baseSmile: 0,
};

export const ETHNICITY = {
  filipino: {
    tones: ['#c58f66', '#b98259', '#d2a07a', '#a8734d', '#dcae8a', '#c08a60'],
    hair: ['#17110d', '#1c1410', '#241812', '#120d0a'], eyes: ['#3e2616', '#4a2e1b', '#2d1b10'],
    face: { noseWidth: 1.06, noseBridge: 0.82, lips: 1.05, eyeTilt: 0.02, cheek: 1.05 }, brow: '#120d0a', pathHair: 'straight',
  },
  caucasian: {
    tones: ['#f0cfb2', '#e8c1a0', '#deb08c', '#f3d7c0', '#e5b896'],
    hair: ['#3a2618', '#6b4a2c', '#b98a4b', '#d8b46a', '#2a1c14', '#8a3b1e', '#8a8580'], eyes: ['#4b6e8f', '#5d7f56', '#6a4a2c', '#8a9aa0', '#3a5a7a'],
    face: { noseBridge: 1.12, noseLen: 1.05, lips: 0.9, noseWidth: 0.95 }, brow: '#4a3322', pathHair: 'straight',
  },
  black: {
    tones: ['#6b4430', '#5a3826', '#7a5238', '#4a2f20', '#8a5f42'],
    hair: ['#0c0907', '#14100c', '#1a120d'], eyes: ['#2b1a10', '#34200f'],
    face: { noseWidth: 1.18, noseBridge: 0.9, lips: 1.25, cheek: 1.05, noseLen: 0.95 }, brow: '#0c0907', pathHair: 'curly',
  },
  south_asian: {
    tones: ['#a8754e', '#9a6a45', '#b88660', '#8a5a38'],
    hair: ['#0f0b09', '#17110d', '#1c1410'], eyes: ['#2d1b10', '#3a2312'],
    face: { noseBridge: 1.05, noseLen: 1.05, lips: 1.05, eyeSize: 1.06, brow: 1.1 }, brow: '#0f0b09', pathHair: 'wavy',
  },
  east_asian: {
    tones: ['#e5be98', '#dcb48c', '#e9c8a4', '#d9ad88'],
    hair: ['#0f0c0a', '#17110d'], eyes: ['#2d1b10', '#3a2312'],
    face: { noseBridge: 0.7, noseWidth: 0.95, eyeTilt: 0.07, cheek: 1.12, jaw: 0.95, eyeSize: 0.95, brow: 0.85 }, brow: '#0f0c0a', pathHair: 'straight',
  },
  slavic: {
    tones: ['#efcfb6', '#f0d5be', '#e9c4a6'],
    hair: ['#8f6a3a', '#c9a45d', '#4a3524', '#d9bf84', '#6e5a48'], eyes: ['#5a7fa0', '#7a96a8', '#6a8a6a', '#4b6e8f'],
    face: { cheek: 1.12, jaw: 1.02, noseBridge: 1.0, lips: 0.92, eyeSpacing: 1.04 }, brow: '#6e5a48', pathHair: 'straight',
  },
  german: {
    tones: ['#ecc9aa', '#f0d3b8', '#e6bfa0'],
    hair: ['#c9a45d', '#8f6a3a', '#4a3524', '#d9c58c', '#6b4a2c'], eyes: ['#4b6e8f', '#6a8aa8', '#7a8a60'],
    face: { jaw: 1.06, noseBridge: 1.12, noseLen: 1.06, lips: 0.88, brow: 1.05 }, brow: '#6b4a2c', pathHair: 'straight',
  },
  middle_eastern: {
    tones: ['#c79a74', '#b88960', '#d4aa86', '#a67a55'],
    hair: ['#0f0b09', '#1c1410', '#2a1c14'], eyes: ['#3a2312', '#5a4020', '#6a5a2c'],
    face: { noseBridge: 1.2, noseLen: 1.12, brow: 1.2, jaw: 1.04, lips: 1.0, eyeSize: 1.04 }, brow: '#0f0b09', pathHair: 'wavy',
  },
};

// -------- main cast (CONTRACT §4) --------
export const MAIN_CAST = {
  mirrah: {
    id: 'mirrah', name: 'Mirrah', gender: 'F', age: 19, heightCm: 150, ethnicity: 'filipino',
    build: { shoulder: 0.93, chest: 0.9, waist: 0.84, hip: 1.0, limbFat: 0.28, muscle: 0.08, bust: 0.55, hand: 0.92, neck: 0.9 },
    face: { width: 0.97, jaw: 0.9, chin: 0.9, cheek: 1.12, noseWidth: 0.92, noseBridge: 0.85, noseLen: 0.88, lips: 1.1, lipWidth: 0.95, eyeSize: 1.12, eyeSpacing: 1.0, eyeTilt: 0.03, brow: 0.9 },
    skin: { tone: '#cf9c76', warm: 0.5, blush: 0.32, freckles: 0.05, moles: [[-0.052, -0.045]], lip: '#b36a68', eyeliner: 0.2, wrinkles: 0 },
    eyes: { color: '#2d1b10' }, brows: { color: '#140e0b', thick: 0.9, arch: 0.55 },
    hair: { style: 'bun', color: '#130e0c', hi: '#2a1e18', length: 1, volume: 1 },
    outfit: { top: { type: 'scrubs', color: '#2c8fa6' }, outer: { type: 'labcoat', color: '#f1f3f5', open: true }, bottom: { type: 'scrubs', color: '#2c8fa6' }, shoes: { type: 'clog', color: '#f2f2f2' } },
    accessories: ['glasses_round', 'lanyard', 'pen_pocket'], baseSmile: 0.1,
  },
  bead: {
    id: 'bead', name: 'Bead', gender: 'M', age: 20, heightCm: 168, ethnicity: 'filipino',
    build: { shoulder: 1.14, chest: 1.22, waist: 0.9, hip: 0.96, limbFat: 0.06, muscle: 0.95, neck: 1.18, hand: 1.05 },
    face: { width: 1.02, jaw: 1.14, chin: 1.08, cheek: 0.98, brow: 1.1, noseWidth: 0.98, noseBridge: 0.95, eyeSize: 1.0, eyeTilt: 0.02, lips: 0.95 },
    skin: { tone: '#caa07c', warm: 0.45, blush: 0.12, stubble: 0.25, lip: '#a45f58' },
    eyes: { color: '#2b1a10', holo: true }, brows: { color: '#0f0b09', thick: 1.15, arch: 0.35 },
    hair: { style: 'sidepart', color: '#0f0c0a', hi: '#25201c', length: 1, volume: 1.1 },
    outfit: { top: { type: 'techtee', color: '#14181d', accent: '#46e6ff' }, outer: { type: 'techjacket', color: '#1b2128', accent: '#46e6ff' }, bottom: { type: 'techpants', color: '#161a20', accent: '#46e6ff' }, shoes: { type: 'techsneaker', color: '#101317', accent: '#46e6ff' } },
    accessories: ['aipin', 'watch'],
  },
  jez: {
    id: 'jez', name: 'Jez', gender: 'F', age: 21, heightCm: 165, ethnicity: 'filipino',
    build: { shoulder: 0.97, chest: 0.95, waist: 0.88, hip: 1.0, limbFat: 0.2, muscle: 0.35, bust: 0.6, legLen: 1.02 },
    face: { width: 0.96, jaw: 0.94, chin: 0.95, cheek: 1.02, noseWidth: 0.95, noseBridge: 0.92, noseLen: 0.95, lips: 1.0, eyeSize: 1.1, eyeTilt: 0.04, brow: 0.95 },
    skin: { tone: '#d3a07a', warm: 0.55, blush: 0.28, freckles: 0.25, moles: [[0.03, -0.07]], lip: '#b8706a' },
    eyes: { color: '#3b2415' }, brows: { color: '#1c130e', thick: 1.0, arch: 0.6 },
    hair: { style: 'long_wavy', color: '#2a1a12', hi: '#4d3220', length: 1, volume: 1.15 },
    outfit: { top: { type: 'tshirt', color: '#e9e4d8' }, outer: { type: 'cargo_jacket', color: '#6b6b47' }, bottom: { type: 'jeans', color: '#35465e' }, shoes: { type: 'boots', color: '#4a3524' } },
    accessories: ['satchel', 'notebook_pocket'], baseSmile: 0.08,
  },
  stephen: {
    id: 'stephen', name: 'Stephen', gender: 'M', age: 19, heightCm: 188, ethnicity: 'filipino',
    build: { shoulder: 1.0, chest: 0.94, waist: 0.82, hip: 0.84, limbFat: 0.08, muscle: 0.5, neck: 1.05, hand: 1.1, legLen: 1.03 },
    face: { width: 0.97, jaw: 1.05, chin: 1.05, cheek: 0.95, noseWidth: 0.97, noseBridge: 1.0, noseLen: 1.04, lips: 1.0, eyeSize: 0.98, brow: 1.0, headLen: 1.04 },
    skin: { tone: '#d9ab86', warm: 0.45, blush: 0.14, stubble: 0.12, lip: '#a85f5a', freckles: 0.05 },
    eyes: { color: '#3a2312' }, brows: { color: '#1a120d', thick: 1.0, arch: 0.4 },
    hair: { style: 'crop', color: '#1a120d', hi: '#2e231c', length: 1, volume: 1 },
    outfit: { top: { type: 'uniform_polo', color: '#c8202a', trim: '#f2c21b' }, bottom: { type: 'slacks', color: '#17181b' }, shoes: { type: 'work', color: '#141414' }, cap: { type: 'visor', color: '#c8202a', trim: '#f2c21b' } },
    accessories: ['nametag'], baseSmile: 0.1,
  },
  ezra: {
    id: 'ezra', name: 'Ezra', gender: 'M', age: 19, heightCm: 165, ethnicity: 'filipino',
    build: { shoulder: 0.95, chest: 0.88, waist: 0.84, hip: 0.88, limbFat: 0.04, muscle: 0.4, neck: 0.95, hand: 0.98 },
    face: { width: 0.98, jaw: 0.96, chin: 0.95, cheek: 1.08, noseWidth: 1.08, noseBridge: 0.8, noseLen: 0.92, lips: 1.1, lipWidth: 1.08, eyeSize: 1.05, eyeTilt: 0.03, brow: 0.95, earSize: 1.12 },
    skin: { tone: '#b9825a', warm: 0.55, blush: 0.2, stubble: 0.1, lip: '#9c5a50', freckles: 0.1 },
    eyes: { color: '#2b1a10' }, brows: { color: '#0f0b09', thick: 1.0, arch: 0.7 },
    hair: { style: 'messy', color: '#0f0c0a', hi: '#221b16', length: 1, volume: 1.1 },
    outfit: { top: { type: 'uniform_polo', color: '#e6b422', trim: '#b01c26' }, bottom: { type: 'slacks', color: '#24262b' }, shoes: { type: 'sneakers', color: '#e9e9e9' }, cap: { type: 'cap', color: '#b01c26', trim: '#e6b422' } },
    accessories: ['nametag'], baseSmile: 0.42,
  },
  sam: {
    id: 'sam', name: 'Sam', gender: 'M', age: 19, heightCm: 175, ethnicity: 'filipino',
    build: { shoulder: 1.06, chest: 1.22, waist: 1.62, hip: 1.28, belly: 1.0, limbFat: 0.85, muscle: 0.2, neck: 1.2, hand: 1.18 },
    face: { width: 1.1, jaw: 1.0, chin: 0.9, cheek: 1.35, noseWidth: 1.12, noseBridge: 0.78, noseLen: 0.95, lips: 1.12, eyeSize: 1.0, eyeTilt: 0.02, brow: 0.95, jowl: 0.9 },
    skin: { tone: '#a8754e', warm: 0.6, blush: 0.3, stubble: 0.35, lip: '#8f5048' },
    eyes: { color: '#2b1a10' }, brows: { color: '#0f0b09', thick: 1.1, arch: 0.3 },
    facialHair: { type: 'stubble', color: '#17110d', density: 0.7 },
    hair: { style: 'crop', color: '#0f0b09', hi: null, length: 1, volume: 1 },
    outfit: { top: { type: 'driver_shirt', color: '#5a7ea6', trim: '#e8e1cf' }, bottom: { type: 'slacks', color: '#2a2c30' }, shoes: { type: 'sandals', color: '#2e2a26' }, cap: { type: 'cap', color: '#2f4f7a', trim: '#e8e1cf' } },
    accessories: ['towel'], baseSmile: 0.25,
  },
  jhaz: {
    id: 'jhaz', name: 'Jhaz', gender: 'F', age: 19, heightCm: 163, ethnicity: 'filipino',
    build: { shoulder: 1.0, chest: 0.95, waist: 0.9, hip: 1.04, limbFat: 0.3, muscle: 0.5, bust: 0.35, neck: 1.0, hand: 1.0 },
    face: { width: 1.0, jaw: 1.0, chin: 1.02, cheek: 1.0, noseWidth: 1.0, noseBridge: 0.88, noseLen: 0.98, lips: 1.0, eyeSize: 1.0, eyeTilt: 0.02, brow: 1.1 },
    skin: { tone: '#c28b62', warm: 0.5, blush: 0.16, freckles: 0.12, lip: '#a65e58' },
    eyes: { color: '#2d1b10' }, brows: { color: '#120d0a', thick: 1.15, arch: 0.3 },
    hair: { style: 'pixie', color: '#120d0a', hi: '#2b201a', length: 1, volume: 1 },
    outfit: { top: { type: 'tank', color: '#d8d2c4' }, outer: { type: 'driver_jacket', color: '#2b3340', accent: '#d97a1e' }, bottom: { type: 'jeans', color: '#27303d' }, shoes: { type: 'boots', color: '#2a2220' }, gloves: { color: '#1a1a1a' } },
    accessories: ['fingerless_gloves'],
  },
  leon: {
    id: 'leon', name: 'Leon', gender: 'M', age: 19, heightCm: 155, ethnicity: 'filipino',
    build: { shoulder: 1.02, chest: 1.12, waist: 0.96, hip: 0.92, limbFat: 0.1, muscle: 0.7, neck: 1.15, hand: 1.04 },
    face: { width: 1.02, jaw: 1.1, chin: 1.0, cheek: 0.98, noseWidth: 1.05, noseBridge: 0.85, noseLen: 0.95, lips: 0.98, eyeSize: 1.0, brow: 1.2 },
    skin: { tone: '#b07a52', warm: 0.55, blush: 0.1, stubble: 0.45, lip: '#92554a', tattoos: ['forearms', 'neck'] },
    eyes: { color: '#1f130b' }, brows: { color: '#0b0806', thick: 1.2, arch: 0.25 },
    facialHair: { type: 'goatee', color: '#0f0b09', density: 0.85 },
    hair: { style: 'fade', color: '#0b0806', hi: null, length: 1, volume: 1 },
    outfit: { top: { type: 'shirt', color: '#22262b', rolled: true }, bottom: { type: 'jeans', color: '#1d232b' }, apron: { color: '#4a3524' }, shoes: { type: 'boots', color: '#1a1512' } },
    accessories: ['bar_towel'],
  },
  epiphany: {
    id: 'epiphany', name: 'Epiphany', gender: 'F', age: 19, heightCm: 150, ethnicity: 'filipino',
    build: { shoulder: 0.9, chest: 0.88, waist: 0.82, hip: 0.98, limbFat: 0.2, muscle: 0.1, bust: 0.45, hand: 0.9, neck: 0.88 },
    face: { width: 0.95, jaw: 0.88, chin: 0.92, cheek: 1.05, noseWidth: 0.9, noseBridge: 0.9, noseLen: 0.9, lips: 1.0, lipWidth: 0.95, eyeSize: 1.1, eyeTilt: 0.04, brow: 0.95 },
    skin: { tone: '#d6a780', warm: 0.5, blush: 0.26, lip: '#b0605e', lipstick: '#9a2f3a', eyeliner: 0.4, moles: [[0.036, -0.056]] },
    eyes: { color: '#2d1b10' }, brows: { color: '#140e0b', thick: 0.95, arch: 0.75 },
    hair: { style: 'pixie', color: '#110c0a', hi: '#271c17', length: 1, volume: 1 },
    outfit: { top: { type: 'blouse', color: '#f1ece4' }, outer: { type: 'blazer', color: '#2b2f3b' }, bottom: { type: 'slacks', color: '#2b2f3b' }, shoes: { type: 'heels', color: '#1c1b1d' } },
    accessories: ['glasses_tiny', 'briefcase_carry'], baseSmile: 0.05,
  },
};

const merge = (a, b) => { const o = Array.isArray(a) ? a.slice() : { ...a }; for (const k in b) { const v = b[k]; if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) o[k] = merge(a[k], v); else o[k] = v; } return o; };

/** fill defaults + ethnicity facial tendencies; returns a NEW object with numeric `height` (m) */
export function resolveProfile(p = {}) {
  const base = merge(DEFAULTS, p);
  const eth = ETHNICITY[base.ethnicity] || ETHNICITY.filipino;
  // ethnicity tendencies multiply face params only if the author did not specify them
  const face = { ...DEFAULTS.face };
  for (const k in eth.face) face[k] = eth.face[k];
  for (const k in (p.face || {})) face[k] = p.face[k];
  base.face = face;
  if (!p.skin?.tone) base.skin.tone = eth.tones[0];
  if (!p.eyes?.color) base.eyes.color = eth.eyes[0];
  if (!base.brows.color) base.brows.color = eth.brow;
  if (!base.facialHair.color) base.facialHair.color = base.hair.color;
  base.height = base.heightCm / 100;
  base.isFemale = base.gender === 'F';
  base.youth = base.age < 16 ? Math.max(0, Math.min(1, (16 - base.age) / 12)) : 0; // 0 adult .. 1 toddler-ish
  base.elder = base.age > 60 ? Math.min(1, (base.age - 60) / 30) : 0;
  base.seed = hashStr(base.id + base.name);
  return base;
}
