// Simuladores de los MODELOS de Realtime Database y Firestore: cómo se cobra y qué dejan consultar.
// No son Firebase ni reproducen su rendimiento: sirven para ver qué mide cada uno, sin cuentas ni emulador.
const { esperar } = require("./red");

// Realtime Database: un gran árbol JSON. Se cobra por BYTES descargados.
class RealtimeSim {
  constructor() { this.raiz = {}; this.bytes = 0; this.escrituras = 0; }
  _partes(ruta) { return ruta.split("/").filter(Boolean); }
  leer(ruta) {
    let n = this.raiz;
    for (const p of this._partes(ruta)) n = n?.[p];
    this.bytes += Buffer.byteLength(JSON.stringify(n ?? null));
    return n ?? null;
  }
  escribir(ruta, valor) {
    const partes = this._partes(ruta);
    let n = this.raiz;
    for (const p of partes.slice(0, -1)) n = n[p] ??= {};
    n[partes.at(-1)] = valor;
    this.escrituras++;
  }
  // update multi-ruta: todas o ninguna.
  actualizar(cambios) { for (const [ruta, valor] of Object.entries(cambios)) this.escribir(ruta, valor); }
}

// Firestore: documentos en colecciones. Se cobra por DOCUMENTO leído o escrito, pese lo que pese.
class FirestoreSim {
  constructor() { this.colecciones = new Map(); this.indices = new Set(); this.lecturas = 0; this.escrituras = 0; }
  _col(c) { if (!this.colecciones.has(c)) this.colecciones.set(c, new Map()); return this.colecciones.get(c); }
  escribir(c, id, doc) { this._col(c).set(id, doc); this.escrituras++; }
  leer(c, id) { this.lecturas++; return this._col(c).get(id) ?? null; }
  crearIndice(c, campos) { this.indices.add(`${c}:${campos.join(",")}`); }
  // filtros = { campo: valor }. Combinar igualdad con orden en otro campo exige índice compuesto.
  consultar(c, { filtros = {}, orden, limite = Infinity } = {}) {
    const campos = [...Object.keys(filtros), ...(orden ? [orden] : [])];
    if (campos.length > 1 && orden && !this.indices.has(`${c}:${campos.join(",")}`)) {
      throw new Error(`FAILED_PRECONDITION: la consulta requiere un índice compuesto (${campos.join(", ")})`);
    }
    let docs = [...this._col(c).values()].filter((d) => Object.entries(filtros).every(([k, v]) => d[k] === v));
    if (orden) docs.sort((a, b) => b[orden] - a[orden]);
    docs = docs.slice(0, limite);
    this.lecturas += docs.length;
    return docs;
  }
}

// Documento con transacción optimista: si cambió entre la lectura y la escritura, se reintenta.
class DocumentoRemoto {
  constructor(valor = 0) { this.valor = valor; this.version = 0; this.conflictos = 0; }
  async leer() { await esperar(1); return { valor: this.valor, version: this.version }; }
  async escribir(valor) { await esperar(1); this.valor = valor; this.version++; }
  async escribirSi(version, valor) {
    await esperar(1);
    if (this.version !== version) { this.conflictos++; return false; }
    this.valor = valor; this.version++;
    return true;
  }
}
module.exports = { RealtimeSim, FirestoreSim, DocumentoRemoto };
