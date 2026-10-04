// UV atlas layout of the shared body skin texture (fractions of the atlas; canvas y runs downwards).
// ringLoft maps the FIRST station to canvas-top of the rect for limbs (shoulder / hip / wrist) and to canvas-bottom for the torso (crotch).
export const BODY_UV = {
  torso: { x: 0, y: 0, w: 0.5, h: 0.5 },
  armL: { x: 0.5, y: 0, w: 0.25, h: 0.5 },
  armR: { x: 0.75, y: 0, w: 0.25, h: 0.5 },
  legL: { x: 0, y: 0.5, w: 0.25, h: 0.5 },
  legR: { x: 0.25, y: 0.5, w: 0.25, h: 0.5 },
  handL: { x: 0.5, y: 0.5, w: 0.25, h: 0.25 },
  handR: { x: 0.75, y: 0.5, w: 0.25, h: 0.25 },
  footL: { x: 0.5, y: 0.75, w: 0.25, h: 0.25 },
  footR: { x: 0.75, y: 0.75, w: 0.25, h: 0.25 },
};
/** uv rect for ringLoft: topFirst=true → first station at canvas-top of the rect. Optional sub-rect in rect-fractions (fx,fy,fw,fh). */
export function uvRect(name, topFirst = true, sub = null) {
  const r = BODY_UV[name];
  const s = sub || { fx: 0, fy: 0, fw: 1, fh: 1 };
  const x0 = r.x + r.w * s.fx, x1 = r.x + r.w * (s.fx + s.fw), y0 = r.y + r.h * s.fy, y1 = r.y + r.h * (s.fy + s.fh);
  const top = 1 - y0, bot = 1 - y1;
  return topFirst ? { u0: x0, u1: x1, v0: top, v1: bot } : { u0: x0, u1: x1, v0: bot, v1: top };
}
