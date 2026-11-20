// PASO 3 — Esperar al que es lento
// Igual que el paso 2, más dos líneas:
//   si res.write() devuelve false ("estoy lleno"), cerramos la canilla (pause)
//   cuando la respuesta avisa 'drain' ("ya tengo lugar"), la abrimos (resume)
//
//   node servidor/paso3-esperar-al-lento.js

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ARCHIVO = path.join(__dirname, '..', 'datos', 'lecturas.csv');

http.createServer((req, res) => {
  if (req.url !== '/reporte') { res.statusCode = 404; return res.end(); }

  res.setHeader('Content-Type', 'text/csv');
  const archivo = fs.createReadStream(ARCHIVO);

  archivo.on('data', (pedazo) => {
    const hayLugar = res.write(pedazo);
    if (!hayLugar) {
      archivo.pause();                             // NUEVO: cierro la canilla
      res.once('drain', () => archivo.resume());   // NUEVO: la abro cuando hay lugar
    }
  });
  archivo.on('end', () => res.end());
}).listen(process.env.PORT || 3000, () => console.log('Paso 3 escuchando en http://localhost:' + (process.env.PORT || 3000) + '/reporte'));
