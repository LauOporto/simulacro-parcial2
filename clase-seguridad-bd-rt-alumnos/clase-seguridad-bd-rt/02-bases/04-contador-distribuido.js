// node 02-bases/04-contador-distribuido.js
//
// Firestore no deja actualizar un documento a un ritmo ilimitado. Su documentación propone repartir
// el contador en "fragmentos" (shards). El ejemplo oficial asume un incremento por segundo por fragmento:
// usamos esa cifra como supuesto de este modelo, no como medición.
//
// PREDECÍ ANTES DE EJECUTAR
// Entran 20 "me gusta" por segundo durante 10 segundos: 200 en total.
// ¿Cuántos se aceptan con 1 documento? ¿Con 10 y 50 fragmentos? ¿Qué se encarece a cambio?
let semilla = 42;
const azar = (n) => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return Math.floor((semilla / 2147483648) * n); };

function simular(fragmentos) {
  let aceptados = 0;
  for (let segundo = 0; segundo < 10; segundo++) {
    const ocupado = new Set();
    for (let i = 0; i < 20; i++) {
      const f = azar(fragmentos);
      if (!ocupado.has(f)) { ocupado.add(f); aceptados++; }
    }
  }
  return aceptados;
}

console.log("fragmentos  aceptados de 200  lecturas para saber el total");
for (const f of [1, 10, 50, 200]) {
  console.log(String(f).padEnd(11), String(simular(f)).padEnd(17), f);
}

// PARA PROBAR VOS
// 1. ¿Por qué con 50 fragmentos no entran los 200, si la capacidad alcanzaría?
// 2. Si cada visita a la página muestra el total, ¿conviene tener 200 fragmentos? Hacé la cuenta de lecturas.
// 3. ¿Cómo lo resolverías con PostgreSQL? ¿Tendrías el mismo límite?
