// PARTE 1.3 — Las tres rutas de /recepciones. app.js ya pasó por autenticar antes de llegar acá.
// Qué responde cada una (y qué rol necesita) está en la tabla del enunciado.

const express = require("express");
const { Problema } = require("../errores/problema");
const { permitir } = require("../middlewares/auth");
const { validarRecepcion } = require("../validacion/recepcion");
const { liquidar, redondear } = require("../servicios/liquidacion");

function crearRouterRecepciones({ almacen }) {
  const router = express.Router();

  // POST /          → registrar una recepción        (sólo operador)
  // GET  /          → listar con filtro y paginación (cualquiera)
  // GET  /:id       → una recepción                  (cualquiera)

  return router;
}

module.exports = { crearRouterRecepciones };
