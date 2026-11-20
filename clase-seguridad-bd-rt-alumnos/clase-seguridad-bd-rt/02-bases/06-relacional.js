// node --disable-warning=ExperimentalWarning 02-bases/06-relacional.js
//
// A veces la respuesta es ninguna de las dos. Esto es SQL de verdad, con SQLite, que ya viene en Node.
//
// PREDECÍ ANTES DE EJECUTAR
// Llega una pregunta que nadie previó: "los 3 sensores con más alertas críticas de la empresa Lácteos Sur".
// ¿Cuántos documentos leerías en Firestore, sin GROUP BY? ¿Qué cambia con un índice en SQL?
const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE empresas (id INTEGER PRIMARY KEY, nombre TEXT);
  CREATE TABLE sensores (id INTEGER PRIMARY KEY, empresa_id INTEGER, nombre TEXT);
  CREATE TABLE alertas (id INTEGER PRIMARY KEY, sensor_id INTEGER, nivel TEXT, fecha INTEGER);
`);
const FILAS = 300000;
db.exec("BEGIN");
db.exec("INSERT INTO empresas VALUES (1, 'Frigorífico Norte'), (2, 'Lácteos Sur')");
const s = db.prepare("INSERT INTO sensores VALUES (?, ?, ?)");
for (let i = 1; i <= 100; i++) s.run(i, (i % 2) + 1, `S-${i}`);
const a = db.prepare("INSERT INTO alertas VALUES (?, ?, ?, ?)");
for (let i = 1; i <= FILAS; i++) a.run(i, ((i * 7) % 100) + 1, i % 5 === 0 ? "critica" : "aviso", i);
db.exec("COMMIT");

const SQL = `
  SELECT s.nombre, COUNT(*) AS criticas
  FROM alertas a JOIN sensores s ON s.id = a.sensor_id JOIN empresas e ON e.id = s.empresa_id
  WHERE e.nombre = 'Lácteos Sur' AND a.nivel = 'critica'
  GROUP BY s.id ORDER BY criticas DESC LIMIT 3`;

const medir = () => {
  const t = process.hrtime.bigint();
  const filas = db.prepare(SQL).all();
  return [filas, (Number(process.hrtime.bigint() - t) / 1e6).toFixed(1)];
};
const plan = () => db.prepare("EXPLAIN QUERY PLAN " + SQL).all().map((f) => "   " + f.detail).join("\n");

const [filas, sinIndice] = medir();
console.log("Resultado:", filas.map((f) => ({ ...f })));
console.log(`\nSin índice nuevo: ${sinIndice} ms\n${plan()}`);
db.exec("CREATE INDEX idx_alertas ON alertas (nivel, sensor_id)");
const [, conIndice] = medir();
console.log(`\nDespués de CREATE INDEX: ${conIndice} ms\n${plan()}`);

console.log(`\nLa misma pregunta en un modelo de documentos, sin haberla previsto:`);
console.log(`  leer las ${FILAS.toLocaleString("es-AR")} alertas y contar en tu código, o mantener contadores desde el principio.`);

// PARA PROBAR VOS
// 1. Escribí otra pregunta ad hoc: "alertas por empresa y por nivel". ¿Cuánto tardaste en contestarla?
// 2. ¿Qué perdés con SQL? Pensá en el panel que se actualiza solo, o en un cliente móvil que escribe sin señal.
