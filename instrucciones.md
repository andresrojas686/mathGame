# Instrucciones — lanzar y probar Multiplicón

Estado actual: **Fase 1** (núcleo jugable sin arte). El juego se dibuja con rectángulos de color y se juega con el teclado físico.

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

## Elegir el nivel

Todavía no existe la pantalla de selección de nivel. El nivel se elige por parámetro en la URL:

| URL | Nivel | Corazones | Operaciones |
|---|---|---|---|
| `http://localhost:5173/` | Fácil (por defecto) | 5 | 2 cifras × 1 cifra |
| `http://localhost:5173/?level=normal` | Normal | 3 | 2–3 cifras × 1–2 cifras |
| `http://localhost:5173/?level=dificil` | Difícil | 1 | 3–5 cifras × 1–3 cifras |

## Cómo se juega

- Escribe la respuesta con los dígitos del teclado.
- `Backspace` borra el último dígito.
- `Enter` confirma. La respuesta solo se valida al confirmar.
- Al terminar la partida, `Enter` empieza otra.

## Qué probar a mano

Abre `http://localhost:5173/?level=normal` y comprueba:

1. **Pantalla inicial.** Tres corazones arriba a la izquierda, contador de aciertos a la derecha, una multiplicación grande en el centro y una barra de tiempo llena debajo.
2. **Acierto.** Escribe la respuesta correcta y pulsa Enter. Aparece una nueva operación, el contador sube uno, la barra se llena, el héroe y el monstruo se mueven.
3. **Fallo.** Escribe cualquier número incorrecto y pulsa Enter. Aparece "MISS" subiendo y desvaneciéndose, el campo se vacía y se sacude, la operación **no cambia** y la barra **sigue bajando**. Puedes reintentar hasta que se acabe el tiempo.
4. **Tiempo bajo.** Cuando quedan menos de 2 segundos la barra se pone roja y pulsa.
5. **Timeout.** Deja pasar el tiempo. La pantalla se sacude, se apaga un corazón, se muestra medio segundo la operación con su resultado correcto y luego entra la siguiente.
6. **Pausa.** Con el tiempo corriendo, cambia de pestaña o de ventana. Al volver, la barra está donde la dejaste y se ve "PAUSA" mientras estás fuera.
7. **Fin de partida.** Pierde todos los corazones. Aparece "FIN DE LA PARTIDA" con los aciertos. Enter reinicia con los corazones completos.
8. **Otros niveles.** Repite con `?level=facil` (5 corazones) y `?level=dificil` (1 corazón: el primer timeout termina la partida).

## Pruebas automáticas

Pruebas unitarias del generador de operaciones y de la máquina de estado del combate. No necesitan navegador.

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

Solo en modo desarrollo, la instancia de Phaser queda en `window.__multiplicon`. Sirve para leer el estado sin adivinar la respuesta:

```js
const s = window.__multiplicon.scene.getScene('Battle').state;
s.problem.text    // "347 × 26"
s.problem.answer  // 9022
s.hearts          // corazones restantes
s.correct         // aciertos
s.timeLeft        // segundos que quedan
s.history         // operaciones intentadas, con respuesta dada y tiempo usado
```

## Detener el servidor

`Ctrl+C` en la terminal donde corre `pnpm dev`. Si el puerto queda ocupado en Windows:

```powershell
$c = Get-NetTCPConnection -LocalPort 5173 -State Listen; Stop-Process -Id $c.OwningProcess -Force
```

## Estructura relevante

```
src/
├── main.ts                    configuración de Phaser (1280×720, Scale.FIT)
├── types.ts                   DifficultyConfig, Problem, HistoryEntry
├── config/difficulties.ts     los tres niveles y la curva de tiempo por oleada
├── systems/
│   ├── ProblemGenerator.ts    generación de operaciones (puro, con pruebas)
│   └── BattleState.ts         corazones, aciertos, temporizador (puro, con pruebas)
└── scenes/BattleScene.ts      pantalla de combate con rectángulos
```

Las fases siguientes están descritas en `plan.md`, sección 12.
