// YA RESUELTO. Guarda las entregas en memoria (en el parcial no hay base de datos).
class Almacen {
  #entregas = [];
  #ultimoId = 0;

  // Recibe la entrega ya validada y liquidada; le asigna un id numérico (1, 2, 3...).
  agregar(datos) {
    const entrega = { id: ++this.#ultimoId, ...datos };
    this.#entregas.push(entrega);
    return entrega;
  }

  // Busca por id. Ojo: compara con ===.
  buscar(id) {
    return this.#entregas.find((e) => e.id === id);
  }

  // Copia del array, en orden de carga (id ascendente).
  todas() {
    return [...this.#entregas];
  }
}

module.exports = { Almacen };
