// Procedural Earth data: rough continent outlines (lon,lat) -> land potential, biomes, elevation, ice, city lights, clouds.
// Everything is generated on the CPU into small DataTextures (equirect), seamless on the sphere because noise is sampled in 3D.
import * as THREE from 'three';
import { Q, RNG, clamp, lerp, smoothstep } from '../../engine/common.js';
import { makeCanvas, noise3, fbm3, noise2 } from '../../engine/proc.js';
import { cached } from '../../engine/proc.js';

const P = (s) => { const a = s.trim().split(/[\s,;]+/).map(Number); const o = []; for (let i = 0; i < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };

// ---- outlines (rough, but recognisable) -------------------------------------------------------------------
const LAND = {
  northAmerica: P(`-168 66, -166 68.5, -156 71.3, -141 69.6, -128 70.2, -115 68.8, -108 68, -98 68.5, -95 71.5, -90 69, -85 69.5, -82 67, -87 64.5, -93 61.5, -94.5 59, -92.5 57, -85 55.3, -82.5 53, -80.5 51.3, -79 54.5, -77 58, -78 62, -72 61.5, -69 59, -65 60.2, -62 57, -60 55.5, -56 52.2, -60 50.2, -66 50, -70 47.2, -65 48.5, -64.5 46.2, -61 45.8, -66 44.2, -70 43.5, -70.3 41.8, -74 40.6, -75.5 38, -76 36.5, -78 34.5, -81 31.5, -80 27, -80.5 25.2, -82 26.5, -83 29.2, -85.5 29.8, -89 30.2, -90 29, -94 29.5, -97.3 27.5, -97.5 24, -97.8 21.5, -96 19, -94.5 18.2, -91 18.8, -90.4 21, -87 21.5, -87.5 18.5, -88.5 16, -84 15.8, -83.3 12.5, -83.8 10.5, -81.5 8.8, -79.5 9.5, -77.5 8.5, -78 7.2, -80.5 7.3, -82.8 8.2, -85.8 10.2, -87.5 13, -91.2 14, -94.5 16.2, -96.5 15.6, -101 17.3, -105.5 20, -105.5 22.5, -109.5 25.5, -112.2 29.5, -114.8 31.5, -112.8 28.5, -110.5 24.2, -109.8 22.9, -112.2 24.5, -114.5 27.5, -117.2 32.5, -120.5 34.5, -122.5 37.5, -124 40.5, -124.2 46, -123 48.3, -127 50.5, -131 54.5, -135 58, -140 59.8, -146 60.8, -152 59, -156 57, -163 54.8, -158 58.5, -162 60, -165.5 61.5, -163 64.5, -168 65.8`),
  southAmerica: P(`-77.5 8.5, -75.5 10.8, -72 12, -71.5 10.5, -68 10.5, -62 10.7, -60 8.5, -57 6, -52 4.8, -50 1.8, -48 -1, -44.5 -2.5, -39 -3.5, -35 -5.5, -35 -9, -37.5 -12.5, -39 -17.5, -40 -20.5, -43 -23, -46.5 -24.5, -48.5 -26, -48.8 -28.5, -52 -32, -53.5 -34.5, -57 -35, -58 -38.2, -62 -39, -62.5 -41, -65 -41, -64.5 -43, -67.5 -46, -66 -48, -69 -51, -68.5 -52.5, -70.5 -54.5, -73.5 -53.5, -75.5 -50.5, -75 -47, -73.7 -43, -73.5 -38, -71.7 -33, -71.5 -28, -70.3 -23, -70.2 -18.5, -75 -15.5, -76.5 -13.5, -79 -8, -81 -5, -80.2 -2.5, -80.5 0.5, -78.8 1.8, -77.5 4, -77.2 6.5`),
  africa: P(`-17.2 21, -16 24, -13 27.5, -10 30, -9.5 32.5, -6 35.8, -2 35.2, 3 36.8, 10.2 37.2, 11 33.5, 15 32.3, 20 31, 20 32.8, 25 32.5, 32.2 31.3, 34.5 28, 35.5 24, 37.2 21.5, 38.5 18, 41.5 14, 43.3 12.5, 44.5 10.4, 51 11.8, 51.2 10.2, 48.5 5, 44 1.5, 41.5 -1.8, 40.2 -4.8, 39.3 -7.5, 40.5 -11, 40.5 -15, 35 -19.8, 35.5 -24, 32.8 -26, 31 -30, 27.5 -33.5, 22 -34.2, 18.5 -34.2, 17.2 -30.5, 15 -26.5, 14.2 -22, 11.8 -17.5, 13.5 -12.5, 12.3 -6, 9.5 -1.5, 9.2 3.8, 6 4.4, 4 6.3, -1.5 5.2, -7.5 4.4, -11.5 7, -13.7 9.5, -17 13.5, -16.3 18.5`),
  eurasia: P(`-9.5 43.2, -9 38.5, -8.8 37, -6 36.2, -2 36.8, 0 38.5, 3 42, 3.5 43.3, 6 43.1, 8.7 44.4, 10.5 43.2, 12.5 41.5, 15.5 40, 16.2 38.2, 17.8 40.5, 16 41.5, 13.5 43.8, 12.3 45.3, 13.8 45.2, 15.5 43.8, 18.5 42.2, 19.5 40.5, 21 38.5, 23 36.5, 24 38.5, 26 40.7, 27.2 37, 29.5 36.3, 32.5 36.1, 36 36.7, 36 34.5, 35 32.5, 34.3 31.3, 34.8 29.5, 35 28, 37 26, 39.5 21.5, 42.8 16.5, 43.6 12.7, 45 12.8, 49 14, 52.5 16.5, 55.5 17.5, 57.5 18.8, 59.8 22.5, 57.2 24.3, 56.4 26.2, 54.5 24.2, 51.5 24.5, 51 26, 50 27, 48.5 29.8, 48 30, 50 30.3, 52.5 27.5, 56.5 27.2, 57.2 25.7, 61.5 25.2, 66.5 25.2, 68.2 23.7, 70.7 20.8, 72.8 19, 73.5 16, 75 12.5, 76.3 9.5, 77.5 8.1, 79.8 10.3, 80.3 13.5, 80.2 15.8, 82.3 17, 84.8 19, 87 21.5, 89 22, 90.5 22.5, 92 21, 94 19, 94.5 16.5, 97.5 16.5, 98.5 12.5, 98.3 8, 100.3 6.5, 100.5 3.8, 103.5 1.5, 104 1.4, 103.3 4, 102.5 6.2, 100.5 12.5, 100 13.5, 102.5 12.2, 105 10.3, 105.2 8.7, 106.7 10.3, 108.8 11.5, 109.3 13.5, 108 16, 106 18.8, 107.5 21.2, 110 21, 111 21.5, 113.5 22.2, 117 23.3, 119.5 25.3, 121.5 28.5, 122 30.5, 120.8 32, 119.5 35, 122.4 37, 120 37.2, 118.8 38.8, 117.7 39.2, 121.2 40.3, 122.5 40.5, 125 39.5, 124.5 38, 126.5 37.3, 126.5 34.5, 129.2 35.2, 129.5 37, 128 38.5, 129.7 41, 133 42.8, 135.5 43.8, 138.5 47, 141 49, 140.5 52.5, 137.5 54, 135.5 54.7, 141.5 58.5, 144 59.5, 149.5 59.5, 155.5 59.2, 156.5 57.5, 156 51.5, 158.8 52, 162.5 57.5, 163.5 60, 170 60, 177.5 62.5, 179.5 65, 180 68.9, 170 70, 160 69.7, 150 71.5, 140 72.5, 131 71.2, 128 73.2, 113 73.8, 108 76.7, 104 77.7, 100 76.5, 95 76, 87 75, 80.5 72.8, 80 68.5, 73 68.3, 69 68.8, 68 72, 72 72.8, 66.5 69.3, 60 69.8, 58 68.3, 53 68.8, 45 68.5, 44 66.3, 40.5 67.2, 41 66, 34 66.5, 33.5 69.2, 30 70, 26 71.1, 19.5 70, 15 68.5, 12 65.5, 9.5 63, 5.5 62, 5 60, 7 58, 10.5 59, 11 58.2, 11.5 59.8, 12.8 56.2, 14.2 55.5, 18 56.5, 19 59.5, 16.8 62, 17.5 63.5, 21.5 65.5, 24 65.8, 22 63.2, 21.5 61, 25 60, 28.5 60.2, 30.5 59.8, 28 57.5, 24.5 57.3, 21 56.2, 21.5 54.5, 19 54.4, 14.2 54, 11 54, 10 56, 8.2 57, 8.5 54.8, 7 53.5, 4.5 52.7, 3.8 51.4, 1.6 50.8, -1.5 49.7, -4.5 48.5, -2.2 47.2, -1.2 46, -1.7 44, -1.8 43.4`),
  britain: P(`-5.5 50, -3 50.5, 1.4 51.2, 1.7 52.7, 0 53.5, -1.5 55, -2 57.5, -4 57.8, -3 58.6, -5 58.6, -6 57, -5.5 56, -5 55, -3.2 54.8, -3 53.4, -4.5 53.2, -4.2 52.2, -5.3 51.8, -3.5 51.3`),
  ireland: P(`-10 51.8, -6 52, -6 54, -5.7 54.7, -8 55.2, -10 54, -9.5 53`),
  iceland: P(`-24 65.5, -22 66.4, -16 66.5, -13.5 65, -15 64.2, -19 63.4, -22.5 63.8`),
  greenland: P(`-73 78, -67 80.5, -58 82, -40 83.5, -22 82.2, -18 80, -20 76, -19 72, -22 70.5, -26 68.5, -35 66, -40 64.5, -43.5 60, -48 60.5, -52 64, -54 68, -56 71, -60 75.5, -68 76.5`),
  honshu: P(`130.8 31.2, 131.5 33.5, 133 33.5, 135.2 33.5, 136.8 34.3, 138.8 34.7, 140 35.3, 141 38.5, 142 39.5, 141.5 41.5, 140.2 40.5, 139.7 38, 137.2 36.8, 136 36, 133 35.6, 131 34.4`),
  hokkaido: P(`140 42.2, 141.5 42.7, 143.5 42.2, 145.5 43.3, 144 44.2, 142 45.5, 141.8 44.2, 140.4 43.2`),
  sakhalin: P(`142 46, 143.5 49, 143.2 53, 142.2 54.2, 141.8 51, 142 47.5`),
  taiwan: P(`120.2 23, 121.2 22.2, 122 25, 121.5 25.3, 120.7 24.5`),
  luzon: P(`120.2 18.5, 121.5 18.6, 122.3 18.4, 122.2 16.5, 121.6 15.8, 121.7 14.2, 122.5 14, 123.5 13.9, 124.2 13, 124.1 12.5, 123 13.2, 121.5 13.5, 120.7 13.8, 120.5 14.5, 119.8 15.8, 120.1 17.5`),
  samar: P(`124.3 12.6, 125.7 11.5, 125.5 9.8, 124.5 10, 124.2 11.5`),
  panay: P(`122 11.8, 123 11.5, 122.9 10.5, 122 10.4, 121.9 11`),
  negros: P(`123 10.9, 123.5 10, 123.3 9.4, 123.2 9.1, 122.8 9.7, 122.4 10.6`),
  palawan: P(`117.2 8.4, 117.8 9.3, 119.5 11.2, 119.6 10.4, 118.5 9, 117.5 8.2`),
  mindanao: P(`122 7, 122.5 8, 123.2 8.7, 123.8 8.5, 124.6 8.6, 125.5 9.8, 126.5 8.8, 126.3 7, 126 6.3, 125.5 5.6, 125 6.4, 124.2 6.2, 124 7.2, 123.5 7.5, 122.8 6.9, 122.2 6.9`),
  sumatra: P(`95.3 5.5, 97.5 5.2, 100 3, 103 0.5, 106 -3, 105.8 -5.8, 104 -5.8, 102 -4, 100.2 -1.5, 98.5 1.8, 96 3.5`),
  java: P(`105.2 -6.8, 108 -6.3, 110.5 -6.9, 112.8 -6.9, 114.5 -7.9, 113 -8.5, 110 -8.2, 106.5 -7.5`),
  borneo: P(`109 1.5, 111 1.8, 113.5 3.2, 115.5 5.2, 117 6.7, 119 5.2, 118 3.5, 117.5 1, 116 -1.5, 116.5 -3.5, 114.5 -4, 111.5 -3.2, 110.2 -2.5, 110 -0.5`),
  sulawesi: P(`119.5 0.5, 121 1.2, 123.5 0.8, 125 1.5, 123 0, 121.5 -1, 123 -1.5, 122.5 -4.5, 121.5 -4.8, 120.5 -3, 120.3 -5.5, 119.5 -5.5, 119.5 -3.5, 118.8 -2.5, 119.5 -0.5`),
  newGuinea: P(`131 -0.8, 134 -0.8, 135.5 -3.3, 138.5 -1.8, 142 -2.7, 144.5 -3.8, 147.5 -6, 147.5 -8, 150.5 -10.5, 147 -10, 144 -7.8, 141 -9.1, 138 -8.3, 137.5 -5.5, 133.5 -4, 132 -2.5`),
  sriLanka: P(`79.8 9.7, 81.8 7.5, 81.3 6, 80 6, 79.8 8`),
  australia: P(`113.5 -22, 114 -26, 115 -34, 118 -35, 122 -34, 125 -32.5, 129 -31.7, 131.5 -31.5, 134 -32.8, 136 -35, 138 -34.8, 138 -33, 140 -37.5, 144 -38.5, 146.5 -39, 150 -37.5, 152.5 -32, 153.5 -28, 153 -25, 150 -22.5, 148.5 -20, 146 -18.5, 145.5 -15, 143.5 -14, 142.5 -10.8, 141.5 -13, 141.5 -17, 139.5 -17.2, 136.5 -15.5, 137 -12.2, 135 -12, 132 -11.5, 129.5 -14.8, 127 -14, 125.5 -14.5, 122.5 -17, 121 -19.5, 117 -20.5, 114 -22`),
  tasmania: P(`144.7 -40.8, 148.2 -40.9, 148 -43.2, 146.5 -43.6`),
  nzNorth: P(`172.7 -34.5, 174.5 -36.5, 176 -37.5, 178.5 -37.7, 177.5 -39.5, 175.5 -41.5, 174.7 -41.2, 175 -39.5, 173.8 -39.2, 174.5 -37`),
  nzSouth: P(`172.7 -40.5, 174 -41.5, 173 -43.5, 171 -44.5, 168.3 -46.5, 166.5 -46, 168 -44, 170.5 -42.8, 172 -41`),
  madagascar: P(`43.5 -23.5, 44.5 -25, 47 -25, 47.5 -24, 48.8 -21.5, 49.5 -16, 50.3 -15.5, 49.5 -12.5, 48.2 -13.5, 47 -15, 44.2 -17.5, 44 -20.5`),
  cuba: P(`-85 22, -82.5 23.2, -79 22.5, -77 21.5, -74.2 20.2, -77.5 19.9, -80 21.8, -83.5 22.2`),
  hispaniola: P(`-74.3 18.5, -72.5 19.9, -69.5 19.3, -68.5 18.5, -71 17.8, -74.2 18.3`),
  novaya: P(`52 71, 56 74, 60 76, 68 77, 66 75.5, 58 72.5`),
  antarctica: P(`-180 -90, 180 -90, 180 -72, 160 -70, 130 -66, 100 -66, 70 -68, 50 -67, 20 -70, -5 -70.5, -20 -72, -45 -78, -60 -75, -62 -70, -60 -64.5, -65 -65, -70 -72, -85 -73, -100 -74, -130 -74, -150 -77, -165 -78, -180 -78`),
};
const SEAS = {
  black: P(`28 41.2, 28 43, 29.7 45.2, 31.5 46.5, 33.5 46.1, 33 44.8, 35.5 45.2, 36.8 45.3, 38 47, 39.2 47, 41.5 42, 41.8 41.5, 39 41, 35 42, 31 41.2`),
  caspian: P(`47 45, 50 46.5, 53 46.5, 53.5 44, 52.5 41.5, 53.8 40, 54 37.5, 50.5 37, 49 38.5, 49.5 40.5, 47.8 42.5, 47 44`),
  lakeVictoria: P(`31.8 0.2, 34 0.4, 34.2 -1.5, 33 -2.8, 31.8 -1.8`),
};
// mountain ranges & regional climate as gaussian blobs in lon/lat (lon, lat, sigmaLon, sigmaLat, amp, rot deg)
const MOUNTAINS = [[87, 33, 14, 5, 1.0, 5], [90, 28, 6, 2.5, 1.1, 0], [-112, 45, 6, 14, 0.62, -10], [-108, 36, 5, 5, 0.45, 0], [-72, -20, 4, 22, 0.9, 8], [-74, 5, 3, 5, 0.6, 0], [10, 46.5, 5, 2, 0.55, 0], [60, 58, 2, 10, 0.3, 0], [44, 42.5, 6, 1.6, 0.75, -15], [37, 7, 5, 6, 0.5, 0], [35, -3, 4, 8, 0.4, 0], [-80, 37, 3, 7, 0.25, 35], [147, -33, 3, 10, 0.25, 0], [143, 61, 14, 6, 0.4, 0], [100, 25, 5, 5, 0.55, 0], [70, 36, 8, 3, 0.75, 20], [-5, 31.5, 8, 2, 0.4, 0], [15, 2, 6, 8, 0.2, 0], [27, -28, 3, 3, 0.35, 0], [-150, 62, 8, 3, 0.55, 0], [8, 62, 4, 3, 0.35, 0], [105, 52, 10, 3, 0.35, 0]];
const DRY = [[15, 23, 28, 8], [45, 24, 10, 8], [60, 36, 8, 6], [105, 42, 14, 5], [134, -25, 14, 9], [22, -23, 8, 6], [-70, -23, 3, 6], [-112, 34, 8, 6], [70, 28, 6, 4], [-68, -40, 5, 8], [-5, 25, 12, 5]];
const WET = [[-62, -4, 14, 9], [22, 0, 10, 6], [112, 0, 14, 5], [96, 22, 8, 6], [-75, 3, 5, 5], [150, -5, 8, 4], [122, 12, 4, 6], [-85, 10, 5, 4], [78, 14, 5, 7], [-88, 33, 8, 6]];
// population centres for night lights: lon, lat, sigma(deg), weight
const POP = [[-74, 40.7, 4, 1.4], [-87.6, 41.9, 3, 1.0], [-118.2, 34, 3, 1.0], [-96, 32, 5, 0.6], [-122, 37.5, 2.5, 0.7], [-80, 26, 2, 0.7], [-99, 19.4, 3, 0.9], [-46.6, -23.5, 3, 1.2], [-43, -22.9, 2, 0.7], [-58.4, -34.6, 3, 0.9], [-77, -12, 2, 0.5], [-74, 4.6, 2, 0.6], [2.3, 48.9, 3, 1.1], [-0.1, 51.5, 3, 1.3], [13.4, 52.5, 3, 0.9], [7, 51, 3, 1.1], [12.5, 41.9, 3, 0.8], [-3.7, 40.4, 2.5, 0.7], [30.5, 50.4, 2.5, 0.5], [37.6, 55.7, 3.5, 1.1], [30.3, 59.9, 2, 0.6], [28.9, 41, 2.5, 0.9], [31.2, 30, 2.5, 1.0], [3.4, 6.5, 3, 0.9], [-0.2, 5.6, 2, 0.4], [36.8, -1.3, 2, 0.4], [28, -26, 3, 0.8], [18.4, -33.9, 1.5, 0.4], [51.4, 35.7, 3, 0.9], [46.7, 24.7, 2.5, 0.6], [67, 24.9, 2, 0.8], [74.3, 31.5, 3, 0.9], [77.2, 28.6, 3.5, 1.4], [72.8, 19, 2.5, 1.2], [88.4, 22.6, 3, 1.1], [80.3, 13, 2.5, 0.7], [77.6, 13, 2.5, 0.7], [90.4, 23.8, 2.5, 1.0], [100.5, 13.8, 2.5, 0.8], [106.8, -6.2, 3, 1.2], [112.7, -7.3, 2.5, 0.8], [103.8, 1.35, 1.2, 0.8], [121, 14.6, 1.8, 1.0], [123.9, 10.3, 1.4, 0.7], [125.6, 7.1, 1.2, 0.4], [106.7, 10.8, 2.5, 0.8], [121.5, 31.2, 3, 1.5], [116.4, 39.9, 3, 1.4], [113.3, 23.1, 3, 1.4], [114.2, 22.4, 1.5, 0.9], [104, 30.6, 3, 0.9], [114.3, 30.6, 3, 0.9], [121.5, 25, 1.8, 1.0], [126.9, 37.5, 2, 1.3], [139.7, 35.7, 3, 1.8], [135.5, 34.7, 2.5, 1.1], [130.4, 33.6, 2, 0.6], [151.2, -33.9, 2, 0.8], [145, -37.8, 2, 0.6], [153, -27.5, 1.5, 0.4], [174.8, -36.9, 1.2, 0.3], [-79.4, 43.7, 2.5, 0.7], [-123, 49.2, 1.5, 0.4], [-84.4, 33.7, 2.5, 0.6], [-77, 38.9, 2.5, 0.8], [-71, 42.4, 2.5, 0.7], [-83, 42.3, 2.5, 0.7], [-104.9, 39.7, 1.5, 0.4], [-112, 33.4, 2, 0.5], [-115, 36.1, 1.2, 0.4], [-95.4, 29.8, 2.5, 0.8], [-122.3, 47.6, 1.8, 0.5], [44.4, 33.3, 2, 0.6], [35.2, 32, 1.5, 0.6], [32.9, 39.9, 2, 0.6], [69.3, 41.3, 2, 0.5], [76.9, 43.2, 1.5, 0.3], [49, 40.4, 1.5, 0.4], [44.8, 41.7, 1.5, 0.3], [-17.4, 14.7, 1.5, 0.3], [15.3, -4.3, 2, 0.6], [39.3, -6.8, 1.5, 0.4], [32.6, 0.3, 1.5, 0.4], [38.7, 9, 2, 0.5], [3.1, 36.8, 2, 0.5], [-7.6, 33.6, 2, 0.5], [10.2, 36.8, 1.5, 0.3]];

function drawPoly(ctx, poly, W, H, fill) {
  ctx.beginPath(); poly.forEach(([lo, la], i) => { const x = (lo + 180) / 360 * W, y = (90 - la) / 180 * H; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
const gauss = (lon, lat, c) => { let dl = lon - c[0]; if (dl > 180) dl -= 360; if (dl < -180) dl += 360; const rot = (c[5] || 0) * Math.PI / 180; const dx = dl * Math.cos(lat * Math.PI / 180 * 0.6), dy = lat - c[1]; const cr = Math.cos(rot), sr = Math.sin(rot); const u = (dx * cr + dy * sr) / c[2], v = (-dx * sr + dy * cr) / c[3]; return Math.exp(-(u * u + v * v)); };
const gaussPlain = (lon, lat, c) => { let dl = lon - c[0]; if (dl > 180) dl -= 360; if (dl < -180) dl += 360; const dx = dl * Math.cos(lat * Math.PI / 180), dy = lat - c[1]; return Math.exp(-((dx / c[2]) ** 2 + (dy / c[3]) ** 2)); };

function boxBlur(src, W, H, r, passes = 2) {
  let a = src, b = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    // horizontal (wrap)
    for (let y = 0; y < H; y++) { let acc = 0; const row = y * W; for (let i = -r; i <= r; i++) acc += a[row + ((i + W) % W)]; for (let x = 0; x < W; x++) { b[row + x] = acc / (2 * r + 1); acc += a[row + ((x + r + 1) % W)] - a[row + ((x - r + W) % W)]; } }
    // vertical (clamp)
    const c = new Float32Array(src.length);
    for (let x = 0; x < W; x++) { let acc = 0; for (let i = -r; i <= r; i++) acc += b[Math.max(0, Math.min(H - 1, i)) * W + x]; for (let y = 0; y < H; y++) { c[y * W + x] = acc / (2 * r + 1); acc += b[Math.min(H - 1, y + r + 1) * W + x] - b[Math.max(0, y - r) * W + x]; } }
    a = c;
  }
  return a;
}

function dirOf(lonDeg, latDeg, out) { const lo = lonDeg * Math.PI / 180, la = latDeg * Math.PI / 180; out[0] = Math.cos(la) * Math.cos(lo); out[1] = Math.sin(la); out[2] = -Math.cos(la) * Math.sin(lo); return out; }

function tex(data, W, H, format, srgb = false) {
  const t = new THREE.DataTexture(data, W, H, format, THREE.UnsignedByteType); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t;
}

/**
 * Build Earth textures. Returns { map (RGBA: R land/ocean potential [0.5=coast], G moisture, B ice, A elevation), lights (R), clouds (R), W, H }.
 * Cached per quality tier & seed.
 */
export function buildEarthTextures(seed = 1) {
  return cached(`earth:tex:${seed}:${Q.level}`, () => {
    const W = Q.level === 0 ? 512 : Q.level === 1 ? 1024 : 1536; const H = W / 2; const t0 = performance.now();
    // 1) land mask from outlines
    const c = makeCanvas(W, H); const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (const k in LAND) drawPoly(ctx, LAND[k], W, H, '#fff');
    for (const k in SEAS) drawPoly(ctx, SEAS[k], W, H, '#000');
    const id = ctx.getImageData(0, 0, W, H).data; const mask = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) mask[y * W + x] = id[((H - 1 - y) * W + x) * 4] / 255; // texture rows run south -> north
    const rB = Math.max(1, Math.round(W / 300)); const blur1 = boxBlur(mask, W, H, rB, 2); const blur2 = boxBlur(mask, W, H, Math.max(3, Math.round(W / 45)), 2);
    // 2) pixel pass
    const map = new Uint8Array(W * H * 4), lights = new Uint8Array(W * H), clouds = new Uint8Array(W * H);
    const d = [0, 0, 0]; const rng = new RNG(seed * 31 + 7);
    const sx = seed * 11.3, sy = seed * 7.7, sz = seed * 3.1;
    // coarse population grid
    const PW = 256, PH = 128; const pop = new Float32Array(PW * PH);
    for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) { const lon = (i + 0.5) / PW * 360 - 180, lat = -90 + (j + 0.5) / PH * 180; let s = 0; for (const p of POP) s += p[3] * gaussPlain(lon, lat, p); pop[j * PW + i] = Math.min(1.6, s); }
    // low-res analytic fields (mountains, dry, wet, cyclones) -> bilinear in the pixel loop
    const GW = 384, GH = 192; const gMt = new Float32Array(GW * GH), gDry = new Float32Array(GW * GH), gWet = new Float32Array(GW * GH), gCyc = new Float32Array(GW * GH);
    const CYCS = [[-45, 48, 1], [160, -48, -1], [-130, 35, 1], [-60, -42, -1], [20, 62, 1], [88, 15, 1]];
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const lon = (i + 0.5) / GW * 360 - 180, lat = -90 + (j + 0.5) / GH * 180; const k = j * GW + i;
      let mt = 0; for (const m of MOUNTAINS) mt += m[4] * gauss(lon, lat, m); gMt[k] = mt;
      let dry = 0; for (const g of DRY) dry += gaussPlain(lon, lat, g); gDry[k] = dry;
      let wet = 0; for (const g of WET) wet += gaussPlain(lon, lat, g); gWet[k] = wet;
      let cyc = 0; for (const c of CYCS) { const g = gaussPlain(lon, lat, [c[0], c[1], 9, 7]); if (g < 0.01) continue; const ang = Math.atan2(lat - c[1], lon - c[0]) + c[2] * Math.sqrt(Math.max(0.0001, (lon - c[0]) ** 2 + (lat - c[1]) ** 2)) * 0.28; cyc += g * (0.5 + 0.5 * Math.sin(ang * 3)); } gCyc[k] = cyc;
    }
    const samp = (grid, u, v) => { const x = u * GW - 0.5, y = v * GH - 0.5; const x0 = Math.floor(x), y0 = Math.max(0, Math.min(GH - 2, Math.floor(y))); const fx = x - x0, fy = Math.max(0, Math.min(1, y - y0)); const g = (xx, yy) => grid[yy * GW + ((xx + GW) % GW)]; return lerp(lerp(g(x0, y0), g(x0 + 1, y0), fx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), fx), fy); };
    const popAt = (u, v) => { const x = u * PW - 0.5, y = v * PH - 0.5; const x0 = Math.floor(x), y0 = Math.max(0, Math.min(PH - 2, Math.floor(y))); const fx = x - x0, fy = Math.max(0, Math.min(1, y - y0)); const g = (xx, yy) => pop[yy * PW + ((xx + PW) % PW)]; return lerp(lerp(g(x0, y0), g(x0 + 1, y0), fx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), fx), fy); };
    for (let y = 0; y < H; y++) {
      const lat = -90 + (y + 0.5) / H * 180; const latR = lat * Math.PI / 180;
      for (let x = 0; x < W; x++) {
        const lon = (x + 0.5) / W * 360 - 180; dirOf(lon, lat, d); const i = y * W + x;
        // coast: blurred outline + 3D noise jitter
        const nC = noise3(d[0] * 9 + sx, d[1] * 9 + sy, d[2] * 9 + sz) * 0.5 + noise3(d[0] * 26 + sy, d[1] * 26, d[2] * 26 + sx) * 0.25;
        const lp = blur1[i] + nC * 0.2;
        const land = clamp((lp - 0.5) * 3 + 0.5);
        const shelf = blur2[i];
        // elevation
        const gu = (x + 0.5) / W, gv = (y + 0.5) / H; const mt = samp(gMt, gu, gv);
        const rid = 1 - Math.abs(noise3(d[0] * 14 + sz, d[1] * 14 + sx, d[2] * 14 + sy)); const fbm = fbm3(d[0] * 5 + sx, d[1] * 5 + sy, d[2] * 5 + sz, 4);
        let elev = land * (0.03 + 0.14 * Math.max(0, fbm - 0.35) + mt * (0.25 + 0.75 * rid * rid) * 0.62 + (blur2[i] - 0.5) * 0.08);
        elev = clamp(elev, 0, 1);
        // moisture / temperature
        const dry = samp(gDry, gu, gv), wet = samp(gWet, gu, gv);
        const abLat = Math.abs(lat); let m = 0.45 + (fbm3(d[0] * 3 + sy, d[1] * 3 + sz, d[2] * 3 + sx, 3) - 0.5) * 0.9 + 0.35 * Math.exp(-Math.pow((abLat - 3) / 12, 2)) + 0.12 * Math.exp(-Math.pow((abLat - 55) / 14, 2)) - 0.3 * Math.exp(-Math.pow((abLat - 27) / 7, 2));
        m += wet * 0.5 - dry * 0.75; m = clamp(m - elev * 0.25 + (1 - shelf) * 0.0);
        const temp = Math.cos(latR) ** 1.4 - elev * 1.3;
        const ice = clamp(Math.max(smoothstep(-0.02, 0.18, 0.2 - temp) , abLat > 72 ? smoothstep(72, 80, abLat) : 0) * (land > 0.5 ? 1 : 0.0) + (land < 0.5 ? smoothstep(76, 83, abLat + nC * 8) * 0.95 : 0));
        // map R: ocean depth below 0.5, land above
        let R; if (land > 0.5) R = 0.5 + elev * 0.5 + 0.004; else R = 0.5 * (1 - 0.0) * (0.12 + 0.88 * Math.pow(smoothstep(0.0, 0.55, shelf + (nC * 0.3)), 0.6)) ; // 0 deep .. ~0.5 shore
        R = land > 0.5 ? R : Math.min(0.49, 0.5 * (0.1 + 0.9 * Math.pow(clamp(shelf * 1.7 + nC * 0.2), 0.75)));
        map[i * 4] = Math.round(clamp(R) * 255); map[i * 4 + 1] = Math.round(m * 255); map[i * 4 + 2] = Math.round(ice * 255); map[i * 4 + 3] = Math.round(elev * 255);
        // night lights
        const pp = popAt((x + 0.5) / W, (y + 0.5) / H); const sp = noise3(d[0] * 160 + sx, d[1] * 160 + sy, d[2] * 160 + sz) * 0.5 + 0.5; const sp2 = noise3(d[0] * 60 + sz, d[1] * 60 + sx, d[2] * 60) * 0.5 + 0.5;
        const coastB = smoothstep(0.55, 0.9, blur2[i]) * 0.0 + 1;
        let L = land > 0.5 && ice < 0.5 ? Math.min(1.4, pp * 1.15) * (0.3 + 0.7 * sp2) * smoothstep(0.22, 0.6, sp * 0.75 + pp * 0.42) : 0; // specks around centres
        L += land > 0.5 && ice < 0.5 ? 0.25 * smoothstep(0.62, 0.95, sp) * smoothstep(0.05, 0.4, pp) : 0;
        lights[i] = Math.round(clamp(L * coastB) * 255);
        // clouds: banded latitude coverage + warped fbm
        const w1 = fbm3(d[0] * 2.2 + sx, d[1] * 2.2 + sy, d[2] * 2.2 + sz, 3); const wx = d[0] + (w1 - 0.5) * 0.5, wy = d[1] + (w1 - 0.5) * 0.35, wz = d[2] + (w1 - 0.5) * 0.5;
        const stretch = 1 + 2.5 * Math.exp(-Math.pow((abLat - 15) / 14, 2)); // streaky trade-wind clouds in the tropics
        const cn = fbm3(wx * 3.2 * stretch + sz, wy * 3.2 + sx, wz * 3.2 * stretch + sy, 5);
        const band = 0.5 + 0.3 * Math.exp(-Math.pow(abLat / 9, 2)) + 0.28 * Math.exp(-Math.pow((abLat - 52) / 12, 2)) - 0.3 * Math.exp(-Math.pow((abLat - 26) / 8, 2));
        // a few big cyclone swirls
        const cyc = samp(gCyc, gu, gv);
        const cov = 0.4 + 0.24 * clamp(band); let cv = smoothstep(1 - cov - 0.1, 1 - cov + 0.22, cn + cyc * 0.2); cv = clamp(cv + cyc * 0.12);
        clouds[i] = Math.round(cv * 255);
      }
    }
    const out = { map: tex(map, W, H, THREE.RGBAFormat), lights: tex(lights, W, H, THREE.RedFormat), clouds: tex(clouds, W, H, THREE.RedFormat), W, H, ms: performance.now() - t0 };
    out.map.userData.shared = out.lights.userData.shared = out.clouds.userData.shared = true; return out;
  });
}

/** Simple moon textures: albedo (grey, maria, crater rays) + normal map from crater height field. */
export function buildMoonTextures(seed = 1) {
  return cached(`moon:tex:${seed}:${Q.level}`, () => {
    const W = Q.level === 0 ? 512 : Q.level === 1 ? 1024 : 2048; const H = W / 2; const r = new RNG(seed * 97 + 5);
    const hc = makeCanvas(W, H); const hx = hc.getContext('2d'); hx.fillStyle = 'rgb(128,128,128)'; hx.fillRect(0, 0, W, H);
    const ac = makeCanvas(W, H); const ax = ac.getContext('2d');
    // base albedo from noise (maria = dark smooth basalt plains)
    const img = ax.createImageData(W, H); const d = [0, 0, 0]; const s0 = seed * 5.1;
    for (let y = 0; y < H; y++) { const lat = 90 - (y + 0.5) / H * 180; for (let x = 0; x < W; x++) { dirOf((x + 0.5) / W * 360 - 180, lat, d); const n = fbm3(d[0] * 2.2 + s0, d[1] * 2.2, d[2] * 2.2 + s0, 4); const maria = smoothstep(0.50, 0.58, n); const hi = fbm3(d[0] * 12 + s0, d[1] * 12, d[2] * 12, 4); const v = lerp(0.46, 0.13, maria) * (0.82 + 0.36 * hi); const i = (y * W + x) * 4; img.data[i] = v * 255 * 1.02; img.data[i + 1] = v * 255; img.data[i + 2] = v * 255 * 0.97; img.data[i + 3] = 255; } }
    ax.putImageData(img, 0, 0);
    const N = Q.level === 0 ? 900 : Q.level === 1 ? 3000 : 7000;
    for (let k = 0; k < N; k++) {
      const big = Math.pow(r.next(), 5.5); const rad = (0.6 + big * 34) * (W / 1024); const lat = Math.asin(r.range(-1, 1)) * 180 / Math.PI; const lon = r.range(-180, 180);
      const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H; const sxs = 1 / Math.max(0.15, Math.cos(lat * Math.PI / 180)); // stretch horizontally near poles
      for (const dx of [0, -W, W]) {
        hx.save(); hx.translate(x + dx, y); hx.scale(Math.min(sxs, 6), 1);
        const g = hx.createRadialGradient(0, 0, 0, 0, 0, rad); g.addColorStop(0, 'rgba(70,70,70,0.7)'); g.addColorStop(0.6, 'rgba(100,100,100,0.45)'); g.addColorStop(0.83, 'rgba(200,200,200,0.5)'); g.addColorStop(0.95, 'rgba(150,150,150,0.15)'); g.addColorStop(1, 'rgba(128,128,128,0)'); hx.fillStyle = g; hx.beginPath(); hx.arc(0, 0, rad, 0, 7); hx.fill(); hx.restore();
        if (big > 0.12) { ax.save(); ax.translate(x + dx, y); ax.scale(Math.min(sxs, 6), 1); const g2 = ax.createRadialGradient(0, 0, rad * 0.7, 0, 0, rad * 2.2 * (1 + big)); g2.addColorStop(0, `rgba(255,255,250,${0.12 + big * 0.2})`); g2.addColorStop(1, 'rgba(255,255,250,0)'); ax.fillStyle = g2; ax.beginPath(); ax.arc(0, 0, rad * 2.4 * (1 + big), 0, 7); ax.fill(); ax.restore(); }
      }
    }
    // a few bright ray craters
    for (let k = 0; k < 4; k++) { const lat = r.range(-60, 50), lon = r.range(-170, 170); const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H; for (let j = 0; j < 24; j++) { const a = r.range(0, 6.28), l = r.range(40, 130) * (W / 1024); ax.strokeStyle = `rgba(255,255,250,${r.range(0.05, 0.16)})`; ax.lineWidth = r.range(0.6, 2) * (W / 1024); ax.beginPath(); ax.moveTo(x, y); ax.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.8); ax.stroke(); } }
    // grain on height
    const hd = hx.getImageData(0, 0, W, H); for (let i = 0; i < W * H; i++) { const nz = (rng01(i) - 0.5) * 10; hd.data[i * 4] = hd.data[i * 4 + 1] = hd.data[i * 4 + 2] = Math.max(0, Math.min(255, hd.data[i * 4] + nz)); } hx.putImageData(hd, 0, 0);
    // normal map from height
    const hdat = hx.getImageData(0, 0, W, H).data; const nrm = new Uint8Array(W * H * 4); const Hf = (x, y) => hdat[((H - 1 - Math.max(0, Math.min(H - 1, y))) * W + ((x + W) % W)) * 4] / 255; const str = 2.4;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (Hf(x + 1, y) - Hf(x - 1, y)) * str, dy = (Hf(x, y + 1) - Hf(x, y - 1)) * str; const l = Math.hypot(dx, dy, 1); const i = (y * W + x) * 4; nrm[i] = (-dx / l * 0.5 + 0.5) * 255; nrm[i + 1] = (dy / l * 0.5 + 0.5) * 255; nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[i + 3] = 255; }
    const albedo = new THREE.CanvasTexture(ac); albedo.colorSpace = THREE.SRGBColorSpace; albedo.wrapS = THREE.RepeatWrapping; albedo.anisotropy = 4;
    const normal = new THREE.DataTexture(nrm, W, H, THREE.RGBAFormat, THREE.UnsignedByteType); normal.wrapS = THREE.RepeatWrapping; normal.magFilter = THREE.LinearFilter; normal.minFilter = THREE.LinearMipmapLinearFilter; normal.generateMipmaps = true; normal.anisotropy = 4; normal.needsUpdate = true;
    albedo.userData.shared = normal.userData.shared = true; return { albedo, normal };
  });
}
function rng01(i) { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
export { dirOf as latLonToDirArray };
