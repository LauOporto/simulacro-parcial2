# Clase: Streams

**Hoy:** un servidor tiene que mandar un reporte de 126 MB. Lo arreglamos en 4 pasos.

No hace falta instalar nada: alcanza con Node 20 o más.

## Antes de empezar

```bash
node preparar.js
```

Genera `datos/lecturas.csv` (126 MB, 3 millones de lecturas de heladeras) y termina con `TODO OK`.

## Cómo se mide

Siempre con el mismo comando:

```bash
node medir.js <paso> <usuarios>
```

| `<usuarios>` | Qué simula |
|---|---|
| `rapidos` | 10 usuarios con buena conexión bajan el reporte entero |
| `lentos` | 3 usuarios con mala conexión (1 MB/s) durante 4 segundos |
| `cancelan` | 20 usuarios empiezan a bajar y cierran la pestaña enseguida |

## Los 4 pasos

| Paso | Archivo | Idea | Qué problema le queda |
|---|---|---|---|
| 1 | `servidor/paso1-todo-junto.js` | Leer todo y mandarlo | Una copia en memoria por usuario |
| 2 | `servidor/paso2-de-a-pedazos.js` | Stream: mandar cada pedazo apenas llega | Con usuarios lentos, la memoria vuelve a subir |
| 3 | `servidor/paso3-esperar-al-lento.js` | Si `write()` dice "lleno", cerrar la canilla hasta el `drain` | Si el usuario se va, la canilla queda cerrada para siempre |
| 4 | `servidor/paso4-pipeline.js` | `pipeline()` hace todo eso solo | Ninguno |

Los números cambian de una compu a otra. Lo que se repite es cuál paso gana.

## Lo que tenés que llevarte

1. **Un stream manda el dato de a pedazos.** La memoria depende del pedazo, no del archivo.
2. **Si el que recibe es lento, hay que esperarlo.** `write()` devuelve `false` cuando está lleno y `drain` avisa cuando hay lugar. A esto se le dice *backpressure* (contrapresión).
3. **Usá `pipeline()`.** Espera al lento por vos y cierra todo si algo falla o el usuario se va.

## Laboratorio

Leé `laboratorio/CONSIGNA.md` y corré `npm run lab`.
