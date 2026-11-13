/* Xinas · v0.5 — germina
   El visor es la base de la app y está hecho de capas:
   umbral (crear semilla) → cámara → lectura del instante → imprime → germina → sembrar en Endeles.
   Al escanear una tira se entra directo a «germina»: la cámara se vuelve blanco y negro y la planta
   nace frente a ti, de luz, desde el punto impreso al pie del retrato.
   Colección Alchemy of Meaning · Héctor Cruz Juárez · GPL-3.0 */
import * as THREE from 'three';
import jsQR from 'jsqr';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { musica } from './musica.js';
const M = musica();

const P = window.Planta, $ = s => document.querySelector(s), clamp = P.clamp;
const VER = '0.9';
const GATHER = 2800, GROW = 24000;          // ms: la luz se junta en la semilla, luego crece
/* Endeles vive junto a Xinas en el mismo sitio: /app/xinas/ → /app/endeles/ */
const ENDELES = /\/app\/xinas\/?/i.test(location.pathname) ? location.pathname.replace(/\/app\/xinas\/?.*$/i, '/app/endeles/') : 'https://hectorcruz.com.mx/app/endeles/';

/* ---------------- semilla ---------------- */
const DEMO = 'FECN70WHGWZBY';
let seed = P.parseURL(location.href);
const fromLink = !!seed;
if (!seed) seed = { code:DEMO, minute:P.minuteIndex(Date.now()) - 9*1440 };
let plant, hex, daysOld = 0, unitMM = 1, ageShown = 0;

const VERSOS = {
  semilla:'cada instante guarda una semilla.',
  'raíz':'antes de subir, aprende a sostenerse.',
  brote:'abre sus primeras hojas: está aprendiendo la luz.',
  tallo:'busca hacia arriba lo que la foto dejó encendido.',
  ramas:'cada rama es un camino que el instante ya sabía.',
  hojas:'respira. lo que viste se volvió follaje.',
  flor:'este instante no se repite. por eso florece.', follaje:'este instante no se repite. por eso florece.',
  yemas:'este instante no se repite. por eso florece.', plenitud:'este instante no se repite. por eso florece.'
};
const FIN = 'llévala al bosque. seguirá creciendo cuando la tira ya no exista.';
/* herbario de lecturas: una voz por etapa, en paráfrasis propia («a partir de») */
const HERBARIO = [
  { etapas:['semilla'], autor:'Emanuele Coccia', obra:'La vida de las plantas', linea:'la semilla es una vida que espera: guarda el mundo entero plegado hasta encontrar su momento.' },
  { etapas:['raíz'], autor:'Dōgen', obra:'Uji (ser-tiempo)', linea:'el tiempo no pasa junto a las cosas: cada cosa es su tiempo. este instante está completo.' },
  { etapas:['brote', 'tallo'], autor:'Goethe', obra:'La metamorfosis de las plantas', linea:'toda la planta es una sola forma que se transforma: la hoja se vuelve tallo, cáliz, pétalo y semilla.' },
  { etapas:['ramas'], autor:'Jorge Luis Borges', obra:'El jardín de senderos que se bifurcan', linea:'el tiempo se bifurca hacia innumerables futuros; cada rama es uno de ellos.' },
  { etapas:['hojas'], autor:'Roland Barthes', obra:'La cámara lúcida', linea:'una fotografía no cuenta lo que fue: certifica que fue. el minuto de tu retrato es único y ya pasó; por eso queda.' },
  { etapas:['flor', 'follaje', 'yemas', 'plenitud'], autor:'Carl Gustav Jung', obra:'prólogo al I Ching de Richard Wilhelm', linea:'lo que nace en un momento lleva la cualidad de ese momento. el hexagrama no predice: retrata el instante.' }
];
const lecturaDe = st => HERBARIO.find(h => h.etapas.includes(st)) || null;

/* ---------------- escena ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas:$('#gl'), antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0x050505, 1);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(40, 1, 1, 5000);
const marker = new THREE.Group(); marker.matrixAutoUpdate = false; scene.add(marker);
const garden = new THREE.Group(); scene.add(garden);
const holder = new THREE.Group();   // la planta: y hacia arriba, unidades en mm

/* fondo: la cámara (o la imagen de prueba) en blanco y negro, oscura y con grano; en el jardín, negro */
const bgScene = new THREE.Scene(), bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const bgMat = new THREE.ShaderMaterial({ depthTest:false, depthWrite:false,
  uniforms:{ tex:{value:null}, uOn:{value:0}, uVid:{value:new THREE.Vector2(1, 1)}, uScr:{value:new THREE.Vector2(1, 1)}, uT:{value:0} },
  vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader:`uniform sampler2D tex; uniform float uOn, uT; uniform vec2 uVid, uScr; varying vec2 vUv;
    float h(vec2 p){ vec3 q = fract(vec3(p.xyx)*.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y)*q.z); }
    void main(){
      float s = max(uScr.x/uVid.x, uScr.y/uVid.y); vec2 sz = uVid*s; vec2 p = (vUv*uScr - (uScr - sz)*.5)/sz;
      vec3 c = texture2D(tex, p).rgb; float l = dot(c, vec3(.299, .587, .114));
      l = smoothstep(.04, .96, l); l = pow(l, 1.2)*.4 + .012;
      l += (h(gl_FragCoord.xy + floor(uT*24.)*7.) - .5)*.05;
      gl_FragColor = vec4(vec3(l*uOn) + vec3(.02)*(1. - uOn), 1.);
    }` });
bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));

/* luz: bloom sobre la planta */
const composer = new EffectComposer(renderer);
const passBg = new RenderPass(bgScene, bgCam), passPlant = new RenderPass(scene, cam);
passPlant.clear = false; passPlant.clearDepth = true;
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 1.1, .55, .12);
composer.addPass(passBg); composer.addPass(passPlant); composer.addPass(bloom);

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
const matStem = irid({ span:.35, gain:1.1, rim:.4, h:.5 }), matHalo = irid({ span:.3, gain:.9, alpha:.13, rim:1, h:.5, off:.08 });
const matLeaf = irid({ span:.9, gain:.75, alpha:.38, rim:.85, off:.25 }), matBud = irid({ span:.2, gain:1.2, rim:.2, off:.5 });
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
const matPollen = dots(5, .75), matSpark = dots(18, .9);
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
  const gc = P.paletteRGB(Pal, .1); groundMat.color.setRGB(gc[0]*.3, gc[1]*.3, gc[2]*.3);
  matLeaf.uniforms.uSpan.value = .55 + Pal.span*.6; matStem.uniforms.uSpan.value = .25 + Pal.span*.25;
  // follajes densos: cada hoja brilla menos, para que la copa no se queme a blanco
  const nHojas = plant.leaves.length + plant.tips.filter(x => x.kind !== 'yema').length*(plant.P.petals*.6);
  const dens = Math.min(1, Math.pow(45/Math.max(45, nHojas), .85));
  matLeaf.blending = THREE.NormalBlending; matLeaf.needsUpdate = true;
  matLeaf.uniforms.uAlpha.value = .42 + .2*dens; matLeaf.uniforms.uGain.value = .95;
  matBud.uniforms.uGain.value = 1.2*(.55 + .45*dens);
  // muchos tallos en poco espacio: los halos se suman; se atenúan según cuántos tramos hay por volumen
  const bbA = P.plantBox(plant, 1, 0), vol = Math.max(.15, (bbA.x1 - bbA.x0)*(bbA.y1 - bbA.y0)), dT = Math.min(1, Math.pow(260*vol/Math.max(1, plant.segs.length), .8));
  matHalo.uniforms.uAlpha.value = .13*dT; matStem.uniforms.uGain.value = 1.1*(.65 + .35*dT); matStem.uniforms.uAlpha.value = Math.max(.3, Math.min(1, dT*1.6)); matBud.uniforms.uAlpha.value = Math.max(.35, Math.min(1, dT*1.8)); const nTip = Math.max(1, plant.tips.length); matSpark.uniforms.uSize.value = 18*Math.min(1, Math.sqrt(16/nTip)); matSpark.uniforms.uAlpha.value = .9*Math.min(1, Math.pow(20/nTip, .6));
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
  showInfo();
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
    const rr = Math.max(.22*mm, R*Math.pow(.68, g.d)); rod(g.a, b, rr*4.2, mHalo, n); rod(g.a, b, rr, mSeg, n++); }
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
  for (let li=0; li<plant.leaves.length; li+=5){ const l = plant.leaves[li]; if (l.t + .06 >= age || l.coty) continue; const g = clamp((age - l.t)/.08); sp.setXYZ(ns++, l.p[0] + l.d[0]*l.s*g, l.p[1] + l.d[1]*l.s*g, l.p[2] + l.d[2]*l.s*g); }
  spark.geometry.setDrawRange(0, ns); sp.needsUpdate = true;
}


/* ---------------- información ---------------- */
function fmtMinute(m){ if (m == null) return '—'; const t = P.minuteToDate(m), p = n => String(n).padStart(2, '0'); return `${p(t.getDate())}.${p(t.getMonth()+1)}.${t.getFullYear()} · ${p(t.getHours())}:${p(t.getMinutes())}`; }
const nice = c => c.slice(0,4) + ' ' + c.slice(4,8) + ' ' + c.slice(8);
function showInfo(){
  $('#iCode').textContent = $('#hCode').textContent = nice(seed.code);
  $('#iBorn').textContent = fmtMinute(seed.minute);
  $('#iDays').textContent = Math.floor(daysOld);
  const hx = $('#iHex'); hx.innerHTML = '';
  for (let i=5;i>=0;i--){ const r = document.createElement('i'); r.className = hex.lines[i] ? 'y' : 'n'; hx.append(r); }
  $('#iHexN').textContent = `${hex.n} · ${hex.name}`;
  $('#gMarca').textContent = $('#vMarca').textContent = 'semilla nº ' + nice(seed.code);
}

/* ---------------- jardín (sin cámara) ---------------- */
let orbit = { az:0, el:.12, zoom:1, drag:null, auto:true }, fr = { h:30, d:200 };
const groundMat = new THREE.LineBasicMaterial({ color:0x2a2a2a, transparent:true, opacity:.8 });
const ground = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:96}, (_, i) => new THREE.Vector3(Math.cos(i/96*Math.PI*2)*40, 0, Math.sin(i/96*Math.PI*2)*40))), groundMat);
garden.add(ground);
const gl = $('#gl');
gl.addEventListener('pointerdown', e => { if (mode !== 'jardin') return; orbit.drag = { x:e.clientX, y:e.clientY, az:orbit.az, el:orbit.el }; orbit.auto = false; gl.setPointerCapture(e.pointerId); });
gl.addEventListener('pointermove', e => { const d = orbit.drag; if (!d) return; orbit.az = d.az - (e.clientX - d.x)*.008; orbit.el = clamp(d.el + (e.clientY - d.y)*.005, -.2, 1.2); });
gl.addEventListener('pointerup', () => orbit.drag = null); gl.addEventListener('pointercancel', () => orbit.drag = null);
gl.addEventListener('wheel', e => { orbit.zoom = clamp(orbit.zoom*(1 + e.deltaY*.001), .4, 3); }, { passive:true });

/* ---------------- germinar: la luz se junta y la planta crece ---------------- */
const tl = { state:'idle', t0:0, verso:'' };
function germinar(now = performance.now()){ if (seed.code !== DEMO) recordar(seed.code, seed.minute); M.preparar(P.decode(seed.code), hex.n, plant); M.empezar(); tl.state = 'gather'; tl.t0 = now; ageShown = 0; setVerso(''); $('#vFin').hidden = true; document.body.classList.remove('fin'); }
function setVerso(t, lec){ if (tl.verso === t) return; tl.verso = t; const v = $('#verso'), l = $('#lectura'); v.classList.remove('ve'); l.classList.remove('ve'); clearTimeout(setVerso.k);
  setVerso.k = setTimeout(() => { v.textContent = t; if (t) v.classList.add('ve');
    if (lec){ l.innerHTML = `${lec.linea}<span>a partir de ${lec.autor}, <i>${lec.obra}</i></span>`; l.classList.add('ve'); } }, t ? 700 : 0); }
const ease = x => x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2;
/* luz que se junta: puntos que caen hacia la semilla antes de que nazca la raíz */
const NG = 90, gGeo = new THREE.BufferGeometry(), gPos = new Float32Array(NG*3), gFrom = [];
for (let i=0;i<NG;i++){ const a = Math.random()*6.283, r = .25 + Math.random()*.6, y = Math.random()*.9; gFrom.push([Math.cos(a)*r, y, Math.sin(a)*r]); }
gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3)); gGeo.setAttribute('aK', new THREE.BufferAttribute(Float32Array.from({length:NG}, () => Math.random()), 1));
const gather = new THREE.Points(gGeo, dots(9, 1)); gather.frustumCulled = false; gather.renderOrder = 7; MATS.push(gather.material);

/* ---------------- AR: cámara + QR ---------------- */
let mode = 'jardin', video = null, stream = null, work = null, wctx = null, lastSeen = 0, frameN = 0, hfov = 62, seen = false;
const pose3 = { has:false, q:new THREE.Quaternion(), t:new THREE.Vector3() };
let testSrc = null, vidTex = null;

async function startAR(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ msg('Este navegador no da la cámara aquí. Abre el enlace en Safari o Chrome.', 5000); return false; }
  try { stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } } }); }
  catch(e){ msg(e && e.name === 'NotAllowedError' ? 'Sin permiso para la cámara: la verás sin la tira.' : 'La cámara no está disponible: la verás sin la tira.', 4500); return false; }
  video = $('#video'); video.srcObject = stream; await video.play().catch(() => {});
  if (vidTex) vidTex.dispose(); vidTex = new THREE.VideoTexture(video); bgMat.uniforms.tex.value = vidTex;
  setMode('ar'); return true;
}
function stopAR(){ if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; if (video) video.srcObject = null; testSrc = null; setMode('jardin'); }
function setMode(m){
  mode = m; document.body.dataset.mode = m; $('#bModo').textContent = m === 'ar' ? 'verla sin la tira' : 'sobre la tira';
  if (m === 'ar'){ marker.add(holder); holder.rotation.set(-Math.PI/2, 0, 0); pose3.has = false; seen = false; $('#hint').hidden = false; bloom.threshold = .5; bloom.strength = .55; bloom.radius = .4; }
  else { garden.add(holder); holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0); $('#hint').hidden = true; bloom.threshold = .5; bloom.strength = .5; bloom.radius = .35; }
  holder.add(gather);
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
  bgMat.uniforms.uVid.value.set(vw, vh);
  const W = innerWidth, Hh = innerHeight, s = Math.max(W/vw, Hh/vh), ox = (W - vw*s)/2, oy = (Hh - vh*s)/2;
  const k = Math.min(1, 720/Math.max(vw, vh)), ww = Math.round(vw*k), wh = Math.round(vh*k);
  if (!work){ work = document.createElement('canvas'); wctx = work.getContext('2d', { willReadFrequently:true }); }
  if (work.width !== ww || work.height !== wh){ work.width = ww; work.height = wh; }
  wctx.drawImage(src, 0, 0, ww, wh);
  const img = wctx.getImageData(0, 0, ww, wh), q = jsQR(img.data, ww, wh, { inversionAttempts:'dontInvert' });
  if (!q || !q.location){ if (now - lastSeen > 700) pose3.has = false; return; }
  const got = P.parseURL(q.data);
  if (got && got.code !== seed.code){ seed = got; build(); germinar(now); msg('otra semilla: ' + got.code.slice(0,4)); }
  const n = 17 + 4*q.version, A = P.anchorMM(n), side = A.side, L = q.location;
  const toScr = p => [p.x/k*s + ox, p.y/k*s + oy];
  const dst = [L.topLeftCorner, L.topRightCorner, L.bottomRightCorner, L.bottomLeftCorner].map(toScr);
  const H = homography([[0,0],[side,0],[side,side],[0,side]], dst); if (!H) return;
  const vlong = Math.max(vw, vh)*s, f = (vlong/2)/Math.tan(hfov*Math.PI/360);
  const { R, t } = poseFromH(H, f, W/2, Hh/2);
  const m = new THREE.Matrix4().set(R[0][0], R[1][0], R[2][0], t[0], -R[0][1], -R[1][1], -R[2][1], -t[1], -R[0][2], -R[1][2], -R[2][2], -t[2], 0, 0, 0, 1);
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3(); m.decompose(pos, quat, sc);
  if (!pose3.has){ pose3.q.copy(quat); pose3.t.copy(pos); } else { pose3.q.slerp(quat, .45); pose3.t.lerp(pos, .45); }
  pose3.has = true; lastSeen = now;
  cam.fov = 2*Math.atan((Hh/2)/f)*180/Math.PI; cam.aspect = W/Hh; cam.updateProjectionMatrix();
  holder.position.set(A.x, A.y, 0);
  $('#hint').hidden = true;
  if (!seen){ seen = true; germinar(now); }
}

/* ---------------- bucle ---------------- */
function resize(){
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h);
  composer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); bloom.resolution.set(w/2, h/2);
  bgMat.uniforms.uScr.value.set(w, h); cam.aspect = w/h; cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
function frame(now){
  requestAnimationFrame(frame); const _last = frame.last; frame.last = now; if (_last === undefined) frame.last = now;
  if (document.body.dataset.crear) return;
  const ts = now/1000; for (const m of MATS) m.uniforms.uTime.value = ts; bgMat.uniforms.uT.value = ts;
  // línea de tiempo de la germinación
  let gk = 0;
  if (tl.state === 'idle') ageShown = 1;
  else if (tl.state === 'gather'){ gk = clamp((now - tl.t0)/GATHER); ageShown = 0; setVerso(VERSOS.semilla, lecturaDe('semilla')); if (gk >= 1){ tl.state = 'grow'; tl.t0 = now; } }
  else if (tl.state === 'grow'){ const k = clamp((now - tl.t0)/GROW); ageShown = ease(k)*.999 + .001; { const st = P.stage(ageShown, plant.P.orn); setVerso(VERSOS[st] || '', lecturaDe(st)); }
    M.crecer(ageShown);
    if (k >= 1){ tl.state = 'done'; tl.t0 = now; M.crecer(1); M.florecer(); } }
  else if (tl.state === 'done'){ ageShown = 1; M.reposo(Math.min(.1, (now - (_last || now))/1000)); if (now - tl.t0 > 3200){ setVerso(FIN); if ($('#vFin').hidden){ $('#vFin').hidden = false; document.body.classList.add('fin'); } } }
  $('#vAge').style.width = (ageShown*100).toFixed(1) + '%';
  pose(Math.max(.001, ageShown));
  // luz que se junta
  gather.visible = tl.state === 'gather' || (tl.state === 'grow' && now - tl.t0 < 1200);
  if (gather.visible){ const ga = gGeo.attributes.position, e = tl.state === 'gather' ? gk*gk : 1, r0 = .05/Math.max(.3, P.plantBox(plant, 1, 0).y1);
    for (let i=0;i<NG;i++){ const f = gFrom[i], w = Math.min(1, e*(1.1 + (i % 7)*.04)); ga.setXYZ(i, f[0]*(1 - w) + Math.sin(ts*2 + i)*r0*(1 - w), f[1]*(1 - w), f[2]*(1 - w)); }
    ga.needsUpdate = true; gather.material.uniforms.uAlpha.value = tl.state === 'gather' ? .3 + .7*gk : clamp(1 - (now - tl.t0)/1200); }
  // polen
  const pa = pollen.geometry.attributes.position, hgt = Math.max(.2, P.plantBox(plant, ageShown, 0).y1)*1.2;
  for (let i=0;i<pollenSeed.length;i++){ const s = pollenSeed[i], y = (s[1] + ts*.018*(.4 + s[3])) % hgt;
    pa.setXYZ(i, s[0] + Math.sin(ts*.5 + s[3]*20)*.03, y, s[2] + Math.cos(ts*.4 + s[3]*17)*.03); }
  pa.needsUpdate = true; matPollen.uniforms.uAlpha.value = clamp((ageShown - .5)*3)*.8;
  if (mode === 'jardin'){
    bgMat.uniforms.uOn.value = 0;
    if (orbit.auto) orbit.az += .0025;
    const bb = P.plantBox(plant, Math.max(.3, ageShown), 0), top = Math.max(.15, bb.y1)*unitMM, low = Math.min(0, bb.y0)*unitMM;
    const wid = Math.max(Math.abs(bb.x0), Math.abs(bb.x1), .1)*2*unitMM;
    const want = Math.max((top - low)*1.9, wid*1.5/(innerWidth/innerHeight))/Math.min(1, innerWidth/innerHeight*1.4);
    fr.h += ((top + low)/2 + 4 - fr.h)*.04; fr.d += (want - fr.d)*.04;
    ground.scale.setScalar(clamp(top/40, .35, 1.2));
    const d = fr.d*orbit.zoom; cam.fov = 40; cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix();
    cam.position.set(Math.sin(orbit.az)*Math.cos(orbit.el)*d, fr.h + Math.sin(orbit.el)*d, Math.cos(orbit.az)*Math.cos(orbit.el)*d);
    cam.lookAt(0, fr.h, 0); garden.visible = true; marker.visible = false;
  } else {
    bgMat.uniforms.uOn.value = Math.min(1, bgMat.uniforms.uOn.value + .03);
    cam.position.set(0, 0, 0); cam.quaternion.identity(); garden.visible = false;
    if ((frameN++ & 1) === 0 || testSrc) track(now);
    marker.visible = pose3.has; if (pose3.has){ marker.matrix.compose(pose3.t, pose3.q, new THREE.Vector3(1, 1, 1)); marker.matrixWorldNeedsUpdate = true; }
    if (!pose3.has && now - lastSeen > 1500) $('#hint').hidden = false;
  }
  composer.render();
}

/* ---------------- mis semillas: la memoria de este teléfono ---------------- */
const MIS_K = 'xinas.semillas';
function misLeer(){ try { return JSON.parse(localStorage.getItem(MIS_K) || '[]').filter(x => x && /^[0-9A-HJKMNP-TV-Z]{13}$/.test(x.s)); } catch(e){ return []; } }
function misGuardar(L){ try { localStorage.setItem(MIS_K, JSON.stringify(L.slice(-80))); } catch(e){} }
function recordar(s, t, extra){ if (s === DEMO) return; const L = misLeer(); let x = L.find(e => e.s === s); if (!x){ x = { s, t }; L.push(x); }
  Object.assign(x, extra || {}, { v:Date.now() }); misGuardar(L); $('#bMis').hidden = false; }
function misPintar(){
  const L = misLeer().sort((a, b) => (b.v || 0) - (a.v || 0)), ul = $('#misLista'); ul.innerHTML = '';
  if (!L.length){ ul.innerHTML = '<li class="sub">todavía no hay semillas en este teléfono.</li>'; return; }
  for (const x of L){
    const b = P.decode(x.s); if (!b) continue; const pl = P.grow(b), hx = P.hexagram(pl.f), pal = P.palette(b);
    const li = document.createElement('li'), cv = document.createElement('canvas'); cv.width = 96; cv.height = 96; cv.className = 'mini';
    const c = cv.getContext('2d'), bb = P.plantBox(pl, 1, 0), sc = Math.min(84/Math.max(.3, bb.y1), 40/Math.max(.1, -bb.x0, bb.x1));
    c.fillStyle = '#050505'; c.fillRect(0, 0, 96, 96); c.globalCompositeOperation = 'lighter';
    for (let k=0;k<3;k++){ const col = P.paletteRGB(pal, .15 + k*.25).map(v => Math.round(v*255)); c.globalAlpha = .85; P.drawPlant(c, pl, 1, { ox:48, oy:91, s:sc, rot:k*.35, col:`rgb(${col})`, lw:1.2, min:1, dimRoots:0, fillLeaves:k === 2 }); }
    const d = document.createElement('div'); d.className = 'misd';
    d.innerHTML = `<b>${nice(x.s)}</b><span>${fmtMinute(x.t)}</span><span>${hx.n} · ${hx.name}${x.sem ? ' · sembrada' : ''}</span>`;
    const a = document.createElement('div'); a.className = 'misa';
    const g = document.createElement('button'); g.className = 'liga'; g.textContent = 'germinar'; g.onclick = () => { $('#cMis').hidden = true; setSeed(x.s, x.t, true); capa('#cGermina'); };
    const e = document.createElement('button'); e.className = 'liga'; e.textContent = 'verla en Endeles'; e.onclick = () => irAlBosque(x.s, x.t, false);
    a.append(g, e); li.append(cv, d, a); ul.append(li);
  }
}

/* ---------------- capas ---------------- */
function msg(t, ms=2400){ const m = $('#msg'); m.textContent = t; m.hidden = false; clearTimeout(msg.t); msg.t = setTimeout(() => m.hidden = true, ms); }
const CAPAS = ['#cUmbral', '#cLectura', '#cImprime', '#cGermina', '#cQue'];
function capa(id){ for (const c of CAPAS) $(c).hidden = c !== id; $('#vivo').hidden = id !== null; }
function vivo(){ for (const c of CAPAS) $(c).hidden = true; $('#vivo').hidden = false; }
/* el acento de la interfaz es el color de la planta: la interfaz se tiñe del instante */
function acento(code){
  const b = P.decode(code); if (!b) return; const pal = P.palette(b);
  let [r, g, bl] = P.paletteRGB(pal, .3); const mx = Math.max(r, g, bl, .01), k = .92/mx; r *= k; g *= k; bl *= k;   // lo más luminoso posible
  const c = v => Math.round(Math.min(1, v)*255), ink = v => Math.round(Math.min(1, v*.55 + .45)*255);
  const st = document.documentElement.style;
  st.setProperty('--semilla', `rgb(${c(r)},${c(g)},${c(bl)})`); st.setProperty('--semilla-ink', `rgb(${ink(r)},${ink(g)},${ink(bl)})`);
  st.setProperty('--semilla-bg', `rgba(${c(r)},${c(g)},${c(bl)},.14)`);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = '#050505';
}
function setSeed(code, minute, real){
  seed = { code, minute }; build(); acento(code);
  if (real) try { if (location.protocol === 'https:') history.replaceState(null, '', location.pathname + '?s=' + code + '&t=' + minute.toString(36)); } catch(e){}
}

/* crear: abre la cámara del teléfono (y pide la ubicación aproximada, si se permite) */
let geoP = null;
function pedirLugar(){
  const X = window.XINAS; if (!X || !navigator.geolocation) return Promise.resolve();
  if (X.state.lat != null) return Promise.resolve();
  return new Promise(res => navigator.geolocation.getCurrentPosition(p => { X.state.lat = Math.round(p.coords.latitude*100)/100; X.state.lon = Math.round(p.coords.longitude*100)/100; res(); },
    () => res(), { enableHighAccuracy:false, timeout:8000, maximumAge:600000 }));
}
function crearSemilla(){ M.callar(1); if (mode === 'ar') stopAR(); $('#fCam').click(); geoP = pedirLugar(); }
$('#fCam').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  await Promise.race([geoP || Promise.resolve(), new Promise(r => setTimeout(r, 2500))]);
  try { await window.XINAS.loadFile(f, true); lectura(); } catch(err){ msg('No se pudo abrir esa imagen.'); }
};

/* lectura del instante: la tira aparece, los números de la luz se juntan, el hexagrama se forma */
let lectT = [];
function lectura(){
  const X = window.XINAS, G = X.compute(), S = X.state; lectT.forEach(clearTimeout); lectT = [];
  capa('#cLectura');
  const cv = $('#lTira'), cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(G.tira, 0, 0); cv.classList.remove('ve');
  const w = P.minuteToDate(G.minute), p = n => String(n).padStart(2, '0'), f = G.f;
  const filas = [['brillo', Math.round(f.b*100)], ['contraste', Math.round(f.c*100)], ['bordes', Math.round(f.e*100)], ['ángulo', Math.round(f.a*180) + '°'],
    ['peso', `${Math.round(f.x*100)} · ${Math.round(f.y*100)}`], ['instante', `${p(w.getDate())}.${p(w.getMonth()+1)}.${w.getFullYear()} · ${p(w.getHours())}:${p(w.getMinutes())}`],
    ['lugar', (S.place || '').trim() || (S.lat != null ? `${S.lat.toFixed(2)}, ${S.lon.toFixed(2)}` : 'sin ubicación')]];
  const dl = $('#lDatos'); dl.innerHTML = filas.map(([k, v]) => `<dt class="ap">${k}</dt><dd class="ap">${v}</dd>`).join('');
  const hx = P.hexagram(f), hg = $('#lHex'); hg.innerHTML = ''; for (let i=5;i>=0;i--){ const r = document.createElement('i'); r.className = hx.lines[i] ? 'y' : 'n'; r.dataset.i = i; hg.append(r); }
  $('#lCodigo').textContent = '';
  const at = (ms, fn) => lectT.push(setTimeout(fn, ms));
  at(150, () => cv.classList.add('ve'));
  dl.querySelectorAll('dt').forEach((dt, i) => at(700 + i*260, () => { dt.classList.add('ve'); dt.nextElementSibling.classList.add('ve'); }));
  for (let i=0;i<6;i++) at(2700 + i*300, () => hg.querySelector(`[data-i="${i}"]`).classList.add('ve'));
  const code = nice(G.code); for (let i=0;i<=code.length;i++) at(4700 + i*70, () => $('#lCodigo').textContent = code.slice(0, i));
  at(4700 + code.length*70 + 200, () => { $('#lCodigo').textContent = code + '   ·   ' + hx.n + ' ' + hx.name; });
  X.prepareBlob();
  setSeed(G.code, G.minute, false);
}
$('#bSemilla').onclick = crearSemilla; $('#bOtra').onclick = crearSemilla;
$('#bCrear').onclick = () => { stopAR(); tl.state = 'idle'; crearSemilla(); capa('#cUmbral'); };
$('#bAfinar').onclick = () => window.XINAS.open();
$('#bAfinar0').onclick = () => window.XINAS.open();
$('#bGuardar').onclick = async () => { const ok = await window.XINAS.saveTira(); $('#iNom').textContent = `xinas-${window.XINAS.compute().code}.png`; if (ok !== false) capa('#cImprime'); };
$('#bReguardar').onclick = () => window.XINAS.saveTira();
function aGerminar(){ const G = window.XINAS.compute(); setSeed(G.code, G.minute, true); capa('#cGermina'); }
$('#bImpresa').onclick = aGerminar; $('#bSaltar').onclick = aGerminar;
$('#bMuestra').onclick = () => { M.callar(.5); stopAR(); setSeed(DEMO, P.minuteIndex(Date.now()) - 9*1440, false); capa('#cGermina'); };

/* germina */
$('#bGerminar').onclick = async () => { M.asegurar(); vivo(); const ok = await startAR(); if (!ok){ setMode('jardin'); germinar(); } };
$('#bSinTira').onclick = () => { M.asegurar(); vivo(); stopAR(); germinar(); };
$('#bRe').onclick = () => { M.asegurar(); M.callar(.6); germinar(); };
$('#bModo').onclick = async () => { M.asegurar(); M.callar(.6); if (mode === 'ar'){ stopAR(); germinar(); } else { const ok = await startAR(); if (!ok) germinar(); } };
$('#bSon').onclick = () => { M.asegurar(); const on = M.alternar(); $('#bSon').textContent = on ? 'sonido' : 'sin sonido'; $('#bSon').setAttribute('aria-pressed', String(on)); };
document.addEventListener('visibilitychange', () => { if (document.hidden) M.callar(.3); });
$('#bInfo').onclick = () => $('#wInfo').hidden = !$('#wInfo').hidden; $('#xInfo').onclick = () => $('#wInfo').hidden = true;
$('#sFov').oninput = e => { hfov = +e.target.value; $('#oFov').textContent = hfov + '°'; e.target.style.setProperty('--p', ((hfov - 40)/50*100) + '%'); };
$('#herbario').innerHTML = HERBARIO.map(h => `<p>${h.linea}<span>a partir de ${h.autor}, <i>${h.obra}</i> · ${h.etapas[0]}</span></p>`).join('');
for (const b of ['#bQue1', '#bQue2']) $(b).onclick = () => { $('#cQue').hidden = false; };
$('#xQue').onclick = () => { $('#cQue').hidden = true; };

/* sembrar en Endeles: solo viajan el número de la semilla y su minuto */
async function irAlBosque(code, minute, sembrar){
  const body = JSON.stringify({ s:code, t:minute });
  let base = ENDELES, ok = false;
  // nota para Endeles en este teléfono: si el servidor recorta el enlace, la semilla igual llega
  try { localStorage.setItem('xinas.llegada', JSON.stringify({ s:code, t:minute, en:Date.now() })); } catch(e){}
  if (sembrar){
    /* la carpeta puede llamarse endeles o Endeles: se usa la que responda */
    const cands = [ENDELES, ENDELES.replace('/endeles/', '/Endeles/')].filter((v, i, a) => a.indexOf(v) === i);
    for (const c of cands){
      try { const r = await Promise.race([fetch(c + 'semillas.php', { method:'POST', headers:{ 'Content-Type':'application/json' }, body }), new Promise((_, rj) => setTimeout(rj, 6000))]);
        if (r && r.status !== 404){ base = c; try { const j = await r.json(); ok = !!(j && j.ok); } catch(e){} break; } } catch(e){}
    }
    recordar(code, minute, { sem:true, enServidor:ok });
  }
  const q = 's=' + code + '&t=' + minute.toString(36);
  location.href = base + '?' + q + '#' + q;
}
$('#bSembrar').onclick = async () => {
  const b = $('#bSembrar'); b.disabled = true; b.textContent = 'sembrando…'; M.callar(1.2);
  await irAlBosque(seed.code, seed.minute, true);
  setTimeout(() => { b.disabled = false; b.textContent = 'sembrar en Endeles'; }, 4000);
};
$('#bMis').onclick = $('#bMis2').onclick = () => { misPintar(); $('#cMis').hidden = false; };
$('#xMis').onclick = () => { $('#cMis').hidden = true; };
$('#bMis').hidden = !misLeer().length;
addEventListener('keydown', e => { if (document.body.dataset.crear || e.target.matches('input')) return;
  if (e.key === 'h') document.body.classList.toggle('hide'); else if (e.key === ' '){ e.preventDefault(); germinar(); } });
$('#restore').onclick = () => document.body.classList.remove('hide');

/* prueba sin cámara: VISOR.test(imagen) usa una imagen fija como si fuera el video */
window.CAPAS = { lectura, capa, germinar };
window.VISOR = { VER, test(img){ testSrc = img; const t = new THREE.Texture(img); t.needsUpdate = true; bgMat.uniforms.tex.value = t; vivo(); setMode('ar'); },
  get partes(){ return { mSeg, mHalo, mLeaf, mBall, spark, pollen, bloom, ground }; }, get pose(){ return pose3; }, get seed(){ return seed; }, get tl(){ return tl; }, germinar, ENDELES };

/* entrada: con semilla en el enlace → germina; sin ella → el umbral, con una planta de muestra detrás */
build(); acento(seed.code); setMode('jardin');
if (fromLink) capa('#cGermina'); else capa('#cUmbral');
requestAnimationFrame(frame);

/* app instalable: guarda la copia para abrir sin conexión (solo en https, en su propio sitio) */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
