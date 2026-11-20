// laboratorio/subidas.js
//
// En clase mandamos un archivo grande al usuario. Ahora al revés: el usuario
// SUBE un CSV de lecturas y el servidor lo guarda en laboratorio/subidas/.
//
// Esta versión "anda" con archivos chicos. Tiene 4 defectos.
// Arreglala hasta que pasen los 5 tests:  npm run lab
//
// Pista grande: req (el pedido) es un stream, igual que el archivo de la clase.
//
// Para probar a mano:
//   node laboratorio/subidas.js
//   curl --data-binary @datos/lecturas.csv "http://localhost:3000/subir?nombre=prueba.csv"

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function crearServidor({ carpeta = path.join(__dirname, 'subidas') } = {}) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method !== 'POST' || url.pathname !== '/subir') { res.statusCode = 404; return res.end(); }

    const nombre = path.basename(url.searchParams.get('nombre') || 'sin-nombre.csv');
    const destino = path.join(carpeta, nombre);

    const partes = [];
    req.on('data', (pedazo) => partes.push(pedazo));
    req.on('end', () => {
      res.statusCode = 201;
      res.end('guardado');
      fs.writeFile(destino, Buffer.concat(partes), () => {});
    });
  });
}

module.exports = { crearServidor };

if (require.main === module) {
  fs.mkdirSync(path.join(__dirname, 'subidas'), { recursive: true });
  crearServidor().listen(3000, () => console.log('POST http://localhost:3000/subir?nombre=algo.csv'));
}
