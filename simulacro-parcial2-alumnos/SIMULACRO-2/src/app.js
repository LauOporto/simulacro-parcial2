// YA RESUELTO. Arma la aplicación. No lo modifiques (salvo que lo justifiques en DEFECTOS.md).
const express = require("express");
const { Almacen } = require("./almacen");
const { autenticar } = require("./middlewares/auth");
const { manejarErrores } = require("./middlewares/errores");
const { Problema } = require("./errores/problema");
const { crearRouterRecepciones } = require("./rutas/recepciones");

function crearApp({ almacen = new Almacen() } = {}) {
  const app = express();
  app.use(express.json());

  app.get("/salud", (req, res) => res.json({ ok: true }));

  // Ruta de diagnóstico que quedó de una prueba: simula que se cae el caché.
  app.get("/diagnostico/cache", () => {
    throw new Error("no se pudo conectar a redis://default:Lacteos2026@10.0.0.9:6379");
  });

  app.use("/recepciones", autenticar, crearRouterRecepciones({ almacen }));

  app.use((req, res, next) => next(new Problema(404, "no-encontrado", "No existe esa ruta")));
  app.use(manejarErrores);
  return app;
}

module.exports = { crearApp };
