# Apunte del Segundo Parcial — Programación IV

Programación IV — UTN FRRe

Este apunte desarrolla **todos los temas del temario** del segundo parcial: semántica HTTP, identidad federada, JWT, seguridad, bases de datos, tiempo real y streams. Al final hay un repaso de lo que se sigue usando de la primera parte.

El parcial no evalúa memoria. Pide **predecir** qué imprime o qué responde un código, **encontrar el defecto** en algo que parece correcto y **justificar** una decisión con sus costos. Todo gira alrededor de una pregunta:

> **¿Qué puede creer tu backend de lo que le llega por la red?**
>
> Respuesta corta: **nada que no haya verificado él mismo.**

## Cómo usar este apunte

- Cada tema tiene: la **idea en una frase**, una **analogía**, lo **técnico mínimo** y **preguntas tipo parcial** con respuesta modelo.
- Las preguntas tienen el formato de los simulacros (**T** + número). Primero tapá la respuesta e intentá contestar con tus palabras.
- Para cada tema, preparate **una frase**: *qué ataque o falla evita* y *qué cuesta la solución*.

## Índice

| # | Tema | Pregunta de fondo |
| --- | --- | --- |
| 1 | Semántica HTTP | ¿Qué pasa si el pedido se repite o se pisa con otro? |
| 2 | Identidad federada (Firebase Auth) | ¿Quién es el usuario de verdad? |
| 3 | JWT | ¿Puedo creerle a este token? |
| 4 | Seguridad | ¿Cómo me tiran abajo o me engañan? |
| 5 | Bases de datos | ¿Cuánto cuesta y qué se pierde con escrituras concurrentes? |
| 6 | Tiempo real | ¿Cómo le aviso al cliente sin que pregunte? |
| 7 | Streams y backpressure | ¿Cómo manejo archivos enormes sin explotar la memoria? |
| 8 | Repaso de la primera parte | Event loop, Express, lista blanca |
| 9 | Machete final | Tablas de una línea para repasar |

---

## 1. Semántica HTTP

### 1.1 Un timeout no significa que falló: significa que no sabés

Cuando el cliente manda un pedido y no recibe respuesta, pudo haber pasado cualquiera de estas tres cosas:

| Final | ¿Qué pasó en el servidor? |
| --- | --- |
| No llegó | Nada. El pedido se perdió en el camino. |
| Llegó y falló | Se intentó, pero hubo un error. |
| Funcionó, pero se perdió la respuesta | **Se hizo.** Solo se perdió el "ok". |

**Desde el cliente, las tres se ven igual.** Si el cliente reintenta, en el tercer caso **lo hace dos veces**.

> Analogía: mandás un mensaje de WhatsApp y queda con un solo tilde. No sabés si le llegó o no. Si lo mandás de nuevo, quizás lo recibe dos veces.

### 1.2 Métodos seguros e idempotentes (RFC 9110)

- **Seguro**: no cambia nada en el servidor. Solo lee.
- **Idempotente**: hacerlo 1 vez o 10 veces **deja el mismo estado**. No significa "devuelve lo mismo".

| Método | ¿Seguro? | ¿Idempotente? | Por qué |
| --- | --- | --- | --- |
| `GET` | Sí | Sí | Solo lee. |
| `PUT` | No | **Sí** | "Dejá el recurso 123 así": dos veces queda igual. |
| `DELETE` | No | **Sí** | Borrar algo ya borrado lo deja borrado. La 2ª vez puede dar `404`, pero **el estado** es el mismo. |
| `POST` | No | **No** | "Creá uno nuevo": cada vez crea otro. |
| `PATCH` | No | **No necesariamente** | `{"nombre":"Ana"}` sí es idempotente; `{"op":"sumar","stock":1}` no. |

> Analogía: el botón del ascensor es idempotente (lo apretás 5 veces y viene una sola vez). Pedir "traeme una pizza" no lo es (5 pedidos son 5 pizzas).

**Trampa típica:** "`DELETE` no es idempotente porque la segunda vez da 404". **Falso:** idempotencia habla del **estado**, no de la respuesta.

### 1.3 Idempotency-Key

El cliente inventa una clave única (un UUID) por operación y la manda en el encabezado `Idempotency-Key`. Si reintenta, manda **la misma**.

Por cada clave, el servidor guarda la **huella del body** (un hash SHA-256), el **estado** (`en proceso` o `terminado`) y la **respuesta** (status y body).

**Los cuatro casos:**

| Caso | Qué hace el servidor | Respuesta |
| --- | --- | --- |
| 1. Primer intento (clave nueva) | Guarda la clave como `en proceso` **antes** de procesar, procesa y guarda la respuesta | La normal (ej. `201`) |
| 2. Reintento mientras la 1ª se procesa | No procesa de nuevo | **`409 Conflict`** (+ `Retry-After`) |
| 3. Reintento cuando la 1ª ya terminó | No procesa de nuevo | **La respuesta guardada**, idéntica |
| 4. Misma clave, **otro body** (no coincide la huella) | Rechaza | **`422`** |

- **¿Por qué la huella?** Sin ella, el caso 4 respondería "ok, ya está" y los datos nuevos se perderían **en silencio**.
- **¿Por qué marcar `en proceso` antes?** Si no, dos pedidos simultáneos no encuentran la clave y los dos crean el recurso.

**¿Por qué un `Map` en memoria no alcanza con dos instancias?**
Cada instancia tiene **su propio** `Map`. El balanceador puede mandar el 1er intento a la instancia A y el reintento a la B. B no conoce la clave y crea el recurso otra vez. Solución: un **almacén compartido** (Redis o la base), con una inserción **atómica** de la clave (por ejemplo `SET clave valor NX` en Redis, o una restricción `UNIQUE` en la base), para que solo uno "gane" la clave.

### 1.4 Lost update (actualización perdida)

Dos clientes editan lo mismo al mismo tiempo:

```
1. Ana  hace GET /productos/7   → { nombre: "Yerba", precio: 100, stock: 10 }
2. Beto hace GET /productos/7   → { nombre: "Yerba", precio: 100, stock: 10 }
3. Ana  hace PUT  con precio: 120 (y stock: 10)   → 200
4. Beto hace PUT  con stock: 8    (y precio: 100) → 200   ← pisa el precio de Ana
```

Resultado: **dos `200`, ningún error, y el precio de Ana se perdió.** Beto mandó el objeto entero con el precio **viejo**.

> Analogía: dos personas editan la misma planilla descargada. La última que sube su copia pisa los cambios de la otra.

**¿Por qué `PATCH` no siempre lo arregla?**
- Si cada uno toca **campos distintos**, `PATCH` ayuda: Ana manda solo `precio` y Beto solo `stock`.
- Si los dos tocan **el mismo campo**, o el valor nuevo **se calculó en el cliente a partir del viejo**, se sigue perdiendo. Ejemplo: los dos leen `stock: 10`, venden 1 cada uno y mandan `PATCH {stock: 9}`. Quedó 9, pero debería ser 8.

### 1.5 ETag e If-Match (concurrencia optimista)

**Idea:** cada versión del recurso tiene una "etiqueta" (`ETag`). Para modificar, el cliente dice "modificalo **solo si** sigue siendo la versión que yo vi".

```
GET /productos/7         → 200, ETag: "v5"
PUT /productos/7
If-Match: "v5"           → si sigue en v5: 200 (y pasa a v6)
                         → si ya cambió:   412 Precondition Failed
```

| Código | Cuándo |
| --- | --- |
| **`412` Precondition Failed** | Mandaste `If-Match` pero la versión ya cambió. El cliente tiene que volver a leer. |
| **`428` Precondition Required** | El servidor **exige** `If-Match` y no lo mandaste. |
| **`304` Not Modified** | En un `GET` con `If-None-Match: "v5"`: tu copia sigue vigente y no te mando el body (ahorra ancho de banda). |

Se llama **optimista** porque no bloquea a nadie: asume que casi nunca hay conflicto y solo lo detecta cuando pasa.

**¿Por qué comparar y escribir tiene que ser UNA sola sentencia?**

```js
// ❌ MAL: dos pasos. Entre el SELECT y el UPDATE se puede meter otro pedido.
const fila = await db.query("SELECT version FROM productos WHERE id = $1", [id]);
if (fila.version !== versionCliente) return 412;
await db.query("UPDATE productos SET precio = $1, version = version + 1 WHERE id = $2", [...]);

// ✅ BIEN: compara y escribe en un solo paso atómico.
const r = await db.query(
  "UPDATE productos SET precio = $1, version = version + 1 WHERE id = $3 AND version = $2",
  [precio, versionCliente, id]
);
if (r.rowCount === 0) return 412;   // nadie coincidió: la versión ya había cambiado
```

En la versión mala, dos pedidos pueden pasar el `if` a la vez, porque los dos leyeron `v5`, y los dos escriben: vuelve el lost update. En la buena, la base garantiza que **solo uno** encuentra `version = 5`.

### 1.6 Códigos de estado que confunden

| Par | Diferencia en una línea |
| --- | --- |
| **400 vs 422** | 400: el pedido **no se puede leer** (JSON roto, `limite=abc`). 422: se leyó bien pero **no cumple las reglas** (`"kg": "11000"` es string). |
| **401 vs 403** | 401: **no sé quién sos** (falta token, inválido o vencido). 403: **sé quién sos pero no podés** (rol insuficiente). |
| **409 vs 412** | 409: choca con el **estado actual** (ya existe, se está procesando). 412: **tu condición** `If-Match` ya no se cumple. |
| **412 vs 428** | 412: mandaste `If-Match` y estaba **viejo**. 428: **no mandaste** `If-Match` y era obligatorio. |

Otros: `201` creado (con encabezado `Location`), `204` sin contenido, `404` no existe, `429` demasiados pedidos (rate limit, con `Retry-After`), `500` error del servidor.

### 1.7 Problem Details (RFC 9457)

Formato estándar para errores, con `Content-Type: application/problem+json`:

```json
{
  "type": "https://api.ejemplo.edu/problemas/entrega-invalida",
  "title": "kgBrutos debe ser un entero entre 1 y 30000",
  "status": 422,
  "detail": "Llegó el valor \"11000\" como texto",
  "instance": "/entregas"
}
```

| Campo | Qué es |
| --- | --- |
| `type` | URI que identifica **el tipo** de problema (siempre el mismo para el mismo error). |
| `title` | Resumen legible para humanos. |
| `status` | El código HTTP. |
| `detail` | Explicación de **este** caso puntual. |
| `instance` | Qué pedido o recurso lo causó. |

**En un `500` no se filtra nada interno**: ni el stack, ni la cadena de conexión, ni el SQL. Esas cosas van **al log**, y al cliente solo le llega `"Error interno"`. Sirven de mapa para un atacante (STRIDE: *filtración de información*).

### 1.8 Paginación: offset vs cursor

**Offset**: `GET /items?pagina=3` → `LIMIT 10 OFFSET 20`.
**Cursor**: `GET /items?despuesDe=481` → `WHERE id < 481 ORDER BY id DESC LIMIT 10`.

| Problema | Offset | Cursor |
| --- | --- | --- |
| Alguien **inserta** un ítem mientras paginás | Todo se corre un lugar: ves un ítem **repetido** en la página siguiente | No pasa: seguís desde el último id que viste |
| Alguien **borra** un ítem mientras paginás | Todo se corre al revés: un ítem queda **salteado** | No pasa |
| `OFFSET 100000` | La base **lee y descarta** 100.000 filas: lento | Usa el índice y va directo |
| Saltar a "página 50" | Fácil | No se puede: solo siguiente o anterior |

> Analogía: offset es "dame lo que está en el renglón 20 de la lista", pero si alguien agregó un renglón arriba, ese ya no es el mismo. Cursor es "dame lo que viene después de este señalador".

### Preguntas tipo parcial — HTTP

**T1.1 — La balanza manda un `POST`, hay timeout y reintenta. ¿Qué puede pasar?**
> El timeout no dice si el pedido falló. Pudo no llegar, llegar y fallar, o **funcionar y perderse la respuesta**. En el último caso el reintento crea un duplicado (en el simulacro, se le paga dos veces al productor y lo pierde la empresa). El cliente no puede distinguir los casos, así que hace falta `Idempotency-Key`.

**T1.2 — "`DELETE` no es idempotente porque la segunda vez responde 404." ¿Verdadero?**
> Falso. Idempotente significa que repetirlo deja **el mismo estado**, no que devuelva la misma respuesta. Después del 1er y del 2do `DELETE` el recurso está igual: borrado.

**T1.3 — La API guarda las Idempotency-Keys en un `Map` y corre en 2 instancias. ¿Qué falla?**
> Cada instancia tiene su propio `Map`. Si el reintento cae en la otra instancia, la clave no está y se crea un duplicado. Hace falta un almacén compartido (Redis o la base) con inserción atómica (`SET NX` o `UNIQUE`), para que dos pedidos simultáneos no "ganen" los dos.

**T1.4 — Dos usuarios hacen `PUT` al mismo producto y ambos reciben `200`. ¿Hay problema?**
> Sí: lost update. El segundo `PUT` lleva el objeto completo con los valores **viejos** y pisa el cambio del primero, sin ningún error. Se arregla con ETag + `If-Match`: el segundo recibe `412` y tiene que releer. Si además se exige `If-Match`, el que no lo mande recibe `428`.

**T1.5 — ¿Por qué este código no evita el lost update aunque use versiones?** *(SELECT version → if → UPDATE)*
> Porque comparar y escribir son dos pasos. Dos pedidos pueden leer la misma versión, pasar los dos el `if` y escribir los dos. Tiene que ser una sola sentencia: `UPDATE … WHERE id = $1 AND version = $2`. Si `rowCount` es 0, se responde `412`.

**T1.6 — Paginás por offset un feed que recibe ítems nuevos cada segundo. ¿Qué ve el usuario?**
> Ítems **repetidos**: cada inserción arriba corre todo un lugar, así que el último de la página 1 reaparece en la 2. Si se borran ítems, aparecen **salteados**. Además, `OFFSET` grande es caro porque la base lee y descarta filas. Con cursor (`WHERE id < último`) no pasa, pero no se puede saltar a una página arbitraria.

---

## 2. Identidad federada (Firebase Auth)

### 2.1 El uid en el body no identifica a nadie

```js
// ❌ El cliente manda { "uid": "ana", ... } y el servidor le cree.
recepcion.recibidaPor = req.body.uid;
```

El body lo escribe **el cliente**, y el cliente puede ser un atacante con `curl`. Puede poner `"uid": "jefe"` y queda registrado a nombre de otro: **suplantación** (y **repudio**, porque el verdadero "ana" puede decir "yo no fui", y es verdad).

**Lo único que identifica a alguien es lo que sale de un token verificado:** `req.usuario = verificarToken(token)` y después `recibidaPor = req.usuario.sub`.

### 2.2 El backend no autentica: verifica

> Analogía: el boliche no te toma un examen para saber quién sos. Mira tu DNI, que emitió el Registro Civil, y verifica que sea auténtico y que no esté vencido.

- **Autenticar** (saber quién es, viendo su contraseña) lo hace **el proveedor** (Firebase/Google).
- El proveedor le da al usuario un **ID token** firmado.
- **Tu backend nunca ve la contraseña.** Solo comprueba que ese documento firmado sea **auténtico** y que **sea para él**.

### 2.3 Una firma correcta no alcanza: los campos del ID token

Firebase firma con **RS256**: firma con su clave **privada** y vos verificás con su clave **pública**.

| Campo | Qué tiene que cumplir | Si NO lo chequeás, entra… |
| --- | --- | --- |
| `alg` | Exactamente `RS256` | Un token con `alg: none` o con confusión de algoritmo (ver JWT) |
| `kid` | Una de las claves públicas **actuales** de Google | Un token firmado con una clave que elige el atacante |
| `iss` (issuer, quién lo emitió) | `https://securetoken.google.com/<tu-proyecto>` | Un token emitido por otro emisor |
| `aud` (audience, para quién es) | `<tu-proyecto>` | **El token de otro proyecto** (abajo) |
| `sub` (subject) | No vacío: es el uid | Un token sin usuario |
| `exp` | En el futuro | Un token vencido o robado hace meses |
| `iat` (emitido en) | En el pasado | Un token "del futuro" (reloj manipulado) |
| `auth_time` | En el pasado; para operaciones sensibles, **reciente** | Alguien con una sesión vieja que hace algo delicado (cambiar mail o contraseña) sin volver a loguearse |

**El ataque del token de otro proyecto:**
1. El atacante crea **su propio** proyecto de Firebase, que es gratis.
2. Se loguea y obtiene un ID token **firmado de verdad por Google**.
3. Lo manda a tu backend. Si solo verificás la firma, **es válida**: la hizo Google.
4. Pero `aud` dice `proyecto-del-atacante` e `iss` termina en `proyecto-del-atacante`. Si no los chequeás, **entra**.

> La firma solo prueba **quién lo emitió**, no **para quién** era. Es como aceptar una entrada auténtica… de otro recital.

### 2.4 Autenticación vs autorización

| | Autenticación (authn) | Autorización (authz) |
| --- | --- | --- |
| Pregunta | **¿Quién sos?** | **¿Podés hacer esto?** |
| Middleware | `autenticar`: verifica el token y llena `req.usuario` | `autorizar("operador")`: mira `req.usuario.rol` |
| Si falla | **401** | **403** |

```js
router.post("/", autenticar, autorizar("operador"), crearEntrega);
```

Son dos preguntas distintas y van en dos middlewares separados. El orden importa: primero se averigua quién es y después qué puede hacer.

### 2.5 Los claims son una foto del momento: el "admin fantasma"

Un claim como `rol: "admin"` queda **escrito adentro del token** cuando se emite. Si el lunes a Juan le sacan el rol de admin, pero su token dura 1 hora, **durante esa hora su token sigue diciendo "admin"** y el servidor le cree. Ese es el **admin fantasma**.

| ¿Alcanza con el claim? | Caso |
| --- | --- |
| **Sí** | Operaciones de bajo riesgo, donde 1 hora de desfase es aceptable (leer listados). |
| **No, hay que mirar la base** | Operaciones críticas (borrar, pagar, cambiar permisos). Se consulta el rol **actual** en la base o se chequea si el token fue revocado (Firebase: `verifyIdToken(token, true)`). |

**El costo:** consultar la base en cada pedido es más lento y pierde la ventaja del JWT (no tener que consultar a nadie).

### Preguntas tipo parcial — Identidad federada

**T2.1 — Un compañero propone que el cliente mande `"uid": "ana"` en el body y guardarlo como `recibidaPor`. ¿Qué ataque abre?**
> Suplantación: el body lo controla el cliente, así que cualquiera con `curl` manda `"uid": "jefe"` y la recepción queda a nombre de otro. También repudio: nadie puede probar quién la cargó. La identidad tiene que salir **del token verificado** (`req.usuario.sub`), nunca del body.

**T2.2 — Al migrar a Firebase, el backend verifica solo la firma del ID token, sin mirar `iss` ni `aud`. ¿Qué token falso entra?**
> El de otro proyecto. El atacante crea su propio proyecto de Firebase, se loguea y obtiene un token firmado de verdad por Google. La firma es válida, pero `aud` e `iss` dicen otro proyecto. Si no se chequean, entra con cualquier identidad que haya creado en su proyecto. La firma prueba quién emitió el token, no para quién era.

**T2.3 — ¿Por qué se dice que el backend "no autentica, verifica"?**
> Porque quien ve la contraseña y decide quién es el usuario es el proveedor (Firebase). El backend nunca ve la contraseña. Solo comprueba que el token firmado sea auténtico (firma, `kid`, `alg`), que sea para él (`aud`, `iss`) y que esté vigente (`exp`).

**T2.4 — A Juan le sacan el rol `operador`, pero su token (con el rol adentro) dura 1 hora. ¿Qué puede hacer? ¿Qué cuesta arreglarlo?**
> Durante esa hora puede seguir cargando recepciones como operador, porque el token es una foto del momento en que se emitió. Para cortarlo hay que consultar el rol actual en la base, o una lista de revocados, en cada pedido. Eso cuesta una consulta por pedido y se pierde la ventaja del JWT de no depender de un almacén. La alternativa barata es acortar la duración del token (menos ventana, pero más renovaciones).

---

## 3. JWT

### 3.1 Estructura

```
eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiJhbmEiLCJyb2wiOiJvcGVyYWRvciJ9 . Xk3f9QaZ...
       HEADER                            PAYLOAD                        FIRMA
```

| Parte | Contenido | ¿Quién lo puede leer o escribir? |
| --- | --- | --- |
| Header | `{"alg":"HS256","typ":"JWT"}` | **Cualquiera** |
| Payload | `{"sub":"ana","rol":"operador","exp":...}` | **Cualquiera** |
| Firma | `HMAC(header.payload, SECRETO)` o firma RSA | **Solo quien tiene la clave** |

**Base64url NO es cifrado.** Es como escribir en otro alfabeto: cualquiera lo traduce sin clave. Por eso **nunca** se pone nada sensible en el payload (contraseñas, datos personales).

> Analogía: un JWT es una **postal con un sello lacrado**. Todos pueden leer la postal, pero solo el que tiene el sello puede lacrarla. Si alguien cambia el texto, el lacre ya no coincide.

**HS256 vs RS256:**
- **HS256** (simétrico): **un solo secreto** para firmar y verificar. Lo tiene solo el servidor.
- **RS256** (asimétrico): se firma con la clave **privada** y se verifica con la **pública**, que es pública de verdad. Lo usa Firebase/Google: vos verificás sin poder firmar.

### 3.2 El defecto de fondo

**El token trae en su header las instrucciones para verificarlo (`alg`, `kid`), y ese header lo escribe el atacante.**

> Es como si el ladrón te dijera qué cerradura revisar.

Todos los ataques de abajo explotan ese defecto.

### 3.3 Ataques al verificador ingenuo

**a) `alg: none`**
El estándar permite `"alg": "none"`, que significa "token sin firma". El atacante arma `{"alg":"none"}.{"rol":"admin"}.` con la firma vacía. Un verificador que obedece al header no verifica nada y lo acepta.

**b) Confusión de algoritmo (RS256 → HS256)**
1. El servidor usa RS256 y tiene una clave **pública**, que todos conocen.
2. El atacante arma un token con `alg: HS256` y lo firma con HMAC **usando la clave pública como secreto**.
3. El verificador ingenuo lee `HS256` y verifica con HMAC usando "la clave que tiene", que es la pública. **Coincide.**
4. El atacante firmó tokens válidos con algo que todo el mundo conoce.

**c) Secreto débil atacado offline**
Si el secreto HS256 es `"secreto123"`, el atacante toma **un solo** token válido (el suyo) y en su propia compu prueba millones de secretos por segundo hasta que la firma coincide. Es **offline**: no toca tu servidor, así que el rate limiting no lo frena. Cuando lo encuentra, firma lo que quiera. Defensa: un secreto largo y aleatorio (32 bytes o más de `crypto.randomBytes`).

**d) Inyección por `kid`**
El `kid` (key id) dice "verificame con la clave X". Si el servidor lo usa sin controlar:

```js
// ❌ El kid lo escribe el atacante.
const clave = fs.readFileSync(`claves/${header.kid}.key`);
```

- `kid: "../../../dev/null"` lee un archivo **vacío**, el atacante firma con secreto vacío y entra.
- `kid: "../../package.json"` hace que el atacante firme usando como secreto un archivo **público** del proyecto.
- Si el `kid` se usa en una consulta SQL, hay inyección SQL.

### 3.4 Verificador endurecido: el servidor decide

```js
const CLAVES = {                           // lista blanca: kid → clave + algoritmo
  "2026-11": { clave: CLAVE_NOV, alg: "RS256" },
  "2026-10": { clave: CLAVE_OCT, alg: "RS256" },
};

function verificar(token) {
  const header = leerHeader(token);
  const entrada = CLAVES[header.kid];                 // búsqueda en la lista, nunca un path
  if (!entrada) throw new Error("kid desconocido");
  if (header.alg !== entrada.alg) throw new Error("alg no permitido"); // el alg va atado a la clave
  verificarFirma(token, entrada.clave, entrada.alg);  // con el alg que decide el SERVIDOR
  const p = leerPayload(token);
  if (p.iss !== ISS_ESPERADO) throw ...;
  if (p.aud !== AUD_ESPERADO) throw ...;
  if (!(p.exp > ahora())) throw ...;
  return p;
}
```

- **`kid` como búsqueda en una lista blanca**: si no está en la lista, se rechaza. Nunca se arma un path ni una consulta con él.
- **Algoritmo atado a la clave**: cada clave tiene **un** algoritmo fijo. Esto mata `none` y la confusión de algoritmo.
- **Siempre se chequean `iss`, `aud` y `exp`.**
- **Primero la firma, después se confía en el payload.**

### 3.5 Revocación: un JWT no se puede invalidar

El JWT es **stateless**: el servidor no guarda nada, solo verifica la firma. Esa es su ventaja (cualquier instancia lo verifica sin consultar a nadie) y también su problema: **no hay nada que borrar** para anularlo. Un token robado vale hasta que vence.

**Agregar una lista de revocados (denylist por `jti`, el id del token):** en cada pedido hay que consultar la lista, que además tiene que estar en un almacén compartido entre instancias. Se pierde justamente la ventaja de no consultar a nadie.

**JWT vs sesión opaca:**

| | JWT | Sesión opaca (id aleatorio + datos en el servidor) |
| --- | --- | --- |
| Verificar | Solo la firma, sin consultar nada | Consulta al almacén en **cada** pedido |
| Revocar | Difícil (esperar `exp` o mantener una lista) | **Fácil**: borrás la sesión |
| Varias instancias | Sale gratis | Hace falta un almacén compartido (Redis) |
| Datos actualizados | Foto vieja (admin fantasma) | Siempre los actuales |

### 3.6 Refresh tokens con rotación

- **Access token**: corto (5 a 15 min). Va en cada pedido. Si lo roban, sirve poco tiempo.
- **Refresh token**: largo (días). Solo sirve para pedir un access nuevo.

**Rotación:** cada vez que usás el refresh `R1`, el servidor te da un access nuevo **y un refresh nuevo `R2`**, y `R1` queda **inválido**: es de un solo uso.

**Detección de reuso:** si alguien usa `R1` de nuevo, que ya fue usado, hay dos personas con el mismo refresh: el usuario y un ladrón. El servidor no sabe cuál es cuál, así que **revoca toda la familia** (todos los refresh que descienden de ese login). Los dos tienen que volver a loguearse, y el ladrón queda afuera.

**El caso del cliente honesto que pierde la respuesta:**
1. El cliente manda `R1`.
2. El servidor rota: invalida `R1`, genera `R2` y responde.
3. **La respuesta se pierde** (timeout: ¡tema 1!).
4. El cliente, honesto, reintenta con `R1`.
5. El servidor ve reuso, revoca la familia y **desloguea a un usuario inocente**.

Mitigación: un **período de gracia** corto (unos segundos) en el que reusar `R1` devuelve **el mismo `R2`** en lugar de revocar. Es la idea de la idempotencia aplicada al refresh.

### 3.7 Dónde guardar el token

| | `localStorage` | Cookie `httpOnly` |
| --- | --- | --- |
| ¿Lo lee JavaScript? | **Sí** | **No** |
| Riesgo principal | **XSS**: un script inyectado lo lee y se lo lleva | **CSRF**: el navegador manda la cookie **solo**, incluso desde otro sitio |
| Defensas | Evitar XSS: escapar la salida, CSP (Content Security Policy) | `SameSite=Lax/Strict`, token anti-CSRF, chequear `Origin`. Y siempre `Secure` (solo HTTPS) |

> XSS: el ladrón **se mete en tu casa y te saca la llave**. CSRF: el ladrón no ve la llave, pero **te engaña para que vos abras la puerta**.

### 3.8 Rotación de claves y `kid`

Las claves se cambian cada tanto: si una se filtra, el daño queda acotado. Mientras se rota, conviven tokens firmados con la clave vieja y con la nueva. El **`kid`** le dice al verificador **cuál de las claves** usar, y el proveedor publica sus claves vigentes (JWKS).

**¿Por qué limitar las descargas de claves?** Si cada `kid` desconocido dispara "voy a descargar las claves de nuevo", el atacante manda miles de tokens con `kid` inventados y tu servidor **martilla** al proveedor. Eso es denegación de servicio, y además el proveedor puede bloquearte. Por eso las claves se **cachean** y las descargas se limitan (como mucho una cada X minutos).

### Preguntas tipo parcial — JWT

**T3.1 — Un compañero reemplaza `verificarToken` por `JSON.parse(Buffer.from(token.split(".")[1], "base64url"))` "porque es más rápido". ¿Qué ataque permite?**
> Esa línea solo **decodifica** el payload: no verifica la firma ni `exp`. Cualquiera arma un payload `{"sub":"jefe","rol":"operador"}` con una firma inventada y el servidor le cree. Permite suplantar a otro usuario y escalar privilegios, y además el token nunca vence. Base64url no protege nada: lo único que protege es la firma.

**T3.2 — ¿Por qué `verificarToken` rechaza `"alg": "none"` en lugar de confiar en el token?**
> `none` significa "sin firma". Si el servidor obedeciera al header, un atacante pondría `none`, dejaría la firma vacía y se saltearía la verificación. El header lo escribe el atacante, así que el algoritmo lo decide el servidor (solo `HS256`) y rechaza cualquier otro.

**T3.3 — ¿Para qué controlar `exp` si la firma es válida?**
> La firma prueba que el servidor emitió el token y que nadie lo tocó, pero no que siga vigente. Un token robado serviría para siempre, y como el JWT es stateless no hay forma de anularlo. `exp` acota la ventana de daño.

**T3.4 — `verificarToken` busca la clave en `claves/${header.kid}.key`. ¿Qué token falso entra?**
> El `kid` lo escribe el atacante. Con `kid: "../../../dev/null"` el servidor lee un archivo vacío como clave, y el atacante firma con secreto vacío. Con un path a un archivo público del proyecto, firma usando ese archivo como secreto. La solución es que el `kid` se busque en una lista blanca (un objeto `kid → clave`) y nunca se use para armar un path.

**T3.5 — El servidor usa RS256. ¿Cómo funciona la confusión de algoritmo?**
> El atacante cambia `alg` a `HS256` y firma con HMAC usando la **clave pública** como secreto. Un verificador que obedece al header verifica con HMAC y la clave que tiene (la pública), y la firma coincide. Se evita atando el algoritmo a la clave: esa clave solo verifica RS256.

**T3.6 — El secreto HS256 es `"clave2026"`. ¿Por qué el rate limiting no ayuda?**
> Porque el ataque es offline. Con un solo token válido, el atacante prueba secretos en su propia compu hasta que la firma coincide, sin mandarle ningún pedido al servidor. Después firma tokens a gusto. Hace falta un secreto largo y aleatorio.

**T3.7 — ¿Por qué un JWT no se puede revocar y qué se pierde al agregar una lista negra?**
> Porque el servidor no guarda estado: verifica solo con la firma, así que no hay nada que borrar. Con una denylist hay que consultarla en cada pedido y compartirla entre instancias, y se pierde la ventaja de verificar sin consultar a nadie. Termina pareciéndose a una sesión opaca.

**T3.8 — Con refresh tokens rotativos, un cliente honesto termina deslogueado. ¿Cómo pasó?**
> Mandó `R1`, el servidor lo rotó a `R2`, pero la respuesta se perdió. Al reintentar con `R1`, el servidor lo vio como reuso (posible robo) y revocó toda la familia. Se mitiga con un período de gracia corto en el que reusar `R1` devuelve el mismo `R2`.

**T3.9 — ¿`localStorage` o cookie `httpOnly`?**
> `localStorage` lo lee cualquier JS, así que un XSS roba el token. La cookie `httpOnly` no la lee JS, pero el navegador la manda sola, así que queda expuesta a CSRF. La cookie suele ser mejor porque el CSRF se defiende con `SameSite`, un token anti-CSRF y el chequeo de `Origin`. Siempre con `Secure`.

---

## 4. Seguridad

### 4.1 Rate limiting: tres algoritmos

Limitar cuántos pedidos puede hacer un cliente, por ejemplo 60 por minuto.

**a) Ventana fija**: un contador por minuto calendario (12:00, 12:01…) que se reinicia al cambiar el minuto.
- Memoria: **1 contador por cliente**. Barato.
- Problema: **ráfaga en el borde**. 60 pedidos a las 12:00:59 y 60 a las 12:01:00 son **120 en 2 segundos** y todos pasan.

**b) Registro deslizante (sliding log)**: se guarda **el horario de cada pedido**. Al llegar uno nuevo, se cuentan los de los últimos 60 segundos.
- Exacto: nunca pasan más de 60 en ninguna ventana de 60 s.
- Memoria: **hasta 60 timestamps por cliente**. Caro con muchos clientes.

**c) Balde de fichas (token bucket)**: un balde con capacidad para C fichas que se rellena a un ritmo fijo (1 ficha por segundo, por ejemplo). Cada pedido gasta una ficha, y si no hay fichas → `429`.
- Permite **ráfagas controladas** (hasta C seguidas) y después limita al ritmo de recarga.
- Memoria: **2 números por cliente** (fichas y última recarga). Barato.

| Algoritmo | Ráfaga en el borde | Memoria por cliente |
| --- | --- | --- |
| Ventana fija | **Sí**, hasta el doble | 1 contador |
| Registro deslizante | No | 1 timestamp por pedido (hasta el límite) |
| Token bucket | Ráfaga acotada a C, a propósito | 2 números |

### 4.2 Rate limiting con varias instancias

La API corre en **3 instancias**, cada una con su contador **en memoria** de 60/min. El balanceador reparte los pedidos, así que cada instancia cuenta solo **lo suyo**: un cliente puede hacer **60 × 3 = 180** por minuto. Con N contadores, el límite real es **N veces mayor**.

**Solución:** un **almacén compartido** (Redis) con **un** contador por cliente.

**¿Por qué necesita incremento atómico (`INCR`)?**

```
❌ leer-sumar-escribir:
   Instancia A lee 59   Instancia B lee 59
   A escribe 60         B escribe 60      → pasaron 2 pedidos, el contador sumó 1

✅ INCR: Redis suma y devuelve el valor nuevo en una sola operación indivisible.
   A: INCR → 60 (pasa)   B: INCR → 61 (429)
```

Es **la misma carrera del lost update**, ahora en el contador.

### 4.3 ReDoS (denegación de servicio por regex)

```js
/^(\d+)+$/.test("1111111111111111111111111x")
```

- `+` adentro de `+`: hay **muchísimas formas** de repartir los `1` entre el grupo de adentro y el de afuera.
- Al final hay una `x` que hace fallar el match, y el motor **prueba todas las formas** antes de rendirse (*backtracking*).
- Con n caracteres hay unas 2ⁿ combinaciones: **cada carácter extra duplica el tiempo**. Con 30 caracteres puede tardar minutos.

**¿Por qué deja sordo a todo el servidor?** Node tiene **un solo hilo**. Mientras la regex calcula, el event loop está bloqueado y **ningún otro pedido** de ningún cliente se atiende. Un solo pedido malicioso frena a todos. `async` no ayuda, porque es un cálculo y no una espera.

**Cómo se arregla:**
1. **Reescribir la regex** sin cuantificadores anidados: `/^\d+$/` acepta lo mismo y es lineal.
2. **Limitar el largo de la entrada antes de la regex**: `if (valor.length > 20) → 422`. Aunque la regex fuera mala, con 20 caracteres no explota.

### 4.4 STRIDE

Seis categorías de amenazas. Ejemplo con un **sistema de telemetría** (sensores o balanzas que mandan lecturas a una API):

| Letra | Amenaza | Ejemplo en telemetría | Contramedida |
| --- | --- | --- | --- |
| **S** — Spoofing | **Suplantación** | Un dispositivo falso manda lecturas como si fuera la balanza 7. "El servidor cree la identidad que viene en un encabezado." | Autenticación fuerte por dispositivo (token firmado, certificado), identidad del token y no del body |
| **T** — Tampering | **Manipulación** | Alguien modifica una lectura en tránsito o en la base | HTTPS, firmas, validación con lista blanca |
| **R** — Repudiation | **Repudio** | "La balanza niega haber mandado una pesada" | Log de auditoría con identidad verificada y hora; mensajes firmados |
| **I** — Information disclosure | **Filtración** | Un 500 devuelve el stack o la clave de la base; lecturas sin autenticación | Problem Details sin detalles internos, authz en las lecturas |
| **D** — Denial of service | **Denegación** | Inundar de pedidos, ReDoS, subir archivos gigantes | Rate limiting, límite de tamaño, regex seguras, streams |
| **E** — Elevation of privilege | **Escalada** | Un usuario `consulta` logra cargar datos; el body trae `"rol": "admin"` | Middleware de autorización, lista blanca de campos |

### 4.5 Lista blanca contra lista negra

- **Lista negra**: "rechazo lo malo que conozco" (`__proto__`, `<script>`…). **Siempre deja algo afuera**: aparece `constructor`, `prototype`, una codificación rara o un campo nuevo como `"importe"`.
- **Lista blanca**: "acepto **solo** lo que conozco". Lo bueno es una lista finita, lo malo es infinito.

> Analogía: en una fiesta privada no tenés la lista de los que **no** pueden entrar (sería infinita). Tenés la lista de invitados.

Ejemplo del simulacro: "**solo** se admiten estos cinco campos; si llega cualquier otro, `422`". Eso evita que el cliente mande `"importe": 999999` o `"__proto__"` (prototype pollution).

### Preguntas tipo parcial — Seguridad

**T4.1 — 3 instancias, cada una con un contador en memoria de 60/min por IP. ¿Cuántos pedidos puede hacer un cliente? ¿Qué cambia con un almacén compartido y por qué `INCR`?**
> Hasta 180 por minuto (60 × 3), porque cada instancia cuenta solo lo que le llega. Con un almacén compartido hay un único contador por IP. Tiene que incrementarse en forma atómica: si dos instancias leen 59 y escriben 60, pasaron dos pedidos y se contó uno. `INCR` suma y devuelve el valor nuevo en una sola operación.

**T4.2 — Con ventana fija, ¿qué ráfaga se cuela? ¿Qué algoritmo la evita y a qué costo?**
> En el borde entre dos ventanas: 60 pedidos al final de un minuto y 60 al principio del siguiente, 120 en dos segundos. El registro deslizante la evita porque cuenta los últimos 60 s exactos, pero guarda un timestamp por pedido (hasta 60 por cliente) en lugar de un solo contador. El token bucket la acota con 2 números por cliente.

**T4.3 — `/^(\d+)+$/.test("1111111111111111111111111x")`: ¿qué pasa y por qué afecta a otros clientes?**
> Por el `+` adentro de `+`, el motor prueba todas las formas de repartir los dígitos entre los dos grupos antes de fallar por la `x`. Cada carácter extra duplica el tiempo. Como Node tiene un solo hilo, el event loop queda bloqueado y no se atiende a nadie más. Se reescribe como `/^\d+$/` y además se limita el largo de la entrada antes de evaluarla.

**T4.4 — STRIDE: "el servidor cree la identidad que viene en un encabezado" y "la balanza niega haber mandado una pesada".**
> La primera es **Spoofing** (suplantación): cualquiera pone el encabezado que quiera. Contramedida: identidad desde un token firmado y verificado. La segunda es **Repudio**. Contramedida: log de auditoría con la identidad verificada y la hora, o mensajes firmados por el dispositivo.

**T4.5 — Para evitar prototype pollution, alguien filtra `__proto__`. ¿Alcanza?**
> No. Es una lista negra y deja afuera `constructor` y `prototype`, entre otros. Hay que usar lista blanca: aceptar solo los campos conocidos y rechazar todo lo demás.

---

## 5. Bases de datos

### 5.1 Modelos de costo

| Base | Cobra por… | Qué la hace cara |
| --- | --- | --- |
| **Firestore** | **Documento leído, escrito o borrado** (no importa el tamaño) | Leer muchos documentos: listar 5.000 docs son 5.000 lecturas, y en cada carga del panel |
| **Realtime Database** | **Datos descargados** (GB) y almacenados | Leer un nodo grande: descarga **todo el subárbol** aunque uses un solo campo |

**Cómo la forma de los datos cambia la factura:**
- Firestore: si un panel muestra el total del día, no sumes 5.000 documentos en cada carga. Mantené un **documento resumen** (`totales/hoy`) que se actualiza en cada escritura: el panel lee **1 documento**. Escribir un poco más es más barato que leer mucho muchas veces.
- Realtime DB: **aplanar** los datos y no anidar. Si `/usuarios/ana` contiene todo el historial de Ana, leer su nombre descarga todo el historial.

### 5.2 Transacciones y escrituras concurrentes

**La misma carrera del lost update, ahora en la base:**

```
40 balanzas, un documento litrosHoy = 1000
Balanza A lee 1000         Balanza B lee 1000
A escribe 1000 + 500       B escribe 1000 + 300
Resultado: 1300  (se perdieron 500 litros)
```

**Soluciones:**
- **Transacción**: leer y escribir como una unidad. En Firestore, si otro modificó el documento en el medio, la transacción **se reintenta**.
- **Incremento atómico**: `FieldValue.increment(500)`. La base suma sola, sin leer primero.

**El contador muy escrito:** un solo documento aguanta **pocas escrituras por segundo** (en Firestore, alrededor de 1 por segundo sostenida). Con 40 balanzas escribiendo, el documento es un **cuello de botella** y las transacciones fallan por contención.

**Solución: contador repartido (*distributed counter*)**. En lugar de 1 documento hay **N "fragmentos"** (`litrosHoy/fragmentos/0..9`):
- Cada escritura suma en un fragmento **al azar**: las escrituras se reparten entre 10 documentos.
- Para leer el total se leen los N fragmentos y se suman.
- **Costo**: leer el total cuesta N lecturas en lugar de 1. Se gana capacidad de escritura y se paga en lectura.

### 5.3 Firestore contra Realtime DB contra relacional

| | Firestore | Realtime Database | Relacional (PostgreSQL) |
| --- | --- | --- | --- |
| Forma | Colecciones de documentos | Un único árbol JSON gigante | Tablas con filas y columnas |
| Resuelve bien | Consultas por campos con índice ("recepciones del tambo X de hoy"), tiempo real | Sincronización en vivo muy barata y rápida (chat, presencia "en línea") | **JOIN**, **SUM/GROUP BY**, transacciones ACID, restricciones (`UNIQUE`, claves foráneas) |
| Caro o imposible | **No hay JOIN**; agregados complejos; leer muchos documentos (cobra cada uno) | Consultas: casi solo **un** filtro u orden por consulta; descargar subárboles grandes | Tiempo real (hay que armarlo aparte); escalar horizontalmente es más difícil |

> Pregunta clave: "¿qué consulta voy a hacer más seguido?". La base se elige según la consulta, no según los datos.

### 5.4 ADR (registro de decisión de arquitectura)

Un documento corto que deja escrito **por qué** se eligió algo, para que en 6 meses nadie pregunte "¿por qué usamos esto?".

```markdown
# ADR 003 — Base de datos para las recepciones

## Contexto
40 balanzas cargan ~5.000 recepciones por día. El panel muestra el total en vivo.
Administración pide reportes mensuales con totales por tambo.

## Decisión
PostgreSQL, con una tabla de totales diarios actualizada en la misma transacción
que cada recepción. El panel se actualiza por SSE.

## Alternativas descartadas
- Firestore: el reporte mensual sumaría ~150.000 documentos (150.000 lecturas) y no tiene JOIN.
- Realtime Database: no puede filtrar por tambo y fecha a la vez.

## Consecuencias
+ Reportes con SUM/GROUP BY baratos; restricciones y transacciones ACID.
− El tiempo real lo tenemos que armar nosotros (SSE + pub/sub entre instancias).
− Hay que administrar el servidor de la base.
```

**Las 4 partes:** contexto, decisión, alternativas descartadas (y por qué) y consecuencias (lo bueno **y lo malo**). Un ADR sin consecuencias negativas está incompleto.

### Preguntas tipo parcial — Bases de datos

**T5.1 — 40 balanzas incrementan un único documento `litrosHoy` con leer-sumar-escribir sin transacción. ¿Qué pasa?**
> Lost update: dos balanzas leen el mismo valor, cada una suma lo suyo y la segunda pisa a la primera. Se pierden litros sin ningún error. Se arregla con una transacción o con un incremento atómico (`increment`), que suma sin leer primero.

**T5.2 — ¿Cómo se reparte un contador muy escrito?**
> Un solo documento aguanta pocas escrituras por segundo y con 40 balanzas se vuelve un cuello de botella. Se reparte en N fragmentos: cada escritura suma en uno al azar, y para leer el total se suman los N. Cuesta N lecturas en lugar de una.

**T5.3 — Sumar las 5.000 recepciones del día en cada carga del panel: ¿por qué es caro en Firestore y qué se hace?**
> Firestore cobra por documento leído: cada carga del panel son 5.000 lecturas, y con varios paneles abiertos se multiplica. Se mantiene un documento resumen con el total, actualizado en cada recepción (con increment o con el contador repartido), y el panel lee 1 documento (o N fragmentos).

**T5.4 — ¿Qué consulta resuelve mal cada base?**
> Firestore: cualquier cosa que necesite JOIN o sumar muchos documentos (caro, cobra por cada uno). Realtime DB: filtrar por dos campos a la vez (solo permite un orden o filtro). Relacional: el tiempo real nativo, que hay que armar aparte.

---

## 6. Tiempo real

### 6.1 WebSocket

**HTTP normal**: el cliente pregunta y el servidor responde. El servidor **no puede** hablar si no le preguntan.

**WebSocket**: una conexión **permanente y de dos vías**. Cualquiera de los dos manda mensajes cuando quiere.

**Cómo arranca desde HTTP (el *handshake*):**

```
Cliente → GET /chat HTTP/1.1
          Upgrade: websocket
          Connection: Upgrade
          Sec-WebSocket-Key: dGhlIHNhbXBsZQ==

Servidor → HTTP/1.1 101 Switching Protocols
           Upgrade: websocket
           Sec-WebSocket-Accept: s3pPLMBiTxaQ9k...
```

Después del `101`, la **misma conexión TCP** deja de hablar HTTP y pasa a mandar mensajes (*frames*) en ambas direcciones.

> HTTP es como mandar cartas: cada pregunta, una respuesta. WebSocket es una llamada telefónica: la línea queda abierta y hablan los dos.

**Qué cambia:** hay estado (el servidor recuerda cada conexión abierta), no hay "una respuesta por pedido" y la conexión ocupa recursos todo el tiempo.

### 6.2 SSE (Server-Sent Events)

Una respuesta HTTP **que nunca termina**, por donde el servidor va mandando eventos.

```
GET /panel/eventos
→ 200  Content-Type: text/event-stream

id: 41
data: {"litrosHoy": 18500}

id: 42
data: {"litrosHoy": 19200}
```

- **Una sola dirección**: servidor → cliente. Si el cliente quiere mandar algo, usa un `fetch` normal.
- Es HTTP común: pasa por proxies sin problemas.
- El navegador (`EventSource`) **se reconecta solo** y manda `Last-Event-ID: 42` para retomar desde ahí.
- Solo texto.

**¿Cuándo alcanza?** Cuando **solo habla el servidor**: un panel en vivo, notificaciones, el progreso de un proceso. Para el panel de litros alcanza con SSE, porque el panel solo **escucha**. WebSocket sirve cuando el cliente también manda mucho y seguido (chat, juego).

### 6.3 Socket.IO

Una librería encima de WebSocket que agrega:

| Agrega | Qué es |
| --- | --- |
| **Eventos con nombre** | `socket.emit("nuevaRecepcion", datos)` en lugar de mensajes crudos |
| **Salas (rooms)** | `io.to("tambo-ledesma").emit(...)` le manda solo a un grupo |
| **Reconexión automática** | Si se corta, reintenta solo |
| **Acks** | Confirmación de que el otro recibió |
| **Respaldo con long-polling** | Si WebSocket está bloqueado, funciona igual |

Ojo: un cliente Socket.IO **no** se conecta a un servidor WebSocket puro ni al revés. Tiene su propio protocolo encima.

### 6.4 Varias instancias

```
Balanza → Instancia A (registra la recepción y hace emit)
Panel   → conectado a la Instancia B
```

**El panel no se entera.** Cada instancia conoce **solo sus propias conexiones**. El `emit` de A recorre los clientes de A, y el panel está en B.

**Solución: pub/sub compartido** (Redis). Cada instancia **publica** el evento en un canal y **todas** están suscritas, así que cada una lo reenvía a sus clientes. En Socket.IO es el **Redis adapter**. (Socket.IO con long-polling también necesita *sticky sessions*: que el mismo cliente caiga siempre en la misma instancia.)

### 6.5 Reconexión

Mientras el cliente estuvo desconectado (30 segundos, por ejemplo), **todos los eventos emitidos en ese tiempo se perdieron**: el `emit` es "disparar y olvidar" y no se guarda.

**Cómo recuperarlo:**
1. **Eventos con id + reenvío**: cada evento tiene un id creciente y el servidor guarda los últimos. Al reconectar, el cliente dice "el último que vi fue el 42" (`Last-Event-ID` en SSE) y el servidor reenvía del 43 en adelante.
2. **Volver a pedir el estado completo**: al reconectar, el cliente hace un `GET /panel/total` (la foto actual) y después sigue escuchando. Es simple y sirve cuando importa el **estado** y no cada evento.

Para un total de litros alcanza con la opción 2: no importa cada recepción intermedia, importa el total actual.

### Preguntas tipo parcial — Tiempo real

**T6.1 — ¿WebSocket o SSE para un panel que muestra en vivo el total de litros?**
> SSE: el panel solo escucha y nunca le manda nada al servidor. SSE es HTTP común, pasa por proxies, se reconecta solo y retoma con `Last-Event-ID`. WebSocket es de dos vías y acá no hace falta.

**T6.2 — Con 2 instancias, la recepción se registra en A y el panel está conectado a B. ¿Qué pasa y cómo se resuelve?**
> El panel no se entera: cada instancia solo conoce sus conexiones, y el emit de A no llega a los clientes de B. Se resuelve con pub/sub compartido (Redis): A publica, todas las instancias reciben el evento y cada una lo reenvía a sus clientes.

**T6.3 — El panel pierde la conexión 30 segundos. ¿Qué se pierde y cómo se recupera?**
> Todos los eventos emitidos en esos 30 segundos, porque no se guardan. Se recupera con ids en los eventos y reenvío desde el último visto (`Last-Event-ID`), o pidiendo el estado actual con un `GET` al reconectar. Para un total alcanza con lo segundo.

**T6.4 — ¿Cómo empieza una conexión WebSocket?**
> Como un `GET` HTTP con `Upgrade: websocket` y `Connection: Upgrade`. El servidor responde `101 Switching Protocols` y desde ahí la misma conexión TCP queda abierta para mandar mensajes en las dos direcciones, sin el esquema de pedir y responder.

---

## 7. Streams y backpressure

### 7.1 Leer todo contra leer de a pedazos

```js
const texto = fs.readFileSync("pesajes.csv", "utf8");   // carga TODO el archivo en memoria
fs.createReadStream("pesajes.csv")                      // lo lee de a pedazos (chunks)
```

| | `readFileSync` | `createReadStream` |
| --- | --- | --- |
| Memoria | **= tamaño del archivo** (3 GB → 3 GB, o explota) | **= tamaño del pedazo** (`highWaterMark`, 64 KB) |
| Event loop | **Bloqueado** hasta terminar de leer | Libre entre pedazo y pedazo |

**La memoria depende del tamaño del pedazo, no del archivo.** Un archivo de 3 MB o de 3 GB usa la misma memoria con streams.

> Analogía: vaciar una pileta con un balde. No necesitás un balde del tamaño de la pileta.

### 7.2 Pedazos que cortan líneas

```js
fs.createReadStream("pesajes.csv", { highWaterMark: 64 * 1024 })
  .on("data", (chunk) => {
    for (const linea of chunk.toString().split("\n")) {
      if (linea.split(",").length === 5) validas++;
    }
  });
```

**Da mal sin ningún error**, porque los pedazos se cortan **cada 64 KB, no en los finales de línea**:

```
Pedazo 1: "...\nLedesma,20000,3.9,6,ext"
Pedazo 2: "ra\nMárquez,15000,3.5,8,comun\n..."
```

- La línea de Ledesma quedó partida: `"Ledesma,20000,3.9,6,ext"` en un pedazo y `"ra"` en el otro, y ninguno de los dos se cuenta bien.
- **Además**, `"á"` ocupa 2 bytes en UTF-8. Si el corte cae entre esos 2 bytes, `chunk.toString()` produce caracteres basura (`M�rquez`).

**Arreglo:** guardar el último pedazo de línea incompleto y pegárselo al pedazo siguiente, o usar **`readline`**, que ya entrega líneas completas. Para los caracteres, `setEncoding("utf8")` o `readline`, que respetan los caracteres partidos.

```js
const rl = readline.createInterface({ input: fs.createReadStream("pesajes.csv") });
for await (const linea of rl) if (linea.split(",").length === 5) validas++;
```

### 7.3 Cadena de streams

Cada paso es un stream y se encadenan como caños:

```js
await pipeline(
  fs.createReadStream("pesajes.csv"),   // leer
  separarEnLineas,                      // separar  (Transform)
  filtrarValidas,                       // filtrar  (Transform)
  zlib.createGzip(),                    // comprimir
  fs.createWriteStream("validas.csv.gz")
);
```

Por cada caño pasa un pedazo a la vez, y el archivo nunca está entero en memoria.

### 7.4 Backpressure (contrapresión)

> Llenás un balde con una manguera, y el balde se vacía por un agujerito. Si entra más agua de la que sale, **rebalsa**.

- La fuente rápida (disco o red) produce más rápido de lo que el destino lento (un cliente con mala conexión, el disco) consume.
- **`writable.write(chunk)` devuelve `false`** cuando el buffer interno del destino superó su límite. Significa **"pará, que estoy lleno"**.
- El evento **`drain`** avisa **"ya me vacié, seguí"**.

```js
// Contrapresión manual (pipeline lo hace solo):
function enviar() {
  let chunk;
  while ((chunk = origen.read()) !== null) {
    if (!destino.write(chunk)) {          // false → lleno
      destino.once("drain", enviar);      // espero a que se vacíe
      return;
    }
  }
}
```

**¿Qué pasa con un cliente lento si se ignora?** El servidor sigue escribiendo y todo lo que el cliente no llega a recibir **se acumula en memoria del servidor**. Con muchos clientes lentos (o uno solo con un reporte de 3 GB), el servidor se queda sin memoria y se cae **para todos**.

### 7.5 `.pipe()` contra `pipeline()`

```js
req.pipe(fs.createWriteStream(destino));             // ❌
await pipeline(req, fs.createWriteStream(destino));  // ✅
```

| Situación | `.pipe()` | `pipeline()` |
| --- | --- | --- |
| Backpressure | Sí | Sí |
| El cliente corta a la mitad | El error **no se propaga**: el archivo queda **abierto y a medio escribir** (y parece válido) | **Destruye todos** los streams y tira el error; vos borrás el archivo incompleto |
| El usuario se va mientras le mandás un archivo | El stream de lectura **sigue leyendo el disco para nadie** | Cierra la lectura |
| Saber cuándo terminó | Tenés que escuchar eventos de cada stream | Una promesa o un callback |

**¿Cuándo se responde `201`?** Recién cuando `pipeline` termina **sin error**, o sea cuando el último byte ya está en disco:

```js
try {
  await pipeline(req, fs.createWriteStream(destino));
  res.status(201).end();
} catch {
  await fs.promises.rm(destino, { force: true });   // borrar el archivo a medias
}
```

### 7.6 Streams y event loop

Si para mandar un reporte grande lo armás entero (`JSON.stringify` de 500 MB) y lo mandás de una, el cálculo **bloquea el único hilo** y el servidor queda sordo.

Con streams, el trabajo se hace **de a pedazos**: se procesa un pedazo, se libera el event loop, se atiende a otros clientes y sigue con el pedazo siguiente. Además, el backpressure frena la producción si el cliente es lento, así que la memoria no crece.

### Preguntas tipo parcial — Streams

**T7.1 — Juntar un CSV de 2 GB con `req.on("data", c => texto += c)`. ¿Qué le pasa al proceso y a los otros pedidos?**
> Junta los 2 GB en un string en RAM. El proceso se queda sin memoria (un string en Node ni siquiera llega a ese tamaño) y se cae, y como es un solo proceso, se caen todos los pedidos. Aunque no se caiga, procesar ese texto bloquea el event loop. Con `pipeline` se procesa de a pedazos con memoria constante.

**T7.2 — Contar líneas por pedazo con `chunk.toString().split("\n")` da un número distinto del real, sin error. ¿Por qué?**
> Los pedazos se cortan cada 64 KB, no al final de las líneas, así que las líneas partidas en el borde se cuentan mal. También se pueden partir caracteres de 2 bytes como "á". Se arregla guardando el resto incompleto para el pedazo siguiente o usando `readline`.

**T7.3 — ¿De qué depende la memoria del programa anterior? ¿Qué cambia con `readFileSync`?**
> Del tamaño del pedazo (`highWaterMark`, 64 KB), no del archivo. Con `readFileSync` la memoria es igual al tamaño del archivo (3 GB) y además bloquea el event loop hasta terminar.

**T7.4 — ¿Qué significa que `write()` devuelva `false`?**
> Que el buffer del destino está lleno: hay que dejar de escribir hasta el evento `drain`. Si se ignora con un cliente lento, los datos se acumulan en memoria del servidor hasta que se cae.

**T7.5 — `req.pipe(fs.createWriteStream(destino))` y el cliente corta a la mitad. ¿Qué pasa? ¿Qué hace distinto `pipeline`? ¿Cuándo se responde `201`?**
> Con `.pipe()` el error no se propaga: el archivo queda abierto e incompleto y nadie se entera. `pipeline` destruye todos los streams y rechaza la promesa, así que se puede borrar el archivo a medias. El `201` se responde solo cuando `pipeline` termina sin error.

---

## 8. Repaso de la primera parte (no se toma, pero se usa)

### 8.1 Event loop

- Node corre tu JavaScript en **un solo hilo**.
- `async`/`await` ayuda con las **esperas** (red, disco): mientras espera, atiende a otros.
- **No ayuda con los cálculos largos** (ReDoS, `JSON.parse` de un texto gigante, un bucle de millones). Mientras se calcula, nadie más es atendido.

**Orden de ejecución (como el 3.2 del simulacro):**
1. Primero todo el código **sincrónico**.
2. Después las **microtareas** (lo que sigue a un `await` o a un `.then`).
3. Después las **macrotareas** (`setTimeout`, I/O).

```js
app.use((req, res, next) => { console.log("A1"); next(); console.log("A2"); });
app.use(async (req, res) => { console.log("B1"); await null; console.log("B2"); res.json({}); });
// Imprime A1, B1, A2, B2: next() ejecuta B hasta el primer await, vuelve, imprime A2,
// y recién después corre la microtarea con B2.
```

### 8.2 Express

- **Middleware**: `(req, res, next)`. Hace algo y llama a `next()` para pasar al siguiente.
- **Middleware de errores**: tiene **4 parámetros** `(err, req, res, next)`, va **al final** y es donde un error se convierte en respuesta (Problem Details).
- Para llegar ahí: `next(err)` o, en Express 5, un `throw` (también dentro de una función `async`).
- **authn y authz** son middlewares: `autenticar` (401) y `autorizar(rol)` (403).

### 8.3 Lista blanca y validación de entrada

- Validar **todo** lo que llega por la red: tipo (`typeof x === "number"`, `"13"` no es un número), rango y campos permitidos.
- Prototype pollution: un body con `"__proto__"` o `"constructor"` puede modificar el prototipo de todos los objetos si se copia sin filtrar. Defensa: **lista blanca** de campos.

### 8.4 Trampas de JavaScript que aparecen en "¿qué imprime?"

| Código | Resultado | Por qué |
| --- | --- | --- |
| `[900, 25000, 3100, 100].sort()` | `[100, 25000, 3100, 900]` | Sin comparador, ordena **como texto** |
| `.sort((a, b) => b - a)` | `[25000, 3100, 900, 100]` | Numérico descendente. **Ojo: `sort` modifica el array original** |
| `"0" \|\| 1` | `"0"` | `"0"` es un string no vacío, así que es *truthy* |
| `0 \|\| 1` | `1` | `0` es *falsy* |
| `0 ?? 1` | `0` | `??` solo reemplaza `null` y `undefined` |
| `"2" + 1` | `"21"` | `+` con un string concatena |
| `"12" > 11` | `true` | La comparación convierte el string a número |
| `JSON.stringify({a: NaN, b: Infinity, c: undefined})` | `{"a":null,"b":null}` | NaN e Infinity pasan a `null`; `undefined` desaparece |
| `JSON.parse('{"x":1e309}').x` | `Infinity` | Supera el máximo de un número |
| `Number.isInteger(Infinity)` | `false` | No es un número finito |
| `typeof query.limite` (de la URL) | `"string"` | **Todo** lo que viene en la query string es texto |
| `PRECIO.clase` vs `PRECIO[clase]` | `undefined` vs el valor | Con punto busca la propiedad literal "clase"; con corchetes usa el valor de la variable |
| `let` dentro de `{ }` | No existe afuera | Ámbito de bloque |

---

## 9. Machete final

### Una frase por tema (qué evita y qué cuesta)

| Tema | Qué evita | Qué cuesta |
| --- | --- | --- |
| Idempotency-Key | Duplicados por reintento | Guardar claves y respuestas en un almacén compartido |
| ETag + If-Match | Lost update | El cliente tiene que releer y reintentar ante un `412` |
| Paginación por cursor | Repetidos, salteados, `OFFSET` caro | No se puede saltar a la página N |
| Verificar `iss`/`aud` | El token de otro proyecto | Nada (siempre hay que hacerlo) |
| Mirar la base en vez del claim | El admin fantasma | Una consulta por pedido; se pierde lo stateless |
| `alg` fijo y `kid` en lista blanca | `none`, confusión de algoritmo, inyección por `kid` | Mantener la lista de claves |
| `exp` corto | Tokens robados eternos | Renovar seguido (refresh tokens) |
| Refresh con rotación | Robo del refresh token | Desloguear a un honesto si pierde la respuesta (mitigar con gracia) |
| Cookie `httpOnly` | Robo por XSS | Defenderse de CSRF (`SameSite`, token) |
| Rate limiting en Redis con `INCR` | Límite × N instancias, carreras | Un viaje a Redis por pedido |
| Token bucket | Ráfaga del borde, con poca memoria | Permite ráfagas de hasta C |
| Regex sin anidar + límite de largo | ReDoS | Nada |
| Lista blanca | Lo que la lista negra deja afuera | Hay que declarar todo lo permitido |
| Documento resumen (Firestore) | Leer miles de documentos por carga | Una escritura extra por cada alta |
| Contador repartido | Cuello de botella del documento muy escrito | N lecturas para leer el total |
| SSE | Complejidad innecesaria de WebSocket | Solo servidor → cliente |
| Pub/sub entre instancias | Eventos que no llegan a la otra instancia | Un componente más (Redis) |
| `pipeline` | Archivos a medias, streams abiertos, memoria | Nada; siempre conviene |

### Códigos en una línea

`200` ok · `201` creado (+`Location`) · `204` sin body · `304` tu copia sigue vigente · `400` no se puede leer · `401` no sé quién sos · `403` no podés · `404` no existe · `409` choca con el estado actual · `412` tu `If-Match` está viejo · `422` se leyó pero no cumple las reglas · `428` falta `If-Match` · `429` demasiados pedidos · `500` error mío, sin detalles.

### La pregunta de fondo

> ¿Qué puede creer tu backend de lo que le llega por la red?
>
> - El **body**: solo después de validarlo con lista blanca.
> - La **identidad**: solo la que sale de un token verificado (firma, `alg`, `kid`, `iss`, `aud`, `exp`).
> - El **header del token**: nada; el servidor decide cómo verificar.
> - Que un pedido **sea el primero**: nada; puede ser un reintento.
> - Que **nadie modificó** el recurso mientras tanto: nada; se usa `If-Match`.
