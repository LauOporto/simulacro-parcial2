// TESTS DE AUTOCORRECCIÓN — copiar a la carpeta test/ de tu proyecto y correr: npm test
// Cada test empieza con una etiqueta: buscala en AUTOCORRECCION.md para saber qué mide.
const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { liquidar } = require("../src/servicios/liquidacion");
const { levantar, ENTREGA_OK } = require("./ayuda");
const camiones = require("../datos/camiones");

// ---------- 1.1 Liquidación ----------
test("[T-SECO] humedad bajo la base: no se bonifica (C03)", () => {
  assert.deepEqual(
    liquidar({ kgBrutos: 15000, humedad: 9, rendimiento: 31, grado: "C" }),
    { kgSecos: 15000, kgFibra: 4650, importe: 6975 },
  );
});
test("[T-REDONDEO] se redondea al final (C08)", () => {
  assert.deepEqual(
    liquidar({ kgBrutos: 20000, humedad: 17.5, rendimiento: 36.5, grado: "A" }),
    { kgSecos: 18750, kgFibra: 6843.75, importe: 14371.88 },
  );
});

// ---------- API ----------
let api;
let avisos;
const originales = { warn: console.warn, error: console.error };
before(async () => { api = await levantar(); });
after(() => api.cerrar());
beforeEach(() => {
  avisos = [];
  console.warn = (...a) => avisos.push(["warn", a.join(" ")]);
  console.error = (...a) => avisos.push(["error", a.map(String).join(" ")]);
});
afterEach(() => Object.assign(console, originales));

const post = (body) => api.pedir("POST", "/entregas", { token: "operador", body });
const postCrudo = (crudo) => api.pedir("POST", "/entregas", { token: "operador", crudo });

// ---------- 1.2 Validación ----------
const casos = [
  ["[V-TEXTO] kgBrutos texto (C04)", { kgBrutos: "11000" }, "kgBrutos"],
  ["[V-DECIMAL] kgBrutos decimal (C05)", { kgBrutos: 8000.5 }, "kgBrutos"],
  ["[V-TOPE] kgBrutos > 30000", { kgBrutos: 30001 }, "kgBrutos"],
  ["[V-CERO] kgBrutos 0", { kgBrutos: 0 }, "kgBrutos"],
  ["[V-GRADO] grado en minúscula (C10)", { grado: "a" }, "grado"],
  ["[V-REND] rendimiento fuera de rango (C11)", { rendimiento: 45 }, "rendimiento"],
  ["[V-HUM-TEXTO] humedad texto", { humedad: "13" }, "humedad"],
  ["[V-HUM-NULL] humedad null", { humedad: null }, "humedad"],
  ["[V-PROD-CORTO] productor de 2 letras con espacios", { productor: "  ab  " }, "productor"],
  ["[V-PROD-TIPO] productor no string", { productor: 12345 }, "productor"],
  ["[V-SOBRANTE] campo importe (C07)", { importe: 99999 }, "importe"],
  ["[V-SOBRANTE] campo id", { id: 1 }, "id"],
];
for (const [nombre, cambio, campo] of casos) {
  test(nombre, async () => {
    const r = await post({ ...ENTREGA_OK, ...cambio });
    assert.equal(r.status, 422);
    assert.equal(r.json?.campo, campo);
  });
}
test("[V-INFINITO] kgBrutos 1e309 llega como Infinity (C06)", async () => {
  const r = await postCrudo(camiones.find((c) => c.camion === "C06").cuerpo);
  assert.equal(r.status, 422);
  assert.equal(r.json?.campo, "kgBrutos");
});
test("[V-FALTA] falta grado", async () => {
  const { grado, ...sinGrado } = ENTREGA_OK;
  const r = await post(sinGrado);
  assert.equal(r.status, 422);
  assert.equal(r.json?.campo, "grado");
});
test("[V-ARRAY] body array → 422", async () => {
  const r = await post([ENTREGA_OK]);
  assert.equal(r.status, 422);
});
test("[V-TRIM] productor se guarda sin espacios (C09)", async () => {
  const r = await post({ ...ENTREGA_OK, productor: "  Sotelo  " });
  assert.equal(r.status, 201);
  assert.equal(r.json.productor, "Sotelo");
});
test("[V-SOLO-CINCO] la entrega guardada tiene sólo los campos esperados", async () => {
  const r = await post(ENTREGA_OK);
  assert.deepEqual(Object.keys(r.json).sort(),
    ["grado", "humedad", "id", "importe", "kgBrutos", "kgFibra", "kgSecos", "productor", "registradaPor", "rendimiento"]);
});

// ---------- 1.3 Rutas ----------
test("[R-ID] GET /entregas/:id convierte el id (params es string)", async () => {
  const c = await post(ENTREGA_OK);
  const r = await api.pedir("GET", `/entregas/${c.json.id}`, { token: "consulta" });
  assert.equal(r.status, 200);
});
test("[R-404] GET /entregas/99999 y /entregas/abc → 404 problem+json", async () => {
  for (const id of ["99999", "abc"]) {
    const r = await api.pedir("GET", `/entregas/${id}`, { token: "consulta" });
    assert.equal(r.status, 404);
    assert.match(r.headers.get("content-type"), /problem\+json/);
  }
});
test("[R-LIMITE] limite inválido → 400 (abc, 0, 51, 2.5, repetido)", async () => {
  for (const q of ["limite=abc", "limite=0", "limite=51", "limite=2.5", "limite=2&limite=3"]) {
    const r = await api.pedir("GET", `/entregas?${q}`, { token: "consulta" });
    assert.equal(r.status, 400, q);
    assert.equal(r.json?.campo, "limite", q);
  }
});
test("[R-ORDEN] items de más nuevo a más viejo, limite por defecto 10, totales de todas", async () => {
  for (let i = 0; i < 12; i++) await post({ ...ENTREGA_OK, productor: "Ortiz" });
  const r = await api.pedir("GET", "/entregas?productor=Ortiz", { token: "consulta" });
  assert.equal(r.status, 200);
  assert.equal(r.json.items.length, 10);
  assert.ok(r.json.items[0].id > r.json.items[9].id);
  assert.deepEqual(r.json.total, { entregas: 12, kgFibra: 46440, importe: 97524 });
});
test("[R-LIMITE-OK] limite=3 devuelve 3 (y no '3'+algo)", async () => {
  const r = await api.pedir("GET", "/entregas?productor=Ortiz&limite=3", { token: "consulta" });
  assert.equal(r.json.items.length, 3);
});

// ---------- 2 Defectos ----------
test("[D1] sin Authorization: 401 y el handler NO se ejecuta (sin ERR_HTTP_HEADERS_SENT)", async () => {
  const r = await api.pedir("GET", "/entregas");
  assert.equal(r.status, 401);
  await new Promise((ok) => setTimeout(ok, 20));
  assert.ok(!avisos.some(([, t]) => /HEADERS_SENT|headers after they are sent/i.test(t)), JSON.stringify(avisos));
});
test("[D2] token inválido NO deja leer: 401", async () => {
  for (const token of ["basura", "a.b.c"]) {
    const r = await api.pedir("GET", "/entregas", { token });
    assert.equal(r.status, 401, token);
  }
});
test("[D2] token vencido → 401", async () => {
  const { firmar } = require("../comun/token");
  const r = await api.pedir("GET", "/entregas", { token: firmar({ sub: "x", rol: "operador" }, { expiraEn: -10 }) });
  assert.equal(r.status, 401);
});
test("[D3] rol consulta en POST → 403 sin-permiso", async () => {
  const r = await api.pedir("POST", "/entregas", { token: "consulta", body: ENTREGA_OK });
  assert.equal(r.status, 403);
  assert.match(r.json?.type ?? "", /sin-permiso$/);
});
test("[D4] JSON mal formado (C13) → 400 json-invalido", async () => {
  const r = await postCrudo(camiones.find((c) => c.camion === "C13").cuerpo);
  assert.equal(r.status, 400);
  assert.match(r.json?.type ?? "", /json-invalido$/);
});
test("[D5] error interno: 500 sin filtrar detalles", async () => {
  const r = await api.pedir("GET", "/diagnostico/db");
  assert.equal(r.status, 500);
  assert.doesNotMatch(r.texto, /postgres|Algodon2026|10\.0\.0\.5|at .*\.js/);
  assert.ok(avisos.some(([n]) => n === "error"), "el detalle tiene que quedar en el log");
});
