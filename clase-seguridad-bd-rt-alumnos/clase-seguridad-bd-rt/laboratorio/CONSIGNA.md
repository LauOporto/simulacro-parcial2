# Laboratorio: arreglá la API en tiempo real

`api.js` funciona en el caso feliz y tiene seis defectos, todos vistos hoy. No toques `pruebas.test.js`.

```
npm run lab
```

Andá de a una prueba. Leé qué esperaba, predecí qué falla y recién después escribí el arreglo.

| Peso | Parte | Qué tiene que pasar |
|---|---|---|
| 20% | 1. Rate limit | `POST /login`: máximo 5 por minuto por IP, contados en el almacén compartido. Lo que exceda recibe 429 con `Retry-After`. Con dos instancias y pedidos simultáneos, siguen siendo exactamente 5 |
| 15% | 2. ReDoS | `POST /registro` responde en menos de 100 ms con un texto de ataque. Email válido: 201. Inválido: 422 |
| 20% | 3. Concurrencia | `POST /contador`: 30 pedidos simultáneos dejan el contador en 30 |
| 15% | 4. Origen | Socket.IO rechaza un origen que no esté en `origenes` |
| 15% | 5. Identidad y salas | Sin token válido, no conecta. La empresa sale del token: un usuario no puede unirse a otra sala mandando otro número |
| 15% | 6. Reconexión | El evento `desde` devuelve las alertas con `seq` mayor al último visto |

## Para defender

Pasar las pruebas no alcanza. Respondé por escrito, con tus palabras:

1. ¿Por qué tu rate limit no deja pasar 6, si llegan 20 pedidos al mismo tiempo a dos instancias?
2. Tu regex nueva, ¿cómo sabés que no tiene retroceso catastrófico? Mostrá la medición.
3. Dónde guardarías el historial de alertas con dos instancias, y hasta cuándo.
4. Un ADR corto sobre una decisión de tu TP, con una consecuencia negativa (ver `02-bases/07-ADR.md`).
5. Una decisión donde hayas rechazado lo que te propuso una IA o un compañero, y por qué.
