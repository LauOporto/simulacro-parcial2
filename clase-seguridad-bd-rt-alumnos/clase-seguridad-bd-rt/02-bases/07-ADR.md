# ADR: escribir por qué decidiste lo que decidiste

Un ADR (Architecture Decision Record) es una nota corta que queda en el repositorio. Dentro de seis meses, alguien va a preguntar "¿por qué usamos esto?". El ADR responde sin depender de la memoria de nadie.

## Plantilla

```
# ADR-NNN: <decisión, en una frase>

Estado: propuesta | aceptada | reemplazada por ADR-XXX
Fecha: AAAA-MM-DD

## Contexto
Qué problema hay, con números. Qué restricciones no se pueden cambiar.

## Opciones
Las que se evaluaron de verdad, con su medición.

## Decisión
Qué elegimos y el motivo principal.

## Consecuencias
Lo que ganamos, lo que resignamos y qué haría cambiar esta decisión.
```

## Ejemplo: alertas de telemetría

```
# ADR-004: Guardar alertas en PostgreSQL y no en Firestore

Estado: aceptada
Fecha: 2026-11-04

## Contexto
Hay 50 sensores y estimamos 10.000 alertas por día. Los operadores piden
reportes nuevos todos los meses, cruzando empresa, sensor y nivel.
El equipo ya sabe SQL. No hay clientes móviles que escriban sin conexión.

## Opciones
1. Firestore. Escala sola y actualiza el panel sin código extra. Un reporte
   no previsto obliga a crear índices o a leer todos los documentos.
2. Realtime Database. Latencia baja. Sin consultas compuestas, y se cobra por
   lo que se descarga, así que un reporte amplio se paga caro.
3. PostgreSQL. Reportes ad hoc con JOIN y GROUP BY. Medimos 3 consultas
   nuevas con 300.000 filas de prueba, todas por debajo de lo aceptado.
   Hay que operar la base y programar el tiempo real aparte.

## Decisión
PostgreSQL, porque el dato es relacional y las preguntas cambian todos los meses.

## Consecuencias
+ Un reporte nuevo es una consulta, sin migrar datos.
- Operamos la base y sus copias de seguridad.
- El panel en vivo necesita Socket.IO o SSE.
Revisar si aparecen clientes móviles que escriban sin conexión,
o si superamos lo que aguanta una sola instancia.
```

Los números de este ejemplo ilustran el formato. En tu ADR tienen que ser tuyos, medidos.

## Ejercicio

Escribí un ADR para tu TP sobre una decisión real: la base, cómo manejás la concurrencia o cómo autenticás. Tiene que tener al menos dos opciones reales y una consecuencia negativa. Un ADR sin nada que se resigne no es una decisión: es una justificación.
