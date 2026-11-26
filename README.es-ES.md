# FotoGeometria

> Corrige la geometría de fotos de gran angular, en el navegador: verticales convergentes y personas estiradas en los bordes. Tus fotos no salen del dispositivo.

[English](README.md) | [Português](README.pt-BR.md) | **Español**

[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-1f6355?style=flat-square&labelColor=5f5b54)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/angeloINTJ/fotogeometria/ci.yml?branch=main&label=CI&style=flat-square&labelColor=5f5b54)](https://github.com/angeloINTJ/fotogeometria/actions/workflows/ci.yml)
[![Plataforma: PWA](https://img.shields.io/badge/Plataforma-PWA-1f6355?style=flat-square&labelColor=5f5b54)](https://web.dev/explore/progressive-web-apps)
[![Contribuciones bienvenidas](https://img.shields.io/badge/Contribuciones-bienvenidas-1f6355?style=flat-square&labelColor=5f5b54)](CONTRIBUTING.es-ES.md)

## Descripción

La cámara ultra gran angular del móvil mete el edificio entero o el grupo entero en el encuadre, y lo cobra dos veces: con la cámara inclinada hacia arriba, las paredes se inclinan hacia dentro, y quien está cerca de los bordes sale más ancho de lo que es. FotoGeometria corrige las dos cosas, en el propio móvil, con la foto que ya hiciste.

- **Nivela la cámara.** Encuentra el punto de fuga vertical de la escena, a partir de las líneas de la foto o de dos líneas que trazas tú, y convierte la imagen en la que habría hecho una cámara nivelada.
- **Relaja los bordes.** La proyección Panini mantiene rectas las verticales mientras deshace el estiramiento horizontal de los bordes, y una compresión vertical suave hace lo mismo arriba y abajo.
- **Recorta lo que sobra.** El mayor rectángulo sin esquinas vacías, en la proporción que elijas, prefiriendo la posición más alta para no cortar cabezas.

Cada paso es un control deslizante, del automático al apagado.

## Estado del proyecto

| | |
|---|---|
| **Etapa** | 0 de 8 del [plan](docs/PLANO.md): la estructura del proyecto, sus puertas de calidad y la CI. El editor llega en las etapas 1 a 5. |
| **Pruebas** | 42 pruebas unitarias (`npm test`) de las puertas del propio repositorio y de la fijación de la referencia, ejecutadas en cada pull request. |

## Privacidad

No hay servidor. La app es una página estática; la foto se decodifica, se corrige y se exporta dentro de tu navegador, en tu GPU. No se sube nada, no se recoge nada y no hay telemetría. El JPEG exportado no lleva metadatos, así que la ubicación que grabó la cámara no sale con él.

## Ejecutarlo en local

Node.js 22.13 o posterior:

```bash
git clone https://github.com/angeloINTJ/fotogeometria.git
cd fotogeometria
npm ci
npm run dev        # http://localhost:5173/fotogeometria/
```

`npm test` ejecuta las pruebas unitarias, `npm run lint` y `npm run typecheck` las comprobaciones estáticas, y `npm run gates` las puertas del repositorio. [CONTRIBUTING.es-ES.md](CONTRIBUTING.es-ES.md) tiene el resto.

## Cómo funciona

El algoritmo es la adaptación de un script de Python validado, guardado en [reference/](reference/corrigir_geometria.py), y el TypeScript queda sujeto a él por pruebas de paridad de 0,01 px. El §3 del [plan](docs/PLANO.md) (en portugués) tiene todas las fórmulas: el modelo de cámara, el punto de fuga, la rotación de nivelación, la proyección Panini, la compresión vertical, la reproyección que la GPU hace por píxel y el recorte automático.

## Documentación

| | |
|---|---|
| [docs/README.md](docs/README.md) | Todos los documentos, marcados Living o Snapshot (en inglés) |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Las decisiones que el plan dejó abiertas, y dónde el código se aparta del plan (en inglés) |
| [CONTRIBUTING.es-ES.md](CONTRIBUTING.es-ES.md) | Preparar el entorno, las comprobaciones que debe pasar un pull request y las convenciones |
| [SECURITY.md](SECURITY.md) | Qué protege la app y cómo informar de una vulnerabilidad (en inglés) |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | Lo que la app lleva y escribieron terceros (en inglés) |

## Cómo contribuir

Las issues y los pull requests son bienvenidos, en inglés, portugués o español. Lee antes [CONTRIBUTING.es-ES.md](CONTRIBUTING.es-ES.md) y el [Código de Conducta](CODE_OF_CONDUCT.es-ES.md). El repositorio es público: las imágenes de prueba deben ser sintéticas o de licencia libre, y no pueden mostrar personas identificables.

## Licencia

[MIT](LICENSE). La fuente de los títulos, Bricolage Grotesque, está bajo la SIL Open Font License 1.1; [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) enumera cada componente de terceros y su licencia.
