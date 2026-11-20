// preparar.js
// Corré esto primero: revisa tu versión de Node y genera el archivo de datos
// de la clase (datos/lecturas.csv, unas 3 millones de lecturas de sensores).
//
//   node preparar.js

const fs = require('node:fs');
const path = require('node:path');

const [mayor] = process.versions.node.split('.').map(Number);
if (mayor < 20) {
  console.log(`Tenés Node ${process.versions.node}. Hace falta 20 o más (ideal 22).`);
  process.exit(1);
}
console.log(`Node ${process.versions.node}: bien.`);

const DESTINO = path.join(__dirname, 'datos', 'lecturas.csv');
const LINEAS = 3_000_000;
fs.mkdirSync(path.dirname(DESTINO), { recursive: true });

if (fs.existsSync(DESTINO) && fs.statSync(DESTINO).size > 50e6) {
  console.log('datos/lecturas.csv ya existe.');
  console.log('TODO OK');
  process.exit(0);
}

console.log(`Generando ${LINEAS.toLocaleString('es-AR')} lecturas... (unos segundos)`);

// Ojo: esto ya es un stream de escritura que respeta la contrapresión.
// Hoy vamos a entender por qué está escrito así.
const salida = fs.createWriteStream(DESTINO);
salida.write('fecha,sensor,temperatura\n');

let i = 0;
let semilla = 42;
function azar() { // pseudoaleatorio fijo: a todos les da el mismo archivo
  semilla = (semilla * 1103515245 + 12345) % 2147483648;
  return semilla / 2147483648;
}
const inicio = Date.UTC(2026, 10, 1);

function escribir() {
  let sigo = true;
  while (i < LINEAS && sigo) {
    const fecha = new Date(inicio + i * 1000).toISOString();
    const sensor = 'heladera-' + String(1 + Math.floor(azar() * 40)).padStart(2, '0');
    // casi siempre entre 2 y 7 grados; a veces se calienta
    let t = 2 + azar() * 5;
    if (azar() < 0.01) t = 8 + azar() * 6;
    salida.write(`${fecha},${sensor},${t.toFixed(2)}\n`) || (sigo = false);
    i++;
  }
  if (i < LINEAS) salida.once('drain', escribir);
  else salida.end();
}
salida.on('finish', () => {
  const mb = (fs.statSync(DESTINO).size / 1e6).toFixed(0);
  console.log(`Listo: datos/lecturas.csv (${mb} MB)`);
  console.log('TODO OK');
});
escribir();
