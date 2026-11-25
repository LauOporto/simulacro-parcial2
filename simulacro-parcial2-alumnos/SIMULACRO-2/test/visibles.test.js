// Tests visibles: npm test
// Que pasen NO garantiza la nota: el docente corre además otros tests sobre los mismos casos
// del enunciado (y sobre las cisternas de datos/cisternas.js).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { liquidar } = require("../src/servicios/liquidacion");
const { levantar, RECEPCION_OK } = require("./ayuda");

test("1.1 liquidar: grasa sobre la base bonifica y sin frío no hay descuento", () => {
  assert.deepEqual(liquidar(RECEPCION_OK), { litrosEq: 22285.71, descuentoFrio: 0, importe: 11588.57 });
});

test("1.1 liquidar: grasa justo en la base y temperatura justo en el máximo", () => {
  assert.deepEqual(
    liquidar({ litros: 15000, grasa: 3.5, temperatura: 8, clase: "comun" }),
    { litrosEq: 15000, descuentoFrio: 0, importe: 6750 },
  );
});

let api;
before(async () => { api = await levantar(); });
after(() => api.cerrar());

test("1.3 POST /recepciones válida → 201 con Location y la liquidación", async () => {
  const r = await api.pedir("POST", "/recepciones", { token: "operador", body: RECEPCION_OK });
  assert.equal(r.status, 201);
  assert.equal(r.headers.get("location"), `/recepciones/${r.json.id}`);
  assert.equal(r.json.importe, 11588.57);
  assert.equal(r.json.recibidaPor, "ana");
});

test("1.2 POST /recepciones con litros como texto → 422 en litros", async () => {
  const r = await api.pedir("POST", "/recepciones", { token: "operador", body: { ...RECEPCION_OK, litros: "20000" } });
  assert.equal(r.status, 422);
  assert.match(r.headers.get("content-type"), /application\/problem\+json/);
  assert.equal(r.json.campo, "litros");
});

test("1.3 GET /recepciones/:id de una que existe → 200", async () => {
  const creada = await api.pedir("POST", "/recepciones", { token: "operador", body: RECEPCION_OK });
  const r = await api.pedir("GET", `/recepciones/${creada.json.id}`, { token: "consulta" });
  assert.equal(r.status, 200);
  assert.equal(r.json.id, creada.json.id);
});

test("2 GET /recepciones sin token → 401", async () => {
  const r = await api.pedir("GET", "/recepciones");
  assert.equal(r.status, 401);
});

test("2 POST /recepciones con rol consulta → 403", async () => {
  const r = await api.pedir("POST", "/recepciones", { token: "consulta", body: RECEPCION_OK });
  assert.equal(r.status, 403);
});
