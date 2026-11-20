// Tests visibles: npm test
// Que pasen NO garantiza la nota: el docente corre además otros tests sobre los mismos casos
// del enunciado (y sobre los camiones de datos/camiones.js).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { liquidar } = require("../src/servicios/liquidacion");
const { levantar, ENTREGA_OK } = require("./ayuda");

test("1.1 liquidar: con humedad sobre la base se descuenta", () => {
  assert.deepEqual(liquidar(ENTREGA_OK), { kgSecos: 11727.27, kgFibra: 3870, importe: 8127 });
});

test("1.1 liquidar: con humedad justo en la base no se descuenta", () => {
  assert.deepEqual(
    liquidar({ kgBrutos: 9500, humedad: 12, rendimiento: 35, grado: "B" }),
    { kgSecos: 9500, kgFibra: 3325, importe: 6151.25 },
  );
});

let api;
before(async () => { api = await levantar(); });
after(() => api.cerrar());

test("1.3 POST /entregas válida → 201 con Location y la liquidación", async () => {
  const r = await api.pedir("POST", "/entregas", { token: "operador", body: ENTREGA_OK });
  assert.equal(r.status, 201);
  assert.equal(r.headers.get("location"), `/entregas/${r.json.id}`);
  assert.equal(r.json.importe, 8127);
  assert.equal(r.json.registradaPor, "ana");
});

test("1.2 POST /entregas con kgBrutos como texto → 422 en kgBrutos", async () => {
  const r = await api.pedir("POST", "/entregas", { token: "operador", body: { ...ENTREGA_OK, kgBrutos: "12000" } });
  assert.equal(r.status, 422);
  assert.match(r.headers.get("content-type"), /application\/problem\+json/);
  assert.equal(r.json.campo, "kgBrutos");
});

test("1.3 GET /entregas/:id de una que existe → 200", async () => {
  const creada = await api.pedir("POST", "/entregas", { token: "operador", body: ENTREGA_OK });
  const r = await api.pedir("GET", `/entregas/${creada.json.id}`, { token: "consulta" });
  assert.equal(r.status, 200);
  assert.equal(r.json.id, creada.json.id);
});

test("2 GET /entregas sin token → 401", async () => {
  const r = await api.pedir("GET", "/entregas");
  assert.equal(r.status, 401);
});

test("2 POST /entregas con rol consulta → 403", async () => {
  const r = await api.pedir("POST", "/entregas", { token: "consulta", body: ENTREGA_OK });
  assert.equal(r.status, 403);
});
