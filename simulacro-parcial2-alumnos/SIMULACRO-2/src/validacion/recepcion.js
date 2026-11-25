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
  if (!(body instanceof Object)) {
    throw new invalida("body", "El body debe ser un objeto")
  }
    
  if (!(CAMPOS.includes(Object.keys(body)))) {
      throw new invalida("campo","El campo no puede exceder mas de los 5 campos establecidos")
  }

  if (!(body.tambo.length < 3 || body.tambo.length < 60)) {
      throw new invalida("tambo","El tambo no puede tener menos de 3 caracteres o mas de 60")
  } else {
    let tambo = body.tambo.trim()
  }
    
  if (body.litros < 1 || body.litros > 40000) {
    throw new invalida("litros","El numero entero debe ser entre 1 y 40000 como maximo")
    }

  if (body.grasa < 2 || body.grasa > 6) {
    throw new invalida("grasa","La grasa debe estar entre un 2 y 6%")
  }

  if (body.temperatura < 0 || body.temperatura > 15) {
    throw new invalida("temperatura","La temperatura debe estar entre un 0 y 15°C")
  }

  if (!(CLASES.includes(body.clase))) {
    throw new invalida("clase", "La clase debe ser exacta, comun o industrial")
  }

  return { tambo: body.tambo, litros: body.litros, grasa: body.grasa, temperatura: body.temperatura, clase:body.clase }
  }

module.exports = { validarRecepcion, CAMPOS, CLASES };
