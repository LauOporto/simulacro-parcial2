// YA RESUELTO. Arma la aplicación. No lo modifiques (salvo que lo justifiques en DEFECTOS.md).
const express = require("express");
const { Almacen } = require("./almacen");
const { autenticar } = require("./middlewares/auth");
const { manejarErrores } = require("./middlewares/errores");
const { Problema } = require("./errores/problema");
const { crearRouterEntregas } = require("./rutas/entregas");

function crearApp({ almacen = new Almacen() } = {}) {
  const app = express();
  app.use(express.json());

  app.get("/salud", (req, res) => res.json({ ok: true }));

  // Ruta de diagnóstico que quedó de una prueba: simula que se cae la base de datos.
  app.get("/diagnostico/db", () => {
    throw new Error("no se pudo conectar a postgres://desmotadora:Algodon2026@10.0.0.5/entregas");
  });

  app.use("/entregas", autenticar, crearRouterEntregas({ almacen }));

  app.use((req, res, next) => next(new Problema(404, "no-encontrado", "No existe esa ruta")));
  app.use(manejarErrores);
  return app;
}

module.exports = { crearApp };
