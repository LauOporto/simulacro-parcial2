// node 03-tiempo-real/05-reconexion.js
//
// PREDECÍ ANTES DE EJECUTAR
// Un operador pierde la señal 300 ms y salen dos alertas. Socket.IO reconecta solo.
// ¿Recibe esas alertas? ¿Y si cada alerta tiene número y el cliente pide lo que le falta?
const http = require("node:http");
const { Server } = require("socket.io");
const { io: conectar } = require("socket.io-client");

const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function escenario(conCatchUp) {
  const srv = http.createServer();
  const io = new Server(srv);
  const historial = [];
  io.on("connection", (s) => {
    s.on("desde", (ultimo, responder) => responder(historial.filter((a) => a.seq > ultimo)));
  });
  const publicar = (seq) => { const a = { seq }; historial.push(a); io.emit("alerta", a); };
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));

  const vistas = new Map(); // seq -> alerta: si llega repetida, no se cuenta dos veces
  const cliente = conectar(`http://127.0.0.1:${srv.address().port}`, { reconnectionDelay: 50, reconnectionDelayMax: 50 });
  const registrar = (a) => vistas.set(a.seq, a);
  cliente.on("alerta", registrar);
  await new Promise((ok) => cliente.once("connect", ok));

  publicar(1); publicar(2);
  await pausa(50);

  cliente.io.engine.close();      // se corta la señal
  await pausa(10);
  publicar(3); publicar(4);       // salen mientras no está
  await new Promise((ok) => cliente.once("connect", ok)); // reconecta solo

  if (conCatchUp) {
    const ultimo = Math.max(...vistas.keys());
    (await cliente.emitWithAck("desde", ultimo)).forEach(registrar);
  }
  publicar(5);
  await pausa(50);

  const lista = [...vistas.keys()].sort((a, b) => a - b);
  cliente.close(); io.close();
  return lista;
}

(async () => {
  console.log("Se publicaron las alertas 1, 2, 3, 4, 5.");
  console.log("Reconexión sola:           recibió", await escenario(false), "<-- ningún error");
  console.log("Reconexión con pedido:     recibió", await escenario(true));
})();

// PARA PROBAR VOS
// 1. Tu panel dice "conectado" y le faltan las alertas 3 y 4. ¿Cómo se daría cuenta un operador?
// 2. Socket.IO tiene connectionStateRecovery para cortes breves. Leé qué no cubre. ¿Reemplaza a guardar el historial?
// 3. ¿Dónde guardás el historial si hay dos instancias?
