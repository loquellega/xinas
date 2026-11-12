/* Xinas · música de la germinación
   La partitura es la planta: cada rama que nace es una nota pulsada, cada hoja una campana,
   cada flor un acorde; debajo, un pedal que se abre conforme la planta crece.
   Todo sale de la semilla (tónica, escala, pulso), así que una semilla siempre suena igual.
   Web Audio, sin archivos. Colección Alchemy of Meaning · Héctor Cruz Juárez · GPL-3.0 */

const ESCALAS = [
  [0, 2, 4, 7, 9],            // pentatónica mayor
  [0, 3, 5, 7, 10],           // pentatónica menor
  [0, 2, 3, 7, 8],            // hirajoshi
  [0, 1, 5, 7, 10],           // in-sen
  [0, 2, 4, 6, 7, 9, 11],     // lidio
  [0, 2, 3, 5, 7, 9, 10]      // dórico
];

export function musica(){
  let cola = [], ctx = null, out, rev, wet, dly, fb, pad = [], padF, padG, on = true, cfg = null, ev = [], ei = 0, slot = 0, prevAge = 0, idleT = 0;

  function impulso(seg){
    const n = Math.floor(ctx.sampleRate*seg), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c=0;c<2;c++){ const d = b.getChannelData(c); for (let i=0;i<n;i++) d[i] = (Math.random()*2 - 1)*Math.pow(1 - i/n, 2.6); }
    return b;
  }
  function asegurar(){
    if (ctx){ if (ctx.state !== 'running') ctx.resume().catch(() => {}); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    out = ctx.createGain(); out.gain.value = on ? .9 : 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    rev = ctx.createConvolver(); rev.buffer = impulso(4.2); wet = ctx.createGain(); wet.gain.value = .55;
    dly = ctx.createDelay(1.5); fb = ctx.createGain(); fb.gain.value = .32; const dg = ctx.createGain(); dg.gain.value = .22;
    dly.connect(fb); fb.connect(dly); dly.connect(dg); dg.connect(rev);
    rev.connect(wet); wet.connect(out); out.connect(comp); comp.connect(ctx.destination);
    // en iOS, un buffer mudo al primer toque desbloquea el audio
    const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
    return true;
  }
  const hz = semi => cfg.root*Math.pow(2, semi/12);
  function grado(i){ const e = cfg.esc, o = Math.floor(i/e.length), k = ((i % e.length) + e.length) % e.length; return e[k] + 12*o; }

  /* una voz: seno con armónicos suaves y caída exponencial; va seca, al eco y a la reverb */
  function voz(f, t, dur, vol, pan, tipo){
    const g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o1.type = 'sine'; o1.frequency.value = f;
    o2.type = tipo === 'campana' ? 'sine' : 'triangle'; o2.frequency.value = f*(tipo === 'campana' ? 2.76 : 2.001); g2.gain.value = tipo === 'campana' ? .35 : .12;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (tipo === 'acorde' ? .08 : .006)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o1.connect(g); o2.connect(g2); g2.connect(g);
    let n = g; if (p){ p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); n = p; }
    n.connect(out); n.connect(rev); n.connect(dly);
    o1.start(t); o2.start(t); o1.stop(t + dur + .05); o2.stop(t + dur + .05);
  }

  /* pedal: tónica y quinta, desafinadas, con un filtro que se abre con la edad de la planta */
  function pedalOn(){
    pedalOff(0);
    padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 180; padF.Q.value = .7;
    padG = ctx.createGain(); padG.gain.value = 0; padF.connect(padG); padG.connect(out); padG.connect(rev);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = 60; lfo.connect(lg); lg.connect(padF.frequency); lfo.start();
    pad = [lfo];
    for (const [s, d, ty] of [[-12, -4, 'sawtooth'], [-12, 5, 'sawtooth'], [-5, 2, 'triangle'], [0, -3, 'sine']]){
      const o = ctx.createOscillator(); o.type = ty; o.frequency.value = hz(s); o.detune.value = d; const g = ctx.createGain(); g.gain.value = ty === 'sawtooth' ? .05 : .09;
      o.connect(g); g.connect(padF); o.start(); pad.push(o);
    }
  }
  function pedalOff(fade = 2.5){
    if (!pad.length) return; const t = ctx.currentTime, ps = pad, g = padG;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => ps.forEach(o => { try { o.stop(); } catch(e){} }), fade*1000 + 200); pad = [];
  }

  return {
    get activo(){ return on; },
    /* prepara la semilla: la tónica, la escala y el pulso salen del código y del hexagrama */
    preparar(bytes, hexN, plant){
      if (!asegurar()) return;
      const roots = [110, 116.54, 123.47, 130.81, 138.59, 146.83, 155.56, 164.81, 174.61, 185, 196, 207.65];
      cfg = { root:roots[bytes[3] % 12], esc:ESCALAS[hexN % ESCALAS.length], beat:60/(58 + (bytes[1] % 32)) };
      // la partitura: ramas, hojas y remates en el orden en que aparecen
      const top = Math.max(.3, plant.segs.reduce((m, s) => Math.max(m, s.b[1]), 0)), xs = plant.segs.reduce((m, s) => Math.max(m, Math.abs(s.b[0])), .2);
      ev = [];
      plant.segs.forEach((s, i) => { if (i % 6 === 0) ev.push({ t:s.t0, k:'rama', y:s.a[1]/top, d:s.d, x:s.a[0]/xs }); });
      plant.leaves.forEach(l => ev.push({ t:l.t, k:'hoja', y:l.p[1]/top, x:l.p[0]/xs }));
      plant.tips.forEach(t => ev.push({ t:t.t, k:t.kind === 'flor' ? 'flor' : 'yema', y:t.p[1]/top, x:t.p[0]/xs }));
      ev.sort((a, b) => a.t - b.t); ei = 0; prevAge = 0; cola = [];
    },
    /* empieza la germinación: la luz que se junta suena como un brillo que sube */
    empezar(){
      if (!asegurar() || !cfg) return; ei = 0; prevAge = 0; cola = []; slot = ctx.currentTime + 3; idleT = 0;
      pedalOn(); const t = ctx.currentTime;
      padG.gain.setValueAtTime(0, t); padG.gain.linearRampToValueAtTime(.55, t + 3);
      for (let i=0;i<9;i++) voz(hz(24 + grado(i)), t + .25 + i*.28, 2.2, .035 + i*.004, Math.sin(i*1.7)*.6, 'campana');
    },
    /* cada cuadro: dispara los sucesos de la planta, cuantizados al pulso, sin amontonarse */
    crecer(age){
      if (!ctx || !cfg || !pad.length) return;
      const now = ctx.currentTime, b8 = cfg.beat/2;
      padF.frequency.setTargetAtTime(180 + age*age*2600, now, .4);
      // los sucesos que ya nacieron entran a una cola; la cola suena al pulso (corcheas; las hojas, a semicorcheas)
      while (ei < ev.length && ev[ei].t <= age){ const e = ev[ei++]; if (e.t >= prevAge - .001) cola.push(e); }
      if (cola.length > 10) cola.splice(0, cola.length - 10);
      if (slot < now) slot = now + .03;
      while (cola.length && slot < now + .3){
        const e = cola.shift(), deg = Math.round(e.y*8) + (e.d || 0);
        if (e.k === 'rama') voz(hz(grado(deg) + 12), slot, 1.6 + Math.random()*.6, .1 - Math.min(.05, (e.d || 0)*.01), e.x*.7);
        else if (e.k === 'hoja') voz(hz(grado(deg + 3) + 24), slot, 1.4, .045, e.x*.8, 'campana');
        else if (e.k === 'yema') voz(hz(grado(deg + 5) + 24), slot, 2.2, .05, e.x*.8, 'campana');
        else [0, 2, 4].forEach((k, j) => voz(hz(grado(deg + k) + 12), slot + j*.06, 4.5, .06, e.x*.6 + (j - 1)*.25, 'acorde'));
        slot += e.k === 'hoja' ? b8/2 : b8;
      }
      prevAge = age;
    },
    /* plenitud: un acorde largo; luego el pedal queda bajo y de vez en cuando suena una nota */
    florecer(){
      if (!ctx || !cfg) return; const t = ctx.currentTime + .1;
      [0, 2, 4, 7].forEach((k, j) => voz(hz(grado(k) + 12), t + j*.18, 6.5, .06, (j - 1.5)*.4, 'acorde'));
      if (padG){ padG.gain.cancelScheduledValues(t); padG.gain.setValueAtTime(padG.gain.value, t); padG.gain.linearRampToValueAtTime(.32, t + 5); }
    },
    reposo(dt){
      if (!ctx || !cfg || !pad.length) return; idleT += dt;
      if (idleT > 2.6 + Math.random()*3){ idleT = 0; voz(hz(grado(Math.floor(Math.random()*10)) + 12), ctx.currentTime + .05, 3.2, .035, Math.random()*1.2 - .6, 'campana'); }
    },
    callar(fade){ if (ctx && pad.length) pedalOff(fade); },
    alternar(){ on = !on; if (ctx){ const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(on ? .9 : 0, t, .15); if (on) ctx.resume().catch(() => {}); } return on; },
    asegurar
  };
}
