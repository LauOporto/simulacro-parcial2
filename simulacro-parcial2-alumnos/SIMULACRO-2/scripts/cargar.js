// YA RESUELTO. Levanta la API en un puerto libre, le manda las cisternas de datos/cisternas.js
// como lo haría la balanza, y muestra qué respondió. Después pide el resumen de cada tambo.
//   npm run cargar
const { crearApp } = require("../src/app");
const { firmar } = require("../comun/token");
const cisternas = require("../datos/cisternas");

const servidor = crearApp().listen(0, async () => {
  const base = `http://localhost:${servidor.address().port}`;
  const token = firmar({ sub: "balanza-1", rol: "operador" });
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  try {
    const filas = [];
    for (const { cisterna, cuerpo } of cisternas) {
      const r = await fetch(`${base}/recepciones`, { method: "POST", headers, body: cuerpo });
      const b = await r.json().catch(() => ({}));
      filas.push(r.ok
        ? { cisterna, status: r.status, id: b.id, tambo: b.tambo, litrosEq: b.litrosEq, descuentoFrio: b.descuentoFrio, importe: b.importe }
        : { cisterna, status: r.status, error: b.type?.split("/").at(-1), campo: b.campo });
    }
    console.log("\nRecepciones registradas");
    console.table(filas);

    console.log("\nResumen por tambo");
    for (const tambo of ["Ledesma", "Márquez", "Pereyra"]) {
      const r = await fetch(`${base}/recepciones?tambo=${encodeURIComponent(tambo)}&limite=50`, { headers });
      const b = await r.json();
      console.log(tambo.padEnd(10), r.status, JSON.stringify(b.total));
    }
  } catch (err) {
    console.error("El script falló (¿completaste la Parte 1?):", err.message);
  } finally {
    servidor.close();
    servidor.closeAllConnections();
  }
});
