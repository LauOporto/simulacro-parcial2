// PARTE 2 — Este archivo tiene defectos. Encontralos, arreglalos y explicalos en DEFECTOS.md.
//
// Contrato esperado:
//   autenticar        → sin token, o con token inválido o vencido: 401 "no-autenticado".
//                       Con token válido: deja el usuario en req.usuario ({ sub, rol }) y sigue.
//                       El usuario sale SÓLO del token.
//   permitir(...roles) → si el rol del usuario no está en la lista: 403 "sin-permiso",
//                        y el pedido NO sigue: ni el handler ni nada más se ejecuta.
const { verificarToken } = require("../../comun/token");
const { Problema } = require("../errores/problema");

function autenticar(req, res, next) {
  const encabezado = req.get("Authorization");
  if (!encabezado) {
    throw new Problema(401, "no-autenticado", "Falta el token");
  }

  const token = encabezado.replace("Bearer ", "");
  try {
    const usuario = verificarToken(token);
    // La balanza puede registrar a nombre del operador de turno.
    req.usuario = { sub: req.get("X-Usuario") ?? usuario.sub, rol: usuario.rol };
  } catch (err) {
    return next(err);
  }
  next();
}

function permitir(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
      res.status(403).type("application/problem+json").send(JSON.stringify({
        type: "https://cooperativa.ejemplo.edu/problemas/sin-permiso",
        title: "Tu rol no alcanza para esta operación",
        status: 403,
        instance: req.originalUrl,
      }));
    }
    next();
  };
}

module.exports = { autenticar, permitir };
