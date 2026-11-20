// YA RESUELTO. Levanta la API en un puerto libre, le manda los camiones de datos/camiones.js
// como lo haría la balanza, y muestra qué respondió. Después pide el resumen de cada productor.
//   npm run cargar
const { crearApp } = require("../src/app");
const { firmar } = require("../comun/token");
const camiones = require("../datos/camiones");

const servidor = crearApp().listen(0, async () => {
  const base = `http://localhost:${servidor.address().port}`;
  const token = firmar({ sub: "balanza-1", rol: "operador" });
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  try {
    const filas = [];
    for (const { camion, cuerpo } of camiones) {
      const r = await fetch(`${base}/entregas`, { method: "POST", headers, body: cuerpo });
      const b = await r.json().catch(() => ({}));
      filas.push(r.ok
        ? { camion, status: r.status, id: b.id, productor: b.productor, kgSecos: b.kgSecos, kgFibra: b.kgFibra, importe: b.importe }
        : { camion, status: r.status, error: b.type?.split("/").at(-1), campo: b.campo });
    }
    console.log("\nEntregas recibidas");
    console.table(filas);

    console.log("\nResumen por productor");
    for (const productor of ["Benítez", "Kowalczuk", "Sotelo"]) {
      const r = await fetch(`${base}/entregas?productor=${encodeURIComponent(productor)}&limite=50`, { headers });
      const b = await r.json();
      console.log(productor.padEnd(10), r.status, JSON.stringify(b.total));
    }
  } catch (err) {
    console.error("El script falló (¿completaste la Parte 1?):", err.message);
  } finally {
    servidor.close();
    servidor.closeAllConnections();
  }
});
