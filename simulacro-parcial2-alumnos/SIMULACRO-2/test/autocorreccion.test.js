// TESTS DE AUTOCORRECCIÓN — correr con: npm test
// Cada test empieza con una etiqueta que dice qué mide ([T-…] liquidación, [V-…] validación,
// [R-…] rutas, [D…] defectos). Corré uno solo con:
//   node --test --test-name-pattern="V-TEXTO" test/autocorreccion.test.js
const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { liquidar } = require("../src/servicios/liquidacion");
const { levantar, RECEPCION_OK } = require("./ayuda");
const { firmar } = require("../comun/token");
const cisternas = require("../datos/cisternas");

// ---------- 1.1 Liquidación ----------
test("[T-FRIO] grasa bajo la base no se penaliza y temperatura sobre el máximo descuenta (S03)", () => {
  assert.deepEqual(
    liquidar({ litros: 12000, grasa: 3.2, temperatura: 10, clase: "industrial" }),
    { litrosEq: 12000, descuentoFrio: 186, importe: 3534 },
  );
});
test("[T-REDONDEO] se redondea al final (S08)", () => {
  assert.deepEqual(
    liquidar({ litros: 25000, grasa: 4.6, temperatura: 9.5, clase: "extra" }),
    { litrosEq: 32857.14, descuentoFrio: 854.29, importe: 16231.43 },
  );
});
test("[T-FRIO-BORDE] 8 °C justos no descuentan; 8.1 sí", () => {
  assert.equal(liquidar({ litros: 10000, grasa: 3.5, temperatura: 8, clase: "comun" }).descuentoFrio, 0);
  assert.equal(liquidar({ litros: 10000, grasa: 3.5, temperatura: 8.1, clase: "comun" }).descuentoFrio, 225);
});
test("[T-CLASES] precio por clase", () => {
  const base = { litros: 10000, grasa: 3.5, temperatura: 5 };
  assert.equal(liquidar({ ...base, clase: "extra" }).importe, 5200);
  assert.equal(liquidar({ ...base, clase: "comun" }).importe, 4500);
  assert.equal(liquidar({ ...base, clase: "industrial" }).importe, 3100);
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

const post = (body) => api.pedir("POST", "/recepciones", { token: "operador", body });
const postCrudo = (crudo) => api.pedir("POST", "/recepciones", { token: "operador", crudo });

// ---------- 1.2 Validación ----------
const casos = [
  ["[V-TEXTO] litros texto (S04)", { litros: "18000" }, "litros"],
  ["[V-DECIMAL] litros decimal (S05)", { litros: 9500.5 }, "litros"],
  ["[V-TOPE] litros > 40000", { litros: 40001 }, "litros"],
  ["[V-CERO] litros 0", { litros: 0 }, "litros"],
  ["[V-CLASE] clase con mayúscula (S10)", { clase: "Extra" }, "clase"],
  ["[V-TEMP] temperatura fuera de rango (S11)", { temperatura: 16 }, "temperatura"],
  ["[V-TEMP-NEG] temperatura negativa", { temperatura: -1 }, "temperatura"],
  ["[V-GRASA] grasa fuera de rango", { grasa: 7.2 }, "grasa"],
  ["[V-GRASA-BAJA] grasa bajo el mínimo", { grasa: 1.9 }, "grasa"],
  ["[V-GRASA-TEXTO] grasa texto", { grasa: "3.5" }, "grasa"],
  ["[V-GRASA-NULL] grasa null", { grasa: null }, "grasa"],
  ["[V-TAMBO-CORTO] tambo de 2 letras con espacios", { tambo: "  ab  " }, "tambo"],
  ["[V-TAMBO-TIPO] tambo no string", { tambo: 12345 }, "tambo"],
  ["[V-SOBRANTE] campo importe (S07)", { importe: 99999 }, "importe"],
  ["[V-SOBRANTE] campo id", { id: 1 }, "id"],
];
for (const [nombre, cambio, campo] of casos) {
  test(nombre, async () => {
    const r = await post({ ...RECEPCION_OK, ...cambio });
    assert.equal(r.status, 422);
    assert.equal(r.json?.campo, campo);
  });
}
test("[V-INFINITO] litros 1e309 llega como Infinity (S06)", async () => {
  const r = await postCrudo(cisternas.find((c) => c.cisterna === "S06").cuerpo);
  assert.equal(r.status, 422);
  assert.equal(r.json?.campo, "litros");
});
test("[V-FALTA] falta clase", async () => {
  const { clase, ...sinClase } = RECEPCION_OK;
  const r = await post(sinClase);
  assert.equal(r.status, 422);
  assert.equal(r.json?.campo, "clase");
});
test("[V-ORDEN] dos campos mal: informa el primero según el orden del enunciado", async () => {
  const r = await post({ ...RECEPCION_OK, clase: "x", grasa: 99 });
  assert.equal(r.json?.campo, "grasa");
});
test("[V-ORDEN] un sobrante pesa más que un campo inválido", async () => {
  const r = await post({ ...RECEPCION_OK, litros: "x", extra: 1 });
  assert.equal(r.json?.campo, "extra");
});
test("[V-ARRAY] body array → 422 en body", async () => {
  const r = await post([RECEPCION_OK]);
  assert.equal(r.status, 422);
  assert.equal(r.json?.campo, "body");
});
test("[V-TRIM] tambo se guarda sin espacios (S09)", async () => {
  const r = await post({ ...RECEPCION_OK, tambo: "  Pereyra  " });
  assert.equal(r.status, 201);
  assert.equal(r.json.tambo, "Pereyra");
});
test("[V-BORDES] valores justo en los límites se aceptan", async () => {
  for (const cambio of [{ litros: 1 }, { litros: 40000 }, { grasa: 2 }, { grasa: 6 }, { temperatura: 0 }, { temperatura: 15 }]) {
    const r = await post({ ...RECEPCION_OK, ...cambio });
    assert.equal(r.status, 201, JSON.stringify(cambio));
  }
});
test("[V-SOLO-DIEZ] la recepción guardada tiene sólo los campos esperados", async () => {
  const r = await post(RECEPCION_OK);
  assert.deepEqual(Object.keys(r.json).sort(),
    ["clase", "descuentoFrio", "grasa", "id", "importe", "litros", "litrosEq", "recibidaPor", "tambo", "temperatura"]);
});

// ---------- 1.3 Rutas ----------
test("[R-ID] GET /recepciones/:id convierte el id (params es string)", async () => {
  const c = await post(RECEPCION_OK);
  const r = await api.pedir("GET", `/recepciones/${c.json.id}`, { token: "consulta" });
  assert.equal(r.status, 200);
});
test("[R-404] GET /recepciones/99999 y /recepciones/abc → 404 problem+json", async () => {
  for (const id of ["99999", "abc"]) {
    const r = await api.pedir("GET", `/recepciones/${id}`, { token: "consulta" });
    assert.equal(r.status, 404);
    assert.match(r.headers.get("content-type"), /problem\+json/);
  }
});
test("[R-LIMITE] limite inválido → 400 (abc, 0, 51, 2.5, repetido)", async () => {
  for (const q of ["limite=abc", "limite=0", "limite=51", "limite=2.5", "limite=2&limite=3"]) {
    const r = await api.pedir("GET", `/recepciones?${q}`, { token: "consulta" });
    assert.equal(r.status, 400, q);
    assert.equal(r.json?.campo, "limite", q);
  }
});
test("[R-DESDE] desde inválido → 400 (abc, 0, -3, 1.5, repetido)", async () => {
  for (const q of ["desde=abc", "desde=0", "desde=-3", "desde=1.5", "desde=2&desde=3"]) {
    const r = await api.pedir("GET", `/recepciones?${q}`, { token: "consulta" });
    assert.equal(r.status, 400, q);
    assert.equal(r.json?.campo, "desde", q);
  }
});

let ortiz;
const cargarOrtiz = () => (ortiz ??= (async () => {
  for (let i = 0; i < 12; i++) await post({ ...RECEPCION_OK, tambo: "Ortiz" });
})());

test("[R-ORDEN] items de más nuevo a más viejo, limite por defecto 10, totales de todas", async () => {
  await cargarOrtiz();
  const r = await api.pedir("GET", "/recepciones?tambo=Ortiz", { token: "consulta" });
  assert.equal(r.status, 200);
  assert.equal(r.json.items.length, 10);
  assert.ok(r.json.items[0].id > r.json.items[9].id);
  assert.deepEqual(r.json.total, { recepciones: 12, litros: 240000, importe: 139062.84 });
});
test("[R-LIMITE-OK] limite=3 devuelve 3 (y no '3'+algo)", async () => {
  await cargarOrtiz();
  const r = await api.pedir("GET", "/recepciones?tambo=Ortiz&limite=3", { token: "consulta" });
  assert.equal(r.json.items.length, 3);
});
test("[R-FILTRO] tambo filtra por igualdad exacta", async () => {
  await cargarOrtiz();
  const r = await api.pedir("GET", "/recepciones?tambo=Ortiz&limite=50", { token: "consulta" });
  assert.ok(r.json.items.every((x) => x.tambo === "Ortiz"));
  const nada = await api.pedir("GET", "/recepciones?tambo=ortiz", { token: "consulta" });
  assert.deepEqual(nada.json.items, []);
  assert.deepEqual(nada.json.total, { recepciones: 0, litros: 0, importe: 0 });
});
test("[R-CURSOR] siguiente + desde recorren todo sin repetidos ni salteados", async () => {
  await cargarOrtiz();
  const p1 = await api.pedir("GET", "/recepciones?tambo=Ortiz&limite=5", { token: "consulta" });
  assert.equal(p1.json.items.length, 5);
  assert.equal(p1.json.siguiente, p1.json.items[4].id);
  const p2 = await api.pedir("GET", `/recepciones?tambo=Ortiz&limite=5&desde=${p1.json.siguiente}`, { token: "consulta" });
  assert.equal(p2.json.items.length, 5);
  assert.ok(p2.json.items.every((x) => x.id < p1.json.siguiente));
  const p3 = await api.pedir("GET", `/recepciones?tambo=Ortiz&limite=5&desde=${p2.json.siguiente}`, { token: "consulta" });
  assert.equal(p3.json.items.length, 2);
  assert.equal(p3.json.siguiente, null);
  const ids = [...p1.json.items, ...p2.json.items, ...p3.json.items].map((x) => x.id);
  assert.equal(new Set(ids).size, 12);
});
test("[R-CURSOR-TOTAL] el total no depende de desde ni de limite", async () => {
  await cargarOrtiz();
  const r = await api.pedir("GET", "/recepciones?tambo=Ortiz&limite=1&desde=3", { token: "consulta" });
  assert.equal(r.json.total.recepciones, 12);
});
test("[R-CURSOR-FIN] si no queda nada más viejo, siguiente es null (aunque justo llene la página)", async () => {
  await cargarOrtiz();
  const r = await api.pedir("GET", "/recepciones?tambo=Ortiz&limite=12", { token: "consulta" });
  assert.equal(r.json.items.length, 12);
  assert.equal(r.json.siguiente, null);
});
test("[R-ROL] operador y consulta pueden listar; sólo operador puede crear", async () => {
  assert.equal((await api.pedir("GET", "/recepciones", { token: "operador" })).status, 200);
  assert.equal((await api.pedir("GET", "/recepciones", { token: "consulta" })).status, 200);
});

// ---------- 2 Defectos ----------
test("[D1] token inválido → 401 no-autenticado, no 500 (basura, a.b.c, firma adulterada)", async () => {
  const bueno = firmar({ sub: "x", rol: "operador" });
  const adulterado = bueno.slice(0, -3) + (bueno.endsWith("AAA") ? "BBB" : "AAA");
  for (const token of ["basura", "a.b.c", adulterado]) {
    const r = await api.pedir("GET", "/recepciones", { token });
    assert.equal(r.status, 401, token);
    assert.match(r.json?.type ?? "", /no-autenticado$/, token);
  }
  assert.ok(!avisos.some(([n]) => n === "error"), "un token malo no es un error del servidor: " + JSON.stringify(avisos));
});
test("[D1] token vencido → 401", async () => {
  const r = await api.pedir("GET", "/recepciones", { token: firmar({ sub: "x", rol: "operador" }, { expiraEn: -10 }) });
  assert.equal(r.status, 401);
});
test("[D2] la identidad sale sólo del token: X-Usuario se ignora", async () => {
  const r = await api.pedir("POST", "/recepciones", { token: "operador", body: RECEPCION_OK, headers: { "X-Usuario": "root" } });
  assert.equal(r.status, 201);
  assert.equal(r.json.recibidaPor, "ana");
});
test("[D3] rol consulta en POST → 403 sin-permiso y NO se guarda nada", async () => {
  const r = await api.pedir("POST", "/recepciones", { token: "consulta", body: { ...RECEPCION_OK, tambo: "Intruso" } });
  assert.equal(r.status, 403);
  assert.match(r.json?.type ?? "", /sin-permiso$/);
  await new Promise((ok) => setTimeout(ok, 30));
  const lista = await api.pedir("GET", "/recepciones?tambo=Intruso", { token: "consulta" });
  assert.equal(lista.json.total.recepciones, 0, "el 403 se mandó pero el handler igual guardó la recepción");
});
test("[D4] error interno: 500 sin filtrar detalles, ni en el body ni en los encabezados", async () => {
  const r = await api.pedir("GET", "/diagnostico/cache");
  assert.equal(r.status, 500);
  const secreto = /redis|Lacteos2026|10\.0\.0\.9|conectar/i;
  assert.doesNotMatch(r.texto, secreto);
  assert.doesNotMatch(r.texto, /at .*\.js/);
  const encabezados = [...r.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
  assert.doesNotMatch(encabezados, secreto);
  assert.ok(avisos.some(([n]) => n === "error"), "el detalle tiene que quedar en el log");
});
test("[D5] body demasiado grande → 413 body-demasiado-grande (no 500)", async () => {
  const r = await postCrudo(`{"tambo":"${"x".repeat(200_000)}"}`);
  assert.equal(r.status, 413);
  assert.match(r.json?.type ?? "", /body-demasiado-grande$/);
  assert.match(r.headers.get("content-type"), /problem\+json/);
});
test("[E-JSON] JSON mal formado (S13) → 400 json-invalido", async () => {
  const r = await postCrudo(cisternas.find((c) => c.cisterna === "S13").cuerpo);
  assert.equal(r.status, 400);
  assert.match(r.json?.type ?? "", /json-invalido$/);
});
