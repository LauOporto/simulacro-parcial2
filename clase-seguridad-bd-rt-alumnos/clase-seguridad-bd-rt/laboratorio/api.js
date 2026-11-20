// API con seis defectos. Arreglala hasta que pasen las pruebas: npm run lab
const http = require("node:http");
const express = require("express");
const { Server } = require("socket.io");

const REGEX_EMAIL = /^([a-z0-9]+\.?)+@ejemplo\.com$/;

// almacen: compartido entre instancias. leer, escribir, incrementar (atómico), escribirSi (optimista).
// tokens: Map de token -> { uid, empresa }. origenes: lista de orígenes permitidos.
function crearServidor({ almacen, tokens, origenes }) {
  const app = express();
  app.use(express.json());

  // DEFECTO 1: contador propio de cada instancia, sin límite real.
  let intentos = 0;
  app.post("/login", (req, res) => {
    intentos++;
    res.json({ intento: intentos });
  });

  // DEFECTO 2: regex con retroceso catastrófico.
  app.post("/registro", (req, res) => {
    if (!REGEX_EMAIL.test(req.body.email)) return res.status(422).json({ error: "email inválido" });
    res.status(201).json({ email: req.body.email });
  });

  // DEFECTO 3: leer y después escribir pierde actualizaciones.
  app.post("/contador", async (req, res) => {
    const { valor } = await almacen.leer("contador");
    await almacen.escribir("contador", valor + 1);
    res.sendStatus(204);
  });
  app.get("/contador", async (req, res) => res.json(await almacen.leer("contador")));

  const servidor = http.createServer(app);
  // DEFECTO 4: no chequea el origen.
  const io = new Server(servidor);

  const historial = [];
  // DEFECTO 5: no exige token, y la empresa la elige el cliente.
  io.on("connection", (socket) => {
    socket.on("unirme", (empresa, responder) => {
      socket.join(`empresa-${empresa}`);
      responder({ sala: `empresa-${empresa}` });
    });
    // DEFECTO 6: devuelve siempre vacío.
    socket.on("desde", (ultimo, responder) => responder([]));
  });

  function publicar(empresa) {
    const alerta = { seq: historial.length + 1, empresa };
    historial.push(alerta);
    io.to(`empresa-${empresa}`).emit("alerta", alerta);
    return alerta;
  }
  return { servidor, io, publicar };
}
module.exports = { crearServidor };
