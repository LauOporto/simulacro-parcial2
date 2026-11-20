// laboratorio/subidas.test.js — NO MODIFICAR
// Correr con: npm run lab

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const modulo = process.env.LAB_ARCHIVO ? path.resolve(process.env.LAB_ARCHIVO) : path.join(__dirname, 'subidas.js');
const { crearServidor } = require(modulo);

const LIMITE = { timeout: 8000 };
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const PEDAZO = Buffer.alloc(64 * 1024, 'a');   // siempre el mismo pedazo: el cliente no gasta memoria

async function levantar() {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-subidas-'));
  const srv = crearServidor({ carpeta });
  await new Promise((ok) => srv.listen(0, ok));
  return { srv, carpeta, puerto: srv.address().port };
}

// Sube `pedazos` pedazos de 64 KB. Si cortarEn es un número, corta la conexión en ese pedazo.
function subir(puerto, nombre, pedazos, cortarEn = null) {
  return new Promise((ok) => {
    let respuesta = null;
    let terminoDeMandar = false;
    const listo = () => { if (respuesta && terminoDeMandar) ok(respuesta); };
    const req = http.request({ port: puerto, method: 'POST', path: `/subir?nombre=${nombre}` }, (res) => {
      let s = '';
      res.on('data', (c) => (s += c));
      res.on('end', () => { respuesta = { status: res.statusCode, cuerpo: s }; listo(); });
    });
    req.on('finish', () => { terminoDeMandar = true; listo(); });
    req.on('close', () => { if (respuesta) ok(respuesta); });
    req.on('error', () => ok({ status: null }));
    let i = 0;
    (function escribir() {
      while (i < pedazos) {
        if (i === cortarEn) { req.destroy(); return setTimeout(() => ok({ status: 'cortado' }), 50); }
        i++;
        if (!req.write(PEDAZO)) return req.once('drain', escribir);
      }
      req.end();
    })();
  });
}

test('sube un archivo chico', LIMITE, async () => {
  const { srv, carpeta, puerto } = await levantar();
  const r = await subir(puerto, 'chico.csv', 2);
  await esperar(100);
  srv.close();
  assert.equal(r.status, 201);
  assert.equal(fs.statSync(path.join(carpeta, 'chico.csv')).size, 2 * PEDAZO.length);
});

test('cuando responde 201, el archivo ya está completo en el disco', LIMITE, async () => {
  const { srv, carpeta, puerto } = await levantar();
  const r = await subir(puerto, 'mediano.csv', 300);            // ~20 MB
  const archivo = path.join(carpeta, 'mediano.csv');
  const tamaño = fs.existsSync(archivo) ? fs.statSync(archivo).size : 0;
  srv.close();
  assert.equal(r.status, 201);
  assert.equal(tamaño, 300 * PEDAZO.length, 'respondió 201 pero el archivo no estaba completo');
});

test('no junta el archivo entero en memoria', LIMITE, async () => {
  const { srv, puerto } = await levantar();
  global.gc?.();
  const base = process.memoryUsage().arrayBuffers;
  let pico = 0;
  const reloj = setInterval(() => { pico = Math.max(pico, process.memoryUsage().arrayBuffers - base); }, 5);
  await subir(puerto, 'grande.csv', 1200);                       // ~80 MB
  await esperar(200);
  clearInterval(reloj);
  srv.close();
  assert.ok(pico < 30e6, `llegó a tener ${Math.round(pico / 1e6)} MB del archivo en memoria`);
});

test('si el usuario corta la subida a la mitad, no queda un archivo a medias', LIMITE, async () => {
  const { srv, carpeta, puerto } = await levantar();
  await subir(puerto, 'cortado.csv', 300, 150);
  await esperar(300);
  srv.close();
  assert.equal(fs.existsSync(path.join(carpeta, 'cortado.csv')), false, 'quedó un archivo incompleto');
});

test('si no se puede guardar, responde 500 y el servidor sigue andando', LIMITE, async () => {
  const { srv, carpeta, puerto } = await levantar();
  fs.rmSync(carpeta, { recursive: true });                        // la carpeta desaparece: el disco "falla"
  const r = await subir(puerto, 'imposible.csv', 2);
  fs.mkdirSync(carpeta);
  const r2 = await subir(puerto, 'despues.csv', 2);
  srv.close();
  assert.equal(r.status, 500);
  assert.equal(r2.status, 201, 'el servidor dejó de andar después del error');
});
