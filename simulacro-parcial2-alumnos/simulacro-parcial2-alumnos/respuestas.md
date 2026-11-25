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

T1
(a) -> 401. Se utiliza cuando no se añade el encabezado del token
(b) -> 403. El token es valido sin embargo si es de consulta no deberia poder realiza un POST
(c) -> 400. El pedido no se puede leer
(d) -> 422. El recurso no es valido
(e) -> 429. Se solicitaron demasiados recursos.

T2



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
