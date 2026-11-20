// YA RESUELTO. Un error de la API que sabe qué status y qué tipo responder.
// Se responde con formato RFC 9457 (application/problem+json).
//
//   throw new Problema(422, "entrega-invalida", "kgBrutos debe ser un entero entre 1 y 30000", { campo: "kgBrutos" });
class Problema extends Error {
  constructor(status, tipo, titulo, extra = {}) {
    super(titulo);
    this.name = "Problema";
    this.status = status;
    this.tipo = tipo;
    this.titulo = titulo;
    this.extra = extra;
  }
}

module.exports = { Problema };
