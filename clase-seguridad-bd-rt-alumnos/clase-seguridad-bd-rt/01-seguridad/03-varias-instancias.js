// node 01-seguridad/03-varias-instancias.js
//
// PREDECÍ ANTES DE EJECUTAR
// a) Límite de 10 pedidos. Tres instancias de la API, cada una con su contador en memoria.
//    El balanceador reparte parejo. ¿Cuántos pedidos pasan?
// b) Un almacén compartido, con 20 pedidos a la vez, leyendo y escribiendo en dos pasos. ¿Cuántos pasan?
// c) El mismo almacén, con una operación atómica. ¿Cuántos pasan?
const { esperar } = require("../comun/red");

// Hace de Redis: cada operación tarda, como una llamada por la red.
function crearAlmacen() {
  const datos = new Map();
  return {
    async leer(k) { await esperar(2); return datos.get(k) ?? 0; },
    async escribir(k, v) { await esperar(2); datos.set(k, v); },
    async incrementar(k) { await esperar(2); const v = (datos.get(k) ?? 0) + 1; datos.set(k, v); return v; },
  };
}

const LIMITE = 10;

async function escenarioMemoria() {
  const contadores = [0, 0, 0];
  let pasaron = 0;
  for (let i = 0; i < 30; i++) {
    const instancia = i % 3;
    if (contadores[instancia] < LIMITE) { contadores[instancia]++; pasaron++; }
  }
  return pasaron;
}

async function escenarioDosPasos() {
  const almacen = crearAlmacen();
  const respuestas = await Promise.all(Array.from({ length: 20 }, async () => {
    const n = await almacen.leer("ana");
    if (n >= LIMITE) return false;
    await almacen.escribir("ana", n + 1);
    return true;
  }));
  return respuestas.filter(Boolean).length;
}

async function escenarioAtomico() {
  const almacen = crearAlmacen();
  const respuestas = await Promise.all(Array.from({ length: 20 }, async () => (await almacen.incrementar("ana")) <= LIMITE));
  return respuestas.filter(Boolean).length;
}

(async () => {
  console.log(`Límite configurado: ${LIMITE}\n`);
  console.log("a) 3 instancias, memoria propia, 30 pedidos:     pasan", await escenarioMemoria());
  console.log("b) almacén compartido, leer y después escribir:  pasan", await escenarioDosPasos());
  console.log("c) almacén compartido, incremento atómico:       pasan", await escenarioAtomico());
})();

// PARA PROBAR VOS
// 1. En (b), ¿por qué pasan todos? Dibujá en papel dos pedidos intercalados.
// 2. Es la misma carrera del lost update de la clase pasada. ¿Qué tienen en común?
// 3. En Redis real esto es INCR, más un script Lua si hay que fijar el vencimiento en el mismo paso.
//    ¿Qué pasa si hacés INCR, el proceso muere y nunca llegás a poner EXPIRE?
