# Simulacro 2 del Segundo Parcial — Cooperativa Lechera "La Pampeana"

Programación IV — UTN FRRe

Todas las mañanas, los camiones cisterna llegan con la leche de los tambos asociados a la planta de la cooperativa. La balanza de recepción pesa cada cisterna (litros), mide la grasa butirosa, toma la temperatura de la leche y la clasifica. Después manda esos datos a una API, que liquida cuánto se le paga al tambo.

La API ya existe a medias. Tenés que **terminarla** y **arreglar lo que está mal**.

## Reglas

- **Duración:** 2 horas. Individual.
- **Runtime:** Node.js 22 y Express 5. No se instalan otros paquetes.
- Arrancás desde el proyecto de la plantilla. Lo primero es correr `npm install`.
- **Se entrega** la carpeta del proyecto sin `node_modules`, con `DEFECTOS.md` completo y con `respuestas.md`, que tiene las respuestas de la Parte 3 y de la parte teórica.
- No modifiques `comun/`, `datos/`, `src/almacen.js`, `src/errores/problema.js` ni `src/app.js`. Si creés que alguno tiene un error, explicalo en `DEFECTOS.md`.
- **`npm test` corre todos los tests de la carpeta `test/`.** Que pasen no alcanza para aprobar: el docente corre además otros tests sobre los casos de este enunciado.
- Un resultado correcto sin código que lo explique no suma.
- Va a haber una defensa oral corta sobre tu código.

## Comandos

```bash
npm install
npm test                        # tests (visibles + autocorrección)
npm run cargar                  # manda las 13 cisternas de datos/cisternas.js y muestra qué respondió la API
npm start                       # levanta la API en http://localhost:3000
npm run token -- operador ana   # imprime un token para probar con curl
```

```bash
TOKEN=$(npm run -s token -- operador ana)
curl -i -X POST localhost:3000/recepciones \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tambo":"Ledesma","litros":20000,"grasa":3.9,"temperatura":6,"clase":"extra"}'
```

## Estructura del proyecto

```
comun/token.js                ya resuelto: firmar() y verificarToken()
datos/cisternas.js            ya resuelto: lo que mandó la balanza
src/app.js                    ya resuelto: arma la app y registra los middlewares
src/almacen.js                ya resuelto: guarda en memoria
src/errores/problema.js       ya resuelto: clase Problema (status, tipo, título, extra)
src/servicios/liquidacion.js  PARTE 1.1
src/validacion/recepcion.js   PARTE 1.2
src/rutas/recepciones.js      PARTE 1.3
src/middlewares/auth.js       PARTE 2 (tiene defectos)
src/middlewares/errores.js    PARTE 2 (tiene defectos)
test/                         ayuda.js, visibles.test.js y autocorreccion.test.js
```

## La API

Todos los errores se responden en formato **problem+json** (RFC 9457), que es lo que arma `manejarErrores` a partir de un `Problema`:

```json
{ "type": "https://cooperativa.ejemplo.edu/problemas/recepcion-invalida",
  "title": "litros debe ser un entero entre 1 y 40000",
  "status": 422, "instance": "/recepciones", "campo": "litros" }
```

En el resto del enunciado, cada error se nombra por la última parte de su `type`: `recepcion-invalida`, `no-autenticado`, etc.

**Autenticación.** Todas las rutas de `/recepciones` exigen el encabezado `Authorization: Bearer <token>`. Hay dos roles:

- `operador` (la balanza): puede registrar y consultar recepciones.
- `consulta` (la administración): sólo puede consultar.

La identidad (`sub` y `rol`) sale **únicamente** del token.

| Método y ruta | Rol | Respuesta correcta |
| --- | --- | --- |
| `POST /recepciones` | operador | `201`, con la recepción guardada y el encabezado `Location: /recepciones/<id>` |
| `GET /recepciones?tambo=&limite=&desde=` | cualquiera | `200` `{ items, total, siguiente }` |
| `GET /recepciones/:id` | cualquiera | `200` con la recepción, o `404` `no-encontrado` |

**Errores comunes a todas las rutas:**

| Situación | Status | Tipo |
| --- | --- | --- |
| Sin token, o con un token inválido o vencido | 401 | `no-autenticado` |
| Token válido, pero el rol no alcanza | 403 | `sin-permiso` |
| El body no es JSON válido | 400 | `json-invalido` |
| El body supera el tamaño máximo | 413 | `body-demasiado-grande` |
| Cualquier otro error | 500 | `interno`, sin ningún detalle técnico en la respuesta |

### Reglas de validación de `POST /recepciones`

Si algo falla, se responde `422` `recepcion-invalida`, con `campo` igual al nombre del **primer** campo que falla. Los campos se revisan en este orden:

1. El body es un objeto, no un array ni `null`. Si no lo es, `campo` es `"body"`.
2. **Sólo** se admiten estos cinco campos. Si llega cualquier otro (`id`, `importe`, lo que sea), se rechaza y `campo` es el nombre de ese campo.
3. `tambo`: un string que, sin los espacios del principio y del final, tiene entre 3 y 60 caracteres. Se **guarda** sin esos espacios.
4. `litros`: un número **entero** entre 1 y 40000. Es lo máximo que lleva una cisterna.
5. `grasa`: un número entre 2 y 6, en %.
6. `temperatura`: un número entre 0 y 15, en °C.
7. `clase`: exactamente `"extra"`, `"comun"` o `"industrial"`.

"Un número" quiere decir de **tipo** number: `"3.5"` no es un número.

### Lo que se guarda

Se guardan los cinco campos validados, más lo que calcula `liquidar` (`litrosEq`, `descuentoFrio` e `importe`), más `recibidaPor`, que es el `sub` del token. El `id` lo pone el almacén.

### `GET /recepciones`

- `tambo`: si viene, filtra por igualdad exacta.
- `limite`: un entero entre 1 y 50. Si no viene, vale 10. Si viene cualquier otra cosa, se responde `400` `parametro-invalido` con `campo: "limite"`.
- `desde`: un entero mayor o igual a 1. Si viene, sólo se consideran las recepciones con `id` **menor** que `desde` (es un cursor). Si no viene, se consideran todas. Si viene cualquier otra cosa, se responde `400` `parametro-invalido` con `campo: "desde"`.
- `items`: las recepciones, de la más nueva a la más vieja (id descendente), hasta `limite`.
- `total`: `{ recepciones, litros, importe }` sumado sobre **todas** las recepciones que coinciden con el filtro `tambo`, no sólo las de `items` y sin importar `desde` ni `limite`. `importe` suma los importes guardados y redondea el resultado a 2 decimales.
- `siguiente`: si todavía quedan recepciones más viejas que la última de `items` (dentro del filtro y del cursor), es el `id` de esa última. Si no queda ninguna, es `null`. El cliente pide la página siguiente con `desde=<siguiente>`.

## Anexo — Fórmulas de la liquidación

| Constante | Valor |
| --- | --- |
| Grasa base | 3,5 % |
| Temperatura máxima de recepción | 8 °C |
| Descuento por cadena de frío | 5 % del importe bruto |
| Precio clase `extra` | USD 0,52 por litro equivalente |
| Precio clase `comun` | USD 0,45 por litro equivalente |
| Precio clase `industrial` | USD 0,31 por litro equivalente |

**1. Litros equivalentes (grasa).** La leche más grasa rinde más. Si la grasa está **por encima** de la base, se bonifica. Si está igual o por debajo, **no** se penaliza.

```
si grasa > 3,5:   litrosEq = litros · grasa / 3,5
si no:            litrosEq = litros
```

**2. Importe bruto.**

```
bruto = litrosEq · precio(clase)
```

**3. Descuento por cadena de frío.** Si la leche llegó **más caliente** que el máximo, se descuenta un porcentaje del bruto. Si llegó justo en el máximo, no hay descuento.

```
si temperatura > 8:   descuentoFrio = bruto · 0,05
si no:                descuentoFrio = 0
```

**4. Importe.**

```
importe = bruto − descuentoFrio
```

**5. Redondeo.** `litrosEq`, `descuentoFrio` e `importe` se devuelven redondeados a 2 decimales con `redondear()`, que ya está en el archivo. Se redondea **sólo al final**: cada cuenta usa los valores intermedios **sin** redondear.

**Ejemplo resuelto (S01).** Ledesma, 20.000 litros, 3,9 % de grasa, 6 °C, clase `extra`:

```
3,9 > 3,5              → litrosEq = 20000 · 3,9 / 3,5 = 22285,7142…   → 22285,71
bruto = 22285,7142… · 0,52   = 11588,5714…
6 ≤ 8                  → descuentoFrio = 0                              → 0
importe = 11588,5714… − 0    = 11588,5714…                              → 11588,57
```

**Control:** S02 (Márquez, 15.000 litros, 3,5 %, 8 °C, `comun`). La grasa y la temperatura están justo en el límite, así que no hay bonificación ni descuento: litrosEq 15000, importe 6750.

---

## Parte 1 — Completar la API (50 puntos)

1. **`liquidar`** en `src/servicios/liquidacion.js`. Es una función pura, que no sabe nada de HTTP. *(10)*
2. **`validarRecepcion`** en `src/validacion/recepcion.js`. Aplica las 7 reglas en orden. Si algo falla, tira el `Problema` correspondiente. Si todo está bien, devuelve un objeto **nuevo** con los cinco campos, con el tambo ya sin espacios. *(20)*
3. **Las tres rutas** en `src/rutas/recepciones.js`. *(20)*

Cuando termines, corré `npm run cargar`. Tienen que entrar **6 de las 13 cisternas**.

## Parte 2 — Diagnosticar y arreglar (35 puntos)

`src/middlewares/auth.js` y `src/middlewares/errores.js` tienen **5 defectos** en total. Algunos se ven en un test, otros sólo en la consola del servidor, otros sólo en los encabezados de la respuesta y otros sólo si se los busca. Para cada uno:

1. Mostrá un pedido concreto que lo haga aparecer: un `curl`, un `fetch` o un test.
2. Arreglalo.
3. Completá su sección en `DEFECTOS.md`.

Cada defecto vale 7 puntos: 2 por mostrarlo, 2 por arreglarlo y 3 por explicar el mecanismo.

## Parte 3 — Predicción (15 puntos)

Sin ejecutar, escribí en `respuestas.md` la salida exacta de cada fragmento y por qué. Después ejecutalo. Si fallaste, explicá qué parte de tu modelo mental estaba mal. Se corrige la explicación, no el acierto.

**3.1** ¿Qué imprime cada línea? ¿Por qué `Number(q.desde)` no sirve para saber si `desde` vino o no?

```js
const litros = [900, 25000, 3100, 100];
console.log(litros.sort());
console.log(litros.sort((a, b) => b - a));
const q = Object.fromEntries(new URLSearchParams("desde=&limite=5"));
console.log(Number(q.desde), Number(q.limite) + 1, q.desde ?? "nada", q.desde || "nada");
```

**3.2** ¿En qué orden aparecen `A`, `B`, `C`, `D` y `E`? ¿Qué status ve el cliente? ¿Qué habría pasado con la ruta `async` en Express 4?

```js
const express = require("express");
const app = express();
app.use((req, res, next) => { console.log("A"); next(); console.log("B"); });
app.get("/", async (req, res) => {
  console.log("C");
  await null;
  throw new Error("boom");
});
app.use((err, req, res, next) => { console.log("D"); res.status(500).end(); });
const s = app.listen(0, async () => {
  const r = await fetch(`http://localhost:${s.address().port}/`);
  console.log("E", r.status);
  s.close();
});
```

**3.3** ¿Qué imprime cada línea? ¿Qué consecuencia tiene para una función que calcula plata?

```js
console.log(0.1 + 0.2 === 0.3, 0.1 + 0.2);
console.log(Math.round(1.005 * 100) / 100, Math.round(2.5), Math.round(-2.5));
console.log(JSON.stringify({ a: undefined, b: NaN, c: [undefined], d: new Date(0) }));
```

## Parte teórica

Respondé en `respuestas.md`. Se espera desarrollo, no definiciones de memoria: cada respuesta tiene que razonar sobre el caso que se plantea. Máximo 12 renglones por pregunta.

**T1 — Códigos de estado y concurrencia.** La cooperativa agrega `PUT /recepciones/:id` (corrige una recepción) con `ETag` / `If-Match`, y `Idempotency-Key` en el `POST`. Para cada pedido, decí qué status debe responder la API y por qué ese y no otro parecido:

- (a) un `GET /recepciones` con un token vencido;
- (b) un `PUT /recepciones/7` sin encabezado `If-Match`, en una API que lo exige;
- (c) un `PUT /recepciones/7` con un `If-Match` de una versión que ya cambió;
- (d) un `POST` con una `Idempotency-Key` repetida **mientras** el primer pedido todavía se procesa;
- (e) un `POST` con una `Idempotency-Key` ya usada, pero con otro body;
- (f) el pedido número 61 del minuto, cuando el límite es 60.

Explicá también qué dato se pierde si dos operadores hacen un `PUT` sobre la misma recepción sin `If-Match`, y por qué el `UPDATE` tiene que comparar y escribir en una sola sentencia. Cerrá con la diferencia entre 409 y 412, y entre 412 y 428, en una línea cada una.

**T2 — JWT e identidad.** Cuatro propuestas de compañeros. Para cada una, explicá qué ataque abre y qué pedido o token falso entra:

1. Que el cliente mande `"uid": "ana"` en el body y guardar ese valor como `recibidaPor`.
2. Que el backend, al migrar a Firebase Auth, verifique sólo la firma del ID token, sin mirar `iss` ni `aud`.
3. Que `verificarToken` busque la clave en `claves/${header.kid}.key`, usando el `kid` que trae el token en su header.
4. A Juan le sacan el rol `operador`, pero su token (que lleva el rol adentro) dura 1 hora. ¿Qué puede hacer durante esa hora? ¿Qué cuesta arreglarlo, y qué se pierde de las ventajas del JWT?

**T3 — Seguridad.**

1. La API corre en 3 instancias, cada una con un contador **en memoria** que deja pasar 60 pedidos por minuto por IP. ¿Cuántos puede hacer realmente un cliente? ¿Qué cambia con un almacén compartido y por qué necesita un incremento atómico (`INCR`)? Con ventana fija, ¿qué ráfaga puede colarse en el borde entre dos ventanas, y qué algoritmo la evita a qué costo de memoria?
2. Para validar el número de remito alguien escribió `/^(\d+)+$/.test(valor)`. ¿Qué pasa con `"1111111111111111111111111x"`? ¿Por qué eso afecta también a los pedidos de otros clientes? ¿Cómo la reescribís y qué otra defensa agregás?
3. Con STRIDE: ¿qué amenaza es "el servidor cree la identidad que viene en un encabezado" y cuál es "la balanza niega haber mandado una pesada"? ¿Qué contramedida usarías para cada una?

**T4 — Bases de datos y tiempo real.** La cooperativa quiere un panel que muestre **en vivo** el total de litros recibidos hoy.

1. Las 40 balanzas incrementan un único documento (o fila) `litrosHoy`. ¿Qué pasa con un leer-sumar-escribir sin transacción? ¿Cómo se reparte un contador muy escrito? Y sumar las 5.000 recepciones del día en cada carga del panel, ¿por qué es caro en una base que cobra por documento leído, y qué se hace?
2. ¿WebSocket o SSE para el panel, y por qué? Con 2 instancias, una recepción se registra en la A y el panel está conectado a la B: ¿qué pasa y cómo se resuelve? Si el panel pierde la conexión 30 segundos, ¿qué se pierde y cómo se recupera?

**T5 — Streams.** Al final del mes, la balanza sube un CSV de 3 GB con todos los pesajes (5 columnas, con tildes como "Márquez"). Un compañero cuenta las líneas válidas así:

```js
const fs = require("node:fs");
let validas = 0;
fs.createReadStream("pesajes.csv", { highWaterMark: 64 * 1024 })
  .on("data", (chunk) => {
    for (const linea of chunk.toString().split("\n")) {
      if (linea.split(",").length === 5) validas++;
    }
  })
  .on("end", () => console.log("válidas:", validas));
```

Explicá por qué el número da mal **sin ningún error** y cómo lo arreglarías. Explicá de qué depende la memoria que usa este programa y qué cambiaría con `readFileSync`. Si en cambio el CSV llega por HTTP y se escribe a disco con `req.pipe(fs.createWriteStream(destino))`, ¿qué pasa si el cliente corta a la mitad, qué hace distinto `pipeline`, y en qué momento se puede responder `201`?

## Puntaje

Parte práctica: se aprueba con 60 de 100. Parte teórica: 10 puntos por pregunta, se califica aparte.
