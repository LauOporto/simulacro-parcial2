// node 01-seguridad/01-fuerza-bruta.js
//
// PREDECÍ ANTES DE EJECUTAR
// Un login pide un PIN de 4 dígitos. No hay límite de intentos.
// ¿Cuánto tarda un script en entrar? ¿Y con un límite de 5 intentos por minuto?
const express = require("express");
const { levantar, pedir } = require("../comun/red");

function crearApp(limite) {
  const intentos = new Map();
  const app = express();
  app.use(express.json());
  app.post("/login", (req, res) => {
    if (limite) {
      const n = (intentos.get(req.body.usuario) ?? 0) + 1;
      intentos.set(req.body.usuario, n);
      if (n > limite) return res.status(429).set("Retry-After", "60").json({ error: "demasiados intentos" });
    }
    res.sendStatus(req.body.pin === "7391" ? 200 : 401);
  });
  return app;
}

async function atacar(app) {
  const s = await levantar(app);
  const inicio = Date.now();
  let resultado = "no entró";
  let intentos = 0;
  for (let i = 0; i <= 9999; i++) {
    intentos++;
    const r = await pedir(`${s.url}/login`, { metodo: "POST", cuerpo: { usuario: "ana", pin: String(i).padStart(4, "0") } });
    if (r.status === 200) { resultado = `ENTRÓ con ${String(i).padStart(4, "0")}`; break; }
    if (r.status === 429) { resultado = "frenado con 429"; break; }
  }
  await s.cerrar();
  return `${resultado} · ${intentos} intentos · ${((Date.now() - inicio) / 1000).toFixed(2)} s`;
}

(async () => {
  console.log("Sin límite:          ", await atacar(crearApp(0)));
  console.log("Máximo 5 intentos:   ", await atacar(crearApp(5)));
})();

// PARA PROBAR VOS
// 1. Con 5 intentos por minuto, ¿cuánto tarda en probar los 10.000 PIN? Hacé la cuenta.
// 2. Este límite es por usuario. Un atacante prueba un PIN contra mil usuarios. ¿Lo frena?
// 3. Si limitás por usuario, un atacante puede bloquearle la cuenta a Ana a propósito. ¿Cómo lo evitarías?
