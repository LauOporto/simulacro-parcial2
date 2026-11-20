// node 02-bases/05-indices.js
//
// PREDECÍ ANTES DE EJECUTAR
// "Alertas de S-07, de la más nueva a la más vieja". ¿Funciona de entrada en el modelo Firestore?
const { FirestoreSim } = require("../comun/simuladores");

const fs = new FirestoreSim();
for (let i = 0; i < 100; i++) fs.escribir("alertas", `a${i}`, { sensor: `S-0${i % 10}`, fecha: i, nivel: i % 3 });

const consulta = { filtros: { sensor: "S-07" }, orden: "fecha", limite: 3 };
try { fs.consultar("alertas", consulta); }
catch (e) { console.log("Sin índice:", e.message); }

fs.crearIndice("alertas", ["sensor", "fecha"]);
console.log("Con índice:", fs.consultar("alertas", consulta));

try { fs.consultar("alertas", { filtros: { nivel: 2 }, orden: "fecha", limite: 3 }); }
catch (e) { console.log("\nPregunta nueva, otra combinación:", e.message); }

console.log("\nCada combinación de filtro y orden se prepara por adelantado. Hay que conocer las preguntas antes de guardar los datos.");
console.log("A cambio, las consultas siempre rinden parecido, sin importar cuántos datos haya.");

// PARA PROBAR VOS
// 1. Cada índice también se escribe en cada alta. ¿Qué pasa con el costo de escritura si creás 20?
// 2. ¿Qué pregunta del negocio de tu TP no podrías contestar sin haber creado antes un índice?
