# Instrucciones — lanzar y probar Multiplicón

Estado actual: **Fase 2** (estructura de partida). El juego se dibuja con rectángulos de color; el arte, el teclado en pantalla y el audio llegan en fases posteriores.

## Requisitos

- Node 22 o superior
- pnpm 10 o superior (`npm install -g pnpm` si no lo tienes)

## Instalación

Desde la raíz del proyecto:

```bash
pnpm install
```

## Lanzar el sitio

```bash
pnpm dev
```

Vite imprime la URL, normalmente `http://localhost:5173/`. Ábrela en el navegador. Los cambios en `src/` se recargan solos.

Para fijar el puerto:

```bash
pnpm dev --port 5173 --strictPort
```

## Flujo de pantallas

```
Título  →  Nombre  →  Nivel  →  Combate  →  Resultado
                                                │
                              Enter: otra partida en el mismo nivel
                              Escape: volver a elegir nivel
```

| Pantalla | Teclado | Ratón / táctil |
|---|---|---|
| Título | Enter | Botón "Jugar" |
| Nombre | Escribir, Enter. Máx. 12 caracteres, recuerda el último | Campo de texto y botón "Continuar" |
| Nivel | ← → y Enter, o 1 / 2 / 3. Escape vuelve a Nombre | Clic en una tarjeta |
| Combate | Dígitos, Backspace borra, Enter confirma | (teclado en pantalla en Fase 4) |
| Resultado | Enter otra vez, Escape cambiar nivel | Botones |

## Atajo para probar un nivel directo

Añade `?level=` a la URL para saltar al combate sin pasar por las pantallas previas. Usa el último nombre guardado.

| URL | Nivel |
|---|---|
| `http://localhost:5173/?level=facil` | Fácil |
| `http://localhost:5173/?level=normal` | Normal |
| `http://localhost:5173/?level=dificil` | Difícil |

Los corazones, las cifras y los tiempos de cada nivel están en `src/config/difficulties.ts` y se muestran en las tarjetas de selección.

## Qué probar a mano

1. **Título.** Pulsa Enter o "Jugar".
2. **Nombre.** Escribe un nombre con tildes o ñ; se aceptan. Intenta continuar con el campo vacío: la pantalla vibra y no avanza. Al volver a jugar, el último nombre aparece ya escrito.
3. **Nivel.** Las tres tarjetas muestran tema, corazones, cifras y segundos por operación. Muévete con las flechas y confirma con Enter, o pulsa 1, 2 o 3.
4. **Combate, acierto.** Responde bien: nueva operación, contador +1, la barra de vida del monstruo baja un punto.
5. **Combate, oleada.** Tras 5 aciertos el monstruo sale de la pantalla y entra otro con 7 de vida. Arriba a la derecha se ve "Oleada 2" y el tiempo por operación de esa oleada. La oleada 3 tiene 9 de vida, y así sin límite.
6. **Combate, fallo.** Respuesta incorrecta: "MISS" sube y se desvanece, el campo se vacía, la operación **no cambia** y la barra de tiempo **sigue bajando**.
7. **Combate, timeout.** Se apaga un corazón, se muestra medio segundo la operación con su resultado y entra la siguiente. El monstruo no recupera vida.
8. **Pausa.** Cambia de pestaña con el tiempo corriendo. Al volver, la barra está donde la dejaste.
9. **Fin.** Pierde todos los corazones. La pantalla se funde a negro y aparece el resultado: aciertos, monstruos derrotados y la lista de operaciones que costaron más (tiempos agotados y fallos, primero las peores). Si no hubo fallos, lo dice.
10. **Otra vez.** Enter empieza otra partida en el mismo nivel con el mismo nombre. Escape vuelve a la selección de nivel.

## Pruebas automáticas

Pruebas unitarias del generador de operaciones, la máquina de estado del combate (incluidas oleadas), el resumen de fallos y el saneamiento del nombre. No necesitan navegador.

```bash
pnpm test          # una pasada
pnpm test:watch    # modo continuo
```

## Verificar tipos y generar el build

```bash
pnpm build         # tsc --noEmit + vite build → dist/
pnpm preview       # sirve dist/ para probar el build final
```

## Inspeccionar el juego desde la consola del navegador

Solo en modo desarrollo, la instancia de Phaser queda en `window.__multiplicon`.

```js
const game = window.__multiplicon;
game.scene.getScenes(true).map((s) => s.scene.key);   // escena activa

const s = game.scene.getScene('Battle').state;         // durante el combate
s.problem.text    // "347 × 26"
s.problem.answer  // 9022
s.hearts          // corazones restantes
s.correct         // aciertos
s.wave            // oleada actual
s.monsterHp       // vida del monstruo actual
s.timeLimit       // segundos por operación en esta oleada
s.timeLeft        // segundos que quedan
s.history         // operaciones intentadas, con respuesta dada y tiempo usado

localStorage.getItem('multiplicon.name')               // último nombre guardado
```

## Detener el servidor

`Ctrl+C` en la terminal donde corre `pnpm dev`. Si el puerto queda ocupado en Windows:

```powershell
$c = Get-NetTCPConnection -LocalPort 5173 -State Listen; Stop-Process -Id $c.OwningProcess -Force
```

## Estructura relevante

```
src/
├── main.ts                    configuración de Phaser (1280×720, Scale.FIT, contenedor DOM)
├── types.ts                   DifficultyConfig, Problem, HistoryEntry, BattleParams, ResultParams
├── config/difficulties.ts     los tres niveles, curva de tiempo y vida del monstruo por oleada
├── systems/
│   ├── ProblemGenerator.ts    generación de operaciones (puro, con pruebas)
│   ├── BattleState.ts         corazones, aciertos, oleadas, temporizador, resumen de fallos (puro, con pruebas)
│   └── Preferences.ts         nombre recordado en localStorage
├── ui/
│   ├── style.ts               colores y fuentes provisionales
│   ├── Button.ts              botón con foco visible
│   └── keys.ts                escucha de teclado nativa
└── scenes/
    ├── TitleScene.ts
    ├── NameScene.ts           <input> HTML sobre el canvas
    ├── LevelSelectScene.ts
    ├── BattleScene.ts
    └── ResultScene.ts
```

Las fases siguientes están descritas en `plan.md`, sección 12. La próxima es la fase 3: servidor Hono con el ranking.
