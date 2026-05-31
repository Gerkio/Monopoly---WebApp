# Monopoly — Web App

Un Monopoly completo, jugable en cualquier navegador moderno, sin instalar nada.
HTML + CSS + JavaScript vanilla. **Cero dependencias** (ni build, ni jQuery, ni nada).

> Abre `index.html` en un navegador y juega. Eso es todo.

---

## Características

### 🎲 Jugabilidad

- **2 a 8 jugadores**, mezclando humanos y bots (3 niveles de IA: Fácil, Normal, Difícil)
- **Nombres humorísticos aleatorios para la IA**, localizados (20 ES + 20 EN, sin colisiones — ej. *Armando Bronca Segura*, *Justin Case*)
- **Dos ediciones** de tablero, intercambiables al vuelo:
  - **Classic** — Mediterranean, Boardwalk, Pennsylvania Railroad, Water Works…
  - **New York City** — Madison Square Garden, Empire State Building, Macy's, Lincoln Tunnel…
- **Reglas de la casa** opcionales en la pantalla de setup:
  - 🅿️ Bote de Free Parking (impuestos + multas se acumulan)
  - 🎲 Bonus de "snake eyes" ($500 por sacar doble 1)
  - 💰 Double GO ($400 si caes exacto en SALIDA)
  - 🔇 Sin subastas
  - ⚡ Modo rápido (animaciones 2× más rápidas)
- **Avatares físicos**: 8 fichas distintas (sombrero, auto, perro, barco, zapato, dedal, plancha, tren)
- **Subastas** completas cuando un jugador no compra una propiedad
- **Flujo de dobles correcto**: al caer en propiedad libre, el segundo tiro queda bloqueado hasta resolver compra o subasta (regla de mesa)
- **Tradeo** entre jugadores: dinero + propiedades + cartas de "Salir de la cárcel"
  - **Negociaciones IA↔IA totalmente automáticas** — el humano nunca ve el panel de trade cuando ambas partes son bots
- **Hipoteca / deshipoteca** con interés del 10%
- **Bancarrota inteligente**: cuando una IA hereda propiedades hipotecadas, decide sola si las deshipoteca (heurística: ≥2 del grupo + reserva de $200)
- **Construcción regla pareja**: no puedes poner una casa sin tener al menos una en cada propiedad del grupo

### 🎨 Interfaz

- **Modo claro / oscuro / auto** (sigue al sistema o se fuerza) — botón en el topbar
- **Cartas Chance / Caja de Comunidad gigantes** estilo papel cream, legibles desde cualquier asiento
- **Anillo SVG contador** en cada notificación: se auto-acepta a los 10 s si nadie pulsa
- **Auto-tirada de dados** a los 20 s de inactividad (badge contador encima del botón; cualquier interacción cancela)
- **Tipografía grande** (18 px / 22 px en titulares) para sesiones de mesa con varios espectadores
- **Tablero 3D con feltro verde**, propiedades coloreadas, esquinas decoradas, cartas Chance/CC apiladas en el centro
- **Tarjetas de propiedad al hover** sin parpadeo (`pointer-events: none` en el tooltip)
- **Animaciones compositor-friendly** (transform + opacity), sin jank en rolls / movimientos / popups
- **Dos idiomas**: español 🇪🇸 + inglés 🇬🇧 con pluralización

### 🔊 Audio

- Música de fondo distinta para Classic y NYC (loop suave con fade in/out)
- Sonido de dados real al tirar
- Sirena de policía cuando un jugador va a la cárcel
- SFX sintetizados como fallback (Web Audio API)
- Botón mute persiste preferencia en `localStorage`

### ♿ Accesibilidad

- Roles ARIA + `aria-label` traducidos en todos los controles
- Atajos de teclado para todas las acciones principales
- Restauración de foco tras cerrar popups
- Focus-trap en el overlay de victoria
- Modo `prefers-reduced-motion` desactiva animaciones decorativas

### 🛡️ Seguridad

- Content Security Policy (`<meta>` CSP)
- HTML escape automático en interpolaciones de strings traducidos (previene XSS por nombre de jugador)
- Validación defensiva de `localStorage` (resistente a JSON corrupto)

---

## Cómo jugar

```text
1. Clona o descarga el repo.
2. Abre index.html en cualquier navegador moderno.
3. Configura jugadores, elige edición y reglas, pulsa "Empezar partida".
```

No hay servidor, npm install, ni paso de build. Si lo abres directo con `file://` funciona; si prefieres servirlo, cualquier servidor estático sirve:

```bash
# Python 3
python -m http.server 8000

# Node (sin dependencias)
npx http-server -p 8000

# Solo abrir el archivo
start index.html        # Windows
open  index.html        # macOS
xdg-open index.html     # Linux
```

### Atajos de teclado

| Tecla               | Acción                                           |
| ------------------- | ------------------------------------------------ |
| `Espacio` / `Enter` | Tirar dados / Empezar partida / Acción primaria  |
| `B`                 | Pestaña Comprar                                  |
| `M`                 | Pestaña Gestionar                                |
| `T`                 | Pestaña Intercambiar                             |
| `S`                 | Abrir stats                                      |
| `?`                 | Abrir ayuda                                      |
| `Esc`               | Cerrar modal abierto                             |

### Selección de edición

- Desde el setup: usa el selector "Edición del tablero"
- Por URL: `index.html?edition=nyc` o `?edition=classic`
- La elección se persiste en `localStorage('monopoly:edition')`

### Ajustes en tiempo de ejecución (DevTools console)

```js
// Desactivar auto-roll (default: 20000 ms)
window.__AUTO_ROLL_MS = 0;

// Auto-roll en 10 segundos
window.__AUTO_ROLL_MS = 10000;
```

---

## Estructura del proyecto

```text
.
├── index.html                  ← entry point único
├── styles.css                  ← todos los estilos + tokens de tema + dark mode (~5600 líneas)
├── manifest.webmanifest        ← PWA manifest (instalable)
├── sw.js                       ← service worker (cache-first, offline-ready)
│
│  ── Motor de juego (split en Sprint 5) ──
├── engine.js                   ← Game ctor + estado + dados + flujo de turno (~1400 líneas)
├── players.js                  ← clase Player + tokens (~100 líneas)
├── animations.js               ← walk, dice 3D, shake, zoom, confetti, splash (~1850 líneas)
├── render.js                   ← board paint + money bar + property cards (~1000 líneas)
├── monopoly.js                 ← shell delgado + boot sequence + UI handlers (~2600 líneas)
│
│  ── IA y assets ──
├── ai.js                       ← bots AIEasy / AINormal / AIHard / AIAdaptive (IIFE)
├── ai-worker.js                ← Web Worker para evaluación de trades (off-main-thread)
├── ui.js                       ← Sound, toasts, modal/keyboard helpers (vanilla DOM)
├── i18n.js                     ← diccionario EN/ES + t() + tn() + escape()
├── edition-common.js           ← Square / Card / utiltext compartidos
├── classicedition.js           ← datos del tablero clásico
├── newyorkcityedition.js       ← datos del tablero NYC
│
├── tools/                      ← harness de smoke tests headless (CDP)
│   ├── cdp.js
│   ├── harness.js
│   ├── run-tests.{sh,bat}
│   └── tests/                  ← 5 tests independientes
├── audio/
│   ├── music-classic.mp3       ← música de fondo Classic (96 kbps VBR)
│   ├── music-nyc.mp3           ← música de fondo NYC
│   ├── sfx-dice.mp3            ← sonido de dados (mono 80 kbps)
│   ├── sfx-siren.mp3           ← sirena de policía
│   └── originals/              ← fuentes WAV/MP3 sin comprimir (para re-encodes)
└── images/                     ← iconos de board, avatares, dice faces, etc.
```

---

## Stack técnico

- **HTML5** semántico + `<!DOCTYPE html>` + meta CSP + Web App Manifest (PWA instalable)
- **CSS** vanilla con custom properties (`:root`) — un solo archivo de ~5600 líneas
  - Sistema de temas con tokens (`--surface`, `--ink`, `--accent`, `--ledger-bg-start`…)
  - `@media (prefers-color-scheme: dark)` + clases `.theme-light` / `.theme-dark` para forzar
- **JavaScript** ES5-compatible (sin Babel ni transpilador) — **100% vanilla DOM, sin jQuery**
  - **5 módulos de motor**: `engine.js` + `players.js` + `animations.js` + `render.js` + `monopoly.js`
  - **Web Worker** (`ai-worker.js`) para no bloquear el hilo principal en evaluación de trades de IA
  - **Service Worker** (`sw.js`) cache-first para funcionar offline tras la primera carga
- **Web Audio API** + HTMLAudioElement para SFX y música
- **Cache busting** vía `?v=YYYYMMDDx` en los `<script>`/`<link>` para invalidar tras releases

Sin build tools, sin npm install, sin transpilation, sin bundler.
Funciona offline una vez cargado (PWA).

---

## Testing

Smoke tests headless contra el `index.html` real, vía Chrome DevTools Protocol —
también **sin npm**. Requiere Edge o Chrome instalado y Node ≥ 22.

```bash
# Windows
tools\run-tests.bat

# Linux / macOS / WSL
bash tools/run-tests.sh
```

Cubre: arranque del juego, ciclo de roll determinista, compra/subasta, bancarrota,
y verificación del contrato de las 4 IAs (Easy/Normal/Hard/Adaptive).
Cada test es independiente: `node tools/tests/01-setup-to-game.js` etc.

---

## Compatibilidad

Probado en Edge / Chrome / Firefox modernos. iOS Safari requiere primer gesto del usuario antes de reproducir audio (manejado automáticamente). El layout escala via `fitStage()` a viewport landscape o portrait (rota 90° en mobile vertical).

---

## Sprint roadmap completion

Los 7 sprints del roadmap de mejora profunda están **completos y mergeados a main**:

| # | Sprint                                              | Estado | Highlight                                              |
|---|-----------------------------------------------------|--------|--------------------------------------------------------|
| 1 | Money rolling + turn glow + dice pulse + haptics    | OK     | Microinteracciones que dan vida al tablero             |
| 2 | Token bounce + screen shake + camera zoom + flip 3D | OK     | Feedback físico en cada movimiento y carta             |
| 3 | Splash screen + Monopoly confetti                   | OK     | Cinemática de arranque y celebración de victoria       |
| 4 | PWA (manifest + service worker)                     | OK     | Instalable, funciona offline tras primera carga        |
| 5 | Split de `monopoly.js` en 5 módulos                 | OK     | `engine` + `players` + `animations` + `render` + shell |
| 6 | Drop jQuery 1.11 → vanilla DOM                      | OK     | -30 KB de dependencias, cero librerías externas        |
| 7 | AI Worker (off-main-thread)                         | OK     | Evaluación de trades de IA en `ai-worker.js`           |

Los **5 smoke tests** (`tools/run-tests.sh`) pasan en verde tras cada sprint.

---

## Roadmap (ideas futuras)

- Multiplayer online (WebRTC peer-to-peer, sin servidor)
- Más ediciones de tablero (Madrid, Barcelona, etc.)
- Persistencia de partida en `localStorage` para reanudar

---

## Créditos

Fork de [intrepidcoder/monopoly](https://github.com/intrepidcoder/monopoly) — el motor base del juego es suyo.
Las extensiones (NYC edition, i18n, dark mode, audio real, anillos contadores,
auto-roll, IA Hard, refactor estructural, tests automatizados) son de este fork.

## Licencia

Mismo licenciamiento que el upstream — ver `LICENSE`.
