// PARTE 2 — Este archivo tiene defectos. Encontralos, arreglalos y explicalos en DEFECTOS.md.
//
// Contrato esperado:
//   autenticar        → sin token, o con token inválido o vencido: 401 "no-autenticado".
//                       Con token válido: deja el usuario en req.usuario ({ sub, rol }) y sigue.
//   permitir(...roles) → si el rol del usuario no está en la lista: 403 "sin-permiso".
const { verificarToken } = require("../../comun/token");
const { Problema } = require("../errores/problema");

function autenticar(req, res, next) {
  const encabezado = req.get("Authorization");
  if (!encabezado) {
    res.status(401).type("application/problem+json").send(JSON.stringify({
      type: "https://desmotadora.ejemplo.edu/problemas/no-autenticado",
      title: "Falta el token",
      status: 401,
    }));
  }

  const token = encabezado?.replace("Bearer ", "");
  try {
    req.usuario = verificarToken(token);
  } catch (err) {
    console.warn("token inválido:", err.message);
  }
  next();
}

function permitir(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
      return next(new Problema(401, "no-autenticado", "No autorizado"));
    }
    next();
  };
}

module.exports = { autenticar, permitir };
