// node 03-tiempo-real/02-polling-contra-sse.js
//
// Server-Sent Events: una respuesta HTTP que nunca termina. Va del servidor al cliente, y nada más.
//
// PREDECÍ ANTES DE EJECUTAR
// En 3 segundos hay 3 alertas. Polling pregunta cada 500 ms.
// ¿Cuántos pedidos hace cada uno? ¿Cuánto tarda en enterarse el cliente?
// Si el cliente SSE se corta, ¿pierde lo que pasó mientras tanto?
const express = require("express");
const { levantar, esperar } = require("../comun/red");

const eventos = [];
const clientes = new Set();
let pedidosPolling = 0, pedidosSSE = 0;

const app = express();
app.get("/polling", (req, res) => {
  pedidosPolling++;
  res.json(eventos.filter((e) => e.id > Number(req.query.desde)));
});
app.get("/sse", (req, res) => {
  pedidosSSE++;
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }).flushHeaders();
  const escribir = (e) => res.write(`id: ${e.id}\ndata: ${JSON.stringify(e)}\n\n`);
  // Al reconectar, el navegador manda solo el último id que vio.
  const ultimo = Number(req.get("Last-Event-ID") ?? eventos.at(-1)?.id ?? 0);
  eventos.filter((e) => e.id > ultimo).forEach(escribir);
  clientes.add(escribir);
  req.on("close", () => clientes.delete(escribir));
});
function publicar(id) {
  const e = { id, enviado: Date.now() };
  eventos.push(e);
  clientes.forEach((c) => c(e));
}

async function escucharSSE(url, { headers = {}, senial, alRecibir }) {
  const res = await fetch(url, { headers, signal: senial });
  const lector = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let resto = "";
  try {
    for (;;) {
      const { value, done } = await lector.read();
      if (done) return;
      resto += value;
      const partes = resto.split("\n\n");
      resto = partes.pop();
      for (const p of partes) alRecibir(JSON.parse(p.split("data: ")[1]));
    }
  } catch { /* conexión cortada */ }
}

(async () => {
  const s = await levantar(app);
  const demorasP = [], demorasS = [];

  let desde = 0, polling = true;
  (async () => {
    while (polling) {
      const lista = await (await fetch(`${s.url}/polling?desde=${desde}`)).json();
      for (const e of lista) { demorasP.push(Date.now() - e.enviado); desde = e.id; }
      await esperar(500);
    }
  })();

  const corte = new AbortController();
  let ultimoVisto = 0;
  const sse = escucharSSE(`${s.url}/sse`, { senial: corte.signal, alRecibir: (e) => { demorasS.push(Date.now() - e.enviado); ultimoVisto = e.id; } });

  for (let i = 1; i <= 3; i++) { await esperar(870); publicar(i); }
  await esperar(600);
  polling = false;

  const prom = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0);
  console.log("        pedidos HTTP   demora promedio");
  console.log(`polling ${String(pedidosPolling).padEnd(14)} ${prom(demorasP)} ms`);
  console.log(`SSE     ${String(pedidosSSE).padEnd(14)} ${prom(demorasS)} ms`);

  console.log("\nSe corta el cliente SSE, y mientras tanto salen las alertas 4 y 5");
  corte.abort();
  await sse;
  await esperar(50);
  publicar(4); publicar(5);
  const recibidas = [];
  const corte2 = new AbortController();
  const sse2 = escucharSSE(`${s.url}/sse`, { senial: corte2.signal, headers: { "Last-Event-ID": String(ultimoVisto) }, alRecibir: (e) => recibidas.push(e.id) });
  await esperar(100);
  corte2.abort();
  await sse2;
  console.log(`Reconecta con Last-Event-ID: ${ultimoVisto} y recibe: ${recibidas}`);
  await s.cerrar();
})();

// PARA PROBAR VOS
// 1. Bajá el polling a 50 ms. ¿Qué pasa con la demora? ¿Y con la cantidad de pedidos si hay 10.000 usuarios?
// 2. Para un panel que solo muestra alertas, ¿necesitás WebSocket? ¿Y para un chat?
// 3. En el navegador, EventSource reconecta solo y manda Last-Event-ID sin que escribas código. ¿Qué tuvimos que programar acá a mano?
