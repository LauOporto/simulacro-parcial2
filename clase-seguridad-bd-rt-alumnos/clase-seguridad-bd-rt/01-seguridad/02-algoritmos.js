// node 01-seguridad/02-algoritmos.js
//
// Tres formas de "máximo 10 por minuto". Usamos un reloj simulado para que el resultado sea exacto.
//
// PREDECÍ ANTES DE EJECUTAR
// Mandás 10 pedidos a los 59 segundos y 10 más a los 61 segundos.
// ¿Cuántos deja pasar cada algoritmo? ¿Alguno deja pasar 20 en 2 segundos?
function ventanaFija(limite, ventana) {
  let numero = -1, cuenta = 0;
  return (t) => {
    const n = Math.floor(t / ventana);
    if (n !== numero) { numero = n; cuenta = 0; }
    if (cuenta >= limite) return false;
    cuenta++;
    return true;
  };
}

function registroDeslizante(limite, ventana) {
  const tiempos = [];
  return (t) => {
    while (tiempos.length && tiempos[0] <= t - ventana) tiempos.shift();
    if (tiempos.length >= limite) return false;
    tiempos.push(t);
    return true;
  };
}

function baldeDeFichas(capacidad, porSegundo) {
  let fichas = capacidad, ultimo = 0;
  return (t) => {
    fichas = Math.min(capacidad, fichas + (t - ultimo) * porSegundo);
    ultimo = t;
    if (fichas < 1) return false;
    fichas -= 1;
    return true;
  };
}

function correr(nombre, permite, pedidos) {
  let pasaron = 0;
  for (const t of pedidos) if (permite(t)) pasaron++;
  console.log(`  ${nombre.padEnd(24)} ${pasaron} de ${pedidos.length}`);
}
const todos = (pedidos) => {
  correr("Ventana fija", ventanaFija(10, 60), pedidos);
  correr("Registro deslizante", registroDeslizante(10, 60), pedidos);
  correr("Balde de fichas", baldeDeFichas(10, 10 / 60), pedidos);
};

console.log("Escenario 1: 20 pedidos en 2 segundos, cruzando el minuto (10 en t=59, 10 en t=61)");
todos([...Array(10).fill(59), ...Array(10).fill(61)]);

console.log("\nEscenario 2: un cliente tranquilo, 1 pedido cada 6 segundos durante 2 minutos");
todos(Array.from({ length: 20 }, (_, i) => i * 6));

console.log("\nEscenario 3: ráfaga de 20 en t=0, sin nada antes");
todos(Array(20).fill(0));

const memoria = 10 * 8;
console.log(`\nMemoria por cliente: ventana fija y balde guardan 2 números. El registro guarda hasta 10 tiempos (${memoria} bytes de datos).`);
console.log("Con un límite de 10.000 por hora y un millón de clientes, esa diferencia pesa.");

// PARA PROBAR VOS
// 1. Agregá el "contador deslizante": cuenta_anterior × fracción que queda de la ventana anterior + cuenta_actual.
//    ¿Cuántos deja pasar en el escenario 1?
// 2. ¿Qué algoritmo le conviene a una API a la que los clientes le pegan con ráfagas legítimas? ¿Por qué?
