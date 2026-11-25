// PARTE 1.1 — Liquidación de una recepción de leche. Función pura: no sabe nada de HTTP.
// Las fórmulas están en el Anexo del enunciado.

const GRASA_BASE = 3.5;            // % de grasa butirosa
const TEMPERATURA_MAXIMA = 8;      // °C al llegar a la planta
const DESCUENTO_FRIO = 0.05;       // 5 % del importe bruto
const PRECIO_LITRO = { extra: 0.52, comun: 0.45, industrial: 0.31 }; // USD por litro equivalente

const redondear = (x) => Math.round(x * 100) / 100;

// Recibe una recepción YA VALIDADA: { litros, grasa, temperatura, clase }
// Devuelve { litrosEq, descuentoFrio, importe }, los tres redondeados a 2 decimales.
// Importante: se redondea sólo al final. Las cuentas intermedias usan los valores sin redondear.
function liquidar({ litros, grasa, temperatura, clase }) {
  // TODO
}

module.exports = { liquidar, GRASA_BASE, TEMPERATURA_MAXIMA, DESCUENTO_FRIO, PRECIO_LITRO, redondear };
