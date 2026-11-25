// PARTE 2 — Este archivo tiene defectos. Encontralos, arreglalos y explicalos en DEFECTOS.md.
//
// Contrato esperado:
//   - Un Problema se responde con su status, en application/problem+json.
//   - Un JSON mal formado en el body es culpa del cliente: 400 "json-invalido".
//   - Un body que supera el límite de tamaño es culpa del cliente: 413 "body-demasiado-grande".
//   - Cualquier otro error es un 500 "interno". El detalle se escribe en el log del servidor
//     (console.error), NUNCA en la respuesta: ni en el cuerpo ni en los encabezados.
const { Problema } = require("../errores/problema");

const BASE = "https://cooperativa.ejemplo.edu/problemas";

const responder = (res, req, status, tipo, titulo, extra = {}) =>
  res.status(status).type("application/problem+json").send(JSON.stringify({
    type: `${BASE}/${tipo}`,
    title: titulo,
    status,
    instance: req.originalUrl,
    ...extra,
  }));

function manejarErrores(err, req, res, next) {
  if (err instanceof Problema) {
    return responder(res, req, err.status, err.tipo, err.titulo, err.extra);
  }
  if (err.type === "entity.parse.failed") {
    return responder(res, req, 400, "json-invalido", "El body no es JSON válido");
  }
  res.set("X-Error", err.message);
  console.error(err);
  responder(res, req, 500, "interno", "Error interno");
}

module.exports = { manejarErrores };
