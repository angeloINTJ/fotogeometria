# Changelog

[English](CHANGELOG.md) | **Português**

Todas as mudanças relevantes do FotoGeometria. Cada etapa do [plano](docs/PLANO.md) chega como um pull request e uma entrada em *Unreleased*, até a primeira versão.

## Unreleased

**Etapa 0 do plano: a estrutura do projeto, seus portões e o CI.**

- **O projeto.** Vite 8, TypeScript 6 em modo estrito, ESLint 10 com as regras com tipos do typescript-eslint, Prettier 3 e Vitest 5, todas as versões fixadas exatamente. O `npm run dev` serve uma página provisória no padrão Ângulo; o editor chega nas etapas 1 a 5.
- **A referência.** O Python validado, `reference/corrigir_geometria.py`, byte a byte (sha256 `754e5154…`, fixado por um teste). Com um ponto de fuga montado a partir de um pitch de 17,5° e um roll de 0,8°, ele reproduz a saída de referência do plano, 711×1016, sem a foto de referência.
- **Os portões, cada um com suas mutações em `tests/tools/`.** Uma varredura de segredos (arquivos de chave, material de chave privada, tokens de acesso, credenciais literais); o padrão Ângulo onde uma máquina consegue conferir (as cópias fixadas do simut-rx e o CSS do app: nenhuma cor literal, gradiente, sombra em cartão, raio fora dos três, distância fora da grade de 4 px ou tipo fora da escala; nenhum emoji; selos em flat-square); os avisos de terceiros, gerados de `tools/third-party.json`; e um orçamento exato de tamanho do build, que falha quando uma categoria cresce ou encolhe sem ser registrada.
- **O padrão de interface.** `src/styles/angulo.css`, a fonte de títulos e `docs/ANGULO.md` são cópias fixadas do simut-rx. O tema segue o aparelho desde a primeira pintura.
- **O repositório.** Licença MIT; README, CONTRIBUTING e Código de Conduta em inglês, português e espanhol; SECURITY; modelos de issue e de pull request; Dependabot para o npm e as GitHub Actions; um rotulador de pull requests por caminho; ganchos de pre-commit; e CI com um job por portão.
- **Testes.** 42 casos.
