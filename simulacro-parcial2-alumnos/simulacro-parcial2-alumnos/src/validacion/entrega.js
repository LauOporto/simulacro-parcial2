// PARTE 1.2 — Validación del body de POST /entregas.
// Las reglas están en el enunciado. Si algo falla, TIRÁ un Problema 422 "entrega-invalida"
// con { campo: <nombre del primer campo que falla> }. Si todo está bien, devolvé la entrega
// limpia (sólo los cinco campos, con el productor sin espacios al principio ni al final).
const { Problema } = require("../errores/problema");

const CAMPOS = ["productor", "kgBrutos", "humedad", "rendimiento", "grado"];
const GRADOS = ["A", "B", "C"];

function invalida(campo, titulo) {
  return new Problema(422, "entrega-invalida", titulo, { campo });
}

function validarEntrega(body) {
  // TODO
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalida("body", "El body debe ser un objeto")
  } else {
    for (campo of Object.keys(body)) {
      if (!(CAMPOS.includes(campo))) {
        throw invalida(campo, "OBJETO INVALIDO")
      }
    }

    if (body.productor.length < 3) {
      throw invalida("Productor","El nombre del productor debe ser mayor a 3 caracteres")
    } else if (body.productor.length > 60) {
      throw invalida("Productor","El nombre del productor debe ser menor a 60 caracteres")
    } {
      body.productor = body.productor.trim()
    }
  }

  if (!Number.isInteger(body.kgBrutos)) {
    throw invalida("kgBrutos", "El numero debe ser un entero") 
  } else if (body.kgBrutos < 1) {
    throw invalida ("kgBrutos", "Los kg deben mayor a 1")
  } else if (body.kgBrutos > 30000) {
    throw invalida ("kgBrutos", "Los kg deben ser menor a 30000")
  }

  if (!(body.rendimiento >= 28 && body.rendimiento <= 40)) {
    throw invalida("Rendimiento", "El rendimiento debe ser entre 28 y 40%")
  }

  if (!(body.humedad >= 0 && body.humedad <= 30)) {
    throw invalida("Humedad", "La humedad debe ser entre 0 y 30%")
  }

  if (!(body.grado === "A" || body.grado === "B" || body.grado === "C")) {
    throw invalida("Grado", "El grado debe ser A, B o C")
  }


  return { body: productor, body: kgBrutos, body: humedad, body: rendimiento, body:grado }

}

module.exports = { validarEntrega, CAMPOS, GRADOS };
