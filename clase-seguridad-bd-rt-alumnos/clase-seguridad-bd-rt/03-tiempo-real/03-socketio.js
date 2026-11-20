// node 03-tiempo-real/03-socketio.js
//
// Socket.IO agrega eventos con nombre, salas, confirmaciones y reconexión.
//
// PREDECÍ ANTES DE EJECUTAR
// a) Socket.IO funciona sobre WebSocket: ¿se puede conectar un WebSocket común a un servidor Socket.IO?
// b) Mandás una alerta a la sala "empresa-1". ¿La recibe un operador de la empresa 2?
// c) ¿Cómo sabe el cliente que el servidor recibió su mensaje?
const http = require("node:http");
const { Server } = require("socket.io");
const { io: conectar } = require("socket.io-client");

const servidor = http.createServer();
const io = new Server(servidor);

io.on("connection", (socket) => {
  socket.on("unirme", (empresa, confirmar) => {
    socket.join(`empresa-${empresa}`);
    confirmar({ ok: true, sala: `empresa-${empresa}` });
  });
  socket.on("nueva-alerta", (alerta, confirmar) => {
    io.to(`empresa-${alerta.empresa}`).emit("alerta", alerta);
    confirmar({ guardada: true, id: 1 });
  });
});

const esperarEvento = (emisor, evento) => new Promise((ok) => emisor.once(evento, ok));

servidor.listen(0, "127.0.0.1", async () => {
  const puerto = servidor.address().port;

  await new Promise((ok) => {
    const nativo = new WebSocket(`ws://127.0.0.1:${puerto}/`);
    nativo.onerror = () => { console.log("a) WebSocket común contra Socket.IO: FALLA la conexión"); ok(); };
    nativo.onopen = () => { console.log("a) WebSocket común: se conectó"); nativo.close(); ok(); };
  });
  console.log("   Socket.IO es un protocolo propio arriba de WebSocket: su cliente es otro.\n");

  const ana = conectar(`http://127.0.0.1:${puerto}`);
  const beto = conectar(`http://127.0.0.1:${puerto}`);
  await Promise.all([esperarEvento(ana, "connect"), esperarEvento(beto, "connect")]);

  console.log("b) Salas");
  console.log("   Ana se une:", await ana.emitWithAck("unirme", 1));
  console.log("   Beto se une:", await beto.emitWithAck("unirme", 2));
  ana.on("alerta", (a) => console.log("   Ana (empresa 1) recibe:", a));
  beto.on("alerta", (a) => console.log("   Beto (empresa 2) recibe:", a));

  console.log("\nc) Confirmación");
  const conf = await beto.emitWithAck("nueva-alerta", { empresa: 1, sensor: "S-01" });
  console.log("   Beto recibe la confirmación del servidor:", conf);
  await new Promise((ok) => setTimeout(ok, 100));

  ana.close(); beto.close(); io.close();
});

// PARA PROBAR VOS
// 1. Mirá la salida: Beto emitió para la empresa 1 y solo Ana recibió. ¿Qué pasa si no usás salas y hacés io.emit?
//    ¿Qué datos de una empresa verían los usuarios de otra?
// 2. Probá socket.broadcast.to(...) en lugar de io.to(...). ¿Quién queda afuera?
