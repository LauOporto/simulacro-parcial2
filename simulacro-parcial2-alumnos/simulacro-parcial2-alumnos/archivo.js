// const query = Object.fromEntries(new URLSearchParams("limite=2&pagina=0"));
// const limite = query.limite ?? 10;
// const pagina = query.pagina || 1;
// console.log(limite, 1, pagina, typeof limite, typeof pagina);
// console.log([10, 20, 30, 40, 50].slice(0, limite + 1).length);

// const express = require("express");
// const app = express();
// app.use((req, res, next) => { console.log("A1"); next(); console.log("A2"); });
// app.use(async (req, res) => {
//   console.log("B1");
//   await null;
//   console.log("B2");
//   res.json({ ok: true });
// });
// const s = app.listen(0, async () => {
//   await fetch(`http://localhost:${s.address().port}/`);
//   console.log("C");
//   s.close();
// });

const body = JSON.parse('{"kgBrutos": 1e309, "humedad": "12", "grado": null}');
// console.log("kgbrutos", body.kgBrutos)
// console.log("humedad", body.humedad, typeof body.humedad )
// console.log("grado", body.grado)

console.log(body.kgBrutos > 0, body.humedad > 11, Number.isInteger(body.kgBrutos));
console.log(JSON.stringify({ kg: body.kgBrutos, fecha: undefined, total: 0 / 0, grado: body.grado }));