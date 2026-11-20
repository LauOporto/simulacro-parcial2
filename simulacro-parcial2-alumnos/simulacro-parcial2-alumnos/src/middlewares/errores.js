// PARTE 2 — Este archivo tiene defectos. Encontralos, arreglalos y explicalos en DEFECTOS.md.
//
// Contrato esperado:
//   - Un Problema se responde con su status, en application/problem+json.
//   - Un JSON mal formado en el body es culpa del cliente: 400 "json-invalido".
//   - Cualquier otro error es un 500 "interno". El detalle se escribe en el log del servidor,
//     NUNCA en la respuesta.
const { Problema } = require("../errores/problema");

const BASE = "https://desmotadora.ejemplo.edu/problemas";

function manejarErrores(err, req, res, next) {
  if (err instanceof Problema) {
    return res.status(err.status).type("application/problem+json").send(JSON.stringify({
      type: `${BASE}/${err.tipo}`,
      title: err.titulo,
      status: err.status,
      instance: req.originalUrl,
      ...err.extra,
    }));
  }

  res.status(500).type("application/problem+json").send(JSON.stringify({
    type: `${BASE}/interno`,
    title: "Error interno",
    status: 500,
    detail: err.message,
    stack: err.stack,
  }));
}

module.exports = { manejarErrores };
