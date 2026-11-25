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
    // TODO
    const entrega = validarEntrega(req.body)
    const liquidacion = liquidar(entrega)

    const EntregaCompleta = {
      ...entrega, ...liquidacion, registradaPor : req.usuario.sub
    }
    const entregaGuardada = almacen.agregar(EntregaCompleta)

    res.set("Location", `/entregas/${entregaGuardada.id}`)
    res.status(201).json(entregaGuardada)
    });

  // Lista las entregas. ?productor=<nombre>  ?limite=<1..50, por defecto 10>
  router.get("/", (req, res) => {
    // TODO
    let EntregasCompletas = almacen.todas()
    EntregasCompletas = EntregasCompletas.reverse()
    let limite = 10

    if (!(req.query.limite === undefined)) {
      let queryLimite = Number(req.query.limite)
      if (queryLimite <= 0 || queryLimite >= 51) {
        throw new Problema(400, "parametro-invalido", "limite", {campo: "limite"})
      } else {
        limite = queryLimite
      }
    }

    if (!(req.query.productor === undefined)) {
      let EntregasFiltradas = EntregasCompletas.filter((a) => a.productor === req.query.productor)

      let EntregasConLimite = EntregasFiltradas.slice(0,limite)

      let entregas = redondear(EntregasFiltradas.length)
      let kgFibra = redondear(EntregasFiltradas.reduce((acc, e) => acc + e.kgFibra, 0))
      let importe = redondear(EntregasFiltradas.reduce((acc, e) => acc + e.importe, 0))

     Total = {entregas, kgFibra, importe}

      let EntregaYtotal = {items: EntregasConLimite, total: Total }

      res.status(200).json(EntregaYtotal)
    } else {
      let EntregasConLimite = EntregasCompletas.slice(0,limite)

      let entregas = redondear(EntregasCompletas.length)
      let kgFibra = redondear(EntregasCompletas.reduce((acc, e) => acc + e.kgFibra, 0))
      let importe = redondear(EntregasCompletas.reduce((acc, e) => acc + e.importe, 0))

     Total = {entregas, kgFibra, importe}

      let EntregaYtotal = {items: EntregasConLimite, total: Total }

      res.status(200).json(EntregaYtotal)
    }

    // const todasEntregas = almacen.todas()
    // const EntregasOrdenadas = todasEntregas.reverse()
    
    // if(!(req.query.limite === undefined)) {
    //   if (limite < 1 && limite > 50) {
    //     throw new Problema(400, "parametro-invalido", "campo: limite")
    //   } else {
    //     let limite = req.query.limite
    //     if (req.query.limite === undefined) {
    //       limite = 10
    //     }
    //   }
    // } 

    // if (req.query === "") {
    //   res.status(200).json(EntregasOrdenadas.slice(0,limite), EntregasOrdenadas.reduce().slice(0,limite))

    // }
    
    // if (!(req.query.productor === undefined)) {
    //   let EntregasFiltradas = todasEntregas.filter((a) => a.productor === req.query.productor)
    //   res.status(200).json(EntregasFiltradas.slice(0,limite), EntregasFiltradas.reduce().slice(0,limite))
    // }


    });

  // Una entrega por id.
  router.get("/:id", (req, res) => {
    // TODO
    let id = req.params.id
    id = Number(id)

    const idBuscar = almacen.buscar(id)

    if (!(idBuscar)) {
      throw new Problema(404, "no-encontrado", "Id no encontrado")
    } else {
      res.status(200).json(idBuscar)
    }
  });

  return router;
}

module.exports = { crearRouterEntregas };
