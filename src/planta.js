/* planta.js · núcleo compartido de Xinas, el visor AR y Endeles
   Código semilla (13 caracteres) → planta procedural determinista, hexagrama, edad y medidas de la tira.
   Colección Alchemy of Meaning · Héctor Cruz Juárez · GPL-3.0 */
(function(G){
'use strict';
const D2R = Math.PI/180;
const clamp = (v, a=0, b=1) => Math.min(b, Math.max(a, v));
/* ---------------- utilidades ---------------- */
function mulberry32(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function fnv(bytes){ let h = 2166136261; for (const b of bytes){ h ^= b; h = Math.imul(h, 16777619); } return h >>> 0; }
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function encode(bytes){ let n = 0n; for (const b of bytes) n = (n << 8n) | BigInt(b); n <<= 1n; let s = ''; for (let i=0;i<13;i++){ s = B32[Number(n & 31n)] + s; n >>= 5n; } return s; }
function decode(code){ let n = 0n; for (const ch of code.toUpperCase()){ const k = B32.indexOf(ch); if (k < 0) return null; n = (n << 5n) | BigInt(k); } n >>= 1n; const out = []; for (let i=0;i<8;i++){ out.unshift(Number(n & 255n)); n >>= 8n; } return out; }

/* ---------------- vectores ---------------- */
const add = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]], mul = (a,k) => [a[0]*k, a[1]*k, a[2]*k];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = a => { const l = Math.hypot(a[0],a[1],a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
function rotate(v, k, t){ const c = Math.cos(t), s = Math.sin(t), kv = cross(k, v), kd = dot(k, v)*(1-c); return [v[0]*c + kv[0]*s + k[0]*kd, v[1]*c + kv[1]*s + k[1]*kd, v[2]*c + kv[2]*s + k[2]*kd]; }
function perp(d){ const r = Math.abs(d[1]) < .9 ? [0,1,0] : [1,0,0]; return norm(cross(d, r)); }

/* ---------------- planta procedural ----------------
   Todo sale del código: 6 lecturas de la foto + 2 bytes de sal.
   El visor AR usará esta misma función para hacerla crecer. */
function grow(bytes){
  const f = { b:bytes[0]/255, c:bytes[1]/255, e:bytes[2]/255, a:bytes[3]/255, x:bytes[4]/255, y:bytes[5]/255 };
  const rng = mulberry32(fnv(bytes));
  const P = {
    levels: 2 + Math.round(f.e*3),
    spread: (22 + f.c*36)*D2R,
    twist: (137.5 + (f.a - .5)*90)*D2R,
    lean: (f.x - .5)*.9,
    bend: (.5 - f.y)*.9,
    decay: .56 + f.c*.16,
    kids: 2 + (f.e > .45 ? 1 : 0),
    orn: f.b > .56 ? 'flor' : f.e > .38 ? 'hoja' : 'yema',
    leafy: .25 + f.b*.6,
    petals: 5 + Math.floor(rng()*4)
  };
  const segs = [], leaves = [], tips = [], roots = [];
  function branch(p, dir, len, depth, t0){
    const n = 6, dt = len*(.55 + rng()*.2);
    const bAx = norm(cross(dir, perp(dir).map((v,i) => v + (rng()-.5)*.6)));
    const pts = [p], dirs = [dir]; let cur = p, d = dir;
    for (let i=0;i<n;i++){
      d = rotate(d, bAx, P.bend*len/n + (rng()-.5)*.14);
      d = norm(add(d, [0, .05 + depth*.02, 0]));
      const nx = add(cur, mul(d, len/n));
      segs.push({a:cur, b:nx, t0:t0 + dt*i/n, t1:t0 + dt*(i+1)/n, d:depth});
      if (depth >= 1 && i % 2 === 1 && rng() < P.leafy){
        const side = rotate(perp(d), d, rng()*Math.PI*2);
        leaves.push({p:nx, d:norm(add(side, mul(d, .6))), t:t0 + dt*(i+1)/n, s:len*.32*(.7 + rng()*.5)});
      }
      cur = nx; pts.push(cur); dirs.push(d);
    }
    if (depth < P.levels){
      const k = P.kids + (rng() < .3 ? 1 : 0);
      for (let j=0;j<k;j++){
        const fr = depth === 0 ? .32 + .68*(j+1)/k : .4 + .6*(j+1)/k;
        const i = Math.min(n, Math.round(fr*n)), q = pts[i], dq = dirs[i];
        const az = j*P.twist + depth*1.31 + (rng()-.5)*.5;
        const side = rotate(perp(dq), dq, az);
        const sp = P.spread*(.8 + rng()*.45);
        const cd = norm(add(mul(dq, Math.cos(sp)), mul(side, Math.sin(sp))));
        branch(q, cd, len*P.decay*(.78 + rng()*.35)*(1 - .2*fr), depth + 1, t0 + dt*fr);
      }
    } else tips.push({p:cur, d, t:t0 + dt, s:len*.45, kind:P.orn});
  }
  const nr = 3 + Math.floor(rng()*3);
  for (let r=0;r<nr;r++){
    let p = [0,0,0], d = norm([(rng()-.5)*1.6, -1, (rng()-.5)*1.6]);
    for (let i=0;i<4;i++){ d = norm(add(d, [(rng()-.5)*.5, -.2, (rng()-.5)*.5])); const nx = add(p, mul(d, .07 + rng()*.05)); roots.push({a:p, b:nx, t0:i*.025, t1:(i+1)*.025}); p = nx; }
  }
  branch([0,0,0], norm([Math.sin(P.lean), 1, 0]), 1, 0, .04);
  const cy = segs[0].b, az = rng()*Math.PI;
  for (const sg of [1, -1]) leaves.push({p:cy, d:norm([Math.cos(az)*sg, .55, Math.sin(az)*sg]), t:segs[0].t1, s:.16, coty:true});
  let tmax = 0; for (const s of segs) tmax = Math.max(tmax, s.t1); for (const t of tips) tmax = Math.max(tmax, t.t + .12);
  const k = 1/tmax;
  segs.forEach(s => { s.t0 *= k; s.t1 *= k; }); leaves.forEach(l => l.t *= k); tips.forEach(t => t.t *= k);
  return { f, P, segs, leaves, tips, roots };
}

function plantBox(pl, age, rotY){
  const c = Math.cos(rotY), s = Math.sin(rotY); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const pt = v => { const x = v[0]*c + v[2]*s; if (x < x0) x0 = x; if (x > x1) x1 = x; if (v[1] < y0) y0 = v[1]; if (v[1] > y1) y1 = v[1]; };
  pt([0,0,0]);
  for (const r of pl.roots) if (r.t0 < age) pt(r.b);
  for (const l of pl.leaves) if (l.t < age) pt(add(l.p, mul(l.d, l.s)));
  for (const g of pl.segs) if (g.t0 < age){ pt(g.a); pt(g.b); }
  for (const t of pl.tips) if (t.t < age){ pt(add(t.p, [t.s*.6, t.s*.6, 0])); pt(add(t.p, [-t.s*.6, 0, 0])); }
  return {x0, x1, y0, y1};
}

function drawPlant(x, pl, age, T){
  const c = Math.cos(T.rot), s = Math.sin(T.rot);
  const P = v => [T.ox + (v[0]*c + v[2]*s)*T.s, T.oy - v[1]*T.s];
  x.save(); x.strokeStyle = T.col; x.fillStyle = T.col; x.lineCap = 'round'; x.lineJoin = 'round';
  // raíces
  x.lineWidth = Math.max(1, T.lw*.5); x.globalAlpha = T.dimRoots ?? .55; x.beginPath();
  for (const r of pl.roots){ if (r.t0 >= age) continue; const fr = clamp((age - r.t0)/(r.t1 - r.t0)); const a = P(r.a), b = P(add(r.a, mul([r.b[0]-r.a[0], r.b[1]-r.a[1], r.b[2]-r.a[2]], fr))); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); }
  x.stroke(); x.globalAlpha = 1;
  // tallos por grosor
  const by = new Map();
  for (const g of pl.segs){ if (g.t0 >= age) continue; (by.get(g.d) || by.set(g.d, []).get(g.d)).push(g); }
  for (const [d, list] of by){
    x.lineWidth = Math.max(T.min ?? 1, T.lw*Math.pow(.7, d)); x.beginPath();
    for (const g of list){ const fr = clamp((age - g.t0)/(g.t1 - g.t0)); const a = P(g.a), b = P([g.a[0] + (g.b[0]-g.a[0])*fr, g.a[1] + (g.b[1]-g.a[1])*fr, g.a[2] + (g.b[2]-g.a[2])*fr]); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); }
    x.stroke();
  }
  // hojas
  x.lineWidth = Math.max(T.min ?? 1, T.lw*.35);
  for (const l of pl.leaves){
    if (l.t >= age) continue; const g = clamp((age - l.t)/.08); const a = P(l.p), b = P(add(l.p, mul(l.d, l.s*g)));
    const mx = (a[0]+b[0])/2, my = (a[1]+b[1])/2, nx = -(b[1]-a[1])*.32, ny = (b[0]-a[0])*.32;
    x.beginPath(); x.moveTo(a[0], a[1]); x.quadraticCurveTo(mx + nx, my + ny, b[0], b[1]); x.quadraticCurveTo(mx - nx, my - ny, a[0], a[1]);
    T.fillLeaves ? x.fill() : x.stroke();
  }
  // remates
  for (const t of pl.tips){
    if (t.t >= age) continue; const g = clamp((age - t.t)/.12), p = P(t.p), r = t.s*T.s*g;
    if (t.kind === 'yema'){ x.beginPath(); x.arc(p[0], p[1], Math.max(1, r*.22), 0, 7); x.fill(); continue; }
    if (t.kind === 'hoja'){ const b = P(add(t.p, mul(t.d, t.s*g))); const mx = (p[0]+b[0])/2, my = (p[1]+b[1])/2, nx = -(b[1]-p[1])*.35, ny = (b[0]-p[0])*.35; x.beginPath(); x.moveTo(p[0],p[1]); x.quadraticCurveTo(mx+nx, my+ny, b[0], b[1]); x.quadraticCurveTo(mx-nx, my-ny, p[0], p[1]); x.fill(); continue; }
    const n = pl.P.petals; x.beginPath();
    for (let i=0;i<n;i++){ const an = i/n*Math.PI*2 + pl.f.a*3; const ex = p[0] + Math.cos(an)*r*.5, ey = p[1] + Math.sin(an)*r*.5;
      x.moveTo(p[0], p[1]); x.quadraticCurveTo(p[0] + Math.cos(an + .5)*r*.55, p[1] + Math.sin(an + .5)*r*.55, ex, ey); x.quadraticCurveTo(p[0] + Math.cos(an - .5)*r*.55, p[1] + Math.sin(an - .5)*r*.55, p[0], p[1]); }
    x.stroke(); x.beginPath(); x.arc(p[0], p[1], Math.max(1, r*.1), 0, 7); x.fill();
  }
  x.restore();
}


/* ---------------- hexagrama ----------------
   Las 6 lecturas, de abajo hacia arriba: brillo, contraste, bordes, ángulo, masa x, masa y.
   ≥ 0.5 es línea entera (yang); menor, partida (yin). */
const TRIG = ['111','100','010','001','000','011','101','110'];   // cielo, trueno, agua, montaña, tierra, viento, fuego, lago
const KW = [
  [1,34,5,26,11,9,14,43],[25,51,3,27,24,42,21,17],[6,40,29,4,7,59,64,47],[33,62,39,52,15,53,56,31],
  [12,16,8,23,2,20,35,45],[44,32,48,18,46,57,50,28],[13,55,63,22,36,37,30,49],[10,54,60,41,19,61,38,58]];
const NOMBRES = ['', 'lo creativo','lo receptivo','la dificultad del inicio','la juventud','la espera','el conflicto','el ejército','la unión',
  'la pequeña fuerza que doma','el paso','la paz','el estancamiento','la comunidad','la gran posesión','la modestia','el entusiasmo',
  'el seguimiento','lo que se repara','el acercamiento','la contemplación','la mordida','la gracia','el desmoronamiento','el retorno',
  'la inocencia','la gran fuerza que doma','la nutrición','el gran exceso','el abismo','el fuego que se adhiere','el influjo','la duración',
  'la retirada','el gran poder','el avance','la luz que se oculta','la familia','la oposición','el obstáculo','la liberación',
  'la disminución','el aumento','la resolución','el encuentro','la reunión','el ascenso','el agotamiento','el pozo',
  'la transformación','el caldero','el trueno','la quietud','el desarrollo gradual','la que se casa','la abundancia','el viajero',
  'lo suave','la alegría','la dispersión','la medida','la verdad interior','el pequeño exceso','después de cumplir','antes de cumplir'];
function hexagram(f){
  const v = [f.b, f.c, f.e, f.a, f.x, f.y], lines = v.map(k => k >= .5 ? 1 : 0);
  const lo = TRIG.indexOf(lines.slice(0,3).join('')), up = TRIG.indexOf(lines.slice(3).join(''));
  const n = KW[lo][up]; return { lines, n, name:NOMBRES[n] };
}

/* ---------------- tiempo ----------------
   Día 0 = el brote impreso; madura con los días (la mitad del camino en ~2 semanas). */
const EPOCH = Date.UTC(2026, 0, 1);
function dayIndex(d){ return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH)/864e5); }
function ageFromDays(days, brote = .45){ return clamp(brote + (1 - brote)*(1 - Math.exp(-Math.max(0, days)/21))); }
const ETAPAS = [[.08,'semilla'],[.3,'raíz'],[.45,'brote'],[.6,'tallo'],[.75,'ramas'],[.9,'hojas'],[1.01,'flor']];
function stage(age, orn){ for (const [k, n] of ETAPAS) if (age < k) return n === 'flor' ? (orn === 'flor' ? 'flor' : orn === 'hoja' ? 'follaje' : 'yemas') : n; return 'plenitud'; }

/* ---------------- la tira (v1) ----------------
   Medidas en puntos de 203 dpi (8 por mm). El brote impreso nace en ROOT, a distancia fija del QR,
   para que el visor AR haga brotar la planta en el mismo lugar del papel. */
const TIRA = { PW:384, DPMM:8, PHOTO_Y:32, QR_Y:428, QR_BOX:208, ROOT_X:192, ROOT_Y:776, LEN_MIN:110, LEN_MAX:150 };
function qrGeom(n){ const m = Math.floor(TIRA.QR_BOX/(n + 8)), off = Math.floor((TIRA.QR_BOX - m*(n + 8))/2) + 4*m; return { m, x:off, y:TIRA.QR_Y + off, size:m*n }; }
/* raíz relativa a la esquina superior izquierda del QR, en mm; y lado del QR en mm */
function anchorMM(n){ const g = qrGeom(n); return { x:(TIRA.ROOT_X - g.x)/TIRA.DPMM, y:(TIRA.ROOT_Y - g.y)/TIRA.DPMM, side:g.size/TIRA.DPMM }; }
function fromCode(code){ const b = decode(code); return b ? grow(b) : null; }
function parseURL(href){
  try { const u = new URL(href); const s = (u.searchParams.get('s') || '').trim().toUpperCase(), t = u.searchParams.get('t');
    if (!/^[0-9A-HJKMNP-TV-Z]{13}$/.test(s)) return null; return { code:s, day:t ? parseInt(t, 36) : null }; } catch(e){ return null; }
}

G.Planta = { VERSION:'1', clamp, mulberry32, fnv, encode, decode, grow, fromCode, plantBox, drawPlant, hexagram, dayIndex, ageFromDays, stage, TIRA, qrGeom, anchorMM, parseURL,
  vec:{ add, mul, dot, cross, norm, rotate, perp } };
})(typeof window !== 'undefined' ? window : globalThis);
