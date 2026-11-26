# Cómo contribuir a FotoGeometria

[English](CONTRIBUTING.md) | [Português](CONTRIBUTING.pt-BR.md) | **Español**

Gracias por tu interés. FotoGeometria es una app web que corrige, en el propio dispositivo, la geometría de fotos de gran angular: verticales convergentes y bordes estirados. Aquí tienes cómo ayudar, y lo que un cambio debe demostrar antes de integrarse.

## Antes de empezar

- **Abre primero una issue** para cualquier cosa mayor que una errata, para acordar el cambio antes de que lo escribas.
- Lee la [Política de Seguridad](SECURITY.md) (en inglés) si el cambio toca cómo se leen los archivos, qué puede cargar la página o la publicación.
- El plan que sigue el proyecto es [docs/PLANO.md](docs/PLANO.md) (en portugués), y [docs/DECISIONS.md](docs/DECISIONS.md) (en inglés) registra dónde se aparta el código de él, y por qué.

## Preparar el entorno

Necesitas Node.js 22.13 o posterior (`.nvmrc` dice 22) y npm.

```bash
git clone https://github.com/angeloINTJ/fotogeometria.git
cd fotogeometria
npm ci
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Sirve la app con recarga automática en `http://localhost:5173/fotogeometria/` |
| `npm test` | Ejecuta las pruebas unitarias (Vitest) |
| `npm run lint` | ESLint y después Prettier en modo de comprobación |
| `npm run typecheck` | El compilador de TypeScript, en modo estricto, sin generar archivos |
| `npm run build` | Construye la app en `dist/` |
| `npm run budget` | Compara `dist/` con los tamaños de `tools/budget.json` (ejecútalo tras el build) |
| `npm run gates` | Las puertas del repositorio: secretos, el estándar Ângulo, los avisos de terceros |
| `npm run format` | Reescribe el código en el formato de Prettier |

### Ganchos de pre-commit

```bash
pip install pre-commit
pre-commit install
```

Ejecutan las comprobaciones de espacios en blanco, de YAML y de JSON y las puertas rápidas, para que encuentres el problema en el segundo que tarda el commit, y no en los minutos que tarda la CI en responder. Las pruebas y el build quedan fuera a propósito: un gancho que tarda minutos es un gancho que la gente desactiva.

## Las comprobaciones que debe pasar un pull request

`main` está protegida: todo cambio llega por pull request, y la CI debe pasar en él. La CI ejecuta los mismos comandos de arriba, así que ejecútalos antes del push:

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run budget && npm run gates
```

- **El presupuesto es exacto.** `tools/budget.json` registra los bytes del build por categoría, y cualquier diferencia falla, también hacia abajo: un presupuesto que solo sube deja de medir. Cuando tu cambio mueve un tamaño, regístralo con `node tools/check-budget.mjs --write` y explica el motivo en el commit.
- **Los avisos de terceros se generan.** Una dependencia nueva en tiempo de ejecución necesita una entrada en `tools/third-party.json` y el texto de su licencia en `LICENSES/`, sin cambios; después, `npm run notices` reescribe `THIRD_PARTY_NOTICES.md`.
- **Un archivo generado nunca se edita a mano.** Cambia la fuente y vuelve a generarlo.

## Primero las pruebas

- Antes de implementar una funcionalidad, una función o un refactor, describe las pruebas que lo van a demostrar. Al terminar, ejecútalas y pon el resultado en el pull request.
- Un refactor se demuestra con el comportamiento sin cambios; una corrección, con una reproducción que falla antes y pasa después; el comportamiento nuevo que se puede ejercitar automáticamente gana un caso de prueba.
- Una prueba solo vale si muerde: necesita un control negativo, una ejecución en la que se deshace la corrección y la prueba falla. Una comprobación nueva se demuestra por mutación: reintroducir la violación da exactamente un hallazgo.
- Las matemáticas de `src/core/` quedan sujetas al Python validado de `reference/` por pruebas de paridad. Una diferencia numérica con la referencia es un error o una decisión, y una decisión se justifica en el código y queda cubierta por una prueba.

## Convenciones de código

- TypeScript en modo estricto, formateado por Prettier y comprobado por ESLint.
- Toda función exportada tiene un comentario de documentación (TSDoc).
- Los comentarios explican el **porqué** y llevan la medición que decidió la cuestión, con su fecha. Un comentario que ya no coincide con el código es un defecto, no ruido.
- `src/core/` son matemáticas puras: sin DOM, sin WebGL, sin efectos secundarios. ESLint rechaza un import de las carpetas que tratan con el navegador, y el compilador comprueba la carpeta sin los tipos del DOM.
- Los identificadores, los comentarios, los mensajes de commit y los pull requests se escriben en inglés.

## El estándar de interfaz

Todo lo que tiene pantalla o lector sigue el Ângulo, en [docs/ANGULO.md](docs/ANGULO.md) (en portugués): un color de acento, dos familias tipográficas, línea antes que sombra, dos radios y el círculo, una rejilla de 4 px, un solo conjunto de iconos, microcopy que dice lo que hace y todos los estados dibujados. Los valores vienen de los tokens de `src/styles/angulo.css`, que es una copia fijada y nunca se edita. `tools/check-angulo.mjs` comprueba lo que puede una máquina; la lista de su §8 es para ti, en los dos temas.

La interfaz está en portugués de Brasil, inglés y español. Un texto nuevo necesita los tres.

## Mensajes de commit

[Conventional Commits](https://www.conventionalcommits.org/es/): `tipo(ámbito): resumen`, con `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci` o `chore`. Si el cambio dice ser más rápido, más pequeño o una corrección, el número o la reproducción va en el mensaje.

## Pull requests

- Rellena la plantilla: el porqué, lo que cambia y la prueba (los comandos que ejecutaste y lo que imprimieron).
- Actualiza los documentos que tu cambio deja incorrectos, en todos los idiomas en que existen: los README (tres), CONTRIBUTING (tres) y el CHANGELOG (dos). Añade una línea en *Unreleased* en los dos changelogs.
- Un pull request trata de un solo asunto.

## Imágenes y privacidad

El repositorio es público. Las imágenes de prueba deben ser sintéticas o de licencia libre, y no pueden mostrar personas identificables. Nunca subas una foto personal: Git ignora la carpeta `local-photos/`, para las fotos que compruebas a mano.

## Licencia

Al contribuir, aceptas que tu contribución queda bajo la [Licencia MIT](LICENSE).
