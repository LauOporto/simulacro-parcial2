// YA RESUELTO. No hace falta modificarlo.
// Tokens JWT firmados con HS256 (HMAC-SHA256) usando un secreto del servidor.
const crypto = require("node:crypto");

const SECRETO = process.env.JWT_SECRETO ?? "simulacro2-lacteos-no-usar-en-produccion";
const ROLES = ["operador", "consulta"];

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const firmarTexto = (texto) => crypto.createHmac("sha256", SECRETO).update(texto).digest("base64url");
const ahora = () => Math.floor(Date.now() / 1000);

// Emite un token. Lo usan los scripts y los tests; la API nunca emite tokens.
function firmar({ sub, rol }, { expiraEn = 3600 } = {}) {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ sub, rol, iat: ahora(), exp: ahora() + expiraEn });
  return `${header}.${payload}.${firmarTexto(`${header}.${payload}`)}`;
}

// Devuelve { sub, rol } si el token es válido. Si no, TIRA un Error (un Error común, no un Problema).
function verificarToken(token) {
  if (typeof token !== "string") throw new Error("token ausente");
  const partes = token.split(".");
  if (partes.length !== 3) throw new Error("formato inválido");
  const [h, p, firma] = partes;

  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  if (header.alg !== "HS256") throw new Error(`algoritmo no permitido: ${header.alg}`);

  const esperada = Buffer.from(firmarTexto(`${h}.${p}`));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) {
    throw new Error("firma inválida");
  }

  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  if (!(payload.exp > ahora())) throw new Error("token vencido");
  if (!payload.sub || !ROLES.includes(payload.rol)) throw new Error("payload inválido");
  return { sub: payload.sub, rol: payload.rol };
}

module.exports = { firmar, verificarToken, ROLES };
