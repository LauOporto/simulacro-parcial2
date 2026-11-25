// YA RESUELTO. Levanta la API: npm start
const { crearApp } = require("./app");

const PUERTO = Number(process.env.PORT ?? 3000);
crearApp().listen(PUERTO, () => console.log(`Cooperativa escuchando en http://localhost:${PUERTO}`));
