/* Xinas v0.4 · crear · retrato + instante → lecturas → código → planta → tira térmica 58 × 88 mm con QR
   Colección Alchemy of Meaning · Héctor Cruz Juárez · GPL-3.0 */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const VER = '0.4';
const { PW, DPMM, PHOTO_Y, QR_Y, QR_BOX, H:TH } = window.Planta.TIRA;   // 384 puntos = 48 mm imprimibles a 203 dpi
const D2R = Math.PI/180;
const clamp = (v, a=0, b=1) => Math.min(b, Math.max(a, v));

/* ---------------- estado ---------------- */
const DEF = { zoom:1, cx:.5, cy:.5, exp:0, con:1.1, dit:'atkinson', mode:'multiply', mix:.6, sc2:1.6,
  l1:'hectorcruz.com.mx', l2:'@hellohectorcruz', base:'https://hectorcruz.com.mx/app/xinas/',
  ui:'suave', born:null, place:'', lat:null, lon:null };
const S = Object.assign({}, DEF);
try { Object.assign(S, JSON.parse(localStorage.getItem('xinas.v1') || localStorage.getItem('semilla.v1') || '{}')); } catch(e){}
if (/hectorcruz\.com\.mx\/(semilla|xinas)\/?$/.test(S.base || '')) S.base = DEF.base;
for (const k of ['salt','len','brote','view','age']) delete S[k];
const save = () => { try { const o = Object.assign({}, S); localStorage.setItem('xinas.v1', JSON.stringify(o)); } catch(e){} };

let img1 = null, img2 = null, demo = true;
let G = null;          // resultado actual: {gray, bits, f, code, plant, tira, url}
let dirty = true;

/* ---------------- núcleo compartido (planta.js) ---------------- */
const { mulberry32, fnv, encode, decode, grow, plantBox, drawPlant, hexagram, minuteIndex, momentBytes, TIRA, qrGeom } = window.Planta;
const { add, mul } = window.Planta.vec;
function msg(t, ms=1800){ const m = $('#msg'); if (!t){ m.hidden = true; return; } m.textContent = t; m.hidden = false; clearTimeout(msg.t); if (ms) msg.t = setTimeout(() => m.hidden = true, ms); }

/* ---------------- foto: composición, ajuste y lecturas ---------------- */
function makeDemo(){
  const c = document.createElement('canvas'); c.width = c.height = 600; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 600, 600); g.addColorStop(0, '#d8d2c4'); g.addColorStop(1, '#2a2a2a'); x.fillStyle = g; x.fillRect(0, 0, 600, 600);
  x.fillStyle = '#111'; x.beginPath(); x.arc(380, 260, 120, 0, 7); x.fill();
  x.strokeStyle = '#f2efe6'; x.lineWidth = 6; for (let i=0;i<14;i++){ x.beginPath(); x.moveTo(40 + i*38, 600); x.lineTo(120 + i*30, 330 - (i%3)*40); x.stroke(); }
  return c;
}
function compose(size){
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d', {willReadFrequently:true});
  x.fillStyle = '#fff'; x.fillRect(0, 0, size, size);
  const im = img1 || DEMO, iw = im.width, ih = im.height, ss = Math.min(iw, ih)/S.zoom;
  const cx = clamp(S.cx*iw, ss/2, iw - ss/2), cy = clamp(S.cy*ih, ss/2, ih - ss/2);
  x.imageSmoothingQuality = 'high'; x.drawImage(im, cx - ss/2, cy - ss/2, ss, ss, 0, 0, size, size);
  if (img2){
    const w2 = img2.width, h2 = img2.height, sc = Math.max(size/w2, size/h2)*S.sc2;
    x.globalCompositeOperation = S.mode; x.globalAlpha = S.mix;
    x.drawImage(img2, (size - w2*sc)/2, (size - h2*sc)/2, w2*sc, h2*sc);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  }
  const d = x.getImageData(0, 0, size, size).data, g = new Float32Array(size*size);
  for (let i=0;i<g.length;i++){ let v = (d[i*4]*.299 + d[i*4+1]*.587 + d[i*4+2]*.114)/255; v = ((v + S.exp*.5) - .5)*S.con + .5; g[i] = clamp(v)*255; }
  return g;
}
function features(g, w){
  const s = 3, n = (w/s)|0, a = new Float32Array(n*n);
  for (let y=0;y<n;y++) for (let x=0;x<n;x++){ let t = 0; for (let j=0;j<s;j++) for (let i=0;i<s;i++) t += g[(y*s + j)*w + x*s + i]; a[y*n + x] = t/(s*s); }
  let m = 0; for (const v of a) m += v; m /= a.length;
  let vr = 0; for (const v of a) vr += (v - m)**2; const sd = Math.sqrt(vr/a.length);
  let em = 0, jxx = 0, jyy = 0, jxy = 0, dx = 0, dy = 0, dm = 0;
  for (let y=1;y<n-1;y++) for (let x=1;x<n-1;x++){
    const p = (i, j) => a[(y + j)*n + x + i];
    const gx = (p(1,-1) + 2*p(1,0) + p(1,1)) - (p(-1,-1) + 2*p(-1,0) + p(-1,1));
    const gy = (p(-1,1) + 2*p(0,1) + p(1,1)) - (p(-1,-1) + 2*p(0,-1) + p(1,-1));
    em += Math.hypot(gx, gy)/8; jxx += gx*gx; jyy += gy*gy; jxy += gx*gy;
  }
  em /= (n-2)*(n-2);
  for (let y=0;y<n;y++) for (let x=0;x<n;x++){ const k = 255 - a[y*n + x]; dx += k*x; dy += k*y; dm += k; }
  let th = .5*Math.atan2(2*jxy, jxx - jyy) + Math.PI/2; th = ((th % Math.PI) + Math.PI) % Math.PI;
  return { b:m/255, c:clamp(sd/100), e:clamp(em/40), a:th/Math.PI, x:dm ? dx/dm/(n-1) : .5, y:dm ? dy/dm/(n-1) : .5 };
}

/* ---------------- tramado 1 bit ---------------- */
function dither(g, w, h, how){
  const v = Float32Array.from(g), out = new Uint8Array(w*h);
  if (how === 'umbral'){ for (let i=0;i<v.length;i++) out[i] = v[i] < 128 ? 0 : 1; return out; }
  if (how === 'bayer'){ const M = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5]; for (let y=0;y<h;y++) for (let x=0;x<w;x++){ const i = y*w + x; out[i] = v[i] > (M[(y&3)*4 + (x&3)] + .5)*16 ? 1 : 0; } return out; }
  for (let y=0;y<h;y++) for (let x=0;x<w;x++){
    const i = y*w + x, o = v[i] < 128 ? 0 : 255, e = v[i] - o; out[i] = o ? 1 : 0;
    if (how === 'floyd'){
      if (x+1 < w) v[i+1] += e*7/16;
      if (y+1 < h){ if (x > 0) v[i+w-1] += e*3/16; v[i+w] += e*5/16; if (x+1 < w) v[i+w+1] += e/16; }
    } else {
      const k = e/8; if (x+1 < w) v[i+1] += k; if (x+2 < w) v[i+2] += k;
      if (y+1 < h){ if (x > 0) v[i+w-1] += k; v[i+w] += k; if (x+1 < w) v[i+w+1] += k; }
      if (y+2 < h) v[i+2*w] += k;
    }
  }
  return out;
}

/* ---------------- la tira ---------------- */
const FONT = px => `${px}px Silkscreen, Menlo, monospace`;
function fitText(x, t, maxW, px){ while (px > 8){ x.font = FONT(px); if (x.measureText(t).width <= maxW) break; px -= 8; } x.font = FONT(px); return px; }
function qrURL(code, minute){ let b = (S.base || '').trim() || DEF.base; if (!/^https?:\/\//i.test(b)) b = 'https://' + b; return b + (b.includes('?') ? '&' : '?') + 's=' + code + '&t=' + minute.toString(36); }
const p2 = n => String(n).padStart(2, '0');
function fmtDate(d){ return `${p2(d.getDate())}.${p2(d.getMonth()+1)}.${d.getFullYear()}`; }
function fmtTime(d){ return `${p2(d.getHours())}:${p2(d.getMinutes())}`; }

function renderTira(bits, code, plant, url){
  const H = TH, c = document.createElement('canvas'); c.width = PW; c.height = H;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, PW, H); x.fillStyle = '#000'; x.textBaseline = 'top';
  // encabezado
  x.font = FONT(16); x.textAlign = 'left'; x.fillText('XINAS', 6, 6);
  x.textAlign = 'right'; x.fillText('Nº ' + code.slice(0, 4), PW - 6, 6);
  // QR (margen de 2 módulos: a su derecha va la columna de texto)
  try {
    const q = qrcode(0, 'M'); q.addData(url); q.make(); const qn = q.getModuleCount(), g = qrGeom(qn), m = g.m;
    for (let r=0;r<qn;r++) for (let k=0;k<qn;k++) if (q.isDark(r, k)) x.fillRect(g.x + k*m, g.y + r*m, m, m);
    S._qr = {n:qn, m, mm:(m*qn/DPMM).toFixed(1)};
  } catch(e){ S._qr = null; }
  // columna: nº, instante, lugar, hexagrama
  const tx = QR_BOX + 12, tw = PW - tx - 6, when = S.born ? new Date(S.born) : new Date();
  x.textAlign = 'left'; x.font = FONT(16);
  [code.slice(0,4), code.slice(4,8), code.slice(8)].forEach((t, i) => x.fillText(t, tx, QR_Y + 4 + i*18));
  x.fillText(fmtDate(when).slice(0,6) + fmtDate(when).slice(8), tx, QR_Y + 66);
  x.fillText(fmtTime(when), tx, QR_Y + 84);
  const place = (S.place || '').trim();
  if (place){ x.font = FONT(8); const words = place.split(/\s+/); let line = '', ln = 0;
    for (const w of words){ const tst = line ? line + ' ' + w : w; if (x.measureText(tst).width > tw && line){ x.fillText(line, tx, QR_Y + 106 + ln*10); ln++; line = w; if (ln > 2) break; } else line = tst; }
    if (ln <= 2 && line) x.fillText(line, tx, QR_Y + 106 + ln*10); }
  const hx = hexagram(plant.f), hy = QR_Y + 146, lw = 56;
  for (let i=0;i<6;i++){ const yy = hy + (5 - i)*8; if (hx.lines[i]) x.fillRect(tx, yy, lw, 4); else { x.fillRect(tx, yy, 24, 4); x.fillRect(tx + 32, yy, 24, 4); } }
  x.font = FONT(16); x.fillText(String(hx.n), tx + lw + 10, hy + 14);
  // pie
  x.textAlign = 'center';
  const l1 = (S.l1 || '').trim(), l2 = (S.l2 || '').trim();
  if (l1){ fitText(x, l1, PW - 12, 16); x.fillText(l1, PW/2, H - 66); }
  if (l2){ fitText(x, l2, PW - 12, 16); x.fillText(l2, PW/2, H - 46); }
  x.font = FONT(8); x.fillText('ALCHEMY OF MEANING', PW/2, H - 20);
  // a 1 bit todo lo que no es foto; luego el retrato tramado
  const id = x.getImageData(0, 0, PW, H), d = id.data;
  for (let i=0;i<PW*H;i++){ const v = d[i*4] < 150 ? 0 : 255; d[i*4] = d[i*4+1] = d[i*4+2] = v; d[i*4+3] = 255; }
  for (let y=0;y<PW;y++) for (let k=0;k<PW;k++){ const i = ((PHOTO_Y + y)*PW + k)*4, v = bits[y*PW + k] ? 255 : 0; d[i] = d[i+1] = d[i+2] = v; }
  x.putImageData(id, 0, 0);
  // la semilla: punto donde brota la planta, al pie del retrato
  x.fillStyle = '#fff'; x.beginPath(); x.arc(TIRA.ROOT_X, TIRA.ROOT_Y, 6, 0, 7); x.fill();
  x.fillStyle = '#000'; x.beginPath(); x.arc(TIRA.ROOT_X, TIRA.ROOT_Y, 3, 0, 7); x.fill();
  return c;
}

/* ---------------- tubería ---------------- */
let DEMO = null;
function compute(){
  const g = compose(PW), f = features(g, PW);
  const q = [f.b, f.c, f.e, f.a, f.x, f.y].map(v => Math.round(clamp(v)*255));
  const minute = minuteIndex(S.born || Date.now());
  const bytes = [...q, ...momentBytes(minute, S.lat, S.lon)], code = encode(bytes);
  const plant = grow(decode(code));
  const url = qrURL(code, minute);
  const bits = dither(g, PW, PW, S.dit);
  G = { g, f, code, plant, url, bits, minute, tira: renderTira(bits, code, plant, url) };
  showReadings();
  dirty = false;
}
function showReadings(){
  const f = G.f, set = (m, o, v, txt) => { $(m).style.width = (v*100).toFixed(0) + '%'; $(o).textContent = txt; };
  set('#mB', '#oB', f.b, Math.round(f.b*100)); set('#mC', '#oC', f.c, Math.round(f.c*100)); set('#mE', '#oE', f.e, Math.round(f.e*100));
  set('#mA', '#oA', f.a, Math.round(f.a*180) + '°'); set('#mX', '#oX', f.x, Math.round(f.x*100)); set('#mY', '#oY', f.y, Math.round(f.y*100));
  $('#lCode').textContent = $('#lhCode').textContent = G.code.slice(0,4) + ' ' + G.code.slice(4,8) + ' ' + G.code.slice(8);
  const P = G.plant.P;
  const hx = hexagram(G.f);
  $('#lPlant').textContent = `${P.levels + 1} niveles · ${P.orn} · giro ${Math.round(P.twist/D2R)}° · hexagrama ${hx.n}, ${hx.name}`;
  const q = S._qr; $('#lQR').textContent = q ? `QR ${q.n}×${q.n} módulos · ${q.m} px por módulo · ${q.mm} mm · ${G.url.length} caracteres` : 'el enlace es demasiado largo para el QR';
  $('#cTR').textContent = `${PW} × ${TH} px · 58 × ${TH/DPMM} mm`;
  const w = S.born ? new Date(S.born) : new Date();
  $('#lWhen').textContent = `${fmtDate(w)} · ${fmtTime(w)}` + (S.lat != null ? ` · ${S.lat.toFixed(2)}, ${S.lon.toFixed(2)}` : '');
  $('#oWhen').textContent = `${fmtDate(w)} · ${fmtTime(w)}`;
  $('#oGeo').textContent = S.lat != null ? `${S.lat.toFixed(2)}, ${S.lon.toFixed(2)}` : 'sin ubicación';
}

/* ---------------- dibujo en pantalla ---------------- */
const cv = $('#cv'), cx = cv.getContext('2d');
let view = { x:0, y:0, s:1 }, W = 0, H = 0, DPR = 1;
function resize(){ DPR = Math.min(window.devicePixelRatio || 1, 2.5); W = innerWidth; H = innerHeight; cv.width = W*DPR; cv.height = H*DPR; dirty = dirty || false; }
addEventListener('resize', resize); resize();

let isOpen = false;
function frame(t){
  if (!isOpen) return;
  if (dirty) compute();
  cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.fillStyle = '#0a0a0a'; cx.fillRect(0, 0, W, H);
  const padT = 40, padB = 70;
  const tc = G.tira, s = Math.min((H - padT - padB)/tc.height, (W - 40)/tc.width);
  const w = tc.width*s, h = tc.height*s, ox = Math.round((W - w)/2), oy = Math.round(padT + (H - padT - padB - h)/2);
  cx.imageSmoothingEnabled = s < 1; cx.drawImage(tc, ox, oy, w, h);
  cx.strokeStyle = '#2e2e2e'; cx.lineWidth = 1; cx.strokeRect(ox - .5, oy - .5, w + 1, h + 1);
  view = { x:ox, y:oy, s };
  requestAnimationFrame(frame);
}

/* ---------------- arrastre: mover la foto dentro de la tira ---------------- */
let drag = null;
cv.addEventListener('pointerdown', e => {
  const px = (e.clientX - view.x)/view.s, py = (e.clientY - view.y)/view.s;
  if (px < 0 || px > PW || py < PHOTO_Y || py > PHOTO_Y + PW || !img1) return;
  drag = { x:e.clientX, y:e.clientY, cx:S.cx, cy:S.cy }; cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  const iw = img1.width, ih = img1.height, ss = Math.min(iw, ih)/S.zoom, k = ss/(PW*view.s);
  S.cx = clamp(drag.cx - dx*k/iw, 0, 1); S.cy = clamp(drag.cy - dy*k/ih, 0, 1);
  const half = ss/2; S.cx = clamp(S.cx, half/iw, 1 - half/iw); S.cy = clamp(S.cy, half/ih, 1 - half/ih);
  dirty = true;
});
const endDrag = () => { if (drag) save(); drag = null; };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

/* ---------------- fotos ---------------- */
async function loadImg(file){
  const url = URL.createObjectURL(file);
  try {
    const im = new Image(); im.decoding = 'async'; im.src = url; await im.decode();
    const m = 1600, s = Math.min(1, m/Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth*s); c.height = Math.round(im.naturalHeight*s);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c;
  } finally { URL.revokeObjectURL(url); }
}
$('#f1').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { img1 = await loadImg(f); demo = false; S.zoom = 1; S.cx = S.cy = .5; S.born = (f.lastModified && Date.now() - f.lastModified < 30*864e5) ? f.lastModified : Date.now(); syncAll(); dirty = true; save(); msg('semilla nueva'); }
  catch(err){ msg('No se pudo abrir esa imagen.'); }
};
$('#f2').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { img2 = await loadImg(f); $('#b2x').disabled = false; dirty = true; msg('fusión activa'); } catch(err){ msg('No se pudo abrir esa imagen.'); }
};
$('#bFoto').onclick = () => $('#f1').click();
$('#b2').onclick = () => $('#f2').click();
$('#b2x').onclick = () => { img2 = null; $('#b2x').disabled = true; dirty = true; };
$('#bNow').onclick = () => { S.born = Date.now(); dirty = true; save(); msg('instante: ahora'); };
$('#bGeo').onclick = () => {
  if (!navigator.geolocation){ msg('Este navegador no da la ubicación.'); return; }
  msg('buscando ubicación…', 0);
  navigator.geolocation.getCurrentPosition(p => { S.lat = Math.round(p.coords.latitude*100)/100; S.lon = Math.round(p.coords.longitude*100)/100; dirty = true; save(); msg('ubicación aproximada (~1 km)'); },
    () => msg('Sin permiso de ubicación. Puedes escribir el lugar.', 3500), { enableHighAccuracy:false, timeout:10000, maximumAge:600000 });
};
$('#bGeoX').onclick = () => { S.lat = S.lon = null; dirty = true; save(); };

/* ---------------- controles ---------------- */
function syncRange(r){ r.style.setProperty('--p', ((r.value - r.min)/(r.max - r.min)*100) + '%'); }
const RANGES = { sZoom:['zoom', v => v.toFixed(2) + '×'], sExp:['exp', v => (v > 0 ? '+' : '') + v.toFixed(2)], sCon:['con', v => v.toFixed(2)],
  sMix:['mix', v => Math.round(v*100) + '%'], sSc2:['sc2', v => v.toFixed(2) + '×'] };
for (const [id, [k, fmt]] of Object.entries(RANGES)){
  const r = $('#' + id), o = $('#o' + id.slice(1));
  r.oninput = () => { S[k] = +r.value; o.textContent = fmt(S[k]); syncRange(r); dirty = true; };
  r.onchange = save;
}
function segGroup(id, key, after){
  const g = $('#' + id);
  g.querySelectorAll('button').forEach(b => b.onclick = () => { S[key] = b.dataset.v; syncSeg(g, S[key]); if (after) after(); dirty = true; save(); });
}
function syncSeg(g, v){ g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); }
segGroup('gDit', 'dit'); segGroup('gMode', 'mode'); segGroup('gCon', 'ui', applyUI);
for (const [id, k] of [['tL1','l1'], ['tL2','l2'], ['tBase','base'], ['tPlace','place']]){ const i = $('#' + id); i.oninput = () => { S[k] = i.value; dirty = true; }; i.onchange = save; }
function applyUI(){ document.documentElement.dataset.contrast = S.ui === 'alto' ? 'alto' : ''; }
function syncAll(){
  for (const [id, [k, fmt]] of Object.entries(RANGES)){ const r = $('#' + id); r.value = S[k]; $('#o' + id.slice(1)).textContent = fmt(+S[k]); syncRange(r); }
  syncSeg($('#gDit'), S.dit); syncSeg($('#gMode'), S.mode); syncSeg($('#gCon'), S.ui);
  $('#tL1').value = S.l1; $('#tL2').value = S.l2; $('#tBase').value = S.base; $('#tPlace').value = S.place || ''; applyUI();
}

const toggleAj = (on = $('#wAj').hidden) => { $('#wAj').hidden = !on; $('#bAj').setAttribute('aria-pressed', String(on)); };
$('#bAj').onclick = () => toggleAj(); $('#xAj').onclick = () => toggleAj(false);
$('#crear').querySelectorAll('[data-min]').forEach(b => b.onclick = () => { const w = b.closest('.win'); w.classList.toggle('min'); b.textContent = w.classList.contains('min') ? '+' : '–'; });
const hideUI = on => document.body.classList.toggle('hide', on);
$('#cHide').onclick = () => hideUI(true);
addEventListener('keydown', e => {
  if (!isOpen || e.target.matches('input[type=text]')) return;
  if (e.key === 'h'){ hideUI(!document.body.classList.contains('hide')); }
  else if (e.key === 'f'){ $('#f1').click(); }
  else if (e.key === 'Escape'){ if (!$('#wSave').hidden) $('#wSave').hidden = true; else if (!$('#wAj').hidden) toggleAj(false); else close(); }
});

/* ---------------- guardar ---------------- */
let blob = null, blobURL = null, fname = '';
const dlP = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
$('#bSave').onclick = async () => {
  if (dirty) compute();
  blob = await new Promise(r => G.tira.toBlob(r, 'image/png'));
  if (!blob){ msg('No se pudo generar la imagen.'); return; }
  if (blobURL) URL.revokeObjectURL(blobURL); blobURL = URL.createObjectURL(blob);
  fname = `xinas-${G.code}.png`;
  $('#saveImg').src = blobURL;
  $('#saveInfo').textContent = `${G.tira.width} × ${G.tira.height} px · 58 × ${TH/DPMM} mm · 1 bit · ${(blob.size/1024).toFixed(0)} KB`;
  $('#wSave').hidden = false;
};
$('#xSave').onclick = () => $('#wSave').hidden = true;
$('#bShare').onclick = async () => {
  if (!blob) return;
  const dl = await dlP;
  if (dl){ try { await dl.save({filename:fname, data:blob}); msg('Imagen guardada.'); } catch(e){ if (e && e.code !== 'declined') msg('No se pudo guardar en esta vista.'); } return; }
  const file = new File([blob], fname, {type:'image/png'});
  if (navigator.canShare && navigator.canShare({files:[file]})){ try { await navigator.share({files:[file]}); } catch(e){ if (e.name !== 'AbortError') msg('No se pudo compartir.'); } return; }
  const a = document.createElement('a'); a.href = blobURL; a.download = fname; document.body.append(a); a.click(); a.remove();
};

/* ---------------- abrir / cerrar dentro del visor ---------------- */
function bornMinute(){ return minuteIndex(S.born || Date.now()); }
function open(){
  if (isOpen) return; isOpen = true; $('#crear').hidden = false; document.body.dataset.crear = '1'; resize();
  dirty = true; requestAnimationFrame(frame);
  if (demo) msg('semilla de muestra · toca foto para sembrar la tuya', 4000);
}
function close(){ if (!isOpen) return; isOpen = false; $('#crear').hidden = true; $('#wSave').hidden = true; delete document.body.dataset.crear; }
function verCrecer(){ if (dirty) compute(); close(); if (window.VISOR) window.VISOR.plantar(G.code, G.minute, !demo); }
$('#cClose').onclick = close;
$('#bVer').onclick = verCrecer; $('#bVer2').onclick = verCrecer;

/* ---------------- arranque ---------------- */
window.XINAS = { open, close, grow, decode, encode, drawPlant, plantBox, get isOpen(){ return isOpen; }, get state(){ return S; }, get result(){ if (dirty) compute(); return G; } };
DEMO = makeDemo();
syncAll();
if (innerWidth <= 720){ $('#wLect').classList.add('min'); $('#wLect [data-min]').textContent = '+'; }
const ready = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('16px Silkscreen'), document.fonts.load('8px Silkscreen')]).catch(() => {}) : Promise.resolve();
ready.then(() => { dirty = true; });
})();
