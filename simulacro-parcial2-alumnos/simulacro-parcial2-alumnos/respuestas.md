**3.1** ¿Qué imprime cada línea? ¿Por qué `pagina` no vale 1?

```js
const query = Object.fromEntries(new URLSearchParams("limite=2&pagina=0"));
const limite = query.limite ?? 10;
const pagina = query.pagina || 1;
console.log(limite + 1, pagina, typeof limite);
console.log([10, 20, 30, 40, 50].slice(0, limite + 1).length);
```

-SALIDA ESPERADA

3, 1, Integer
5

-SALIDA REAL 

21 0 String
5

pagina no vale uno porque query.pagina es un string, este nunca es falso entonces no se le asigna 1, su valor es "0" como string

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

SALIDA ESPERADA
A1
B1
B2

SALIDA REAL

A1
B1
A2
B2
C

Esto se debe a que "s" levanta primeramente el servidor con app.listen y busca un puerto disponible. Posteriormente se cargan los app.use donde se envia A1, este pasa a la siguiente funcion con next(), deja pendiente A2, app.use imprime B1 y entra en timeOut con await y regresa a donde quedó next, se ejecuta A2, como no queda ninguna tarea en cola devuelve la promesa y ejecuta B2. Por ultimo se ejecuta C.

**3.3** ¿Qué imprime cada línea? ¿Qué le llega al cliente si una API responde `res.json` con un valor así?

```js
const body = JSON.parse('{"kgBrutos": 1e309, "humedad": "12", "grado": null}');
console.log(body.kgBrutos > 0, body.humedad > 11, Number.isInteger(body.kgBrutos));
console.log(JSON.stringify({ kg: body.kgBrutos, fecha: undefined, total: 0 / 0, grado: body.grado }));
```
SALIDA ESPERADA
true, false, NaN
kg: 1e309, fecha:undefined, ERROR, grado: null

SALIDA REAL
true, true, false
{"kg":null,"total:null","grado":null}

Mi modelo mental estuvo mal por distintas razones: 
-kgbrutos se imprime como null ya que al ser un valor infinito este no puede asignarse ya que supera el limite de json. Sin embargo sigue siendo mayor a 0 por lo tanto la primer salida es true
-Mi salida fue erronea por pensar que un string no podia compararse con un integer. Al pasar un string en una comparacion este se transforma en entero, por lo tanto devuelve true
-La tercer salida fue una confusion mía pensando que isInteger devolvia NaN en vez de false. Devuelve false porque kgBrutos no es un numero finito
-Json no puede imprimir valores infinitos por lo tanto se asigna null
-0 / 0 es NaN, que termina siendo Null
-La fecha al no estar definido no se muestra.

Lo que falta: la segunda pregunta del enunciado
Pregunta qué le llega al cliente si una API responde res.json con un valor así. Tu respuesta tiene que decir que el cliente recibe "kg": null y "total": null, sin ningún error ni aviso. Si esperaba un número, va a explotar o calcular mal del otro lado. La conclusión es que hay que validar antes de responder con Number.isFinite, y no confiar en que res.json te avise.

PARTE TEORICA

**T1 — Códigos de estado.**

(a) `GET /entregas` sin `Authorization` → **401** `no-autenticado`. El servidor no sabe quién es el cliente, porque no mandó token. No es 403: el 403 supone que ya sé quién sos y que solo te falta permiso.

(b) `POST /entregas` con token válido de rol `consulta` → **403** `sin-permiso`. El token es válido, así que el servidor sabe quién es, pero el rol `consulta` solo puede leer. No es 401: la identidad está bien y mandar de nuevo el mismo token no lo arregla.

(c) `POST` con JSON cortado a la mitad → **400** `json-invalido`. El body ni siquiera se puede parsear: `express.json()` falla antes de llegar a la validación. No es 422 porque no hay contenido para validar.

(d) `POST` con JSON válido pero `"kgBrutos": "11000"` → **422** `entrega-invalida`, `campo: "kgBrutos"`. El JSON se leyó bien, pero `"11000"` es un string y la regla pide tipo number. No es 400 porque la sintaxis está bien: lo que falla es la regla.

(e) `GET /entregas?limite=500` → **400** `parametro-invalido`, `campo: "limite"`. El enunciado dice que `limite` tiene que ser un entero entre 1 y 50, y cualquier otra cosa es 400. No es 429: el 429 es por hacer demasiados pedidos en poco tiempo (rate limit), no por pedir una página grande. Tampoco se recorta a 50 en silencio.

- **400 vs 422:** 400 es que no se puede leer el pedido (sintaxis); 422 es que se leyó bien pero el contenido no cumple las reglas.
- **401 vs 403:** 401 es "no sé quién sos" (falta token o es inválido); 403 es "sé quién sos, pero no tenés permiso".

**T2 — JWT.**

Un JWT tiene 3 partes: header, payload (`sub`, `rol`, `exp`) y firma. El header y el payload están en base64url, que es una codificación, no un cifrado: cualquiera puede leerlos **y escribirlos**. Lo único que protege al token es la firma, que se calcula con el `SECRETO` que solo tiene el servidor. Si se cambia una letra del payload, la firma deja de coincidir.

(a) La línea propuesta solo **lee** el payload y nunca verifica la firma. Cualquiera puede escribir un payload `{"sub":"ana","rol":"operador"}`, ponerle una firma inventada, y el servidor le cree. Eso permite hacerse pasar por otro usuario (suplantación) y darse el rol `operador` (escalada de privilegios), por ejemplo para cargar camiones falsos. Además no mira `exp`, así que el token nunca vence.

(b) `"alg": "none"` significa "este token no tiene firma". Si el servidor hiciera lo que dice el header, un atacante pondría `none`, dejaría la firma vacía y el servidor se saltearía la verificación: es el mismo ataque que en (a). El header lo escribe el atacante, así que no se puede confiar en él para decidir cómo verificar. Por eso `verificarToken` fija el algoritmo (solo acepta `HS256`) y rechaza cualquier otro.

(c) Que la firma sea válida prueba que el servidor emitió el token y que nadie lo modificó, pero **no** que siga vigente. Si roban un token, sin `exp` serviría para siempre. Como JWT es stateless, el servidor no guarda sesiones y no tiene cómo "anular" un token. `exp` limita el daño: un token robado o con un rol viejo sirve como mucho 1 hora.

**T3 — Idempotencia.**

1. Tal como está, el reintento llega como un `POST` nuevo y el servidor no puede saber que es el mismo camión, así que crea una **segunda entrega**. Al productor se le liquida dos veces el mismo algodón, y esa plata la pierde la **desmotadora**. La balanza no puede saber si el primer pedido llegó: lo único que vio fue el corte.

2. La balanza genera una clave única por camión (un UUID) y la manda en `Idempotency-Key`. Si reintenta, manda la misma. Por cada clave, el servidor guarda: la **huella del body** (un hash SHA-256), el **estado** (`en proceso` o `terminado`) y la **respuesta** que dio (status y body).
   - Si llega una clave repetida, ya terminada y con la misma huella, el servidor devuelve **la misma respuesta guardada** (el mismo 201) sin crear otra entrega.
   - Si la clave es la misma pero la huella no coincide, el cliente reutilizó la clave con otros datos. Se responde **422**. Sin la huella, el servidor diría "ok" y esos datos nuevos se perderían en silencio.
   - Si la clave todavía está `en proceso`, se responde **409 Conflict** (con `Retry-After`). Por eso la clave se guarda como `en proceso` **antes** de procesar: si no, dos pedidos simultáneos crearían dos entregas.

3. `PUT /entregas/123` significa "dejá el recurso 123 así". El id lo elige el cliente, y repetirlo deja el mismo estado, así que es idempotente. `POST /entregas` significa "creá uno nuevo": el servidor genera otro id en cada repetición, así que cada reintento es otra entrega.

**T4 — Streams.**

`req` es un stream: el CSV no llega entero, llega en pedazos (chunks) de unos 64 KB. `req.on("data", ...)` se ejecuta con cada pedazo y `req.on("end", ...)` cuando ya no llegan más. El compañero pega todos los pedazos en `texto`, así que termina con **los 2 GB enteros en RAM**. El proceso se queda sin memoria (un string en Node ni siquiera puede llegar a 2 GB) y se cae. Como Node atiende todo en **un solo proceso**, se caen también todos los pedidos que estaba atendiendo. Y aunque no se caiga, `procesar(texto)` sobre un texto gigante bloquea el proceso, así que los demás pedidos quedan esperando.

**Contrapresión (backpressure):** la red puede traer datos más rápido de lo que el disco los escribe. Si nadie frena, lo que no se llegó a escribir se acumula en memoria. La contrapresión es que el destino lento le avise al origen "pará", y después "seguí" cuando se libera. Así en memoria solo hay unos pocos chunks, sin importar el tamaño del archivo.

`pipeline(req, fs.createWriteStream(destino))` conecta la entrada con el archivo y maneja la contrapresión sola. Si el cliente corta a la mitad, `pipeline` cierra todos los streams y avisa con un error. En ese caso se **borra el archivo a medio escribir** y no se responde 201. Con `req.pipe` a mano el error no se propaga y queda un archivo incompleto que parece válido. El **201** se responde recién cuando `pipeline` termina sin error, es decir, cuando el último byte ya está escrito en disco:

```js
try {
  await pipeline(req, fs.createWriteStream(destino));
  res.status(201).end();
} catch {
  await fs.promises.rm(destino, { force: true });
}
```

---

## Machete: códigos de estado (para llevar al parcial)

**Regla de la primera cifra:** 2xx salió bien · 3xx no hace falta mandar nada · 4xx falló el CLIENTE (arreglá el pedido) · 5xx falló el SERVIDOR (no es culpa del cliente).

| Código | Nombre | Cuándo | Ejemplo en esta API |
|---|---|---|---|
| 200 | OK | Salió bien y devuelvo algo | `GET /entregas/:id` encontrado |
| 201 | Created | Se creó algo (+ header `Location`) | `POST /entregas` válido |
| 204 | No Content | Salió bien y no devuelvo cuerpo | `DELETE` exitoso |
| 304 | Not Modified | Tu copia (ETag) sigue vigente | `GET` con `If-None-Match` igual |
| 400 | Bad Request | El pedido ni se puede leer | JSON cortado, `limite=abc` |
| 401 | Unauthorized | No sé quién sos (falta token o es inválido/vencido) | sin `Authorization` |
| 403 | Forbidden | Sé quién sos pero no podés | token válido con rol `consulta` en un `POST` |
| 404 | Not Found | No existe ese recurso | `GET /entregas/999` |
| 409 | Conflict | Choca con el estado actual | crear algo que ya existe; reintento mientras la primera se procesa (Idempotency-Key) |
| 412 | Precondition Failed | Mandaste `If-Match` y la versión ya cambió | lost update evitado con ETag |
| 422 | Unprocessable Content | Se leyó bien, pero el contenido no cumple las reglas | `"kgBrutos": "11000"`, humedad 50; misma Idempotency-Key con otro body |
| 428 | Precondition Required | Te exijo `If-Match` y no lo mandaste | `PUT` sin `If-Match` |
| 429 | Too Many Requests | Superaste el rate limit (+ `Retry-After`) | muchos pedidos seguidos |
| 500 | Internal Server Error | Bug del servidor; detalle al LOG, nunca a la respuesta | error inesperado |

### Los pares que confunden (una línea cada uno)
- **400 vs 422:** 400 = no se pudo ni parsear (sintaxis). 422 = se parseó bien pero el contenido es inválido (reglas).
- **401 vs 403:** 401 = no sé quién sos (identidad). 403 = sé quién sos pero no tenés permiso (autorización).
- **409 vs 412:** 409 = choca con el estado actual del recurso. 412 = tu condición `If-Match` ya no se cumple (la versión cambió).
- **412 vs 428:** 412 = mandaste `If-Match` y estaba viejo. 428 = no mandaste `If-Match` y yo lo exigía.

### Atajos mentales
- ¿Falta/falla el token? → 401. ¿Token bien pero rol no? → 403.
- ¿Rompe el JSON? → 400. ¿JSON bien pero valor/regla mal? → 422.
- ¿Se creó algo? → 201 + `Location`.
- ¿Error mío no previsto? → 500 genérico, sin stack ni datos internos.

### Formato del error (Problem Details, RFC 9457)
`Content-Type: application/problem+json` con `type`, `title`, `status`, `detail`, `instance`. En un 500 no filtrar detalles internos (stack, claves, SQL).
