// node 03-tiempo-real/06-origen-y-token.js
//
// PREDECÍ ANTES DE EJECUTAR
// a) Una página maliciosa abre un WebSocket a tu servidor desde el navegador de una víctima.
//    ¿La política de mismo origen del navegador la frena?
// b) ¿Qué pasa si un cliente se conecta sin token?
const http = require("node:http");
const { Server } = require("socket.io");
const { io: conectar } = require("socket.io-client");

function crearServidor(opciones) {
  const srv = http.createServer();
  const io = new Server(srv, opciones);
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ io, puerto: srv.address().port })));
}

// Un handshake a mano, con el Origin que mandaría el navegador desde otro sitio.
function handshake(puerto, origen) {
  return new Promise((ok) => {
    const req = http.request({
      port: puerto, host: "127.0.0.1", path: "/socket.io/?EIO=4&transport=websocket",
      headers: {
        Connection: "Upgrade", Upgrade: "websocket", Origin: origen,
        "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
      },
    });
    req.on("upgrade", (res, socket) => { socket.destroy(); ok(`${res.statusCode}: conexión aceptada`); });
    req.on("response", (res) => { res.resume(); ok(`${res.statusCode}: rechazada`); });
    req.on("error", () => ok("conexión cortada: rechazada"));
    req.end();
  });
}

(async () => {
  const MALO = "https://sitio-malicioso.example";
  const BUENO = "https://panel.telemetria.example";

  console.log("a) Origen");
  const abierto = await crearServidor({ cors: { origin: BUENO } });
  console.log("   Solo con la opción cors, origen malicioso ->", await handshake(abierto.puerto, MALO));
  abierto.io.close();

  const cerrado = await crearServidor({
    allowRequest: (req, cb) => cb(null, req.headers.origin === BUENO),
  });
  console.log("   Con allowRequest, origen malicioso        ->", await handshake(cerrado.puerto, MALO));
  console.log("   Con allowRequest, origen correcto         ->", await handshake(cerrado.puerto, BUENO));
  cerrado.io.close();

  console.log("\nb) Token");
  const seguro = await crearServidor();
  seguro.io.use((socket, next) => {
    if (socket.handshake.auth.token === "token-valido") { socket.data.uid = "ana"; return next(); }
    next(new Error("no autenticado"));
  });
  seguro.io.on("connection", (s) => console.log(`   Conectada, uid sacado del token: ${s.data.uid}`));

  const intentar = (auth) => new Promise((ok) => {
    const c = conectar(`http://127.0.0.1:${seguro.puerto}`, { auth, reconnection: false });
    c.once("connect", () => { c.close(); ok("conectó"); });
    c.once("connect_error", (e) => { c.close(); ok(`rechazado: ${e.message}`); });
  });
  console.log("   Sin token:   ", await intentar({}));
  console.log("   Token válido:", await intentar({ token: "token-valido" }));
  seguro.io.close();
})();

// PARA PROBAR VOS
// 1. Las cookies viajan en el handshake aunque la página sea de otro sitio. Si tu sesión es por cookie,
//    ¿qué puede hacer la página maliciosa sin el chequeo de Origin? Eso se llama CSWSH.
// 2. Un cliente fuera del navegador manda el Origin que quiera. ¿Este chequeo protege algo en ese caso?
// 3. El token por query string queda en los logs del proxy. ¿Por qué auth: { token } es mejor?
// 4. El token venció mientras el socket seguía abierto. ¿Qué pasa? ¿Cómo lo resolverías?
