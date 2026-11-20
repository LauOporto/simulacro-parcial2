// PASO 4 — pipeline
// Todo lo del paso 3 (y más) en una línea: pipeline conecta el archivo con la
// respuesta, espera al lento, y si algo falla o el usuario se va, cierra todo.
//
//   node servidor/paso4-pipeline.js

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');

const ARCHIVO = path.join(__dirname, '..', 'datos', 'lecturas.csv');

http.createServer((req, res) => {
  if (req.url !== '/reporte') { res.statusCode = 404; return res.end(); }

  res.setHeader('Content-Type', 'text/csv');
  pipeline(fs.createReadStream(ARCHIVO), res, (err) => {
    if (err) console.log('Se cortó el reporte:', err.code || err.message);
  });
}).listen(process.env.PORT || 3000, () => console.log('Paso 4 escuchando en http://localhost:' + (process.env.PORT || 3000) + '/reporte'));

// SI SOBRA TIEMPO: comprimir es agregar una pieza en el medio.
//   const zlib = require('node:zlib');
//   res.setHeader('Content-Encoding', 'gzip');
//   pipeline(fs.createReadStream(ARCHIVO), zlib.createGzip(), res, ...)
// ¿Cuánto pesa ahora lo que baja el usuario?
