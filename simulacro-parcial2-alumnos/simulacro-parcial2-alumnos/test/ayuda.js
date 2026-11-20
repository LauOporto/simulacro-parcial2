// YA RESUELTO. Utilidades para los tests: levanta la API en un puerto libre y hace pedidos.
const { crearApp } = require("../src/app");
const { firmar } = require("../comun/token");

const TOKENS = {
  operador: firmar({ sub: "ana", rol: "operador" }),
  consulta: firmar({ sub: "juan", rol: "consulta" }),
};

async function levantar() {
  const servidor = crearApp().listen(0);
  await new Promise((ok) => servidor.once("listening", ok));
  const base = `http://localhost:${servidor.address().port}`;

  // pedir("POST", "/entregas", { token: "operador", body: {...} })   body objeto → se serializa
  // pedir("POST", "/entregas", { token: "operador", crudo: '{"x":' }) crudo → se manda tal cual
  async function pedir(metodo, ruta, { token, body, crudo, headers = {} } = {}) {
    const h = { ...headers };
    if (token) h.Authorization = `Bearer ${TOKENS[token] ?? token}`;
    if (body !== undefined || crudo !== undefined) h["Content-Type"] = "application/json";
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: h,
      body: crudo ?? (body === undefined ? undefined : JSON.stringify(body)),
      // Un handler que nunca responde deja al cliente colgado: el test corta a los 2 s.
      signal: AbortSignal.timeout(2000),
    });
    const texto = await r.text();
    let json;
    try { json = JSON.parse(texto); } catch { json = undefined; }
    return { status: r.status, headers: r.headers, texto, json };
  }

  const cerrar = () => { servidor.close(); servidor.closeAllConnections(); };
  return { pedir, cerrar };
}

const ENTREGA_OK = { productor: "Benítez", kgBrutos: 12000, humedad: 14, rendimiento: 33, grado: "A" };

module.exports = { levantar, TOKENS, ENTREGA_OK };
