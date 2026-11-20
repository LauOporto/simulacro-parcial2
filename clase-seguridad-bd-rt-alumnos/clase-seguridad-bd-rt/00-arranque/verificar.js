// node 00-arranque/verificar.js
// Si esto imprime TODO OK, tu máquina está lista para la clase.
const [mayor, menor] = process.versions.node.split(".").map(Number);
const versionOk = mayor > 22 || (mayor === 22 && menor >= 13);
console.log(`Node ${process.versions.node}`, versionOk ? "OK" : "<-- necesitás Node 22.13 o más");
let dependencias = true;
for (const p of ["express", "socket.io", "socket.io-client"]) {
  try { console.log(`${p} ${require(`${p}/package.json`).version} OK`); }
  catch { dependencias = false; console.log(`${p} falta: corré npm install`); }
}
console.log(versionOk && dependencias ? "TODO OK" : "Algo falta: avisá.");
