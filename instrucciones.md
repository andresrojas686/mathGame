# Instrucciones — lanzar y probar Multiplicón

Estado actual: **v1 completa** (fases 1 a 6 de `plan.md`). Multiplicación y división, tres gimnasios Pokémon con arte propio, teclado en pantalla, audio sintetizado con ajustes, ranking con servidor y manifest para instalar como app.

## Requisitos

- Node 22 o superior
- pnpm 10 o superior (`npm install -g pnpm` si no lo tienes)
- Conexión a internet para ver los Pokémon (sin red el juego funciona igual, con rectángulos)

## Instalación

Desde la raíz del proyecto:

```bash
pnpm install
```

Los sprites de líderes y la tipografía ya están versionados. Si hiciera falta regenerarlos: `pnpm fetch-trainers` y `node scripts/fetch-fonts.mjs`.

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
Título ─┬─> Nombre ─> Entrenador ─> Operación y nivel ─> Combate ─> Resultado ─┬─> Ranking
        ├─> Ranking                                        │                     └─> otra partida / cambiar nivel
        └─> Ajustes                                        └─ Esc: pausa + Ajustes en overlay
```

| Pantalla | Teclado | Ratón / táctil |
|---|---|---|
| Título | Enter juega · R ranking · A ajustes · M silencio | Botones |
| Nombre | Escribir, Enter. Máx. 12 caracteres, recuerda el último | Campo de texto y botón |
| Entrenador | Flechas y Enter. Escape vuelve a Nombre | Clic en un líder |
| Operación y nivel | M / D o Tab cambia la operación · ← → y Enter, o 1 / 2 / 3 · Escape vuelve a Entrenador | Clic en operación y tarjeta |
| Combate | Dígitos, Backspace, Enter · Esc pausa y abre Ajustes | Teclado numérico en pantalla |
| Resultado | Enter otra vez · R ranking · Escape cambiar nivel | Botones |
| Ranking | ← → nivel · M / D operación · Enter jugar · Escape menú | Pestañas y botones |
| Ajustes | Escape cierra · M silencio | Todo con clic |

El botón de silencio está siempre en la esquina inferior derecha.

## Atajo para probar un nivel directo

`?level=facil|normal|dificil` y opcionalmente `&op=dividir` en la URL saltan al combate con el último nombre y entrenador guardados. Ejemplo: `http://localhost:5173/?level=dificil&op=dividir`.

## Qué probar a mano

1. **Tipografía.** Todo el texto se ve en Atkinson Hyperlegible (0 y O, 1 y 7, 6 y 8 se distinguen). Si el primer frame sale con otra fuente, la carga de `assets/fonts/atkinson.css` falló.
2. **Operación.** En la pantalla de nivel, elige Dividir: las tarjetas cambian a "2 cifras ÷ 1 cifra" y el tiempo se duplica. En el combate aparecen divisiones exactas (nunca con resto) y la cabecera dice "División". La elección se recuerda.
3. **Gimnasios.** Cada nivel tiene fondo en tres capas y paleta propia (roca y planta, agua y eléctrico, psíquico y fantasma). La operación se ve igual de grande y legible en los tres. Al recibir un ataque, el fondo se sacude con leve parallax.
4. **Teclado en pantalla.** Toca los dígitos y ✓ a la derecha del campo de respuesta. Las teclas se iluminan también cuando escribes con el teclado físico.
5. **Corazones.** Son corazones SVG teñidos con el color del gimnasio; al perder uno se encoge y desaparece.
6. **Audio.** No suena nada hasta el primer clic o tecla (política del navegador). Después: música de menú, música distinta en cada gimnasio, clic en cada tecla, sonido de acierto, golpe al recibir ataque, fanfarria al derrotar un Pokémon y descenso al perder. El fallo **no suena**. Con un solo corazón o menos de 2 s, entra una capa de tensión (pad grave y charles) con fundido.
7. **Ajustes.** Desde el título (A) o en pleno combate (Escape, que pausa el reloj). Cambia el sonido de acierto, el texto de fallo (o escribe uno propio de hasta 8 caracteres), la música de cada mundo y los volúmenes; cada uno tiene "Probar". Los cambios se aplican al instante y se guardan. Escribe un texto propio, vuelve al combate y falla: se ve tu texto.
8. **Preferencia inválida.** En consola: `localStorage.setItem('multiplicon.feedback', '{"correctId":"trompeta"}')` y recarga. El juego arranca con la campana por defecto, sin error.
9. **Silencio y foco.** M o el botón de la esquina silencian todo. Al cambiar de pestaña, se pausan el reloj y el audio.
10. **Instalación como app.** En Chrome de escritorio o Android aparece "Instalar Multiplicón" (manifest, icono y modo pantalla completa en horizontal). En vertical en un móvil se muestra "Gira el dispositivo".
11. **Pokémon, ranking, sin red y servidor caído.** Igual que en la fase 3: Pokémon aleatorio con ilustración, rectángulo sin red, ranking con seis tablas (operación × nivel), respaldo local y reenvío de pendientes.

## Pruebas automáticas

Cliente (generadores de multiplicación y división, estado del combate, resumen de fallos, ranking local, PokéAPI, validación de ajustes) y servidor (orden, escritura atómica, concurrencia, validación, rutas). No necesitan navegador ni red.

```bash
pnpm test          # una pasada
pnpm test:watch    # modo continuo
```

## Build y ejecución como en producción

```bash
pnpm build         # tsc + vite build → dist/   y   tsc servidor → dist-server/
pnpm start         # sirve dist/ y la API en http://localhost:8787
```

Comprueba `http://localhost:8787/api/health` → `{"ok":true}` y `http://localhost:8787/manifest.json`.

Variables de entorno del servidor: `PORT` (8787), `DATA_DIR` (carpeta de `scores.json`, por defecto `./data`), `DIST_DIR` (build del cliente, por defecto `./dist`).

## Deploy en Dokploy

1. Crear una aplicación desde este repositorio con **Dockerfile** como método de build.
2. **Montar un volumen en `/app/data`.** Sin él, cada redeploy borra el ranking completo.
3. Puerto expuesto: 8787. Variables opcionales: `PORT`, `DATA_DIR`.
4. Dominio y HTTPS: en Dokploy, añadir el dominio en la aplicación y activar el certificado (Let's Encrypt). El manifest exige HTTPS para que el navegador ofrezca instalar la app.
5. Tras el primer deploy, abrir `/api/health` y jugar una partida; confirmar que `scores.json` aparece en el volumen y sobrevive a un redeploy.

Docker no está instalado en la máquina de desarrollo: la imagen se construye en el VPS.

## Datos, arte y créditos

- Nombres de Pokémon desde PokéAPI, cacheados en `localStorage` (`multiplicon.pokemon.<id>`); ilustraciones desde el repositorio de sprites de PokéAPI.
- Sprites de líderes en `public/assets/trainers/` (descargados una vez).
- Fondos, corazones e iconos son SVG escritos a mano en `public/assets/gyms/`, `public/assets/shared/` y `public/`.
- Música y efectos sintetizados con Web Audio: no hay archivos de audio.
- Licencias y atribuciones en `CREDITS.md`.

## Inspeccionar el juego desde la consola del navegador

Solo en modo desarrollo:

```js
const game = window.__multiplicon;
game.scene.getScenes(true).map((s) => s.scene.key);   // escena activa

const sc = game.scene.getScene('Battle');              // durante el combate
sc.state.problem.text     // "576 ÷ 32"
sc.state.problem.answer   // 18
sc.state.operation        // 'multiplicar' | 'dividir'
sc.state.timeLimit        // segundos por operación (el doble en división)
sc.monster.pokemonName    // Pokémon en pantalla
sc.missLabel.text         // texto de fallo en uso

window.__audio.settings   // preferencias de audio en memoria
window.__audio.isUnlocked // true tras el primer gesto

localStorage.getItem('multiplicon.feedback')   // preferencias guardadas
localStorage.getItem('multiplicon.operation')  // última operación
```

## Detener los servidores

`Ctrl+C` en cada terminal. Si un puerto queda ocupado en Windows:

```powershell
$c = Get-NetTCPConnection -LocalPort 5173 -State Listen; Stop-Process -Id $c.OwningProcess -Force
$c = Get-NetTCPConnection -LocalPort 8787 -State Listen; Stop-Process -Id $c.OwningProcess -Force
```

## Estructura relevante

```
server/                        API Hono: app.ts, scoreStore.ts, validation.ts, badwords.ts, *.test.ts
scripts/                       fetch-trainers.mjs, fetch-fonts.mjs
public/
├── manifest.json, icon.svg    instalación como app
└── assets/
    ├── fonts/                 Atkinson Hyperlegible (OFL)
    ├── gyms/{facil,normal,dificil}/bg-*.svg
    ├── shared/heart-*.svg
    └── trainers/*.png
src/
├── main.ts                    espera la fuente, instala el audio, arranca Phaser
├── config/
│   ├── difficulties.ts        niveles, cifras de × y ÷, curva de tiempo, vida del monstruo
│   ├── themes.ts              paletas y capas por gimnasio
│   ├── feedback.ts            catálogo de música, sonidos de acierto y textos de fallo
│   └── trainers.ts
├── systems/
│   ├── ProblemGenerator.ts    multiplicación y división exacta
│   ├── BattleState.ts         bucle de combate (doble tiempo en división)
│   ├── AudioManager.ts        síntesis, capa de tensión, ducking, autoplay, foco
│   ├── FeedbackSettings.ts    preferencias validadas contra el catálogo
│   ├── Preferences.ts         nombre, entrenador y operación recordados
│   ├── pokemon/PokeApi.ts
│   └── scores/
├── ui/
│   ├── NumPad.ts · MissLabel.ts · HeartBar.ts · MuteButton.ts
│   ├── HeroView.ts · MonsterView.ts
│   └── Button.ts · keys.ts · style.ts
└── scenes/
    Preload · Title · Name · TrainerSelect · LevelSelect · Battle · Result · Leaderboard · Settings
```
