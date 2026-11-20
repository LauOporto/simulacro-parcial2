// medir.js — levanta una versión del servidor y le manda usuarios.
//
//   node medir.js <paso> <usuarios>
//
//   <paso>      1, 2, 3 o 4
//   <usuarios>  rapidos   10 usuarios con buena conexión bajan el reporte entero
//               lentos     3 usuarios con mala conexión (1 MB/s) durante 4 segundos
//               cancelan  20 usuarios empiezan a bajar y cierran la pestaña enseguida
//
// Ejemplo: node medir.js 1 rapidos

const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { fork } = require('node:child_process');

const ARCHIVOS = {
  1: 'paso1-todo-junto.js',
  2: 'paso2-de-a-pedazos.js',
  3: 'paso3-esperar-al-lento.js',
  4: 'paso4-pipeline.js',
};
const [paso, escenario] = process.argv.slice(2);

if (!ARCHIVOS[paso] || !['rapidos', 'lentos', 'cancelan'].includes(escenario)) {
  console.log('Uso: node medir.js <1|2|3|4> <rapidos|lentos|cancelan>');
  process.exit(1);
}
if (!fs.existsSync(path.join(__dirname, 'datos', 'lecturas.csv'))) {
  console.log('Falta el archivo de datos. Corré primero: node preparar.js');
  process.exit(1);
}

function puertoLibre() {
  return new Promise((ok) => {
    const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function levantar(puerto) {
  const hijo = fork(path.join(__dirname, 'servidor', ARCHIVOS[paso]), [], {
    env: { ...process.env, PORT: String(puerto) },
    execArgv: ['--require', path.join(__dirname, 'herramientas', 'espia.js')],
  });
  for (let i = 0; i < 50; i++) {                         // esperamos a que escuche
    const anda = await new Promise((ok) => {
      const s = net.connect(puerto, () => { s.end(); ok(true); }).on('error', () => ok(false));
    });
    if (anda) return hijo;
    await esperar(100);
  }
  throw new Error('El servidor no arrancó');
}

function pedirDatosAlServidor(hijo) {
  return new Promise((ok) => { hijo.once('message', ok); hijo.send('?'); });
}

// Un usuario. velocidad: bytes por segundo (Infinity = buena conexión). cortarAlEmpezar: cierra la pestaña.
function usuario(puerto, { velocidad = Infinity, cortarAlEmpezar = false }) {
  return new Promise((ok) => {
    const t0 = performance.now();
    const r = { primerByte: null, bytes: 0, total: null };
    const req = http.get({ port: puerto, path: '/reporte', agent: false }, (res) => {
      let tramo = 0;
      res.on('data', (c) => {
        if (r.primerByte === null) r.primerByte = performance.now() - t0;
        r.bytes += c.length;
        if (cortarAlEmpezar) { req.destroy(); return ok(r); }
        tramo += c.length;
        if (velocidad !== Infinity && tramo >= 64 * 1024) {   // simula la mala conexión
          res.pause();
          setTimeout(() => res.resume(), (tramo / velocidad) * 1000);
          tramo = 0;
        }
      });
      res.on('end', () => { r.total = performance.now() - t0; ok(r); });
    });
    req.on('error', () => ok(r));
    r.cortar = () => req.destroy();
    usuario.ultimos.push(r);
  });
}
usuario.ultimos = [];

const mb = (b) => (b / 1e6).toFixed(1).replace('.', ',');

(async () => {
  const puerto = await puertoLibre();
  const hijo = await levantar(puerto);
  console.log(`Paso ${paso} (${ARCHIVOS[paso]}) con usuarios ${escenario}...\n`);

  if (escenario === 'rapidos') {
    const rs = await Promise.all(Array.from({ length: 10 }, () => usuario(puerto, {})));
    const s = await pedirDatosAlServidor(hijo);
    const prom = (k) => Math.round(rs.reduce((a, r) => a + r[k], 0) / rs.length);
    console.log(`  Memoria del servidor:           ${s.mb} MB`);
    console.log(`  Cada usuario recibió:           ${mb(rs[0].bytes)} MB`);
    console.log(`  Tardó en ver el primer dato:    ${prom('primerByte')} ms`);
    console.log(`  Tardó en tener todo:            ${prom('total')} ms`);
  }

  if (escenario === 'lentos') {
    Array.from({ length: 3 }, () => usuario(puerto, { velocidad: 1e6 }));
    await esperar(4000);
    const s = await pedirDatosAlServidor(hijo);
    const recibido = usuario.ultimos.reduce((a, r) => a + r.bytes, 0) / 3;
    usuario.ultimos.forEach((r) => r.cortar());
    console.log(`  Memoria del servidor:           ${s.mb} MB`);
    console.log(`  Cada usuario recibió:           ${mb(recibido)} MB (en 4 segundos)`);
    console.log(`  El servidor ya leyó del disco:  ${s.leidoMB} MB`);
  }

  if (escenario === 'cancelan') {
    const rs = await Promise.all(Array.from({ length: 20 }, () => usuario(puerto, { cortarAlEmpezar: true })));
    await esperar(2500);
    const s = await pedirDatosAlServidor(hijo);
    console.log(`  Recibieron entre todos:         ${mb(rs.reduce((a, r) => a + r.bytes, 0))} MB y se fueron`);
    console.log(`  El servidor leyó del disco:     ${s.leidoMB} MB`);
    console.log(`  Memoria del servidor:           ${s.mb} MB`);
    console.log(`  Archivos que quedaron abiertos: ${s.abiertos}`);
  }

  console.log('\n  (Node vacío usa unos 40 MB)');
  hijo.kill();
  process.exit(0);
})();
