# Simulacro del Segundo Parcial — Desmotadora "La Chaqueña"

Programación IV — UTN FRRe

En temporada de cosecha, los productores traen el algodón en bruto en camión a la desmotadora. La balanza pesa cada camión, mide la humedad y estima el rendimiento al desmote (qué porcentaje del algodón en bruto termina siendo fibra). Después manda esos datos a una API, que liquida cuánto se le paga al productor.

La API ya existe a medias. Tenés que **terminarla** y **arreglar lo que está mal**.

## Reglas

- **Duración:** 1 hora 30 minutos. Individual.
- **Runtime:** Node.js 22 y Express 5. No se instalan otros paquetes.
- Arrancás desde el proyecto de la plantilla. Lo primero es correr `npm install`.
- **Se entrega** la carpeta del proyecto sin `node_modules`, con `DEFECTOS.md` completo y con `respuestas.md`, que tiene las respuestas de la Parte 3 y de la parte teórica.
- No modifiques `comun/`, `datos/`, `src/almacen.js`, `src/errores/problema.js` ni `src/app.js`. Si creés que alguno tiene un error, explicalo en `DEFECTOS.md`.
- **`npm test` corre unos pocos tests visibles.** Que pasen no alcanza para aprobar: el docente corre además otros tests sobre los casos de este enunciado.
- Un resultado correcto sin código que lo explique no suma.
- Va a haber una defensa oral corta sobre tu código.

## Comandos

```bash
npm install
npm test                        # tests visibles
npm run cargar                  # manda los 13 camiones de datos/camiones.js y muestra qué respondió la API
npm start                       # levanta la API en http://localhost:3000
npm run token -- operador ana   # imprime un token para probar con curl
```

```bash
TOKEN=$(npm run -s token -- operador ana)
curl -i -X POST localhost:3000/entregas \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productor":"Benítez","kgBrutos":12000,"humedad":14,"rendimiento":33,"grado":"A"}'
```

## Estructura del proyecto

```
comun/token.js                ya resuelto: firmar() y verificarToken()
datos/camiones.js             ya resuelto: lo que mandó la balanza
src/app.js                    ya resuelto: arma la app y registra los middlewares
src/almacen.js                ya resuelto: guarda en memoria
src/errores/problema.js       ya resuelto: clase Problema (status, tipo, título, extra)
src/servicios/liquidacion.js  PARTE 1.1
src/validacion/entrega.js     PARTE 1.2
src/rutas/entregas.js         PARTE 1.3
src/middlewares/auth.js       PARTE 2 (tiene defectos)
src/middlewares/errores.js    PARTE 2 (tiene defectos)
```

## La API

Todos los errores se responden en formato **problem+json** (RFC 9457), que es lo que arma `manejarErrores` a partir de un `Problema`:

```json
{ "type": "https://desmotadora.ejemplo.edu/problemas/entrega-invalida",
  "title": "kgBrutos debe ser un entero entre 1 y 30000",
  "status": 422, "instance": "/entregas", "campo": "kgBrutos" }
```

En el resto del enunciado, cada error se nombra por la última parte de su `type`: `entrega-invalida`, `no-autenticado`, etc.

**Autenticación.** Todas las rutas de `/entregas` exigen el encabezado `Authorization: Bearer <token>`. Hay dos roles:

- `operador` (la balanza): puede registrar y consultar entregas.
- `consulta` (la administración): sólo puede consultar.

| Método y ruta | Rol | Respuesta correcta |
| --- | --- | --- |
| `POST /entregas` | operador | `201`, con la entrega guardada y el encabezado `Location: /entregas/<id>` |
| `GET /entregas?productor=&limite=` | cualquiera | `200` `{ items, total }` |
| `GET /entregas/:id` | cualquiera | `200` con la entrega, o `404` `no-encontrado` |

**Errores comunes a todas las rutas:**

| Situación | Status | Tipo |
| --- | --- | --- |
| Sin token, o con un token inválido o vencido | 401 | `no-autenticado` |
| Token válido, pero el rol no alcanza | 403 | `sin-permiso` |
| El body no es JSON válido | 400 | `json-invalido` |
| Cualquier otro error | 500 | `interno`, sin ningún detalle técnico en la respuesta |

### Reglas de validación de `POST /entregas`

Si algo falla, se responde `422` `entrega-invalida`, con `campo` igual al nombre del **primer** campo que falla. Los campos se revisan en este orden:

1. El body es un objeto, no un array ni `null`. Si no lo es, `campo` es `"body"`.
2. **Sólo** se admiten estos cinco campos. Si llega cualquier otro (`id`, `importe`, lo que sea), se rechaza y `campo` es el nombre de ese campo.
3. `productor`: un string que, sin los espacios del principio y del final, tiene entre 3 y 60 caracteres. Se **guarda** sin esos espacios.
4. `kgBrutos`: un número **entero** entre 1 y 30000. Es lo máximo que lleva un camión.
5. `humedad`: un número entre 0 y 30, en %.
6. `rendimiento`: un número entre 28 y 40, en %.
7. `grado`: exactamente `"A"`, `"B"` o `"C"`.

"Un número" quiere decir de **tipo** number: `"13"` no es un número.

### Lo que se guarda

Se guardan los cinco campos validados, más lo que calcula `liquidar` (`kgSecos`, `kgFibra` e `importe`), más `registradaPor`, que es el `sub` del token. El `id` lo pone el almacén.

### `GET /entregas`

- `productor`: si viene, filtra por igualdad exacta.
- `limite`: un entero entre 1 y 50. Si no viene, vale 10. Si viene cualquier otra cosa, se responde `400` `parametro-invalido` con `campo: "limite"`.
- `items`: las entregas, de la más nueva a la más vieja (id descendente), hasta `limite`.
- `total`: `{ entregas, kgFibra, importe }` sumado sobre **todas** las entregas que coinciden con el filtro, no sólo las de `items`. Los dos importes se redondean a 2 decimales.

## Anexo — Fórmulas de la liquidación

| Constante | Valor |
| --- | --- |
| Humedad base | 12 % |
| Precio grado A | USD 2,10 por kg de fibra |
| Precio grado B | USD 1,85 por kg de fibra |
| Precio grado C | USD 1,50 por kg de fibra |

**1. Descuento por humedad.** El agua pesa, pero no se paga. Si el algodón viene **más húmedo** que la base, se descuenta el exceso de agua. Si viene más seco, **no** se bonifica.

```
si humedad > 12:   kgSecos = kgBrutos · (100 − humedad) / (100 − 12)
si no:             kgSecos = kgBrutos
```

**2. Fibra.**

```
kgFibra = kgSecos · rendimiento / 100
```

**3. Importe.**

```
importe = kgFibra · precio(grado)
```

**4. Redondeo.** `kgSecos`, `kgFibra` e `importe` se devuelven redondeados a 2 decimales con `redondear()`, que ya está en el archivo. Se redondea **sólo al final**: cada cuenta usa los valores intermedios **sin** redondear.

**Ejemplo resuelto (C01).** Benítez, 12.000 kg, 14 % de humedad, 33 % de rendimiento, grado A:

```
14 > 12                → kgSecos = 12000 · 86 / 88 = 11727,2727…   → 11727,27
kgFibra = 11727,2727… · 0,33 = 3870,00                            → 3870
importe = 3870 · 2,10        = 8127,00                            → 8127
```

**Control:** C02 (Kowalczuk, 9500 kg, 12 %, 35 %, B). La humedad es justo la base, así que no hay descuento: kgFibra 3325, importe 6151,25.

---

## Parte 1 — Completar la API (50 puntos)

1. **`liquidar`** en `src/servicios/liquidacion.js`. Es una función pura, que no sabe nada de HTTP. *(10)*
2. **`validarEntrega`** en `src/validacion/entrega.js`. Aplica las 7 reglas en orden. Si algo falla, tira el `Problema` correspondiente. Si todo está bien, devuelve un objeto **nuevo** con los cinco campos, con el productor ya sin espacios. *(20)*
3. **Las tres rutas** en `src/rutas/entregas.js`. *(20)*

Cuando termines, corré `npm run cargar`. Tienen que entrar **6 de los 13 camiones**.

## Parte 2 — Diagnosticar y arreglar (35 puntos)

`src/middlewares/auth.js` y `src/middlewares/errores.js` tienen **5 defectos** en total. Algunos se ven en un test, otros sólo en la consola del servidor y otros sólo si se los busca. Para cada uno:

1. Mostrá un pedido concreto que lo haga aparecer: un `curl`, un `fetch` o un test.
2. Arreglalo.
3. Completá su sección en `DEFECTOS.md`.

Cada defecto vale 7 puntos: 2 por mostrarlo, 2 por arreglarlo y 3 por explicar el mecanismo.

## Parte 3 — Predicción (15 puntos)

Sin ejecutar, escribí en `respuestas.md` la salida exacta de cada fragmento y por qué. Después ejecutalo. Si fallaste, explicá qué parte de tu modelo mental estaba mal. Se corrige la explicación, no el acierto.

**3.1** ¿Qué imprime cada línea? ¿Por qué `pagina` no vale 1?

```js
const query = Object.fromEntries(new URLSearchParams("limite=2&pagina=0"));
const limite = query.limite ?? 10;
const pagina = query.pagina || 1;
console.log(limite + 1, pagina, typeof limite);
console.log([10, 20, 30, 40, 50].slice(0, limite + 1).length);
```

**3.2** ¿En qué orden aparecen `A1`, `A2`, `B1`, `B2` y `C`? ¿`A2` sale antes o después de que el cliente reciba la respuesta?

```js
const express = require("express");
const app = express();
app.use((req, res, next) => { console.log("A1"); next(); console.log("A2"); });
app.use(async (req, res) => {
  console.log("B1");
  await null;
  console.log("B2");
  res.json({ ok: true });
});
const s = app.listen(0, async () => {
  await fetch(`http://localhost:${s.address().port}/`);
  console.log("C");
  s.close();
});
```

**3.3** ¿Qué imprime cada línea? ¿Qué le llega al cliente si una API responde `res.json` con un valor así?

```js
const body = JSON.parse('{"kgBrutos": 1e309, "humedad": "12", "grado": null}');
console.log(body.kgBrutos > 0, body.humedad > 11, Number.isInteger(body.kgBrutos));
console.log(JSON.stringify({ kg: body.kgBrutos, fecha: undefined, total: 0 / 0, grado: body.grado }));
```

## Parte teórica

Respondé en `respuestas.md`. Se espera desarrollo, no definiciones de memoria: cada respuesta tiene que razonar sobre el caso que se plantea. Máximo 12 renglones por pregunta.

**T1 — Códigos de estado.** Para cada pedido, decí qué status debe responder esta API y por qué ese y no otro parecido:

- (a) un `GET /entregas` sin encabezado `Authorization`;
- (b) un `POST /entregas` con un token válido de rol `consulta`;
- (c) un `POST` con un JSON cortado a la mitad;
- (d) un `POST` con un JSON válido pero con `"kgBrutos": "11000"`;
- (e) un `GET /entregas?limite=500`.

Cerrá con la diferencia entre 400 y 422, y entre 401 y 403, en una línea cada una.

**T2 — JWT.** Un compañero propone reemplazar `verificarToken` por esto, "porque es más rápido":

```js
const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
```

Explicá qué ataque permite. Después explicá por qué `verificarToken` rechaza un header con `"alg": "none"` en lugar de confiar en lo que dice el token, y para qué sirve controlar `exp` si la firma ya es válida.

**T3 — Idempotencia.** La balanza manda el `POST` de un camión, la conexión se corta antes de que llegue la respuesta, y la balanza reintenta.

1. ¿Qué pasa con esta API tal como está? ¿A quién le cuesta plata?
2. Diseñá la solución con un encabezado `Idempotency-Key`: qué se guarda, qué se responde ante una repetición, por qué hay que guardar también una huella del body, y qué se responde si la repetición llega **mientras** la primera todavía se está procesando.
3. ¿Por qué un `PUT` no tiene este problema y un `POST` sí?

**T4 — Streams.** Al final de la temporada, la balanza manda un CSV de 2 GB con todos los pesajes a `POST /entregas/lote`. Un compañero lo resuelve así:

```js
let texto = "";
req.on("data", (c) => (texto += c));
req.on("end", () => { procesar(texto); res.status(201).end(); });
```

Explicá qué le pasa al proceso, y a los otros pedidos que llegan mientras tanto. Explicá cómo lo resolvería `pipeline`: qué es la contrapresión (backpressure), qué pasa con el archivo a medio escribir si el cliente corta, y en qué momento se puede responder `201`.

## Puntaje

Parte práctica: se aprueba con 60 de 100. Parte teórica: 10 puntos por pregunta, se califica aparte.
