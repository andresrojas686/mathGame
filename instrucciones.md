# Instrucciones — lanzar y probar Multiplicón

Estado actual: **Fase 3** (ranking con servidor, deploy y personajes Pokémon). El arte de fondos, el teclado en pantalla, la división y el audio llegan en fases posteriores.

## Requisitos

- Node 22 o superior
- pnpm 10 o superior (`npm install -g pnpm` si no lo tienes)
- Conexión a internet para ver los Pokémon (sin red el juego funciona igual, con rectángulos)

## Instalación

Desde la raíz del proyecto:

```bash
pnpm install
```

## Lanzar en desarrollo

Hacen falta **dos terminales**:

```bash
pnpm dev:server    # API del ranking en http://localhost:8787 (guarda en data/scores.json)
pnpm dev           # juego en http://localhost:5173 (reenvía /api al servidor)
```

Abre `http://localhost:5173/`. Los cambios en `src/` y en `server/` se recargan solos.

Si solo lanzas `pnpm dev`, el juego funciona pero el ranking se guarda en el navegador y avisa "sin conexión con el servidor".

## Flujo de pantallas

```
Título ─┬─> Nombre ─> Entrenador ─> Nivel ─> Combate ─> Resultado ─┬─> Ranking
        └─> Ranking                                                └─> otra partida / cambiar nivel
```

| Pantalla | Teclado | Ratón / táctil |
|---|---|---|
| Título | Enter juega · R ranking | Botones |
| Nombre | Escribir, Enter. Máx. 12 caracteres, recuerda el último | Campo de texto y botón |
| Entrenador | Flechas y Enter. Escape vuelve a Nombre | Clic en un líder |
| Nivel | ← → y Enter, o 1 / 2 / 3. Escape vuelve a Entrenador | Clic en una tarjeta |
| Combate | Dígitos, Backspace borra, Enter confirma | (teclado en pantalla en Fase 4) |
| Resultado | Enter otra vez · R ranking · Escape cambiar nivel | Botones |
| Ranking | ← → cambia de nivel · Enter jugar · Escape menú | Pestañas y botones |

## Atajo para probar un nivel directo

`?level=facil`, `?level=normal` o `?level=dificil` en la URL salta al combate con el último nombre y entrenador guardados.

## Qué probar a mano

1. **Entrenador.** Elige un líder; su sprite aparece a la izquierda en el combate. Al volver a jugar queda preseleccionado.
2. **Pokémon.** Al entrar al combate aparece el nombre de un Pokémon aleatorio (en español) y, en uno o dos segundos, su ilustración. Cada oleada trae uno distinto sin espera, porque el siguiente se descarga por adelantado.
3. **Sin red.** En DevTools bloquea `pokeapi.co` y `raw.githubusercontent.com` (o desconecta la red). El enemigo se muestra como rectángulo con "Pokémon #n" y no aparece ningún error.
4. **Oleadas, fallo, timeout, pausa.** Igual que en la fase 2: 5 aciertos derrotan al primer Pokémon, el fallo no cambia la operación, el timeout quita un corazón y muestra el resultado, cambiar de pestaña congela el reloj.
5. **Resultado.** Muestra aciertos, Pokémon derrotados con sus nombres, el estado del guardado ("Puesto #n en el ranking" o "guardado en este dispositivo") y las operaciones que costaron más.
6. **Ranking.** Desde Resultado con R: la partida recién jugada aparece resaltada con su posición real aunque no esté en el top 10. Cambia de pestaña con las flechas. `data/scores.json` contiene la entrada.
7. **Servidor caído.** Para `pnpm dev:server`, juega y pierde: el resultado dice "guardado en este dispositivo" y el ranking avisa que muestra datos locales. Vuelve a arrancar el servidor y recarga el título: la puntuación pendiente se envía sola (`localStorage` `multiplicon.pending` queda vacío).
8. **Nombres.** Un nombre con una palabra malsonante llega al ranking con asteriscos.

## Pruebas automáticas

Cliente (generador, estado del combate, resumen de fallos, ranking local, cliente de PokéAPI) y servidor (orden, escritura atómica, concurrencia, validación, rutas). No necesitan navegador ni red.

```bash
pnpm test          # una pasada
pnpm test:watch    # modo continuo
```

## Build y ejecución como en producción

```bash
pnpm build         # tsc + vite build → dist/   y   tsc servidor → dist-server/
pnpm start         # sirve dist/ y la API en http://localhost:8787
```

Comprueba `http://localhost:8787/api/health` → `{"ok":true}`.

Variables de entorno del servidor: `PORT` (8787), `DATA_DIR` (carpeta de `scores.json`, por defecto `./data`), `DIST_DIR` (build del cliente, por defecto `./dist`).

## Deploy en Dokploy

1. Crear una aplicación desde este repositorio con **Dockerfile** como método de build.
2. **Montar un volumen en `/app/data`.** Sin él, cada redeploy borra el ranking completo.
3. Puerto expuesto: 8787. Variables opcionales: `PORT`, `DATA_DIR`.
4. Tras el primer deploy, abrir `/api/health` y jugar una partida; confirmar que `scores.json` aparece en el volumen y sobrevive a un redeploy.

Docker no está instalado en la máquina de desarrollo: la imagen se construye en el VPS.

## Datos de PokéAPI y créditos

Los nombres de los Pokémon vienen de PokéAPI y se cachean en `localStorage` (`multiplicon.pokemon.<id>`). Las ilustraciones se cargan desde el repositorio público de sprites de PokéAPI. Los sprites de líderes se descargaron una vez con `pnpm fetch-trainers` y están en `public/assets/trainers/`. Licencias y atribuciones en `CREDITS.md`.

## Inspeccionar el juego desde la consola del navegador

Solo en modo desarrollo, la instancia de Phaser queda en `window.__multiplicon`.

```js
const game = window.__multiplicon;
game.scene.getScenes(true).map((s) => s.scene.key);   // escena activa

const sc = game.scene.getScene('Battle');              // durante el combate
sc.state.problem.text     // "347 × 26"
sc.state.problem.answer   // 9022
sc.state.hearts           // corazones restantes
sc.state.wave             // oleada actual
sc.state.monsterHp        // vida del Pokémon actual
sc.monster.pokemonName    // nombre del Pokémon en pantalla
sc.defeatedNames          // Pokémon derrotados en esta partida

localStorage.getItem('multiplicon.name')     // último nombre
localStorage.getItem('multiplicon.trainer')  // último entrenador
localStorage.getItem('multiplicon.pending')  // puntuaciones pendientes de enviar
```

## Detener los servidores

`Ctrl+C` en cada terminal. Si un puerto queda ocupado en Windows:

```powershell
$c = Get-NetTCPConnection -LocalPort 5173 -State Listen; Stop-Process -Id $c.OwningProcess -Force
$c = Get-NetTCPConnection -LocalPort 8787 -State Listen; Stop-Process -Id $c.OwningProcess -Force
```

## Estructura relevante

```
server/
├── index.ts                   arranque: puerto, rutas de datos y build
├── app.ts                     rutas /api/health, /api/leaderboard, /api/scores y estáticos
├── scoreStore.ts              archivo JSON con escritura atómica y cola
├── validation.ts / badwords.ts
└── *.test.ts
src/
├── main.ts                    Phaser: 1280×720, Scale.FIT, contenedor DOM, crossOrigin
├── types.ts
├── config/
│   ├── difficulties.ts        niveles, curva de tiempo, vida del monstruo
│   └── trainers.ts            líderes de gimnasio disponibles
├── systems/
│   ├── ProblemGenerator.ts / BattleState.ts / Preferences.ts
│   ├── pokemon/PokeApi.ts     nombre e ilustración con caché y fallback
│   └── scores/                ScoreRepository, Http, Local, ScoreService
├── ui/
│   ├── HeroView.ts            sprite del entrenador
│   ├── MonsterView.ts         ilustración del Pokémon, nombre y barra de vida
│   └── Button.ts / keys.ts / style.ts
└── scenes/
    Preload · Title · Name · TrainerSelect · LevelSelect · Battle · Result · Leaderboard
public/assets/trainers/        sprites descargados (scripts/fetch-trainers.mjs)
data/scores.json               ranking (no se versiona)
Dockerfile                     imagen multi-etapa para Dokploy
```

Las fases siguientes están en `plan.md`, sección 12. La próxima es la fase 4: arte por gimnasio, teclado en pantalla y la elección entre multiplicar y dividir.
