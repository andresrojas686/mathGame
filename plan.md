# Plan de desarrollo — Juego de multiplicaciones por combate

**Nombre de trabajo:** Multiplicón
**Tipo:** Juego educativo 2D para navegador
**Público:** Niños de 7 a 12 años
**Objetivo pedagógico:** Automatizar la multiplicación bajo presión de tiempo, con dificultad progresiva y refuerzo positivo.
**Alcance de la v1:** un jugador, multiplicación y división (esta última en fase 4), partida sin final, ambientación de gimnasios Pokémon con música propia por dificultad, ranking persistido en archivo del proyecto.

---

## 1. Concepto

El jugador es un héroe que enfrenta a un monstruo. El monstruo no se derrota con botones de ataque, sino resolviendo multiplicaciones: cada respuesta correcta es un golpe del héroe, cada segundo que pasa acerca el ataque del monstruo.

La tensión del juego es el reloj. El niño no está "haciendo una tarea", está evitando que le peguen.

**El juego no tiene final.** Mientras el jugador responda dentro del tiempo, la partida continúa indefinidamente. La partida solo termina cuando se agotan los corazones. El objetivo del niño es su propio número de aciertos, no llegar a una pantalla de victoria.

---

## 2. Stack técnico

| Capa | Elección | Por qué |
|---|---|---|
| Motor | Phaser 3 | Escenas, sprites, animaciones, audio y timers ya resueltos |
| Lenguaje | TypeScript | Tipado del modelo de dificultad y del estado de partida |
| Build | Vite | Arranque rápido, HMR, bundle estático |
| Servidor | Hono.js sobre Node | Sirve el build y expone la API del ranking |
| Persistencia | `data/scores.json` | Archivo del proyecto, sin base de datos |
| Deploy | Dokploy en VPS | Necesita disco persistente para el archivo |
| Enemigos | PokéAPI (pokeapi.co) | Nombre en español e ilustración oficial de un Pokémon aleatorio por oleada, sin clave ni cuota |
| Héroe | Sprites de líderes de gimnasio | Descargados una vez de Pokémon Showdown y versionados en `public/assets/trainers/` |

### Por qué no Cloudflare Pages

El juego en sí es estático y correría perfecto en Pages, pero el ranking tiene que escribirse en un archivo y el navegador no puede hacer eso: no tiene acceso al disco del servidor. Se necesita un proceso que reciba la puntuación y la guarde.

La solución más simple que cumple el requisito es un servidor Hono mínimo que sirve el build estático y expone dos rutas. Va en el VPS con Dokploy y un volumen montado para que `scores.json` sobreviva a los redeploys. Son unas 60 líneas de servidor, no un backend de verdad.

---

## 3. Mecánica de juego

### Bucle principal

```
[Aparece multiplicación]  →  temporizador arranca
        │
        ├── Respuesta correcta  → héroe ataca, +1 acierto, monstruo pierde vida,
        │                         nueva multiplicación, temporizador se reinicia
        │
        ├── Respuesta incorrecta → sacudida + aviso "MISS" en pantalla (sin sonido),
        │                          la multiplicación NO cambia,
        │                          el temporizador NO se reinicia (puede volver a intentar)
        │
        └── Se acaba el tiempo   → monstruo ataca, −1 corazón,
                                   nueva multiplicación, temporizador se reinicia

  El bucle no tiene salida por victoria. Solo termina en corazones = 0.
```

### Reglas confirmadas

- El tiempo inicial para responder es de **7 segundos**.
- Fallar no cuesta corazones: el niño puede reintentar tantas veces como alcance dentro del tiempo restante.
- Cuando el monstruo ataca, la operación cambia. No se puede quedar atascado en una operación imposible.
- El juego termina únicamente cuando los corazones llegan a cero.

### Progresión dentro de una partida

El monstruo tiene vida propia. Cada respuesta correcta le quita un punto; al derrotarlo aparece otro más resistente y el tiempo de respuesta baja un poco. Esto le da al niño una meta visible a corto plazo ("le falta poco") dentro de una partida que por diseño no acaba.

| Oleada | Vida del monstruo | Tiempo de respuesta |
|---|---|---|
| 1 | 5 aciertos | 7.0 s |
| 2 | 7 aciertos | 6.5 s |
| 3 | 9 aciertos | 6.0 s |
| n | 3 + 2n | máx(7 − 0.5·(n−1), piso del nivel) |

Piso de tiempo por nivel: fácil 5 s, normal 4 s, difícil 3.5 s.

El piso es lo que hace posible una partida infinita. Sin él, el tiempo tendería a cero y toda partida terminaría por reflejos y no por matemáticas. Con él, un niño que domina sus tablas puede sostener la partida el tiempo que quiera, que es exactamente el comportamiento buscado.

**Variedad visual en partidas largas:** cada oleada trae un Pokémon distinto, elegido al azar entre 1025 especies y sin repetir dentro de la partida. Una sesión de veinte minutos con un solo monstruo repetido cansa la vista; aquí ese problema no existe.

---

## 4. Niveles de dificultad

| | Fácil | Normal | Difícil |
|---|---|---|---|
| **Gimnasio** | Roca y planta | Agua y eléctrico | Psíquico y fantasma |
| **Corazones** | 5 | 3 | 1 |
| **Multiplicando** | 2 dígitos (10–99) | 2–3 dígitos (10–999) | 3–5 dígitos (100–99999) |
| **Multiplicador** | 1 cifra (2–9) | 1–2 cifras (2–99) | 1–3 cifras (2–999) |
| **Piso de tiempo** | 5 s | 4 s | 3.5 s |

En normal y difícil, la cantidad de dígitos de cada factor se sortea en cada operación, así que la dificultad varía dentro del mismo nivel.

Los valores concretos (corazones, cifras, piso) viven en `src/config/difficulties.ts` y se han ajustado desde esta tabla; el archivo manda.

### Operación: multiplicar o dividir (fase 4)

El jugador elige en la pantalla de nivel si juega a **multiplicar** o a **dividir**. Los tres niveles existen para las dos operaciones.

- **Cifras por nivel.** Se definen por el **dividendo** y el **divisor**, no por los factores de la multiplicación:

  | | Fácil | Normal | Difícil |
  |---|---|---|---|
  | **Dividendo** | 2 cifras | 2 o 3 cifras | 2, 3 o 4 cifras |
  | **Divisor** | 1 cifra | 1 o 2 cifras | 1, 2 o 3 cifras |

  En normal y difícil la cantidad de cifras se sortea en cada operación, como en la multiplicación. Nunca se sortea un divisor con más cifras que el dividendo.
- **División exacta, siempre.** Se elige primero el divisor `b` con sus cifras (nunca 0 ni 1), luego un cociente `q ≥ 2` tal que `q·b` tenga exactamente las cifras del dividendo, y se presenta `q·b ÷ b`; la respuesta es `q`. Nunca hay resto ni decimales. Si para una combinación de cifras no existe ningún cociente válido (por ejemplo 2 cifras entre 99), se vuelve a sortear.
- **El doble de tiempo.** En división, el tiempo por operación es `2 × timeLimitForWave(oleada)`, incluido el piso. Todo lo demás (corazones, vida del monstruo, oleadas) es igual.
- **Ranking separado.** Cada operación tiene sus propias tablas por nivel (sección 10).
- La configuración vive en `dividendDigits` y `divisorDigits` de cada `DifficultyConfig`, y el generador en `generateDivisionProblem` (`src/systems/ProblemGenerator.ts`), ya implementados y probados; la fase 4 conecta la elección en pantalla.

### Generador de operaciones

```ts
interface DifficultyConfig {
  id: 'facil' | 'normal' | 'dificil';
  hearts: number;
  multiplicandDigits: number[];   // ej. [2, 3]
  multiplierDigits: number[];     // ej. [1, 2]
  timeFloor: number;
}

interface Problem {
  text: string;        // "347 × 26"
  answer: number;
  operands: number[];  // [347, 26]
}

function generateProblem(cfg: DifficultyConfig): Problem {
  const a = randomWithDigits(pick(cfg.multiplicandDigits));
  const b = randomWithDigits(pick(cfg.multiplierDigits));
  return { text: `${a} × ${b}`, answer: a * b, operands: [a, b] };
}
```

`Problem` expone `text` en vez de `a` y `b` sueltos. Cuesta lo mismo hoy y evita reescribir la interfaz el día que se agreguen otras operaciones.

**Reglas del generador**

- Excluir el 0 y el 1 como multiplicador: no enseñan nada y regalan el turno.
- Para un factor de *n* dígitos, el rango es `10^(n-1)` a `10^n − 1`, así que un número de 3 dígitos nunca sale como 007.
- No repetir la misma operación dos veces seguidas.
- Guardar un historial de la partida (operación, respuesta dada, tiempo usado) para mostrar al final en qué falló más. Es la parte con más valor pedagógico y cuesta poco.

---

## 5. Entrada del jugador

Los resultados pueden llegar a 5 cifras por 3 cifras, así que la entrada tiene que ser cómoda y rápida:

- Teclado físico: dígitos, `Backspace` para borrar, `Enter` para confirmar.
- Teclado numérico en pantalla, obligatorio para que funcione en tablet, que es donde probablemente lo use un niño.
- La respuesta se valida solo al confirmar, nunca en cada tecla. Validar mientras escribe convierte un 240 en un fallo apenas teclea el 2.
- Al fallar, el campo se limpia y queda listo para reintentar. No hay que borrar a mano.

---

## 6. Pantallas

```
┌──────────────┐
│    Título    │  Nombre del juego, botón "Jugar", ranking y ajustes
└──────┬───────┘
       ↓
┌──────────────┐
│    Nombre    │  Campo de texto, máx. 12 caracteres, recuerda el último usado
└──────┬───────┘
       ↓
┌──────────────┐
│    Nivel     │  Tres tarjetas: Fácil / Normal / Difícil
└──────┬───────┘     (cada una muestra su tema y sus corazones)
       ↓
┌──────────────┐
│    Combate   │  ← pantalla principal, sin salida por victoria
└──────┬───────┘
       ↓
┌──────────────┐
│  Resultado   │  Aciertos, oleadas superadas, operaciones falladas
└──────┬───────┘
       ↓
┌──────────────┐
│   Ranking    │  Top 10 del nivel jugado, con pestañas para ver los otros
└──────────────┘
```

### Layout de la pantalla de combate

```
┌───────────────────────────────────────────────┐
│  ♥♥♥♥♥                          Aciertos: 12  │
│                                               │
│                              ╔═════════════╗  │
│      🧙 héroe                ║  MONSTRUO   ║  │
│                              ║  ▓▓▓▓▓░░░   ║  │
│                              ╚═════════════╝  │
│                                               │
│        ┌───────────────────────────┐          │
│        │        347 × 26           │          │
│        └───────────────────────────┘          │
│        ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░  ← barra de tiempo│
│                                               │
│        [    9022    ]   [ 7 8 9 ]             │
│                         [ 4 5 6 ]             │
│                         [ 1 2 3 ]             │
│                         [ 0 ⌫ ✓ ]             │
└───────────────────────────────────────────────┘
```

La operación va centrada y es el elemento más grande de la pantalla. Héroe y monstruo enmarcan sin competir. La barra de tiempo va pegada debajo de la operación, no en una esquina: el niño tiene que verla sin apartar la mirada del problema.

---

## 7. Dirección visual

### Principio que atraviesa los tres gimnasios

**La operación nunca se disfraza.** Los fondos, los personajes y la interfaz cambian por completo entre niveles, pero los números se muestran siempre en la misma tipografía, mismo tamaño relativo y mismo contraste. Un 6 debe leerse igual de rápido en el gimnasio de roca que en el psíquico. La fantasía es el envoltorio; la legibilidad del número es el producto.

**Tipografía de los números:** Atkinson Hyperlegible. Diseñada para máxima distinción entre caracteres parecidos, resuelve el problema real de este juego (0/O, 1/7, 6/8) mejor que cualquier fuente decorativa.

### Personajes: Pokémon y líderes de gimnasio

Los tres niveles comparten la misma ambientación: **gimnasios Pokémon**. El jugador es un líder de gimnasio que elige en una galería (doce líderes de Kanto y Johto) y el enemigo es un Pokémon aleatorio entre las 1025 especies, distinto en cada oleada.

- El nombre del Pokémon se muestra en español (PokéAPI lo trae; si falla, inglés; si no hay red, "Pokémon #n").
- La ilustración oficial se carga desde el repositorio de sprites de PokéAPI, escalada a 230 px de alto. El siguiente Pokémon se descarga mientras se combate con el actual, así el cambio de oleada no espera a la red.
- Sin red, el enemigo es un rectángulo con su nombre y el juego sigue igual. Ninguna mecánica depende de que la imagen llegue.
- Los sprites de líderes son pixel art de 80×80 escalado ×2.5 con filtro NEAREST, para que se vea nítido y no borroso.

### Fácil — Gimnasio de roca y planta

Cálido y terroso: es el nivel donde el niño está aprendiendo y no queremos que el ambiente lo intimide.

```
#2A1F1A  tierra oscura (fondo)
#8C6A4A  roca
#6B8F5E  verde de planta
#E8C87A  ámbar (acentos, corazones)
#F2E9D8  pergamino (texto de interfaz)
```

### Normal — Gimnasio de agua y eléctrico

Sube la tensión con azules profundos y destellos ámbar.

```
#12202B  azul de fondo
#2F7FB8  agua
#E4B363  ámbar eléctrico (acentos)
#C9D6DF  espuma (texto secundario)
#F2E9D8  texto de interfaz
```

### Difícil — Gimnasio psíquico y fantasma

Frío, limpio, sin ruido visual: es el nivel con menos corazones y no puede haber nada en pantalla compitiendo con la operación.

```
#0F0A1E  vacío violeta (fondo)
#B45CFF  violeta psíquico
#00D9C0  turquesa (acentos)
#FF5470  rojo de alarma (corazones, avisos)
#E6F1FF  texto de interfaz
```

### Retroalimentación

- **Acierto:** el líder embiste, el Pokémon destella y retrocede, sonido ascendente. Menos de 400 ms; nada puede retrasar la siguiente operación.
- **Fallo:** el campo de respuesta se sacude horizontalmente y sube un aviso corto tipo "MISS", **sin ningún sonido**. Ver la sección 9 para el detalle. No hay mensajes de ánimo ni explicaciones: interrumpir con "¡Casi, sigue intentando!" le roba segundos al reintento.
- **Ataque del Pokémon:** embiste hacia el líder, la pantalla se sacude, un corazón se apaga, la operación se desvanece y entra la siguiente. Aquí sí se muestra medio segundo el resultado correcto de la operación perdida: es el único momento en que el niño puede aprender de ese error.
- **Pokémon derrotado:** sale por la derecha y entra el siguiente con un pequeño rebote. La siguiente operación ya está en pantalla durante la transición.
- **Tiempo bajo:** cuando quedan menos de 2 segundos, la barra pulsa. Sin sonido de alarma repetitivo, que agota en sesiones largas.

---

## 8. Assets

Héroe y enemigo **no se dibujan a mano**: son el sprite del líder elegido y la ilustración del Pokémon (sección 7). El resto de la interfaz se produce como **SVG escritos a mano**, no como imágenes rasterizadas ni pack comprado. Phaser los carga como textura con `this.load.svg(key, path, { width, height })` y quedan nítidos en cualquier resolución.

### Cómo se anima

Los personajes son una sola imagen animada con tweens sobre su contenedor (`HeroView`, `MonsterView`): embestida, retroceso, destello de tinte, salida y entrada. Es menos expresivo que animación cuadro a cuadro, pero para este juego alcanza y elimina la parte más costosa de la producción de arte. Las animaciones que importan duran menos de 400 ms y ocurren mientras el niño ya está leyendo la siguiente operación.

### Inventario

**Por cada gimnasio (×3):**

| Asset | Piezas | Notas |
|---|---|---|
| Fondo | 3 capas | Cielo o techo, media distancia, primer plano. Parallax leve al sacudirse |
| Marco de interfaz | 1 | Bordes de la caja de operación y del teclado |
| Corazón | 2 estados | Lleno y vacío |

**Compartidos:**

- Teclado numérico: fondo de tecla, estados normal / presionado / deshabilitado. Se tiñe por gimnasio con `setTint`, no se redibuja tres veces.
- Efectos: destello de impacto, partículas de golpe, viñeta roja de daño.
- Iconos: silencio, volver, ranking.
- Sprites de los doce líderes (`public/assets/trainers/`, descargados con `scripts/fetch-trainers.mjs`).

### Restricciones de producción

- Paleta limitada a los 5 colores del gimnasio.
- Siluetas legibles a 200 px de alto, que es el tamaño real en pantalla.
- Sin texto dentro de los SVG: todo el texto lo dibuja Phaser para poder traducirlo o cambiarlo.

### Licencias

Pokémon es marca de Nintendo, Creatures y GAME FREAK. El uso aquí es educativo y sin ánimo de lucro, y queda registrado en `CREDITS.md`. Si el juego se quisiera distribuir comercialmente, `HeroView` y `MonsterView` se alimentan con otras imágenes sin tocar la lógica.

---

## 9. Audio

### Música de fondo por dificultad

Cada nivel tiene su propia pista, en el mismo registro que su tema visual. La música no es decoración: es lo que le dice al niño en qué mundo está antes de leer una sola palabra.

| Nivel | Tema | Carácter | Instrumentación | Tempo |
|---|---|---|---|---|
| Fácil | Medieval | Cálido, de aventura, nada amenazante | Laúd, flauta, tambor suave | ~100 bpm |
| Normal | Zombies y vampiros | Macabro pero juguetón, tipo caricatura | Órgano, contrabajo en pizzicato, vals menor | ~120 bpm |
| Difícil | Alienígenas | Tenso y limpio, pulso constante | Sintetizadores, arpegio, percusión electrónica | ~140 bpm |

Se suma una cuarta pista para menús y ranking: más tranquila, neutra, sin tema definido. Sirve de descanso entre partidas.

### Reglas de composición

Como la partida no tiene final, un niño puede escuchar el mismo loop durante media hora. Eso cambia lo que sirve:

- **Loops de 90 a 120 segundos.** Un loop de 30 segundos se vuelve insoportable en la oleada 12.
- **Sin ganchos melódicos fuertes.** La melodía pegajosa que funciona en un tráiler es exactamente lo que agota en sesión larga. Texturas y ritmo por encima de melodía.
- **Nada en el rango de frecuencia de los efectos.** Si la música ocupa los mismos medios agudos que el sonido de acierto, el niño deja de percibir la retroalimentación.
- **Corte de loop limpio.** Verificar en el editor que el final empalme con el inicio sin clic audible. Es el error más común y se nota muchísimo en repetición.

### Capa de tensión

Cada pista se compone en dos capas que suenan sobre el mismo loop: la base, siempre activa, y una capa de tensión (percusión extra o un pad grave) que entra con fundido de 300 ms cuando el jugador está en peligro:

- Le queda **un solo corazón**, o
- quedan **menos de 2 segundos** en el temporizador.

Sale con el mismo fundido al recuperar el margen. Es una sola línea de estado en `AudioManager` y da mucha más sensación de riesgo que subir el volumen general. En difícil, donde el jugador siempre tiene un corazón, la capa se activa únicamente por tiempo bajo.

### Efectos

| Evento | Sonido | Duración |
|---|---|---|
| Tecla del teclado numérico | Clic seco, muy bajo | < 60 ms |
| Respuesta correcta | Golpe + tono ascendente | < 400 ms |
| Respuesta incorrecta | **Ninguno.** El aviso es visual | — |
| Ataque del monstruo | Impacto + corazón que se apaga | < 600 ms |
| Monstruo derrotado | Fanfarria breve del tema | < 1 s |
| Fin de partida | Descenso, la música se desvanece | 2 s |

**El fallo no suena.** Un efecto de error repetido veinte veces en una partida convierte el juego en una experiencia de castigo, y en este juego fallar es parte normal del proceso: el niño puede equivocarse tres veces en la misma operación antes de acertar. En su lugar se muestra un aviso visual, descrito en la sección siguiente.

El sonido de acierto sí es configurable, según el catálogo de más abajo. El resto (teclas, ataque, derrota) queda fijo para mantener coherente la identidad sonora del juego.

**Normalización.** Cada sonido del catálogo lleva su propio valor de `gain`. Los efectos descargados de distintas fuentes varían muchísimo de volumen, y sin normalizar, cambiar de "campana" a "moneda" en ajustes puede triplicar el volumen percibido.

**Ducking:** la música baja 4 dB durante los efectos de acierto y de ataque, y vuelve en 200 ms. Sin esto, los efectos se pierden dentro de la mezcla o hay que subirlos tanto que asustan.

### Aviso visual de fallo

Al equivocarse aparece un texto corto sobre el campo de respuesta, que sube unos 30 px mientras se desvanece. Es el único aviso de error del juego.

```
        ┌───────────────────────────┐
        │        347 × 26           │
        └───────────────────────────┘
        ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░

                MISS          ← sube y se desvanece, 700 ms
        [    9022    ]   [ 7 8 9 ]
```

**Por qué encima del campo de respuesta y no sobre el monstruo.** La convención de los juegos de rol pondría el "MISS" sobre el enemigo, pero en el momento de confirmar la respuesta el niño está mirando el teclado y el campo de entrada, no al monstruo. Un aviso en la mitad superior de la pantalla se pierde justo cuando más importa.

**Comportamiento**

- Duración total de 700 ms: aparición inmediata, 400 ms legible, 300 ms de desvanecido.
- No bloquea nada. El niño puede seguir tecleando mientras el aviso todavía se ve.
- Fallos seguidos no apilan avisos: el existente se reinicia en su posición inicial. Tres "MISS" superpuestos son ilegibles y parecen un error de la aplicación.
- El color viene de la paleta del tema, no un rojo fijo. En el nivel alienígena el rojo está reservado para el corazón único y para las alarmas.
- Con `prefers-reduced-motion`, el texto aparece y se desvanece sin desplazarse.

**Ventaja secundaria:** como el juego no depende de sonido para el error, funciona igual con el audio apagado, en un salón de clase o con un niño sordo. La retroalimentación negativa no está en un canal que se pueda perder.

### Parametrización

Ni un solo nombre de archivo de audio ni texto de interfaz aparece fijo en el código del juego. El catálogo vive en `src/config/feedback.ts`, y el jugador elige desde la pantalla de ajustes.

```ts
interface SoundOption {
  id: string;
  label: string;        // lo que ve el usuario: "Campana"
  file: string;         // sin extensión; AudioManager resuelve .ogg / .m4a
  gain: number;         // normalización, 0–1
  detune?: number;      // ajuste de tono en cents
}

interface MusicOption extends SoundOption {
  tensionFile?: string; // capa de tensión, si la pista la tiene
  bpm?: number;
}

interface MissMessage {
  id: string;
  text: string;         // máx. 8 caracteres
}

export const FEEDBACK_CATALOG = {
  music: {
    medieval: MusicOption[],
    undead:   MusicOption[],
    alien:    MusicOption[],
    menu:     MusicOption[],
  },
  correct: SoundOption[],      // sonido de acierto
  miss:    MissMessage[],      // texto de fallo
};

export const FEEDBACK_DEFAULTS = {
  music:   { medieval: 'lute-march', undead: 'organ-waltz', alien: 'pulse-drive' },
  correct: 'chime',
  miss:    'miss',
};
```

**Opciones que trae la v1**

| Sonido de acierto | Texto de fallo | Música |
|---|---|---|
| Campana *(por defecto)* | MISS *(por defecto)* | Dos pistas por cada uno de los tres temas |
| Chispa | ¡UY! | |
| Moneda | CASI | |
| Aplauso corto | OTRA VEZ | |
| Sin sonido | *(personalizado)* | |

**Texto personalizado.** El campo permite escribir cualquier cosa, con tres restricciones: máximo 8 caracteres, se pasa por el mismo filtro de palabras vetadas que los nombres del ranking, y si queda vacío se cae al valor por defecto. El límite de 8 no es arbitrario: más largo se sale del ancho del campo de respuesta y hay que reducir el tamaño de letra hasta volverlo inútil a la distancia que un niño mira una tablet.

**Recomendación sobre el texto.** Conviene que sea neutro o incluso divertido, nunca una descalificación. "MISS" y "CASI" describen el intento; "MAL" o "NO" describen al niño. Es una diferencia pequeña en pantalla y grande después de la vigésima repetición.

**Cómo se agrega una opción nueva:** para sonidos, se deja el archivo en `public/assets/audio/` y se añade una línea al catálogo con su `gain`. Para textos, basta la línea. En ambos casos aparece solo en ajustes, sin tocar escenas ni `AudioManager`.

### Preferencias guardadas

```ts
interface FeedbackSettings {
  musicByTheme: Record<ThemeId, string>;  // id del catálogo
  correctId: string;
  missId: string;
  missCustomText?: string;   // si missId === 'custom'
  musicVolume: number;       // 0–1
  sfxVolume: number;         // 0–1
  muted: boolean;
}
```

Se guarda en `localStorage` bajo `multiplicon.feedback` y se aplica en el arranque, antes del primer sonido y del primer fallo.

**Validación al cargar.** Si una preferencia apunta a un id que ya no existe en el catálogo (porque se quitó un archivo entre versiones), se cae al valor de `FEEDBACK_DEFAULTS` en lugar de fallar. Un juego que arranca mudo, o que no muestra nada al fallar, por una preferencia vieja es de los bugs más difíciles de diagnosticar: no hay error, simplemente no pasa nada.

### Pantalla de ajustes

Accesible desde el botón de engranaje en la pantalla de título y desde la pausa del combate.

```
┌───────────────────────────────────────────┐
│  Ajustes                              ✕   │
│                                           │
│  Música          ▓▓▓▓▓▓▓░░░  70%          │
│  Efectos         ▓▓▓▓▓▓▓▓▓░  90%          │
│                                           │
│  Al acertar                               │
│  ( ) Campana  (•) Chispa  ( ) Moneda   ▶  │
│                                           │
│  Al equivocarse                           │
│  (•) MISS  ( ) ¡UY!  ( ) CASI  ( ) Otro:  │
│  [________]  ← máx. 8            [Probar] │
│                                           │
│  Música de cada mundo                     │
│  Medieval    [ Marcha de laúd      ▾ ]  ▶ │
│  No muertos  [ Vals de órgano      ▾ ]  ▶ │
│  Espacial    [ Pulso               ▾ ]  ▶ │
└───────────────────────────────────────────┘
```

Cada opción tiene su botón de prueba. En el caso del texto de fallo, "Probar" lo anima exactamente como se verá en combate, con la misma tipografía, tamaño y desplazamiento. Escribir "OTRA VEZ" y descubrir en partida que no cabe es el tipo de detalle que solo se ve probándolo.

Los sonidos de prueba de música reproducen ocho segundos y se desvanecen, no la pista entera.

### Controles

- Botón de silencio siempre visible en la esquina, en todas las pantallas. Silencia todo con un toque, sin entrar a ajustes.
- Volúmenes separados de música y efectos. Muchos niños quieren los golpes pero no la música, y con un solo control la única salida es apagar todo.
- Silencio automático al perder el foco de la pestaña, junto con la pausa del temporizador.
- Los cambios en ajustes se aplican de inmediato, incluso con el combate en pausa detrás. Nada de "guardar" ni de reiniciar la partida.

### Detalles técnicos

**Política de autoplay.** Los navegadores bloquean el audio hasta que hay una interacción del usuario. La música no puede arrancar en `BootScene`: se inicia en el primer clic real, que es el botón "Jugar" de la pantalla de título. Si se intenta antes, la primera partida transcurre en silencio sin ningún error visible en consola, y es un bug difícil de rastrear.

**Formatos.** `.ogg` como principal y `.m4a` como respaldo para Safari, ambos declarados en el mismo `load.audio()`. Phaser elige el que el navegador soporte.

**Precarga selectiva.** En `PreloadScene` se carga solo la pista configurada para el nivel elegido, no el catálogo completo. Son varios MB por pista y no tiene sentido descargar las que no se van a usar. Los efectos y la música de menú, que son cortos, se cargan siempre.

Las pistas alternativas se cargan bajo demanda al abrir ajustes, no en el arranque. Si no, el catálogo de música convierte la primera carga del juego en una espera de veinte segundos.

**Transiciones.** Al pasar de menú a combate, fundido cruzado de 500 ms. Cortar en seco entre pistas se siente como un error de la aplicación.

### Estructura de archivos

```
public/assets/audio/
├── music/
│   ├── menu.ogg          menu.m4a
│   ├── medieval-base.ogg medieval-base.m4a
│   ├── medieval-tension.ogg …
│   ├── undead-base.ogg   undead-tension.ogg
│   └── alien-base.ogg    alien-tension.ogg
└── sfx/
    ├── correct/          chime, spark, coin, clap
    ├── key.ogg
    ├── monster-attack.ogg  monster-defeated.ogg
    └── game-over.ogg
```

El acierto va en su propia carpeta porque es un catálogo que va a crecer. El resto queda plano. No hay carpeta `wrong/`: el fallo no produce sonido.

Los efectos son compartidos entre temas y se diferencian con `detune` en Phaser (más agudo en el tema alienígena, más grave en el de zombies). Tres juegos completos de efectos triplicarían el peso a cambio de una diferencia que casi nadie notaría.

### Origen de las pistas

La música se toma de bibliotecas con licencia libre para uso comercial: Incompetech, Free Music Archive u OpenGameArt tienen material adecuado para los tres temas. Hay que verificar la licencia de cada pista y registrar la atribución requerida en un `CREDITS.md` del proyecto, aunque el juego no sea comercial.

---


## 10. Ranking

### Almacenamiento

El ranking vive en `data/scores.json` en la raíz del proyecto. Hay **seis tablas**: una por operación y nivel, con clave `operación:nivel`.

```json
{
  "version": 2,
  "boards": {
    "multiplicar:facil":   [ { "name": "Sofía", "correct": 47, "waves": 6, "date": "2026-09-06T14:22:10Z" } ],
    "multiplicar:normal":  [],
    "multiplicar:dificil": [],
    "dividir:facil":       [],
    "dividir:normal":      [],
    "dividir:dificil":     []
  }
}
```

```ts
interface ScoreEntry {
  name: string;      // máx. 12 caracteres, saneado
  correct: number;   // operaciones resueltas — criterio de orden
  waves: number;     // Pokémon derrotados
  date: string;      // ISO
}
```

### API

Tres rutas en Hono (`server/app.ts`):

```
GET  /api/health             → { ok: true }
GET  /api/leaderboard        → las 10 mejores de cada tabla
POST /api/scores             → { name, level, operation, correct, waves } → { entry, position, board }
```

**Escritura segura.** El archivo se escribe con patrón temporal + `rename`, que es atómico en el sistema de archivos: si el proceso muere a mitad de la escritura, `scores.json` queda intacto. Las escrituras pasan por una cola en memoria para que dos partidas que terminan al mismo tiempo no se pisen.

**Validación en el servidor.** El cliente no es confiable ni siquiera cuando el usuario tiene ocho años. El servidor recorta el nombre, verifica que `level` y `operation` sean válidos y que `correct` y `waves` sean enteros entre 0 y 10000.

### Reglas de ordenamiento

- Se ordena por `correct` descendente; en empate, gana la partida más antigua.
- Se conservan las 20 mejores por tabla en el archivo, se muestran las 10 primeras.
- La partida recién jugada se resalta en la tabla aunque no entre al top 10, con su posición real ("#17"). Una partida peor que las 20 conservadas queda en la posición 21.
- Las tablas son independientes: no tiene sentido comparar 40 aciertos en fácil con 12 en difícil, ni multiplicar con dividir.

### Si el servidor no responde

`ScoreRepository` es una interfaz con dos implementaciones: `HttpScoreRepository` (la normal) y `LocalScoreRepository` (respaldo en `localStorage`). `ScoreService` las combina: si el POST falla, la puntuación se guarda localmente y se encola; la pantalla de ranking avisa que está mostrando datos locales; al abrir el juego la próxima vez se reintenta el envío.

Sin esto, un niño que juega bien y pierde su puntaje por un problema de red no vuelve a jugar.

### Saneamiento del nombre

Recortar espacios, limitar longitud y, como es un juego para niños, sustituir por asteriscos una lista corta de palabras vetadas antes de guardar. El filtro va en el servidor (`server/badwords.ts`).

---

## 11. Estructura del proyecto

```
multiplicon/
├── data/
│   └── scores.json              ← ranking persistido (volumen en Dokploy)
├── server/
│   ├── index.ts                 arranque: puerto, DATA_DIR, DIST_DIR
│   ├── app.ts                   rutas /api y estáticos de dist/
│   ├── scoreStore.ts            lectura/escritura atómica con cola
│   ├── validation.ts            saneamiento y validación
│   └── badwords.ts
├── scripts/
│   └── fetch-trainers.mjs       descarga los sprites de líderes (una vez)
├── public/
│   └── assets/
│       ├── trainers/            sprites de líderes (versionados)
│       ├── gyms/                fondos, marcos y corazones por gimnasio (fase 4)
│       ├── shared/              numpad, efectos, iconos
│       ├── audio/
│       └── fonts/
├── src/
│   ├── main.ts                  configuración de Phaser
│   ├── types.ts
│   ├── config/
│   │   ├── difficulties.ts      niveles, curva de tiempo y vida del monstruo
│   │   ├── trainers.ts          líderes disponibles
│   │   ├── themes.ts            paletas, fuentes y rutas de assets por gimnasio (fase 4)
│   │   └── feedback.ts          catálogo de música, sonido de acierto y textos de fallo (fase 5)
│   ├── scenes/
│   │   ├── PreloadScene.ts
│   │   ├── TitleScene.ts
│   │   ├── NameScene.ts
│   │   ├── TrainerSelectScene.ts
│   │   ├── LevelSelectScene.ts
│   │   ├── BattleScene.ts
│   │   ├── ResultScene.ts
│   │   └── LeaderboardScene.ts
│   ├── systems/
│   │   ├── ProblemGenerator.ts  generación y validación de operaciones
│   │   ├── BattleState.ts       corazones, oleadas, aciertos, temporizador
│   │   ├── Preferences.ts       nombre y entrenador recordados
│   │   ├── pokemon/PokeApi.ts   nombre e ilustración con caché y fallback
│   │   ├── scores/              ScoreRepository, Http, Local, ScoreService
│   │   ├── AudioManager.ts      (fase 5)
│   │   └── FeedbackSettings.ts  (fase 5)
│   └── ui/
│       ├── HeroView.ts          sprite del líder y sus tweens
│       ├── MonsterView.ts       ilustración del Pokémon, nombre y vida
│       ├── Button.ts / keys.ts / style.ts
│       ├── NumPad.ts            (fase 4)
│       └── MissLabel.ts         (fase 4)
├── Dockerfile                   multi-etapa: build de Vite + tsc del servidor
├── vite.config.ts               proxy /api → localhost:8787 en desarrollo
└── package.json
```

`ProblemGenerator`, `BattleState`, `PokeApi`, los repositorios de ranking y todo `server/` no importan nada de Phaser. Así se prueban con Vitest sin levantar un canvas, que es donde está toda la lógica que realmente puede fallar.

### Deploy en Dokploy

Dockerfile multi-etapa: build de Vite y del servidor, luego imagen Node de producción que sirve `dist/` y la API. En Dokploy se monta un volumen en `/app/data` para que `scores.json` sobreviva a los redeploys.

**Antes del primer deploy:** verificar que el volumen esté montado. Sin él, cada redeploy borra el ranking completo y no hay forma de recuperarlo.

---

## 12. Fases de desarrollo

### Fase 1 — Núcleo jugable (sin arte) ✔
Proyecto Vite + Phaser + TS. `ProblemGenerator` con sus tres configuraciones y pruebas unitarias. `BattleScene` con rectángulos de color: operación, temporizador, corazones, entrada por teclado. El bucle completo funciona y se puede perder.

### Fase 2 — Estructura de partida ✔
Vidas del monstruo, oleadas sin límite, reducción de tiempo con su piso. Pantallas de título, nombre, selección de nivel y resultado. Historial de operaciones falladas.

### Fase 3 — Ranking, deploy y personajes Pokémon ✔
Servidor Hono con las rutas y escritura atómica. `ScoreRepository` con sus dos implementaciones y reintento de pendientes. Pantalla de ranking con pestañas por nivel y resaltado de la partida actual. Integración con PokéAPI: Pokémon aleatorio por oleada con nombre en español e ilustración precargada; galería de líderes de gimnasio como héroe. Dockerfile y primer deploy en Dokploy con el volumen.

*Conviene desplegar aquí y no al final: los problemas de volumen y rutas estáticas aparecen en el primer deploy, y es mejor encontrarlos cuando el proyecto todavía es simple.*

### Fase 4 — Operación, arte de gimnasios y teclado en pantalla
- **Elección de operación** en la pantalla de nivel: multiplicar o dividir. División exacta `(a·b) ÷ b` con el doble de tiempo por operación en todos los niveles (sección 4). `Problem.text` ya lo permite sin tocar `BattleScene`. El ranking usa las tablas `dividir:*` que ya existen.
- Producción de los SVG por gimnasio: fondos en tres capas, marcos de interfaz, corazones. Sistema de temas (`config/themes.ts`) aplicado a toda la interfaz. Tipografía Atkinson Hyperlegible con precarga.
- Teclado numérico en pantalla para tablet. Sacudidas, destellos, transiciones y `MissLabel` como componente.

### Fase 5 — Audio y pulido
`AudioManager` con precarga selectiva, capa de tensión y ducking. Catálogo en `config/feedback.ts` y `SettingsScene` con prueba de cada sonido y del texto de fallo. Selección y licenciamiento de las pistas y efectos, normalización de `gain`, y `CREDITS.md`. Verificación del arranque tras el primer clic en los cuatro navegadores.

Pruebas en tablet. Ajuste de tiempos y curva de dificultad con niños reales, y sesiones largas para confirmar que los loops aguantan veinte minutos sin cansar.

### Fase 6 — Publicación
Optimización de assets, `manifest.json` para instalación como app, dominio y HTTPS en Dokploy.

---

## 13. Detalles a cuidar

- **Escalado:** `Phaser.Scale.FIT` con resolución base 1280×720. En vertical (tablet en retrato), mostrar un aviso para girar el dispositivo en lugar de intentar un layout aparte.
- **Precarga de fuentes:** las tipografías web deben estar cargadas antes de que Phaser dibuje texto, o el primer frame sale con la fuente del sistema. Cargarlas en `BootScene` con la API `document.fonts`.
- **Pausa:** al perder foco de la pestaña, congelar el temporizador y silenciar el audio. Si no, el niño vuelve y encuentra tres corazones menos, y la música sigue sonando en una pestaña que ya no está mirando.
- **Partidas largas:** como no hay final, una sesión puede durar mucho. Verificar que no haya fugas de memoria por objetos de Phaser creados en cada oleada sin destruir. Es el riesgo técnico principal de un juego sin final.
- **Accesibilidad:** foco de teclado visible en todos los botones, respetar `prefers-reduced-motion` desactivando sacudidas y desplazamientos, contraste mínimo 4.5:1 en todo texto de interfaz. El aviso de fallo debe cumplir ese contraste en los tres temas, ya que es la única señal de error del juego.
- **Sin penalización acumulada:** el juego nunca debe castigar dos veces el mismo error. Fallar ya cuesta tiempo; no debe costar además puntos.

---

## 14. Versiones posteriores

Fuera del alcance de la v1, anotado para no cerrarle la puerta:

- **Dos jugadores en el mismo dispositivo.** Turnos alternados contra el mismo Pokémon, o marcadores separados en pantalla dividida. Afecta el modelo de partida y el ranking, así que conviene decidir la forma antes de empezarlo, no durante.
- **Sumas y restas.** `Problem` ya expone `text` y `answer`, y el ranking ya separa por operación, así que agregar un generador nuevo no obliga a tocar `BattleScene`.
- **Panel para docentes.** Ver el historial de operaciones falladas por niño y detectar qué tabla se le dificulta. Los datos ya se recogen durante la partida; falta persistirlos y mostrarlos.
- **Ranking por curso.** Separar los rankings con un identificador de grupo para que compitan solo entre compañeros.
- **Arte propio en lugar de Pokémon** si el juego se quisiera distribuir comercialmente: `HeroView` y `MonsterView` aceptan cualquier textura.
