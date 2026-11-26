# FotoGeometria

> Corrige a geometria de fotos de grande angular, no navegador: verticais convergentes e pessoas esticadas nas bordas. Suas fotos não saem do aparelho.

[English](README.md) | **Português** | [Español](README.es-ES.md)

[![Licença: MIT](https://img.shields.io/badge/Licen%C3%A7a-MIT-1f6355?style=flat-square&labelColor=5f5b54)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/angeloINTJ/fotogeometria/ci.yml?branch=main&label=CI&style=flat-square&labelColor=5f5b54)](https://github.com/angeloINTJ/fotogeometria/actions/workflows/ci.yml)
[![Plataforma: PWA](https://img.shields.io/badge/Plataforma-PWA-1f6355?style=flat-square&labelColor=5f5b54)](https://web.dev/explore/progressive-web-apps)
[![Contribuições bem-vindas](https://img.shields.io/badge/Contribui%C3%A7%C3%B5es-bem--vindas-1f6355?style=flat-square&labelColor=5f5b54)](CONTRIBUTING.pt-BR.md)

## Visão geral

A câmera ultra-wide do celular põe o prédio inteiro ou o grupo inteiro no quadro, e cobra duas vezes por isso: com a câmera inclinada para cima, as paredes tombam para dentro, e quem está perto das bordas sai mais largo do que é. O FotoGeometria corrige as duas coisas, no próprio celular, com a foto que você já tirou.

- **Nivela a câmera.** Acha o ponto de fuga vertical da cena, pelas linhas da foto ou por duas linhas que você traça, e transforma a imagem na que uma câmera nivelada teria feito.
- **Alivia as bordas.** A projeção Panini mantém as verticais retas enquanto desfaz o esticamento horizontal das bordas, e uma compressão vertical suave faz o mesmo no topo e na base.
- **Corta o que sobra.** O maior retângulo sem canto vazio, na proporção que você escolher, preferindo a posição mais alta para não cortar cabeças.

Cada etapa é um deslizador, do automático ao desligado.

## Situação do projeto

| | |
|---|---|
| **Etapa** | 0 de 8 do [plano](docs/PLANO.md): a estrutura do projeto, seus portões e o CI. O editor chega nas etapas 1 a 5. |
| **Testes** | 42 testes unitários (`npm test`) dos portões do próprio repositório e da fixação da referência, rodados em todo pull request. |

## Privacidade

Não há servidor. O app é uma página estática; a foto é decodificada, corrigida e exportada dentro do seu navegador, na sua GPU. Nada é enviado, nada é coletado e não há telemetria. O JPEG exportado não leva metadados, então a localização que a câmera gravou não sai junto.

## Como rodar localmente

Node.js 22.13 ou mais novo:

```bash
git clone https://github.com/angeloINTJ/fotogeometria.git
cd fotogeometria
npm ci
npm run dev        # http://localhost:5173/fotogeometria/
```

`npm test` roda os testes unitários, `npm run lint` e `npm run typecheck` as verificações estáticas, e `npm run gates` os portões do repositório. O [CONTRIBUTING.pt-BR.md](CONTRIBUTING.pt-BR.md) tem o resto.

## Como funciona

O algoritmo é o porte de um script Python validado, guardado em [reference/](reference/corrigir_geometria.py), e o TypeScript fica preso a ele por testes de paridade de 0,01 px. O §3 do [plano](docs/PLANO.md) tem todas as fórmulas: o modelo de câmera, o ponto de fuga, a rotação de nivelamento, a projeção Panini, a compressão vertical, a reprojeção que a GPU faz por pixel e o corte automático.

## Documentação

| | |
|---|---|
| [docs/README.md](docs/README.md) | Todos os documentos, marcados Living ou Snapshot |
| [docs/DECISIONS.md](docs/DECISIONS.md) | As decisões que o plano deixou em aberto, e onde o código se afasta do plano |
| [CONTRIBUTING.pt-BR.md](CONTRIBUTING.pt-BR.md) | Preparar o ambiente, as verificações que um pull request precisa passar e as convenções |
| [SECURITY.md](SECURITY.md) | O que o app protege e como relatar uma vulnerabilidade (em inglês) |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | O que o app carrega e que foi escrito por terceiros (em inglês) |

## Como contribuir

Issues e pull requests são bem-vindos, em inglês, português ou espanhol. Leia antes o [CONTRIBUTING.pt-BR.md](CONTRIBUTING.pt-BR.md) e o [Código de Conduta](CODE_OF_CONDUCT.pt-BR.md). O repositório é público: imagens de teste precisam ser sintéticas ou de licença livre, e não podem mostrar pessoas identificáveis.

## Licença

[MIT](LICENSE). A fonte de títulos, Bricolage Grotesque, é da SIL Open Font License 1.1; o [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) lista cada componente de terceiros e sua licença.
