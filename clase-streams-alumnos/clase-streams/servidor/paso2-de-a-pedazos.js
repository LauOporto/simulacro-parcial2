// PASO 2 — De a pedazos
// En vez de leer todo, abrimos un stream: el archivo llega en pedazos de 64 KB
// y cada pedazo se manda apenas llega.
//
//   node servidor/paso2-de-a-pedazos.js

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ARCHIVO = path.join(__dirname, '..', 'datos', 'lecturas.csv');

http.createServer((req, res) => {
  if (req.url !== '/reporte') { res.statusCode = 404; return res.end(); }

  res.setHeader('Content-Type', 'text/csv');
  const archivo = fs.createReadStream(ARCHIVO);

  archivo.on('data', (pedazo) => {
    res.write(pedazo);                             // llega un pedazo, lo mando
  });
  archivo.on('end', () => res.end());              // no hay más pedazos: terminé
}).listen(process.env.PORT || 3000, () => console.log('Paso 2 escuchando en http://localhost:' + (process.env.PORT || 3000) + '/reporte'));
