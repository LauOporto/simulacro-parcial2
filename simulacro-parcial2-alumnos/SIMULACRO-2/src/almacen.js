// YA RESUELTO. Guarda las recepciones en memoria (en el parcial no hay base de datos).
class Almacen {
  #recepciones = [];
  #ultimoId = 0;

  // Recibe la recepción ya validada y liquidada; le asigna un id numérico (1, 2, 3...).
  agregar(datos) {
    const recepcion = { id: ++this.#ultimoId, ...datos };
    this.#recepciones.push(recepcion);
    return recepcion;
  }

  // Busca por id. Ojo: compara con ===.
  buscar(id) {
    return this.#recepciones.find((r) => r.id === id);
  }

  // Copia del array, en orden de carga (id ascendente).
  todas() {
    return [...this.#recepciones];
  }
}

module.exports = { Almacen };
