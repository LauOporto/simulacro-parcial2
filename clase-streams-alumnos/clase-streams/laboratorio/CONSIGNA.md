# Laboratorio: ahora al revés

En clase el servidor **mandaba** un archivo grande. Ahora el usuario **sube** un CSV de lecturas y el servidor lo guarda.

`laboratorio/subidas.js` anda con archivos chicos, pero tiene **4 defectos**.

## Qué hay que hacer

1. Corré los tests: `npm run lab`. Ahora pasan 2 de 5.
2. Arreglá `subidas.js` hasta que pasen los 5. **No toques** `subidas.test.js`.
3. Escribí `RESPUESTAS.md` con una línea por defecto: qué pasaba y cómo lo arreglaste.

## Los 4 defectos (sin decir dónde están)

| # | Qué pasa |
|---|---|
| 1 | Si suben un archivo de 2 GB, el servidor se queda sin memoria |
| 2 | El servidor dice "guardado" antes de haberlo guardado |
| 3 | Si al usuario se le corta internet a mitad de la subida, queda un archivo incompleto |
| 4 | Si el disco falla, igual le dice "guardado" al usuario |

## Pistas

- `req`, el pedido que llega, es un stream, igual que el archivo de la clase. Mirá el **paso 4**.
- Cuando arregles el defecto 1, va a aparecer el 3. Vas bien.
- `pipeline` te avisa en su callback si algo salió mal. Ahí borrás el archivo con `fs.rm`.

## Cómo se evalúa

| Qué | Peso |
|---|---|
| Los 5 tests pasan | 50 % |
| `RESPUESTAS.md` explicado con tus palabras | 30 % |
| Defensa oral: te pido que expliques una línea | 20 % |
