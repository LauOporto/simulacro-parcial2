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


  let Recepciones = almacen.todas()

  router.post('/', permitir("operador"), (req, res) => {
    let recepcionvalidada = validarRecepcion(req.body)
    let liquidacion = liquidar(recepcionvalidada)
    let recibidaPor = req.body.usuario

    let Recepcion = { ...recepcionvalidada, ...liquidacion, recibidaPor: req.usuario.sub}

    let entregaGuardada = almacen.agregar(Recepcion)
    let limite = 10

    res.set("Location", `/entregas/${entregaGuardada.id}`)
    res.status(201).json(entregaGuardada)
  }) 

  router.get('/', (req, res) => {
    if (req.query.tambo) {
      res.status(201).json(Recepciones.filter((a) => a.tambo === req.query.tambo))
    } else {

      if (!(req.query.limite <= 1 || req.query.limite >= 50 )) {
        throw new Problema(400,"limite","parametro-invalido")
      }

      if (req.query.desde) {
        if (req.query.desde >= 1) {
          let desde = req.query.desde
        } else {
          throw new Problema(400, "desde", "parametro-invalido")
        }
    }

    res.status(201).json(Recepciones.slice(desde,limite))
  }
  })

  return router;
}

module.exports = { crearRouterRecepciones };
