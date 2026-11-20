// node 01-seguridad/04-redos.js
//
// PREDECÍ ANTES DE EJECUTAR
// Validamos un email con una regex. El texto de ataque tiene 2 caracteres más cada vez.
// ¿El tiempo crece un poquito, o se multiplica?
// Una sola petición con ese texto, ¿afecta a los demás usuarios?
const { fork } = require("node:child_process");
const { pedir } = require("../comun/red");

const MALA = /^([a-z0-9]+\.?)+@ejemplo\.com$/;
const BUENA = /^[a-z0-9]+(\.[a-z0-9]+)*@ejemplo\.com$/;

if (process.argv[2] === "servidor") {
  const express = require("express");
  const app = express();
  app.use(express.json());
  // V8 compila la regex recién al segundo uso. La usamos antes, como pasa en un servidor ya en marcha.
  MALA.test("a@ejemplo.com"); MALA.test("a@ejemplo.com");
  app.post("/registro", (req, res) => res.json({ valido: MALA.test(req.body.email) }));
  app.get("/salud", (req, res) => res.json({ ok: true }));
  const s = app.listen(0, "127.0.0.1", () => process.send(s.address().port));
} else {
  const medir = (regex, texto) => {
    const t = process.hrtime.bigint();
    regex.test(texto);
    return Number(process.hrtime.bigint() - t) / 1e6;
  };
  MALA.test("a@ejemplo.com"); MALA.test("a@ejemplo.com"); // que V8 la compile antes de medir
  console.log("largo   regex mala     regex buena");
  let largoAtaque = 0;
  for (let n = 24; n <= 40; n += 2) {
    const texto = "a".repeat(n) + "!";
    const mala = medir(MALA, texto);
    console.log(String(n).padEnd(7), `${mala.toFixed(1)} ms`.padEnd(14), `${medir(BUENA, texto).toFixed(3)} ms`);
    largoAtaque = n;
    if (mala > 800) break;
  }
  const email = "a".repeat(largoAtaque) + "!";

  (async () => {
    console.log("\nAhora, contra un servidor de verdad en otro proceso");
    const hijo = fork(__filename, ["servidor"], { timeout: 30000 });
    const puerto = await new Promise((ok) => hijo.once("message", ok));
    const url = `http://127.0.0.1:${puerto}`;

    const salud = async () => { const t = Date.now(); await pedir(`${url}/salud`); return Date.now() - t; };
    console.log(`/salud sin ataque:  ${await salud()} ms`);
    const inicio = Date.now();
    const ataque = pedir(`${url}/registro`, { metodo: "POST", cuerpo: { email } })
      .then(() => console.log(`el ataque terminó a los ${Date.now() - inicio} ms`));
    await new Promise((ok) => setTimeout(ok, 50));
    console.log(`/salud durante el ataque: ${await salud()} ms  <-- ${email.length} bytes frenaron a TODOS los usuarios`);
    await ataque;
    hijo.kill();
  })();
}

// PARA PROBAR VOS
// 1. ¿Por qué se multiplica? El + adentro de otro + deja dividir "aaaa" de muchísimas formas,
//    y el motor las prueba todas antes de rendirse.
// 2. La regex buena, ¿acepta exactamente lo mismo que la mala? Probá con varios emails.
// 3. Un límite de largo (por ejemplo, 254 caracteres para un email) ¿alcanza con la regex mala?
// 4. Conectalo con la clase de event loop: ¿por qué un async no te salva?
