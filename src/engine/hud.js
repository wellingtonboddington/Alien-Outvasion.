// DOM HUD over the film frame: subtitles, date/place stamps, name cards, titles, tags, credits, call frames. Stateless sync => seek-safe.
const CSS = `
#frame{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:hidden;--u:10px;font-family:"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#fff}
#frame *{box-sizing:border-box}
.ov{position:absolute;opacity:0;will-change:opacity,transform}
.sub{left:50%;bottom:6%;transform:translateX(-50%);max-width:82%;text-align:center;font-size:max(13px,calc(var(--u)*1.9));line-height:1.28;text-shadow:0 1px 3px #000,0 0 10px rgba(0,0,0,.9)}
.sub .who{display:block;font-size:.62em;letter-spacing:.18em;text-transform:uppercase;font-weight:700;margin-bottom:.15em;opacity:.95}
.sub .txt{display:inline-block;padding:.12em .55em;background:rgba(0,0,0,.42);border-radius:.3em;font-weight:500}
.sub .txt.alien{font-style:italic;color:#aef3ff}
.stamp{left:4.2%;top:6.5%;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-shadow:0 0 8px rgba(0,0,0,.9);letter-spacing:.12em}
.stamp .l1{font-size:max(11px,calc(var(--u)*1.7));font-weight:700;color:#fff}
.stamp .l2{font-size:max(9px,calc(var(--u)*1.15));color:#bfe9ff;margin-top:.35em;opacity:.9}
.stamp .rec{display:inline-block;width:.62em;height:.62em;border-radius:50%;background:#ff3b3b;margin-right:.6em;box-shadow:0 0 8px #f33;vertical-align:middle;animation:blink 1.1s steps(2,start) infinite}
@keyframes blink{50%{opacity:.15}}
.name{left:5%;bottom:23%;text-shadow:0 2px 10px rgba(0,0,0,.95)}
.name .bar{width:calc(var(--u)*4.6);height:max(2px,calc(var(--u)*.28));margin-bottom:.5em;background:var(--c,#ffd36e);box-shadow:0 0 12px var(--c,#ffd36e)}
.name .n{font-size:max(20px,calc(var(--u)*4.4));font-weight:800;letter-spacing:.04em;line-height:1}
.name .r{font-size:max(11px,calc(var(--u)*1.55));letter-spacing:.16em;text-transform:uppercase;margin-top:.45em;color:#e8f2ff;font-weight:600}
.title{left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;text-shadow:0 0 30px rgba(0,0,0,.8)}
.title .t{font-size:max(22px,calc(var(--u)*var(--sz,6)));font-weight:200;letter-spacing:.34em;text-transform:uppercase;padding-left:.34em;line-height:1.1}
.title .s{font-size:max(11px,calc(var(--u)*1.6));letter-spacing:.38em;text-transform:uppercase;margin-top:1.1em;color:#a8d8ff;font-weight:500}
.title.big .t{font-weight:800;letter-spacing:.22em}
.tag{right:4.2%;top:6.5%;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:max(10px,calc(var(--u)*1.25));letter-spacing:.2em;border:1px solid currentColor;padding:.25em .7em;border-radius:.2em;background:rgba(0,0,0,.35);text-shadow:0 0 6px rgba(0,0,0,.8)}
.tag.live{color:#ff4b4b}.tag.cyan{color:#7fe9ff}.tag.green{color:#6bff4a}.tag.amber{color:#ffc24a}
.credits{left:0;right:0;top:0;bottom:0;text-align:center;overflow:hidden}
.credits .roll{position:absolute;left:0;right:0;top:100%;will-change:transform}
.credits .ln{font-size:max(12px,calc(var(--u)*1.9));letter-spacing:.22em;text-transform:uppercase;margin:.9em 0;font-weight:300;text-shadow:0 0 10px #000}
.credits .ln.h{font-size:max(14px,calc(var(--u)*2.6));font-weight:700;letter-spacing:.3em;margin-top:2.4em;color:#9fe3ff}
.credits .ln.s{font-size:max(10px,calc(var(--u)*1.3));opacity:.8}
.call{left:6%;right:6%;top:9%;bottom:9%;border:0}
.call i{position:absolute;width:6%;height:9%;border:2px solid var(--c,#7fe9ff);opacity:.9}
.call i:nth-child(1){left:0;top:0;border-right:0;border-bottom:0}.call i:nth-child(2){right:0;top:0;border-left:0;border-bottom:0}
.call i:nth-child(3){left:0;bottom:0;border-right:0;border-top:0}.call i:nth-child(4){right:0;bottom:0;border-left:0;border-top:0}
.call b{position:absolute;left:50%;top:-1.2%;transform:translateX(-50%);font-size:max(10px,calc(var(--u)*1.25));font-weight:600;letter-spacing:.3em;color:var(--c,#7fe9ff);font-family:ui-monospace,Menlo,Consolas,monospace;text-shadow:0 0 8px #000}
`;

export class HUD {
  constructor(root) {
    this.root = root; this.els = new Map(); this.subsOn = true; this.last = new Map();
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.frame = document.createElement('div'); this.frame.id = 'frame'; root.appendChild(this.frame);
  }
  /** position the HUD over the film rectangle (px) */
  layout(x, y, w, h) { const s = this.frame.style; s.left = x + 'px'; s.top = y + 'px'; s.width = w + 'px'; s.height = h + 'px'; s.setProperty('--u', (w / 100) + 'px'); }
  _el(key, make) { let e = this.els.get(key); if (!e) { e = make(); this.frame.appendChild(e); this.els.set(key, e); } return e; }
  _op(e, v) { const s = v.toFixed(3); if (e._o !== s) { e._o = s; e.style.opacity = s; } }
  _txt(e, sel, txt) { const n = sel ? e.querySelector(sel) : e; if (n && n._t !== txt) { n._t = txt; n.textContent = txt; } }
  /** t = scene time; overlays = active overlay list; sub = active dialogue line or null */
  sync(t, overlays, subLine) {
    const seen = new Set();
    for (const o of overlays) {
      const key = o.id; seen.add(key); const d = o.data; const u = t - o.t0; const dur = o.t1 - o.t0; const fin = Math.min(1, u / 0.45), fout = Math.min(1, (o.t1 - t) / 0.55); const op = Math.max(0, Math.min(fin, fout));
      if (o.type === 'stamp') {
        const e = this._el(key, () => { const x = document.createElement('div'); x.className = 'ov stamp'; x.innerHTML = '<div class="l1"><span class="rec"></span><span class="a"></span></div><div class="l2"></div>'; return x; });
        const n1 = Math.floor(Math.min(1, u / 1.0) * d.text.length), n2 = Math.floor(Math.min(1, Math.max(0, u - 0.6) / 1.2) * d.place.length);
        this._txt(e, '.a', d.text.slice(0, n1)); this._txt(e, '.l2', d.place.slice(0, n2)); this._op(e, op);
      } else if (o.type === 'name') {
        const e = this._el(key, () => { const x = document.createElement('div'); x.className = 'ov name'; x.innerHTML = '<div class="bar"></div><div class="n"></div><div class="r"></div>'; return x; });
        e.style.setProperty('--c', d.color || '#ffd36e'); this._txt(e, '.n', d.name); this._txt(e, '.r', `${d.age ? 'Age ' + d.age + '  ·  ' : ''}${d.role || ''}`);
        const slide = (1 - Math.min(1, u / 0.5)); const tx = `translateX(${(-slide * 6).toFixed(2)}%)`; if (e._tx !== tx) { e._tx = tx; e.style.transform = tx; } this._op(e, op);
      } else if (o.type === 'title') {
        const e = this._el(key, () => { const x = document.createElement('div'); x.className = 'ov title' + (d.big ? ' big' : ''); x.innerHTML = '<div class="t"></div><div class="s"></div>'; return x; });
        e.style.setProperty('--sz', d.size || 6); this._txt(e, '.t', d.text); this._txt(e, '.s', d.sub || ''); const fi = Math.min(1, u / (d.fadeIn ?? 1.2)), fo = Math.min(1, (o.t1 - t) / (d.fadeOut ?? 1.2)); this._op(e, Math.max(0, Math.min(fi, fo)));
      } else if (o.type === 'tag') {
        const e = this._el(key, () => { const x = document.createElement('div'); x.className = 'ov tag ' + (d.color || 'live'); return x; }); this._txt(e, '', (d.dot !== false ? '● ' : '') + d.text); this._op(e, op * (d.blink ? (Math.floor(t * 2) % 2 ? 1 : 0.35) : 1));
      } else if (o.type === 'credits') {
        const e = this._el(key, () => { const x = document.createElement('div'); x.className = 'ov credits'; const r = document.createElement('div'); r.className = 'roll'; for (const l of d.lines) { const ln = document.createElement('div'); ln.className = 'ln' + (l.startsWith('#') ? ' h' : l.startsWith('~') ? ' s' : ''); ln.textContent = l.replace(/^[#~]/, ''); r.appendChild(ln); } x.appendChild(r); return x; });
        const roll = e.firstChild; const H = this.frame.clientHeight || 600; const total = roll.scrollHeight + H; const y = -Math.min(1, u / dur) * total; const tx = `translateY(${y.toFixed(1)}px)`; if (roll._tx !== tx) { roll._tx = tx; roll.style.transform = tx; } this._op(e, Math.min(1, u / 1.5));
      } else if (o.type === 'call') {
        const e = this._el(key, () => { const x = document.createElement('div'); x.className = 'ov call'; x.innerHTML = '<i></i><i></i><i></i><i></i><b></b>'; return x; }); e.style.setProperty('--c', d.color || '#7fe9ff'); this._txt(e, 'b', d.label); this._op(e, op * 0.9);
      }
    }
    // subtitle
    let sk = null;
    if (subLine && this.subsOn) {
      sk = 'sub'; const e = this._el(sk, () => { const x = document.createElement('div'); x.className = 'ov sub'; x.innerHTML = '<span class="who"></span><span class="txt"></span>'; return x; });
      const w = e.querySelector('.who'), tx = e.querySelector('.txt'); if (w._t !== subLine.name) { w._t = subLine.name; w.textContent = subLine.name; w.style.color = subLine.color; }
      const cls = 'txt' + (subLine.italic ? ' alien' : ''); if (tx.className !== cls) tx.className = cls; if (tx._t !== subLine.sub) { tx._t = subLine.sub; tx.textContent = subLine.sub; }
      const a = Math.min(1, (t - subLine.t0 + 0.05) / 0.12), b = Math.min(1, (subLine.t1 + 0.35 - t) / 0.2); this._op(e, Math.max(0, Math.min(a, b))); seen.add(sk);
    }
    for (const [k, e] of this.els) if (!seen.has(k)) { e.remove(); this.els.delete(k); }
  }
  clear() { for (const [, e] of this.els) e.remove(); this.els.clear(); }
}
