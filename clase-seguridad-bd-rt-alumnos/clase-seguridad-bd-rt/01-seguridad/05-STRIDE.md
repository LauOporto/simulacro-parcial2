# STRIDE: buscar amenazas con método

STRIDE evita que dependas de "lo que se me ocurrió". Dibujás el sistema y, en cada elemento, recorrés seis preguntas.

| Letra | Amenaza | La pregunta | Propiedad que protege |
|---|---|---|---|
| **S** | Spoofing, suplantación | ¿Alguien se puede hacer pasar por otro? | Autenticación |
| **T** | Tampering, manipulación | ¿Alguien puede cambiar datos que no debería? | Integridad |
| **R** | Repudiation, repudio | ¿Alguien puede negar lo que hizo? | No repudio |
| **I** | Information disclosure, filtración | ¿Se puede ver lo que no corresponde? | Confidencialidad |
| **D** | Denial of service, denegación | ¿Se puede dejar sin servicio a otros? | Disponibilidad |
| **E** | Elevation of privilege, escalada | ¿Alguien puede hacer más de lo que le toca? | Autorización |

## Ejemplo resuelto: `POST /lecturas` de la API de telemetría

Un sensor manda su temperatura a la API. La API la guarda en PostgreSQL y dispara una alerta si supera el umbral.

| Letra | Amenaza concreta | Defensa | Impacto |
|---|---|---|---|
| S | Alguien manda lecturas diciendo ser el sensor S-01 | Credencial por sensor, verificada en cada pedido | Alto |
| T | Modifican una lectura ya guardada para ocultar una falla | La tabla de lecturas no admite UPDATE desde la API | Alto |
| R | Un operador silencia una alerta y después lo niega | Registro de auditoría con usuario, fecha y acción | Medio |
| I | Un error 500 muestra la cadena de conexión a la base | Problem Details y mensaje genérico | Alto |
| D | Un cuerpo enorme o una regex lenta frena el proceso | Límite de tamaño, rate limit, regex sin retroceso | Alto |
| E | Un operador cambia umbrales con `{ "rol": "admin" }` en el body | Lista blanca de campos y autorización por rol | Alto |

## Ejercicio para tu TP

1. Dibujá el flujo de una operación crítica de tu proyecto: quién llama, qué servicios toca y dónde guarda.
2. Marcá dónde cruza un límite de confianza: por ejemplo, entre internet y la API.
3. Completá la tabla con **una amenaza concreta por letra**. "Pueden hackear la base" no sirve; "un operador lee alertas de otra empresa cambiando el id" sí.
4. Elegí las dos de mayor impacto y demostrá la defensa con una prueba automatizada.
