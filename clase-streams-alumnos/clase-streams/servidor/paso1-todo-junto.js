// PASO 1 — Todo junto
// Lo que haría cualquiera: leer el archivo y mandarlo.
//
//   node servidor/paso1-todo-junto.js      y abrí http://localhost:3000/reporte

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ARCHIVO = path.join(__dirname, '..', 'datos', 'lecturas.csv');

http.createServer((req, res) => {
  if (req.url !== '/reporte') { res.statusCode = 404; return res.end(); }

  fs.readFile(ARCHIVO, (err, contenido) => {      // carga los 126 MB en memoria
    if (err) { res.statusCode = 500; return res.end(); }
    res.setHeader('Content-Type', 'text/csv');
    res.end(contenido);                            // y recién ahí manda todo
  });
}).listen(process.env.PORT || 3000, () => console.log('Paso 1 escuchando en http://localhost:' + (process.env.PORT || 3000) + '/reporte'));
