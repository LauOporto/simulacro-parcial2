// PARTE 1.2 — Validación del body de POST /recepciones.
// Las 7 reglas, en orden, están en el enunciado ("Reglas de validación").

const { Problema } = require("../errores/problema");

const CAMPOS = ["tambo", "litros", "grasa", "temperatura", "clase"];
const CLASES = ["extra", "comun", "industrial"];

// Arma el Problema 422. OJO: sólo lo CREA; quien lo usa tiene que tirarlo.
const invalida = (campo, titulo) => new Problema(422, "recepcion-invalida", titulo, { campo });

// Recibe lo que llegó en req.body (puede ser cualquier cosa).
// Si algo falla, TIRA invalida(<campo>, <título>) con el PRIMER campo que falla.
// Si todo está bien, DEVUELVE un objeto NUEVO con los cinco campos (el tambo ya sin espacios en los bordes).
function validarRecepcion(body) {
  // TODO
}

module.exports = { validarRecepcion, CAMPOS, CLASES };
