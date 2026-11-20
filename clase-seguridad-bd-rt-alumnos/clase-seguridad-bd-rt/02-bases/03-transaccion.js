// node 02-bases/03-transaccion.js
//
// PREDECÍ ANTES DE EJECUTAR
// 50 procesos suman 1 a un contador remoto, todos a la vez. ¿Cuánto termina valiendo?
// ¿Y con una transacción optimista? ¿Cuántos conflictos habrá?
const { DocumentoRemoto } = require("../comun/simuladores");

(async () => {
  const a = new DocumentoRemoto();
  await Promise.all(Array.from({ length: 50 }, async () => {
    const { valor } = await a.leer();
    await a.escribir(valor + 1);
  }));
  console.log(`Leer y después escribir:   ${a.valor} (se perdieron ${50 - a.valor})`);

  const b = new DocumentoRemoto();
  await Promise.all(Array.from({ length: 50 }, async () => {
    for (;;) {
      const { valor, version } = await b.leer();
      if (await b.escribirSi(version, valor + 1)) return;
    }
  }));
  console.log(`Transacción optimista:     ${b.valor} (con ${b.conflictos} reintentos por conflicto)`);
  console.log("\nEs el mismo If-Match de la clase de HTTP: \"escribí solo si no cambió desde que leí\".");
})();

// PARA PROBAR VOS
// 1. Subí a 200 procesos. ¿Cómo crecen los reintentos? ¿Qué le pasaría a una app con un documento muy disputado?
// 2. Por qué la función de una transacción no debería tener efectos secundarios, como mandar un email?
