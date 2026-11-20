# Seguridad, bases de datos y tiempo real

Programación IV · UTN FRRe. Todo corre en tu máquina, sin cuentas, Redis ni Firebase.

## Arranque

```
node 00-arranque/verificar.js
```

Tiene que terminar en `TODO OK`. Necesitás Node 22.13 o más. Si falta algo, corré `npm install`.

## Cómo se trabaja

1. Abrí el archivo y leé el `PREDECÍ ANTES DE EJECUTAR`.
2. Escribí tu predicción.
3. Ejecutalo.
4. Si le erraste, escribí qué parte de tu modelo mental estaba mal.
5. Hacé el `PARA PROBAR VOS` del final.

## Qué te tenés que llevar

- **Un límite en memoria no sirve con varias instancias**, y el contador compartido tiene que ser atómico.
- **Una sola petición de pocos bytes puede frenar a todos** si una regex se dispara.
- **STRIDE te obliga a buscar amenazas con método**, en lugar de depender de lo que se te ocurra.
- **Una base se elige por sus consultas, su costo y su consistencia**, no por su lista de funciones.
- **Una decisión se escribe con lo que resignás.** Eso es un ADR.
- **WebSocket no siempre es la respuesta.** Para un panel que solo recibe, SSE suele alcanzar.
- **Una reconexión no recupera lo perdido** salvo que lo programes.

## Comandos

### Bloque 1: Seguridad

```
node 01-seguridad/01-fuerza-bruta.js
node 01-seguridad/02-algoritmos.js
node 01-seguridad/03-varias-instancias.js
node 01-seguridad/04-redos.js
```

Ejercicio: `01-seguridad/05-STRIDE.md`. Estos ataques se prueban solo contra tu propia máquina. Hacerlo contra sistemas ajenos sin autorización es un delito.

### Bloque 2: Bases de datos

```
node 02-bases/01-cuanto-cuesta.js
node 02-bases/02-desnormalizar.js
node 02-bases/03-transaccion.js
node 02-bases/04-contador-distribuido.js
node 02-bases/05-indices.js
node --disable-warning=ExperimentalWarning 02-bases/06-relacional.js
```

Los archivos 01 a 05 usan simuladores de `comun/simuladores.js`: reproducen cómo cobra y qué permite consultar cada modelo, no su rendimiento. El 06 es SQL de verdad, con SQLite. Ejercicio: `02-bases/07-ADR.md`.

### Bloque 3: Tiempo real

```
node 03-tiempo-real/01-websocket-a-mano.js
node 03-tiempo-real/02-polling-contra-sse.js
node 03-tiempo-real/03-socketio.js
node 03-tiempo-real/04-dos-instancias.js
node 03-tiempo-real/05-reconexion.js
node 03-tiempo-real/06-origen-y-token.js
```

### Laboratorio

Leé `laboratorio/CONSIGNA.md`, arreglá `laboratorio/api.js` y corré `npm run lab`.

## Para leer

- RFC 6455: The WebSocket Protocol
- OWASP: ReDoS
- Firebase: *Choose a database*, y las páginas de facturación de Firestore y Realtime Database
- Firebase: *Distributed counters*
