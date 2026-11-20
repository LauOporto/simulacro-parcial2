// node 02-bases/01-cuanto-cuesta.js
//
// Realtime Database cobra por bytes descargados. Firestore, por documento leído.
//
// PREDECÍ ANTES DE EJECUTAR
// a) "Las 10 últimas alertas de un sensor", entre 10.000 alertas. ¿Cuántos KB baja cada modelo?
// b) Un panel con 1000 lecturas chiquitas. ¿Cuál modelo cuesta más lecturas?
// c) Un solo documento de 500 KB. ¿Qué modelo lo nota?
const { RealtimeSim, FirestoreSim } = require("../comun/simuladores");
const kb = (b) => `${(b / 1024).toFixed(1)} KB`;

const alertas = Array.from({ length: 10000 }, (_, i) => ({
  id: `a${i}`, sensor: `S-${String(i % 50).padStart(2, "0")}`, temperatura: 8 + (i % 10), fecha: i,
  mensaje: "Temperatura fuera de rango en cámara de frío",
}));

console.log("a) Las 10 últimas alertas de S-07");
const rtdb = new RealtimeSim();
for (const a of alertas) {
  rtdb.escribir(`/alertas/${a.id}`, a);
  rtdb.escribir(`/porSensor/${a.sensor}/${a.id}`, a);
}
rtdb.bytes = 0;
const todas = rtdb.leer("/alertas");
Object.values(todas).filter((a) => a.sensor === "S-07").sort((x, y) => y.fecha - x.fecha).slice(0, 10);
console.log(`  Realtime, bajo todo y filtro en el cliente:  ${kb(rtdb.bytes)}`);
rtdb.bytes = 0;
const delSensor = rtdb.leer("/porSensor/S-07");
Object.values(delSensor).sort((x, y) => y.fecha - x.fecha).slice(0, 10);
console.log(`  Realtime, bajo solo la rama del sensor:      ${kb(rtdb.bytes)}`);
console.log(`  (en el real, con un índice y limitToLast(10) bajás mucho menos: ${kb(Buffer.byteLength(JSON.stringify(alertas.slice(0, 10))))})`);

const fs = new FirestoreSim();
for (const a of alertas) fs.escribir("alertas", a.id, a);
fs.crearIndice("alertas", ["sensor", "fecha"]);
fs.lecturas = 0;
fs.consultar("alertas", { filtros: { sensor: "S-07" }, orden: "fecha", limite: 10 });
console.log(`  Firestore, consulta con índice:              ${fs.lecturas} lecturas de documento`);

console.log("\nb) Un panel con 1000 lecturas chiquitas");
const r2 = new RealtimeSim(); const f2 = new FirestoreSim();
for (let i = 0; i < 1000; i++) { r2.escribir(`/lecturas/l${i}`, 12.5); f2.escribir("lecturas", `l${i}`, { v: 12.5 }); }
r2.bytes = 0; f2.lecturas = 0;
r2.leer("/lecturas"); f2.consultar("lecturas");
console.log(`  Realtime:  ${kb(r2.bytes)}`);
console.log(`  Firestore: ${f2.lecturas} lecturas`);

console.log("\nc) Un documento de 500 KB, leído 100 veces");
const r3 = new RealtimeSim(); const f3 = new FirestoreSim();
const grande = { contenido: "x".repeat(500 * 1024) };
r3.escribir("/config", grande); f3.escribir("config", "uno", grande);
r3.bytes = 0; f3.lecturas = 0;
for (let i = 0; i < 100; i++) { r3.leer("/config"); f3.leer("config", "uno"); }
console.log(`  Realtime:  ${kb(r3.bytes)}`);
console.log(`  Firestore: ${f3.lecturas} lecturas`);
console.log("\nEl modelo de costos decide cómo diseñás los datos. Primero pensá qué consultas vas a hacer.");

// PARA PROBAR VOS
// 1. Si 500 usuarios abren el panel 20 veces por día, ¿cuántas lecturas y cuántos GB son por mes en cada modelo?
//    Buscá los precios vigentes en la página de Firebase y calculalo. No uses precios de memoria.
// 2. En el modelo Realtime, ¿qué pasa con el tamaño de la base por guardar cada alerta en dos ramas?
