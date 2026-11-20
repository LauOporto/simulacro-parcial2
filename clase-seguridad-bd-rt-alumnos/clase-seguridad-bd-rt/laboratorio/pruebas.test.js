const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { io: conectar } = require("socket.io-client");
const { pedir, esperar } = require("../comun/red");

const { crearServidor } = require(process.env.LAB_API ? path.resolve(process.env.LAB_API) : "./api");

function crearAlmacen() {
  const datos = new Map();
  return {
    async leer(k) { await esperar(1); return datos.get(k) ?? { valor: 0, version: 0 }; },
    async escribir(k, valor) { await esperar(1); const v = datos.get(k)?.version ?? 0; datos.set(k, { valor, version: v + 1 }); },
    async incrementar(k) { await esperar(1); const a = datos.get(k) ?? { valor: 0, version: 0 }; datos.set(k, { valor: a.valor + 1, version: a.version + 1 }); return a.valor + 1; },
    async escribirSi(k, version, valor) {
      await esperar(1);
      const a = datos.get(k) ?? { valor: 0, version: 0 };
      if (a.version !== version) return false;
      datos.set(k, { valor, version: version + 1 });
      return true;
    },
  };
}
const BUENO = "https://panel.ejemplo.edu";
const tokens = new Map([["token-ana", { uid: "ana", empresa: 1 }], ["token-beto", { uid: "beto", empresa: 2 }]]);

const levantar = (opciones = {}) => new Promise((ok) => {
  const inst = crearServidor({ almacen: crearAlmacen(), tokens, origenes: [BUENO], ...opciones });
  inst.servidor.listen(0, "127.0.0.1", () => ok({ ...inst, url: `http://127.0.0.1:${inst.servidor.address().port}`, puerto: inst.servidor.address().port }));
});
const cerrar = (i) => new Promise((ok) => i.io.close(() => ok()));
const conectado = (url, auth) => new Promise((ok, mal) => {
  const c = conectar(url, { auth, reconnection: false, extraHeaders: { Origin: BUENO } });
  c.once("connect", () => ok(c));
  c.once("connect_error", (e) => { c.close(); mal(e); });
});

describe("1. Rate limit", () => {
  test("5 pasan entre dos instancias, con pedidos simultáneos, y el resto recibe 429", async () => {
    const almacen = crearAlmacen();
    const [a, b] = [await levantar({ almacen }), await levantar({ almacen })];
    const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => pedir(`${(i % 2 ? a : b).url}/login`, { metodo: "POST", cuerpo: {} })));
    assert.equal(rs.filter((r) => r.status === 429).length, 15);
    assert.ok(rs.find((r) => r.status === 429)?.headers.get("retry-after"), "falta Retry-After");
    await cerrar(a); await cerrar(b);
  });
});

describe("2. ReDoS", () => {
  let s;
  before(async () => { s = await levantar(); });
  after(() => cerrar(s));
  const registrar = (email) => pedir(`${s.url}/registro`, { metodo: "POST", cuerpo: { email } });
  test("email válido: 201", async () => {
    assert.equal((await registrar("ana.perez@ejemplo.com")).status, 201);
    assert.equal((await registrar("ana@ejemplo.com")).status, 201);
  });
  test("email inválido: 422", async () => assert.equal((await registrar("ana@otro.com")).status, 422));
  test("no acepta cosas raras", async () => assert.equal((await registrar("ana..perez@ejemplo.com")).status, 422));
  test("texto de ataque: menos de 100 ms", { timeout: 20000 }, async () => {
    const t = Date.now();
    const r = await registrar("a".repeat(38) + "!");
    assert.equal(r.status, 422);
    assert.ok(Date.now() - t < 100, `tardó ${Date.now() - t} ms`);
  });
});

describe("3. Concurrencia", () => {
  test("30 pedidos simultáneos: el contador queda en 30", async () => {
    const s = await levantar();
    await Promise.all(Array.from({ length: 30 }, () => pedir(`${s.url}/contador`, { metodo: "POST" })));
    assert.equal((await pedir(`${s.url}/contador`)).datos.valor, 30);
    await cerrar(s);
  });
});

describe("4. Origen", () => {
  const handshake = (puerto, origen) => new Promise((ok) => {
    const req = http.request({ port: puerto, host: "127.0.0.1", path: "/socket.io/?EIO=4&transport=websocket",
      headers: { Connection: "Upgrade", Upgrade: "websocket", Origin: origen, "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==" } });
    req.on("upgrade", (res, socket) => { socket.destroy(); ok(res.statusCode); });
    req.on("response", (res) => { res.resume(); ok(res.statusCode); });
    req.on("error", () => ok(0));
    req.end();
  });
  test("origen ajeno, rechazado; origen permitido, aceptado", async () => {
    const s = await levantar();
    assert.notEqual(await handshake(s.puerto, "https://malo.example"), 101);
    assert.equal(await handshake(s.puerto, BUENO), 101);
    await cerrar(s);
  });
});

describe("5. Identidad y salas", () => {
  let s;
  before(async () => { s = await levantar(); });
  after(() => cerrar(s));
  test("sin token, no conecta", async () => { await assert.rejects(conectado(s.url, {})); });
  test("con token inventado, no conecta", async () => { await assert.rejects(conectado(s.url, { token: "falso" })); });
  test("la empresa sale del token, no del cliente", async () => {
    const beto = await conectado(s.url, { token: "token-beto" });
    const recibidas = [];
    beto.on("alerta", (a) => recibidas.push(a));
    await beto.emitWithAck("unirme", 1); // Beto es de la empresa 2 e intenta entrar a la 1
    s.publicar(1);
    await esperar(50);
    beto.close();
    assert.equal(recibidas.length, 0, "Beto recibió alertas de otra empresa");
  });
  test("un usuario recibe las alertas de su empresa", async () => {
    const ana = await conectado(s.url, { token: "token-ana" });
    const recibidas = [];
    ana.on("alerta", (a) => recibidas.push(a));
    await ana.emitWithAck("unirme", 1);
    s.publicar(1);
    await esperar(50);
    ana.close();
    assert.equal(recibidas.length, 1);
  });
});

describe("6. Reconexión", () => {
  test("'desde' devuelve lo que faltó, y solo de su empresa", async () => {
    const s = await levantar();
    const a1 = s.publicar(1); s.publicar(2); const a3 = s.publicar(1);
    const ana = await conectado(s.url, { token: "token-ana" });
    const faltantes = await ana.emitWithAck("desde", a1.seq);
    ana.close();
    assert.deepEqual(faltantes.map((a) => a.seq), [a3.seq]);
    await cerrar(s);
  });
});
