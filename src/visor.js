/* Xinas · visor AR v0.4 (base de la app; «crear» abre el editor de tira) — plantas luminosas e iridiscentes
   Lee ?s=CÓDIGO&t=DÍA, reconstruye la planta con planta.js y la hace crecer:
   en jardín (pantalla) o sobre la tira impresa (cámara + QR como marcador).
   Colección Alchemy of Meaning · Héctor Cruz Juárez · GPL-3.0 */
import * as THREE from 'three';
import jsQR from 'jsqr';

const P = window.Planta, $ = s => document.querySelector(s), clamp = P.clamp;
const VER = '0.4';

/* ---------------- semilla ---------------- */
const DEMO = 'FECN70WHGWZBY';
let seed = P.parseURL(location.href) || P.parseURL(location.origin + '/?' + (location.hash || '').slice(1));
const fromLink = !!seed;
if (!seed) seed = { code:DEMO, minute:P.minuteIndex(Date.now()) };
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
/* luz iridiscente: el color recorre la paleta de la semilla según el ángulo de la mirada (película fina) */
const IRID_V = `
  varying vec3 vN; varying vec3 vV; varying float vH;
  void main(){
    mat4 im = mat4(1.0);
    #ifdef USE_INSTANCING
      im = instanceMatrix;
    #endif
    vec4 lp = im*vec4(position, 1.0); vH = lp.y;
    vec4 wp = modelMatrix*lp;
    vN = normalize(mat3(modelMatrix)*mat3(im)*normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix*viewMatrix*wp;
  }`;
const IRID_F = `
  uniform vec3 uA, uB, uC, uD; uniform float uSpan, uOff, uGain, uAlpha, uTime, uH, uRim;
  varying vec3 vN; varying vec3 vV; varying float vH;
  vec3 pal(float t){ return uA + uB*cos(6.28318*(uC*t + uD)); }
  void main(){
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    vec3 c = pal(uOff + f*uSpan + vH*uH + uTime*.025);
    c *= uGain*(1.0 - uRim + uRim*(.35 + 1.4*pow(f, 1.6)));
    gl_FragColor = vec4(c, uAlpha);
  }`;
function irid(o){
  return new THREE.ShaderMaterial({ vertexShader:IRID_V, fragmentShader:IRID_F, side:THREE.DoubleSide, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uA:{value:new THREE.Vector3()}, uB:{value:new THREE.Vector3()}, uC:{value:new THREE.Vector3()}, uD:{value:new THREE.Vector3()},
      uSpan:{value:o.span ?? .6}, uOff:{value:o.off ?? 0}, uGain:{value:o.gain ?? 1}, uAlpha:{value:o.alpha ?? 1}, uTime:{value:0}, uH:{value:o.h ?? .35}, uRim:{value:o.rim ?? .7} } });
}
const matStem = irid({ span:.35, gain:1.05, rim:.4, h:.5 }), matHalo = irid({ span:.3, gain:.9, alpha:.16, rim:1, h:.5, off:.08 });
const matLeaf = irid({ span:.9, gain:.95, alpha:.8, rim:.85, off:.25 }), matBud = irid({ span:.2, gain:1.6, rim:.2, off:.5 });
const matRoot = irid({ span:.25, gain:.5, alpha:.55, rim:.5, off:.65 });
const MATS = [matStem, matHalo, matLeaf, matBud, matRoot];
function setPalette(Pal){ for (const m of MATS){ const u = m.uniforms; u.uA.value.fromArray(Pal.a); u.uB.value.fromArray(Pal.b); u.uC.value.fromArray(Pal.c); u.uD.value.fromArray(Pal.d); } }

/* polen y destellos: puntos suaves que flotan */
const DOT_V = `attribute float aK; uniform float uSize, uPR; varying float vK;
  void main(){ vK = aK; vec4 mv = modelViewMatrix*vec4(position, 1.0); gl_PointSize = min(uSize*uPR*(220.0/max(20.0, -mv.z))*(.6 + .8*fract(aK*7.13)), uSize*uPR*1.6); gl_Position = projectionMatrix*mv; }`;
const DOT_F = `uniform vec3 uA, uB, uC, uD; uniform float uAlpha, uTime; varying float vK;
  vec3 pal(float t){ return uA + uB*cos(6.28318*(uC*t + uD)); }
  void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); a *= a;
    gl_FragColor = vec4(pal(vK + uTime*.04)*1.3, a*uAlpha); }`;
function dots(size, alpha){ return new THREE.ShaderMaterial({ vertexShader:DOT_V, fragmentShader:DOT_F, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms:{ uA:{value:new THREE.Vector3()}, uB:{value:new THREE.Vector3()}, uC:{value:new THREE.Vector3()}, uD:{value:new THREE.Vector3()}, uSize:{value:size}, uPR:{value:Math.min(devicePixelRatio || 1, 2)}, uAlpha:{value:alpha}, uTime:{value:0} } }); }
const matPollen = dots(5, .75), matSpark = dots(26, .9);
MATS.push(matPollen, matSpark);
let pollen, spark, pollenSeed = [];

const cyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(.34, .5, 0, 1); leafShape.quadraticCurveTo(-.34, .5, 0, 0);
const leafGeo = new THREE.ShapeGeometry(leafShape, 6);
const ball = new THREE.IcosahedronGeometry(1, 1);
let mSeg, mHalo, mRoot, mLeaf, mBall;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const V = a => new THREE.Vector3(a[0], a[1], a[2]);

function build(){
  plant = P.fromCode(seed.code); hex = P.hexagram(plant.f);
  for (const m of [mSeg, mHalo, mRoot, mLeaf, mBall, pollen, spark]) if (m){ holder.remove(m); if (m.dispose) m.dispose(); else m.geometry.dispose(); }
  const bytes = P.decode(seed.code), Pal = P.palette(bytes); setPalette(Pal);
  const gc = P.paletteRGB(Pal, .1); groundMat.color.setRGB(gc[0]*.35, gc[1]*.35, gc[2]*.35);
  matLeaf.uniforms.uSpan.value = .55 + Pal.span*.6; matStem.uniforms.uSpan.value = .25 + Pal.span*.25;
  const nPet = plant.tips.length*(plant.P.petals + 1);
  mSeg = new THREE.InstancedMesh(cyl, matStem, plant.segs.length);
  mHalo = new THREE.InstancedMesh(cyl, matHalo, plant.segs.length);
  mRoot = new THREE.InstancedMesh(cyl, matRoot, plant.roots.length);
  mLeaf = new THREE.InstancedMesh(leafGeo, matLeaf, plant.leaves.length + nPet);
  mBall = new THREE.InstancedMesh(ball, matBud, plant.tips.length*2);
  mRoot.renderOrder = 0; mHalo.renderOrder = 1; mSeg.renderOrder = 2; mLeaf.renderOrder = 3; mBall.renderOrder = 4;
  for (const m of [mSeg, mHalo, mRoot, mLeaf, mBall]){ m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; holder.add(m); }
  // polen: nace alrededor de la planta adulta y sube despacio
  const bb1 = P.plantBox(plant, 1, 0), rng = P.mulberry32(P.fnv(bytes) ^ 77), NP = 140;
  const pg = new THREE.BufferGeometry(), pp = new Float32Array(NP*3), pk = new Float32Array(NP); pollenSeed = [];
  for (let i=0;i<NP;i++){ const r = Math.sqrt(rng())*Math.max(.3, (bb1.x1 - bb1.x0)*.7), an = rng()*6.283; pollenSeed.push([Math.cos(an)*r, rng()*bb1.y1*1.15, Math.sin(an)*r, rng()]); pk[i] = rng(); }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('aK', new THREE.BufferAttribute(pk, 1));
  pollen = new THREE.Points(pg, matPollen); pollen.frustumCulled = false; pollen.renderOrder = 5; holder.add(pollen);
  const sg = new THREE.BufferGeometry(), NS = plant.tips.length + plant.leaves.length;
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS*3), 3)); sg.setAttribute('aK', new THREE.BufferAttribute(Float32Array.from({length:NS}, (_, i) => (i*.137) % 1), 1));
  spark = new THREE.Points(sg, matSpark); spark.frustumCulled = false; spark.renderOrder = 6; holder.add(spark);
  // escala: la planta adulta mide ~85 mm sobre la tira
  const bb = P.plantBox(plant, 1, 0); unitMM = 70/Math.max(.3, bb.y1);
  holder.scale.setScalar(unitMM);
  daysOld = seed.minute == null ? 0 : Math.max(0, (P.minuteIndex(Date.now()) - seed.minute)/1440);
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
    const rr = Math.max(.22*mm, R*Math.pow(.68, g.d)); rod(g.a, b, rr*3.2, mHalo, n); rod(g.a, b, rr, mSeg, n++); }
  mSeg.count = mHalo.count = n; n = 0;
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
  for (const m of [mSeg, mHalo, mRoot, mLeaf, mBall]) m.instanceMatrix.needsUpdate = true;
  // destellos en yemas, flores y puntas de hoja
  const sp = spark.geometry.attributes.position; let ns = 0;
  for (const t of plant.tips){ if (t.t >= age) continue; sp.setXYZ(ns++, t.p[0], t.p[1], t.p[2]); }
  for (const l of plant.leaves){ if (l.t + .06 >= age || l.coty) continue; const g = clamp((age - l.t)/.08); sp.setXYZ(ns++, l.p[0] + l.d[0]*l.s*g, l.p[1] + l.d[1]*l.s*g, l.p[2] + l.d[2]*l.s*g); }
  spark.geometry.setDrawRange(0, ns); sp.needsUpdate = true;
}

/* ---------------- información ---------------- */
function fmtMinute(m){ if (m == null) return '—'; const t = P.minuteToDate(m), p = n => String(n).padStart(2, '0'); return `${p(t.getDate())}.${p(t.getMonth()+1)}.${t.getFullYear()} · ${p(t.getHours())}:${p(t.getMinutes())}`; }
function fmtDay(d){ if (d == null) return '—'; const t = new Date(Date.UTC(2026, 0, 1) + d*864e5); return `${String(t.getUTCDate()).padStart(2,'0')}.${String(t.getUTCMonth()+1).padStart(2,'0')}.${t.getUTCFullYear()}`; }
function showInfo(){
  $('#iCode').textContent = $('#hCode').textContent = seed.code.slice(0,4) + ' ' + seed.code.slice(4,8) + ' ' + seed.code.slice(8);
  $('#iBorn').textContent = fmtMinute(seed.minute);
  const dd = Math.floor(daysOld);
  $('#iDays').textContent = (dd + extraDays) + (extraDays ? ` (${dd} + ${extraDays})` : '');
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
const groundMat = new THREE.LineBasicMaterial({ color:0x2a2a2a, transparent:true, opacity:.8 });
const ground = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:96}, (_, i) => new THREE.Vector3(Math.cos(i/96*Math.PI*2)*40, 0, Math.sin(i/96*Math.PI*2)*40))), groundMat);
garden.add(ground);
function toGarden(){ garden.add(holder); holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0); setLook('jardin'); }
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
  if (m === 'ar'){ marker.add(holder); holder.rotation.set(-Math.PI/2, 0, 0); setLook('ar'); pose3.has = false; $('#hint').hidden = false; }
  else { toGarden(); $('#hint').hidden = true; }
}
/* en el jardín la planta es luz sobre negro (suma); sobre la tira blanca se dibuja con color pleno para que se vea en el papel */
function setLook(m){
  const ar = m === 'ar';
  for (const [mat, a, g] of [[matStem, 1, ar ? .85 : 1.05], [matLeaf, ar ? .92 : .8, ar ? .8 : .95], [matBud, 1, ar ? 1.1 : 1.6], [matRoot, ar ? .35 : .55, ar ? .5 : .5]]){
    mat.blending = ar ? THREE.NormalBlending : THREE.AdditiveBlending; mat.depthWrite = ar && mat !== matLeaf; mat.uniforms.uAlpha.value = a; mat.uniforms.uGain.value = g; mat.needsUpdate = true; }
}

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
  const ts = now/1000; for (const m of MATS) m.uniforms.uTime.value = ts;
  // polen: sube despacio, se mece; aparece cuando la planta ya tiene hojas
  const pa = pollen.geometry.attributes.position, hgt = Math.max(.2, P.plantBox(plant, ageShown, 0).y1)*1.2;
  for (let i=0;i<pollenSeed.length;i++){ const s = pollenSeed[i], y = (s[1] + ts*.018*(.4 + s[3])) % hgt;
    pa.setXYZ(i, s[0] + Math.sin(ts*.5 + s[3]*20)*.03, y, s[2] + Math.cos(ts*.4 + s[3]*17)*.03); }
  pa.needsUpdate = true; matPollen.uniforms.uAlpha.value = clamp((ageShown - .5)*3)*(mode === 'ar' ? .55 : .75);
  if (mode === 'jardin'){
    if (orbit.auto) orbit.az += .0025;
    const bb = P.plantBox(plant, ageShown, 0), top = Math.max(.15, bb.y1)*unitMM, low = Math.min(0, bb.y0)*unitMM;
    const wid = Math.max(Math.abs(bb.x0), Math.abs(bb.x1), .1)*2*unitMM;
    const want = Math.max((top - low)*1.9, wid*1.5/(innerWidth/innerHeight))/Math.min(1, innerWidth/innerHeight*1.4);
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
$('#sFov').oninput = e => { hfov = +e.target.value; $('#oFov').textContent = hfov + '°'; e.target.style.setProperty('--p', ((hfov - 40)/50*100) + '%'); };
$('#bHide').onclick = () => document.body.classList.add('hide'); $('#restore').onclick = () => document.body.classList.remove('hide');
$('#wInfo').querySelectorAll('[data-min]').forEach(b => b.onclick = () => { const w = b.closest('.win'); w.classList.toggle('min'); b.textContent = w.classList.contains('min') ? '+' : '–'; });
addEventListener('keydown', e => { if (document.body.dataset.crear || e.target.matches('input')) return; if (e.key === 'h') document.body.classList.toggle('hide'); else if (e.key === ' '){ e.preventDefault(); $('#bRe').click(); } });

/* prueba sin cámara: VISOR.test(imagen) usa una imagen fija como si fuera el video */
function plantar(code, minute, real){
  seed = { code, minute }; extraDays = 0; $('#sDias').value = 0; $('#oDias').textContent = 'hoy'; $('#sDias').style.setProperty('--p', '0%');
  build(); if (mode === 'ar') stopAR(); else toGarden();
  if (real) try { if (location.protocol === 'https:') history.replaceState(null, '', location.pathname + '?s=' + code + '&t=' + minute.toString(36)); } catch(e){}
  $('#tDemo').hidden = true; msg('así crecerá: ' + code.slice(0,4));
}
$('#bCrear').onclick = () => { if (mode === 'ar') stopAR(); if (window.XINAS) window.XINAS.open(); };
window.VISOR = { VER, plantar, test(img){ testSrc = img; $('#video').hidden = true; const bg = $('#testbg'); bg.hidden = false; bg.src = img.src; setMode('ar'); }, get pose(){ return pose3; }, get seed(){ return seed; } };

build(); toGarden(); setMode('jardin');
if (innerWidth <= 720){ $('#wInfo').classList.add('min'); $('#wInfo [data-min]').textContent = '+'; }
requestAnimationFrame(frame);
