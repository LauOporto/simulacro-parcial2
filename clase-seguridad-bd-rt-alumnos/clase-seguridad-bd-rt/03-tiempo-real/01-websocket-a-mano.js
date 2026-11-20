// node 03-tiempo-real/01-websocket-a-mano.js
//
// Un servidor WebSocket sin librerías. El cliente es el WebSocket que ya viene en Node, igual al del navegador.
//
// PREDECÍ ANTES DE EJECUTAR
// a) ¿Una conexión WebSocket arranca como HTTP o como otro protocolo?
// b) El cliente manda "hola". ¿Viajan esos 4 bytes tal cual por la red?
const http = require("node:http");
const crypto = require("node:crypto");

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"; // constante fijada por RFC 6455

function decodificarFrame(b) {
  const fin = Boolean(b[0] & 0x80);
  const opcode = b[0] & 0x0f;
  const enmascarado = Boolean(b[1] & 0x80);
  const largo = b[1] & 0x7f; // alcanza para esta demo: mensajes de menos de 126 bytes
  const mascara = b.subarray(2, 6);
  const cargado = b.subarray(6, 6 + largo);
  const texto = Buffer.from(cargado.map((byte, i) => byte ^ mascara[i % 4])).toString();
  return { fin, opcode, enmascarado, largo, mascara, cargado, texto };
}
function armarFrameTexto(texto) {
  const datos = Buffer.from(texto);
  return Buffer.concat([Buffer.from([0x81, datos.length]), datos]); // 0x81 = FIN + opcode de texto
}

const server = http.createServer((req, res) => res.end("Esto es HTTP normal\n"));
server.on("upgrade", (req, socket) => {
  console.log("1. Llega un GET de HTTP común:");
  console.log(`   ${req.method} ${req.url}`);
  console.log(`   Upgrade: ${req.headers.upgrade}`);
  console.log(`   Sec-WebSocket-Key: ${req.headers["sec-websocket-key"]}`);

  const aceptacion = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + GUID).digest("base64");
  console.log(`\n2. Respondemos 101 con SHA-1(clave + GUID) en base64: ${aceptacion}`);
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${aceptacion}\r\n\r\n`);

  socket.on("data", (buffer) => {
    const f = decodificarFrame(buffer);
    if (f.opcode === 0x8) return socket.end();
    console.log("\n3. Llega un frame:");
    console.log(`   bytes en la red:  ${buffer.toString("hex")}`);
    console.log(`   FIN=${f.fin}  opcode=${f.opcode} (1 es texto)  enmascarado=${f.enmascarado}  largo=${f.largo}`);
    console.log(`   máscara:          ${f.mascara.toString("hex")}`);
    console.log(`   datos en la red:  ${f.cargado.toString("hex")}  <-- no se lee "hola"`);
    console.log(`   datos ^ máscara:  "${f.texto}"`);
    socket.write(armarFrameTexto(`recibí: ${f.texto}`));
  });
  socket.on("error", () => {});
});

server.listen(0, "127.0.0.1", () => {
  const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/alertas`);
  ws.onopen = () => ws.send("hola");
  ws.onmessage = (e) => {
    console.log(`\n4. El cliente recibe: "${e.data}"`);
    ws.close();
    server.closeAllConnections();
    server.close();
  };
});

// PARA PROBAR VOS
// 1. Mandá "hola" dos veces. ¿Cambian los bytes en la red? ¿Por qué la máscara es aleatoria en cada mensaje?
// 2. La máscara no es seguridad: el valor va en el mismo frame. Existe para no confundir a proxies viejos. Leé RFC 6455 §10.3.
// 3. Mandá un mensaje de 200 caracteres. Se rompe: buscá en RFC 6455 §5.2 cómo se codifican los largos mayores a 125.
