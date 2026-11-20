// YA RESUELTO. No modifiques estos datos.
// Lo que mandó la balanza de la desmotadora durante la mañana. Cada cuerpo es el TEXTO
// exacto que llega por HTTP (por eso son strings: algunos no se pueden escribir como objeto JS).
module.exports = [
  { camion: "C01", cuerpo: '{"productor":"Benítez","kgBrutos":12000,"humedad":14,"rendimiento":33,"grado":"A"}' },
  { camion: "C02", cuerpo: '{"productor":"Kowalczuk","kgBrutos":9500,"humedad":12,"rendimiento":35,"grado":"B"}' },
  { camion: "C03", cuerpo: '{"productor":"Sotelo","kgBrutos":15000,"humedad":9,"rendimiento":31,"grado":"C"}' },
  { camion: "C04", cuerpo: '{"productor":"Benítez","kgBrutos":"11000","humedad":13,"rendimiento":32,"grado":"B"}' },
  { camion: "C05", cuerpo: '{"productor":"Kowalczuk","kgBrutos":8000.5,"humedad":11,"rendimiento":34,"grado":"A"}' },
  { camion: "C06", cuerpo: '{"productor":"Sotelo","kgBrutos":1e309,"humedad":12,"rendimiento":30,"grado":"C"}' },
  { camion: "C07", cuerpo: '{"productor":"Benítez","kgBrutos":7000,"humedad":12,"rendimiento":33,"grado":"A","importe":99999}' },
  { camion: "C08", cuerpo: '{"productor":"Kowalczuk","kgBrutos":20000,"humedad":17.5,"rendimiento":36.5,"grado":"A"}' },
  { camion: "C09", cuerpo: '{"productor":"  Sotelo  ","kgBrutos":13000,"humedad":12.5,"rendimiento":30,"grado":"B"}' },
  { camion: "C10", cuerpo: '{"productor":"Benítez","kgBrutos":10000,"humedad":12,"rendimiento":32,"grado":"a"}' },
  { camion: "C11", cuerpo: '{"productor":"Sotelo","kgBrutos":9000,"humedad":10,"rendimiento":45,"grado":"B"}' },
  { camion: "C12", cuerpo: '{"productor":"Benítez","kgBrutos":18000,"humedad":13,"rendimiento":34,"grado":"B"}' },
  { camion: "C13", cuerpo: '{"productor":"Sotelo","kgBrutos":11000,"humedad":' },
];
