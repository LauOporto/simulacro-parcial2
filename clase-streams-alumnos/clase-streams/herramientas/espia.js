// herramientas/espia.js — NO hace falta leerlo.
// medir.js lo carga dentro del servidor para medir memoria y bytes leídos del disco,
// sin tocar el código del servidor.
const fs = require('node:fs');

let pico = 0;
let leidos = 0;
const streams = [];
setInterval(() => { pico = Math.max(pico, process.memoryUsage().rss); }, 5).unref();

const crearOriginal = fs.createReadStream;
fs.createReadStream = function (...args) {
  const s = crearOriginal.apply(this, args);
  streams.push(s);
  return s;
};
const readFileOriginal = fs.readFile;
fs.readFile = function (archivo, ...resto) {
  const cb = resto.pop();
  return readFileOriginal.call(this, archivo, ...resto, (err, datos) => {
    if (datos) leidos += datos.length;
    cb(err, datos);
  });
};

if (process.send) {
  process.on('message', () => {
    const enStreams = streams.reduce((s, x) => s + x.bytesRead, 0);
    process.send({ mb: Math.round(pico / 1e6), leidoMB: Math.round((leidos + enStreams) / 1e6), abiertos: streams.filter((x) => !x.destroyed).length });
  });
}
console.log = () => {};   // que el servidor no ensucie la salida de medir.js
