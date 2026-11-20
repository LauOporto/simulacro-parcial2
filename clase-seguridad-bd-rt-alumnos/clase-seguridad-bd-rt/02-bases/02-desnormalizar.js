// node 02-bases/02-desnormalizar.js
//
// Sin JOIN, para mostrar el nombre del sensor en cada alerta hay que COPIARLO.
//
// PREDECÍ ANTES DE EJECUTAR
// Renombrás un sensor que tiene 3 alertas copiadas en dos ramas. ¿Cuántas escrituras son?
// Si se corta la conexión a mitad de camino, ¿cómo queda la base?
const { RealtimeSim } = require("../comun/simuladores");

function armar() {
  const db = new RealtimeSim();
  db.escribir("/sensores/S-01", { nombre: "Cámara fría" });
  for (const id of ["a1", "a2", "a3"]) {
    db.escribir(`/alertas/${id}`, { sensor: "S-01", nombreSensor: "Cámara fría" });
    db.escribir(`/porSensor/S-01/${id}`, { nombreSensor: "Cámara fría" });
  }
  db.escrituras = 0;
  return db;
}
const rutas = ["/sensores/S-01/nombre",
  ...["a1", "a2", "a3"].flatMap((id) => [`/alertas/${id}/nombreSensor`, `/porSensor/S-01/${id}/nombreSensor`])];

console.log("1. Una escritura por vez, y se corta la conexión en la tercera");
let db = armar();
try {
  rutas.forEach((ruta, i) => {
    if (i === 3) throw new Error("se cortó la conexión");
    db.escribir(ruta, "Cámara 1");
  });
} catch (e) { console.log("  ", e.message, `(hechas: ${db.escrituras} de ${rutas.length})`); }
console.log("   Sensor:      ", db.raiz.sensores["S-01"].nombre);
console.log("   Alerta a1:   ", db.raiz.alertas.a1.nombreSensor);
console.log("   Alerta a2:   ", db.raiz.alertas.a2.nombreSensor, " <-- datos inconsistentes, sin ningún error visible");

console.log("\n2. Update multi-ruta: una sola operación, todas o ninguna");
db = armar();
db.actualizar(Object.fromEntries(rutas.map((r) => [r, "Cámara 1"])));
console.log(`   ${db.escrituras} rutas en una operación. Alerta a2: ${db.raiz.alertas.a2.nombreSensor}`);

console.log("\nCon una base relacional, el nombre vive en un solo lugar y renombrar es 1 UPDATE.");
console.log("La lectura sin JOIN se paga con escrituras más caras y riesgo de inconsistencia.");

// PARA PROBAR VOS
// 1. Si un sensor tiene un millón de alertas, ¿un update multi-ruta sigue siendo razonable?
// 2. ¿Es grave que una alerta vieja muestre el nombre viejo? A veces no: ¿qué representa ese dato en una alerta histórica?
