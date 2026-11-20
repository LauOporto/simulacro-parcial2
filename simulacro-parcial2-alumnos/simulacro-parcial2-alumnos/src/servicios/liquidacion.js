// PARTE 1.1 — Liquidación de una entrega. Función pura: no sabe nada de HTTP.
// Las fórmulas están en el Anexo del enunciado.

const HUMEDAD_BASE = 12;                                  // %
const PRECIO_FIBRA = { A: 2.10, B: 1.85, C: 1.50 }; 
let kgSecos = 0 
     // USD por kg de fibra
let kgFibra = 0
let importe = 0

const redondear = (x) => Math.round(x * 100) / 100;

// Recibe una entrega YA VALIDADA: { kgBrutos, humedad, rendimiento, grado }
// Devuelve { kgSecos, kgFibra, importe }, los tres redondeados a 2 decimales.
// Importante: se redondea sólo al final. Las cuentas intermedias usan los valores sin redondear.
function liquidar({ kgBrutos, humedad, rendimiento, grado }) {
  // TODO
  if (humedad >  HUMEDAD_BASE) {
      kgSecos = kgBrutos * (100 - humedad) / (100 - 12)
  } else {
    kgSecos = kgBrutos
  }

  kgFibra = kgSecos * rendimiento / 100

  if (grado === "A") {
    importe = kgFibra * PRECIO_FIBRA.A
  } else if (grado === "B") {
     importe = kgFibra * PRECIO_FIBRA.B
  } else if (grado === "C") {
    importe = kgFibra * PRECIO_FIBRA.C
  }

  kgSecos = redondear(kgSecos)
  kgFibra = redondear(kgFibra)
  importe = redondear(importe)

  return { kgSecos, kgFibra, importe }
}

module.exports = { liquidar, HUMEDAD_BASE, PRECIO_FIBRA, redondear };
