// YA RESUELTO. Genera un token para probar con curl o con fetch.
//   npm run token -- operador ana
//   npm run token -- consulta juan
const { firmar, ROLES } = require("../comun/token");

const [rol = "operador", sub = "prueba"] = process.argv.slice(2);
if (!ROLES.includes(rol)) {
  console.error(`rol inválido: ${rol} (usá ${ROLES.join(" o ")})`);
  process.exit(1);
}
console.log(firmar({ sub, rol }));
