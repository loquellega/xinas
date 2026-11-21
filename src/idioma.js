/* idioma.js — español · English · français
   Colección Alchemy of Meaning · Héctor Cruz Juárez · GPL-3.0
   El español es el texto de origen: cada traducción se busca por la frase en español.
   Si falta una traducción se muestra el español (y se anota en IDIOMA.falta para revisarla). */
(function(){
  const LS = ['es', 'en', 'fr'], K = 'alquimia.idioma';
  const qs = new URLSearchParams(location.search).get('l'), hs = (location.hash.match(/[#&]l=([a-z]{2})/) || [])[1];
  let L = [qs, hs].find(x => LS.includes(x)) || null;
  if (L){ try { localStorage.setItem(K, L); } catch(e){} }
  if (!L){ try { L = localStorage.getItem(K); } catch(e){} if (!LS.includes(L)) L = null; }
  if (!L) L = (navigator.languages || [navigator.language || 'es']).map(x => String(x).slice(0, 2).toLowerCase()).find(x => LS.includes(x)) || 'es';
  const D = (window.I18N = window.I18N || {}), falta = new Set();
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const letras = /[a-záéíóúñü]{3}/i;
  function tr(s, v){
    let r = s;
    if (L !== 'es' && s != null){ const d = D[L] || {}, k = norm(s); if (k in d) r = d[k]; else if (letras.test(k)) falta.add(k); }
    if (v) r = String(r).replace(/\{(\w+)\}/g, (m, k) => v[k] != null ? v[k] : m);
    return r;
  }
  /* un «bloque» es un elemento cuyo contenido es solo texto y marcas en línea: se traduce entero */
  const EN_LINEA = new Set(['B','I','EM','STRONG','BR','A','SMALL','U','SUP','SUB','KBD','CODE','SPAN']);
  const SALTA = new Set(['SCRIPT','STYLE','CANVAS','VIDEO','TEXTAREA','INPUT','SELECT','svg','SVG','TEMPLATE']);
  const esBloque = el => [...el.children].every(c => EN_LINEA.has(c.tagName) && !c.id && esBloque(c));
  function aplicar(root){
    document.documentElement.lang = L;
    if (L === 'es') return;
    const d = D[L] || {};
    const ver = el => {
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.hasAttribute('data-no-i18n')) return;
      for (const a of ['placeholder', 'title', 'aria-label', 'alt']) if (el.hasAttribute(a)){
        const k = norm(el.getAttribute(a)); if (k in d) el.setAttribute(a, d[k]); else if (letras.test(k)) falta.add(k); }
      if (SALTA.has(el.tagName)) return;
      if (esBloque(el)){
        const k = norm(el.innerHTML); if (!k || !letras.test(el.textContent)) return;
        if (k in d) el.innerHTML = d[k]; else falta.add(k);
        return;
      }
      for (const n of el.childNodes){
        if (n.nodeType === 3){ const k = norm(n.nodeValue); if (!k || !letras.test(k)) continue;
          if (k in d) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), d[k]); else falta.add(k); }
        else if (n.nodeType === 1) ver(n);
      }
    };
    ver(root || document.body);
    const ti = norm(document.title); if (ti in d) document.title = d[ti];
    const md = document.querySelector('meta[name="description"]'); if (md){ const k = norm(md.content); if (k in d) md.content = d[k]; }
  }
  function cambiar(n){
    if (!LS.includes(n)) return;
    try { localStorage.setItem(K, n); } catch(e){}
    const u = new URL(location.href); u.searchParams.set('l', n); location.replace(u.href);
  }
  /* selector: pinta «es · en · fr» dentro de un elemento */
  function selector(el){
    if (!el) return;
    el.innerHTML = LS.map(x => `<button type="button" data-l="${x}" class="${x === L ? 'on' : ''}" aria-pressed="${x === L}">${x}</button>`).join('<span aria-hidden="true">·</span>');
    el.querySelectorAll('button').forEach(b => b.onclick = () => cambiar(b.dataset.l));
  }
  window.IDIOMA = { get L(){ return L; }, tr, aplicar, cambiar, selector, LS, falta, norm };
  window.tr = tr;
})();
