# Parte 2 — Defectos

Hay **5 defectos**: 3 en `src/middlewares/auth.js` y 2 en `src/middlewares/errores.js`.
Para cada uno completá las cuatro líneas. Un arreglo sin explicación no suma.

## D1
- **Dónde** (archivo y línea): archivo: auth.js, linea 13
- **Qué pasa hoy** (un pedido concreto y qué recibe el cliente o qué queda en el servidor): El usuario intenta acceder a un pedido sin autorizacion (falta de token), y recibe un 401 no autenticado, con el aviso de que falta un token. Sin embargo la funcion en vez de detenerse ahi, continua ejecutandose. llegó a next() y el pedido siguió hasta la ruta, que intentó responder una segunda vez y falló con Cannot set headers after they are sent (se ve en la consola del servidor) 
comando utilizado: curl -i localhost:3000/entregas
- **Por qué** (el mecanismo): Esto se debe a que la funcion de autenticar al recibir un acceso no autorizado devuelve un aviso de 401 y llego a next en vez de cortar la funcion
- **Cómo lo arreglé**: corto la funcion con throw y que lo maneje el manejador de errores

## D2
- **Dónde**: auth.js, linea 26
- **Qué pasa hoy**: Al ingresar con un usuario con cualquier token, el token se invalida y error es atrapado, sin embargo no hace nada con eso y pasa como si el token fuera valido. Probado con: curl.exe -i localhost:3000/entregas -H "Authorization: Bearer abc". Devuelve un 200 con la lista de entregas cuando el contrato pide 401
- **Por qué**: solo se envia un console.warn en vez de cortar ahi mismo el catch. Despues del catch se ejecuta next() y el pedido sigue como si el token fuera valido
- **Cómo lo arreglé**: Cambie el console.warn por un throw new Problema y status 401, no autenticado

## D3
- **Dónde**: auth.js, linea 31
- **Qué pasa hoy**: error de status erroneo, devuelve 401 no autenticado. Comando utlizado: rol consulta haciendo un POST
curl -i -X POST localhost:3000/entregas -H "Authorization: Bearer $TOKEN_CO" -H "Content-Type: application/json" -d '{"productor":"Benítez","kgBrutos":12000,"humedad":14,"rendimiento":33,"grado":"A"}'
- **Por qué**: El error que debe devolver es 403, ya que se trata de una validacion de roles. Permitir devuelve el mismo error que autenticar y mezcla dos situaciones distintas. El token de consulta es válido, así que identidad no falló. Pero permitir lo trata como si sí.
- **Cómo lo arreglé**: Cambié el codigo de error (403) y el titulo (sin-permiso).

## D4
- **Dónde**: errores.js, linea 27 y 28
- **Qué pasa hoy**: En el bash se imprime el pedido que se solicitó, pueden ser datos sensibles. Comando utilizado: curl -i localhost:3000/diagnostico/db (aparece detail y stack)
- **Por qué**: El mensaje de respuesta se imprimia el codigo de estado, el titulo jutno a detail y stack, estos al ser incluidos podian presentar datos sensibles
- **Cómo lo arreglé**: Elimina err.detail y err.stack de la respuesta

## D5
- **Dónde**: errores.js, linea 21
- **Qué pasa hoy**: Al usar un curl invalido el error de json invalido nunca entra con status 400, siempre con 500 (interno).
- **Por qué**: El error de json está mal formado, lo genera Express y no es un problema. Solo tenia una rama para los errores, lo demas caia en 500
- **Cómo lo arreglé**: Agregando una condicion que valide que el status sea 400 y devuelva los avisos correspondientes
