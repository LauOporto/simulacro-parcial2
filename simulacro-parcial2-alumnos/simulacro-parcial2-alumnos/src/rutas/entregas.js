// PARTE 1.3 — Rutas de /entregas. autenticar ya se aplica en app.js para todo el router.
const express = require("express");
const { permitir } = require("../middlewares/auth");
const { validarEntrega } = require("../validacion/entrega");
const { liquidar, redondear } = require("../servicios/liquidacion");
const { Problema } = require("../errores/problema");

function crearRouterEntregas({ almacen }) {
  const router = express.Router();

  // Registra una entrega. Sólo operadores.
  router.post("/", permitir("operador"), (req, res) => {
    if (!(validarEntrega(req.body))) {
      throw new Problema(422,"entrega-invalida","ERROR EN LA VALIDACION DE ENTREGA")
    } else {
      res.status(201).json(req.body)
    }
    // TODO
  });

  // Lista las entregas. ?productor=<nombre>  ?limite=<1..50, por defecto 10>
  router.get("/", (req, res) => {
    // TODO
  });

  // Una entrega por id.
  router.get("/:id", (req, res) => {
    // TODO

  });

  return router;
}

module.exports = { crearRouterEntregas };
