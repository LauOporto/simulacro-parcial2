// node 03-tiempo-real/04-dos-instancias.js
//
// PREDECÍ ANTES DE EJECUTAR
// Dos instancias de la API detrás de un balanceador. Ana quedó en la 1 y Beto en la 2.
// La instancia 1 emite una alerta a todos. ¿Le llega a Beto?
const http = require("node:http");
const { EventEmitter } = require("node:events");
const { Server } = require("socket.io");
const { io: conectar } = require("socket.io-client");

const levantar = () => new Promise((ok) => {
  const srv = http.createServer();
  const io = new Server(srv);
  srv.listen(0, "127.0.0.1", () => ok({ io, url: `http://127.0.0.1:${srv.address().port}` }));
});
const conectarA = (url, nombre, buzon) => new Promise((ok) => {
  const c = conectar(url);
  c.on("alerta", (a) => buzon.push(`${nombre} recibió ${a}`));
  c.once("connect", () => ok(c));
});
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

(async () => {
  const uno = await levantar(), dos = await levantar();
  const buzon = [];
  const ana = await conectarA(uno.url, "Ana", buzon);
  const beto = await conectarA(dos.url, "Beto", buzon);

  console.log("1. Sin nada que conecte las instancias");
  uno.io.emit("alerta", "A-1");
  await pausa(100);
  console.log("  ", buzon.splice(0));

  console.log("\n2. Con un canal compartido. Acá es un EventEmitter; en producción, Redis pub/sub");
  const canal = new EventEmitter();
  for (const inst of [uno, dos]) canal.on("alerta", (a) => inst.io.emit("alerta", a));
  canal.emit("alerta", "A-2");
  await pausa(100);
  console.log("  ", buzon.splice(0));

  console.log("\nLa conexión vive pegada a un proceso. Cada instancia solo conoce a sus propios clientes.");
  ana.close(); beto.close(); uno.io.close(); dos.io.close();
})();

// PARA PROBAR VOS
// 1. En producción se hace con io.adapter(createAdapter(pub, sub)) de @socket.io/redis-adapter.
//    Socket.IO emite por el canal y las otras instancias reenvían a sus clientes. ¿Qué dibujo te queda?
// 2. Con polling de respaldo y dos instancias, hacen falta "sesiones pegajosas" en el balanceador. ¿Por qué?
// 3. Si dos instancias publican a la vez, ¿todos los clientes ven el mismo orden? ¿Cómo lo resolverías?
