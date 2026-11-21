"""Arma index.html (un solo archivo) desde src/.  Uso: npm install && python3 build.py"""
import pathlib, subprocess
R = pathlib.Path(__file__).parent; s = R/'src'; tmp = R/'dist'; tmp.mkdir(exist_ok=True)
subprocess.run([str(R/'node_modules/.bin/esbuild'), str(s/'visor.js'), '--bundle', '--format=iife', '--minify',
                '--legal-comments=none', '--outfile=' + str(tmp/'visor.bundle.js')], check=True)
h = (s/'xinas.html').read_text()
h = h.replace('/*FONT*/', (s/'font.css').read_text().strip(), 1)
import json
dic = ''.join(f"window.I18N=window.I18N||{{}};I18N.{k}={json.dumps(json.loads((s/'i18n'/(k+'.json')).read_text()), ensure_ascii=False)};\n" for k in ('en','fr'))
h = h.replace('/*IDIOMA*/', dic + (s/'idioma.js').read_text(), 1)
h = h.replace('/*PLANTA*/', (s/'planta.js').read_text(), 1)
h = h.replace('/*QR*/', (s/'qr.js').read_text(), 1)
h = h.replace('/*APP*/', (s/'app.js').read_text(), 1)
h = h.replace('/*VISOR*/', (tmp/'visor.bundle.js').read_text().replace('</script', '<\\/script'), 1)
(R/'index.html').write_text(h)
print('index.html', len(h), 'bytes')
