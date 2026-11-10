/* Xinas · visor AR v0.2 (base de la app; «crear» abre el editor de tira)
   Lee ?s=CÓDIGO&t=DÍA, reconstruye la planta con planta.js y la hace crecer:
   en jardín (pantalla) o sobre la tira impresa (cámara + QR como marcador).
   Colección Alchemy of Meaning · Héctor Cruz Juárez · GPL-3.0 */
import * as THREE from 'three';
import jsQR from 'jsqr';

const P = window.Planta, $ = s => document.querySelector(s), clamp = P.clamp;
const VER = '0.2';

/* ---------------- semilla ---------------- */
const DEMO = 'FECN70WHGWZBY';
let seed = P.parseURL(location.href) || P.parseURL(location.origin + '/?' + (location.hash || '').slice(1));
const fromLink = !!seed;
if (!seed) seed = { code:DEMO, day:P.dayIndex(new Date()) };
let plant, hex, daysOld, ageNow, ageShown = .45, ageFrom = .45, ageT0 = 0, extraDays = 0, unitMM = 1;

const STORY = {
  semilla:'todavía es una promesa guardada en el papel.',
  'raíz':'antes de subir, aprende a sostenerse.',
  brote:'abrió los cotiledones: está aprendiendo la luz.',
  tallo:'busca hacia arriba lo que la foto dejó encendido.',
  ramas:'empieza a decidir; cada rama es un camino que la imagen ya sabía.',
  hojas:'respira. lo que viste se volvió follaje.',
  flor:'dio flor. la tira se borra; ella se queda.', follaje:'se cerró en hojas. la tira se borra; ella se queda.',
  yemas:'guarda yemas para después. la tira se borra; ella se queda.', plenitud:'plenitud.'
};

/* ---------------- escena ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas:$('#gl'), antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(40, 1, 1, 5000);
const marker = new THREE.Group(); marker.matrixAutoUpdate = false; scene.add(marker);
const garden = new THREE.Group(); scene.add(garden);
const holder = new THREE.Group();   // la planta: y hacia arriba, unidades en mm
const matInk = new THREE.MeshBasicMaterial({ color:0xeeeeee, side:THREE.DoubleSide });
const matRoot = new THREE.MeshBasicMaterial({ color:0x8f8f8f, side:THREE.DoubleSide, transparent:true, opacity:.6 });

const cyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(.34, .5, 0, 1); leafShape.quadraticCurveTo(-.34, .5, 0, 0);
const leafGeo = new THREE.ShapeGeometry(leafShape, 6);
const ball = new THREE.IcosahedronGeometry(1, 1);
let mSeg, mRoot, mLeaf, mBall;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const V = a => new THREE.Vector3(a[0], a[1], a[2]);

function build(){
  plant = P.fromCode(seed.code); hex = P.hexagram(plant.f);
  for (const m of [mSeg, mRoot, mLeaf, mBall]) if (m){ holder.remove(m); m.dispose(); }
  const nPet = plant.tips.length*(plant.P.petals + 1);
  mSeg = new THREE.InstancedMesh(cyl, matInk, plant.segs.length);
  mRoot = new THREE.InstancedMesh(cyl, matRoot, plant.roots.length);
  mLeaf = new THREE.InstancedMesh(leafGeo, matInk, plant.leaves.length + nPet);
  mBall = new THREE.InstancedMesh(ball, matInk, plant.tips.length*2);
  for (const m of [mSeg, mRoot, mLeaf, mBall]){ m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; holder.add(m); }
  // escala: la planta adulta mide ~85 mm sobre la tira
  const bb = P.plantBox(plant, 1, 0); unitMM = 85/Math.max(.3, bb.y1);
  holder.scale.setScalar(unitMM);
  const today = P.dayIndex(new Date());
  daysOld = seed.day == null ? 0 : Math.max(0, today - seed.day);
  setAgeTarget(true);
  showInfo();
}
function setAgeTarget(fromStart){
  ageNow = P.ageFromDays(daysOld + extraDays);
  ageFrom = fromStart ? .45 : ageShown; ageT0 = performance.now();
}
function rod(a, b, r, m, i){
  _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]); _p.subVectors(_b, _a); const L = _p.length() || 1e-6;
  _q.setFromUnitVectors(_up, _p.clone().divideScalar(L)); _s.set(r, L, r); _a.addScaledVector(_p, .5);
  _m.compose(_a, _q, _s); m.setMatrixAt(i, _m);
}
function leaf(p, d, side, len, m, i){
  const y = V(d).normalize(), x = V(side).sub(y.clone().multiplyScalar(V(side).dot(y))).normalize(), z = new THREE.Vector3().crossVectors(x, y);
  _m.makeBasis(x.multiplyScalar(len), y.multiplyScalar(len), z.multiplyScalar(len)); _m.setPosition(p[0], p[1], p[2]); m.setMatrixAt(i, _m);
}
function pose(age){
  const R = .0065, mm = 1/unitMM;   // radios en unidades de planta
  let n = 0;
  for (const g of plant.segs){ if (g.t0 >= age) continue; const fr = clamp((age - g.t0)/(g.t1 - g.t0));
    const b = [g.a[0] + (g.b[0]-g.a[0])*fr, g.a[1] + (g.b[1]-g.a[1])*fr, g.a[2] + (g.b[2]-g.a[2])*fr];
    rod(g.a, b, Math.max(.22*mm, R*Math.pow(.68, g.d)), mSeg, n++); }
  mSeg.count = n; n = 0;
  for (const r of plant.roots){ if (r.t0 >= age) continue; const fr = clamp((age - r.t0)/(r.t1 - r.t0));
    rod(r.a, [r.a[0] + (r.b[0]-r.a[0])*fr, r.a[1] + (r.b[1]-r.a[1])*fr, r.a[2] + (r.b[2]-r.a[2])*fr], .3*mm, mRoot, n++); }
  mRoot.count = n; n = 0; let nb = 0;
  for (const l of plant.leaves){ if (l.t >= age) continue; const g = clamp((age - l.t)/.08);
    const side = P.vec.perp(l.d); leaf(l.p, l.d, side, l.s*g, mLeaf, n++); }
  for (const t of plant.tips){ if (t.t >= age) continue; const g = clamp((age - t.t)/.12), r = t.s*g;
    if (t.kind === 'hoja'){ leaf(t.p, t.d, P.vec.perp(t.d), r, mLeaf, n++); continue; }
    if (t.kind === 'flor'){
      const u = P.vec.perp(t.d), w = P.vec.cross(t.d, u), k = plant.P.petals;
      for (let i=0;i<k;i++){ const an = i/k*Math.PI*2 + plant.f.a*3; const dir = P.vec.norm(P.vec.add(P.vec.add(P.vec.mul(u, Math.cos(an)), P.vec.mul(w, Math.sin(an))), P.vec.mul(t.d, .35)));
        leaf(t.p, dir, P.vec.cross(dir, t.d), r*.5, mLeaf, n++); }
      _m.compose(V(t.p), _q.identity(), _s.setScalar(Math.max(.4*mm, r*.09))); mBall.setMatrixAt(nb++, _m);
    } else { _m.compose(V(t.p), _q.identity(), _s.setScalar(Math.max(.4*mm, r*.2))); mBall.setMatrixAt(nb++, _m); }
  }
  mLeaf.count = n; mBall.count = nb;
  for (const m of [mSeg, mRoot, mLeaf, mBall]) m.instanceMatrix.needsUpdate = true;
}

/* ---------------- información ---------------- */
function fmtDay(d){ if (d == null) return '—'; const t = new Date(Date.UTC(2026, 0, 1) + d*864e5); return `${String(t.getUTCDate()).padStart(2,'0')}.${String(t.getUTCMonth()+1).padStart(2,'0')}.${t.getUTCFullYear()}`; }
function showInfo(){
  $('#iCode').textContent = $('#hCode').textContent = seed.code.slice(0,4) + ' ' + seed.code.slice(4,8) + ' ' + seed.code.slice(8);
  $('#iBorn').textContent = fmtDay(seed.day);
  $('#iDays').textContent = (daysOld + extraDays) + (extraDays ? ` (${daysOld} + ${extraDays})` : '');
  const hx = $('#iHex'); hx.innerHTML = '';
  for (let i=5;i>=0;i--){ const r = document.createElement('i'); r.className = hex.lines[i] ? 'y' : 'n'; hx.append(r); }
  $('#iHexN').textContent = `${hex.n} · ${hex.name}`;
  $('#tDemo').hidden = fromLink;
}
function showStage(age){
  const st = P.stage(age, plant.P.orn);
  if ($('#iStage').textContent !== st){ $('#iStage').textContent = st; $('#iStory').textContent = STORY[st] || ''; }
  $('#iAge').style.width = (age*100).toFixed(1) + '%';
}

/* ---------------- jardín (sin cámara) ---------------- */
let orbit = { az:0, el:.12, dist:260, zoom:1, drag:null, auto:true }, fr = { h:30, d:200 };
const ground = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:96}, (_, i) => new THREE.Vector3(Math.cos(i/96*Math.PI*2)*40, 0, Math.sin(i/96*Math.PI*2)*40))), new THREE.LineBasicMaterial({ color:0x3a3a3a }));
garden.add(ground);
function toGarden(){ garden.add(holder); holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0); matInk.color.set(0xeeeeee); }
const gl = $('#gl');
gl.addEventListener('pointerdown', e => { if (mode !== 'jardin') return; orbit.drag = { x:e.clientX, y:e.clientY, az:orbit.az, el:orbit.el }; orbit.auto = false; gl.setPointerCapture(e.pointerId); });
gl.addEventListener('pointermove', e => { const d = orbit.drag; if (!d) return; orbit.az = d.az - (e.clientX - d.x)*.008; orbit.el = clamp(d.el + (e.clientY - d.y)*.005, -.2, 1.2); });
gl.addEventListener('pointerup', () => orbit.drag = null); gl.addEventListener('pointercancel', () => orbit.drag = null);
gl.addEventListener('wheel', e => { orbit.zoom = clamp(orbit.zoom*(1 + e.deltaY*.001), .4, 3); }, { passive:true });

/* ---------------- AR: cámara + QR ---------------- */
let mode = 'jardin', video = null, stream = null, work = null, wctx = null, lastSeen = 0, frameN = 0, hfov = 62;
const pose3 = { has:false, q:new THREE.Quaternion(), t:new THREE.Vector3() };
let testSrc = null;

async function startAR(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ msg('Este navegador no da acceso a la cámara aquí. Abre el enlace de la tira en Safari o Chrome.', 6000); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } } });
  } catch(e){ msg(e && e.name === 'NotAllowedError' ? 'Sin permiso para la cámara.' : 'La cámara no está disponible en esta vista.', 5000); return; }
  video = $('#video'); video.srcObject = stream; await video.play().catch(() => {});
  setMode('ar');
}
function stopAR(){ if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; if (video) video.srcObject = null; setMode('jardin'); }
function setMode(m){
  mode = m; document.body.dataset.mode = m;
  $('#bAR').setAttribute('aria-pressed', String(m === 'ar')); $('#bAR').textContent = m === 'ar' ? 'jardín' : 'sobre la tira';
  if (m === 'ar'){ marker.add(holder); holder.rotation.set(-Math.PI/2, 0, 0); applyInk(); pose3.has = false; $('#hint').hidden = false; }
  else { toGarden(); $('#hint').hidden = true; }
}
function applyInk(){ matInk.color.set(ink === 'tinta' ? 0x0a0a0a : 0xf4f4f4); matRoot.color.set(ink === 'tinta' ? 0x333333 : 0xbbbbbb); }
let ink = 'tinta';

/* homografía de 4 puntos (plano en mm → pantalla en px) */
function homography(src, dst){
  const A = [], b = [];
  for (let i=0;i<4;i++){ const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u*x, -u*y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v*x, -v*y]); b.push(v); }
  for (let c=0;c<8;c++){ let p = c; for (let r=c+1;r<8;r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]; const d = A[c][c]; if (Math.abs(d) < 1e-12) return null;
    for (let r=0;r<8;r++){ if (r === c) continue; const k = A[r][c]/d; for (let k2=c;k2<8;k2++) A[r][k2] -= k*A[c][k2]; b[r] -= k*b[c]; } }
  const h = b.map((v, i) => v/A[i][i]); return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
/* pose a partir de la homografía y una cámara estenopeica (f en px, centro cx, cy) */
function poseFromH(H, f, cx, cy){
  const col = j => [(H[j] - cx*H[6+j])/f, (H[3+j] - cy*H[6+j])/f, H[6+j]];
  let h1 = col(0), h2 = col(1), h3 = col(2);
  const n1 = Math.hypot(...h1), n2 = Math.hypot(...h2); let l = 2/(n1 + n2);
  if (h3[2]*l < 0) l = -l;
  let r1 = h1.map(v => v*l), r2 = h2.map(v => v*l); const t = h3.map(v => v*l);
  r1 = P.vec.norm(r1); r2 = P.vec.norm(P.vec.add(r2, P.vec.mul(r1, -P.vec.dot(r1, r2)))); const r3 = P.vec.cross(r1, r2);
  return { R:[r1, r2, r3], t };
}
function track(now){
  const src = testSrc || video; if (!src) return;
  const vw = src.videoWidth || src.width, vh = src.videoHeight || src.height; if (!vw || !vh) return;
  const W = innerWidth, Hh = innerHeight, s = Math.max(W/vw, Hh/vh), ox = (W - vw*s)/2, oy = (Hh - vh*s)/2;
  const k = Math.min(1, 720/Math.max(vw, vh)), ww = Math.round(vw*k), wh = Math.round(vh*k);
  if (!work){ work = document.createElement('canvas'); wctx = work.getContext('2d', { willReadFrequently:true }); }
  if (work.width !== ww || work.height !== wh){ work.width = ww; work.height = wh; }
  wctx.drawImage(src, 0, 0, ww, wh);
  const img = wctx.getImageData(0, 0, ww, wh), q = jsQR(img.data, ww, wh, { inversionAttempts:'dontInvert' });
  if (!q || !q.location){ if (now - lastSeen > 700) pose3.has = false; return; }
  const got = P.parseURL(q.data);
  if (got && got.code !== seed.code){ seed = got; build(); msg('otra semilla: ' + got.code.slice(0,4)); }
  const n = 17 + 4*q.version, A = P.anchorMM(n), side = A.side, L = q.location;
  const toScr = p => [p.x/k*s + ox, p.y/k*s + oy];
  const dst = [L.topLeftCorner, L.topRightCorner, L.bottomRightCorner, L.bottomLeftCorner].map(toScr);
  const H = homography([[0,0],[side,0],[side,side],[0,side]], dst); if (!H) return;
  const vlong = Math.max(vw, vh)*s, f = (vlong/2)/Math.tan(hfov*Math.PI/360);
  const { R, t } = poseFromH(H, f, W/2, Hh/2);
  // OpenCV (x der, y abajo, z adelante) → three (y arriba, z atrás)
  const m = new THREE.Matrix4().set(R[0][0], R[1][0], R[2][0], t[0], -R[0][1], -R[1][1], -R[2][1], -t[1], -R[0][2], -R[1][2], -R[2][2], -t[2], 0, 0, 0, 1);
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3(); m.decompose(pos, quat, sc);
  if (!pose3.has){ pose3.q.copy(quat); pose3.t.copy(pos); } else { pose3.q.slerp(quat, .45); pose3.t.lerp(pos, .45); }
  pose3.has = true; lastSeen = now;
  cam.fov = 2*Math.atan((Hh/2)/f)*180/Math.PI; cam.aspect = W/Hh; cam.updateProjectionMatrix();
  holder.position.set(A.x, A.y, 0);
  if (!$('#hint').hidden){ $('#hint').hidden = true; ageFrom = .45; ageT0 = now; }
}

/* ---------------- bucle ---------------- */
function resize(){ renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
function frame(now){
  if (document.body.dataset.crear){ requestAnimationFrame(frame); return; }
  const k = clamp((now - ageT0)/4200), e = 1 - Math.pow(1 - k, 3);
  ageShown = ageFrom + (ageNow - ageFrom)*e; pose(ageShown); showStage(ageShown);
  if (mode === 'jardin'){
    if (orbit.auto) orbit.az += .0025;
    const bb = P.plantBox(plant, ageShown, 0), top = Math.max(.15, bb.y1)*unitMM, low = Math.min(0, bb.y0)*unitMM;
    const want = (top - low)*1.9/Math.min(1, innerWidth/innerHeight*1.4);
    fr.h += ((top + low)/2 + 4 - fr.h)*.06; fr.d += (want - fr.d)*.06;
    ground.scale.setScalar(clamp(top/40, .35, 1.2));
    const h = fr.h; orbit.dist = fr.d*orbit.zoom; cam.fov = 40; cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix();
    cam.position.set(Math.sin(orbit.az)*Math.cos(orbit.el)*orbit.dist, h + Math.sin(orbit.el)*orbit.dist, Math.cos(orbit.az)*Math.cos(orbit.el)*orbit.dist);
    cam.lookAt(0, h, 0); garden.visible = true; marker.visible = false;
  } else {
    cam.position.set(0, 0, 0); cam.quaternion.identity(); garden.visible = false;
    if ((frameN++ & 1) === 0 || testSrc) track(now);
    marker.visible = pose3.has; if (pose3.has){ marker.matrix.compose(pose3.t, pose3.q, new THREE.Vector3(1, 1, 1)); marker.matrixWorldNeedsUpdate = true; }
    if (!pose3.has && now - lastSeen > 1500) $('#hint').hidden = false;
  }
  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}

/* ---------------- interfaz ---------------- */
function msg(t, ms=2200){ const m = $('#msg'); m.textContent = t; m.hidden = false; clearTimeout(msg.t); msg.t = setTimeout(() => m.hidden = true, ms); }
$('#bAR').onclick = () => mode === 'ar' ? stopAR() : startAR();
$('#sDias').oninput = e => { extraDays = +e.target.value; $('#oDias').textContent = extraDays ? '+' + extraDays + ' d' : 'hoy'; e.target.style.setProperty('--p', (extraDays/120*100) + '%'); setAgeTarget(false); showInfo(); };
$('#bRe').onclick = () => { ageFrom = .45; ageT0 = performance.now(); };
$('#gInk').querySelectorAll('button').forEach(b => b.onclick = () => { ink = b.dataset.v; $('#gInk').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); if (mode === 'ar') applyInk(); });
$('#sFov').oninput = e => { hfov = +e.target.value; $('#oFov').textContent = hfov + '°'; e.target.style.setProperty('--p', ((hfov - 40)/50*100) + '%'); };
$('#bHide').onclick = () => document.body.classList.add('hide'); $('#restore').onclick = () => document.body.classList.remove('hide');
$('#wInfo').querySelectorAll('[data-min]').forEach(b => b.onclick = () => { const w = b.closest('.win'); w.classList.toggle('min'); b.textContent = w.classList.contains('min') ? '+' : '–'; });
addEventListener('keydown', e => { if (document.body.dataset.crear || e.target.matches('input')) return; if (e.key === 'h') document.body.classList.toggle('hide'); else if (e.key === ' '){ e.preventDefault(); $('#bRe').click(); } });

/* prueba sin cámara: VISOR.test(imagen) usa una imagen fija como si fuera el video */
function plantar(code, day, real){
  seed = { code, day }; extraDays = 0; $('#sDias').value = 0; $('#oDias').textContent = 'hoy'; $('#sDias').style.setProperty('--p', '0%');
  build(); if (mode === 'ar') stopAR(); else toGarden();
  if (real) try { if (location.protocol === 'https:') history.replaceState(null, '', location.pathname + '?s=' + code + '&t=' + day.toString(36)); } catch(e){}
  $('#tDemo').hidden = true; msg('así crecerá: ' + code.slice(0,4));
}
$('#bCrear').onclick = () => { if (mode === 'ar') stopAR(); if (window.XINAS) window.XINAS.open(); };
window.VISOR = { VER, plantar, test(img){ testSrc = img; $('#video').hidden = true; const bg = $('#testbg'); bg.hidden = false; bg.src = img.src; setMode('ar'); }, get pose(){ return pose3; }, get seed(){ return seed; } };

build(); toGarden(); setMode('jardin');
if (innerWidth <= 720){ $('#wInfo').classList.add('min'); $('#wInfo [data-min]').textContent = '+'; }
requestAnimationFrame(frame);
