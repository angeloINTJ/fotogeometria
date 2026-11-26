# Changelog

[English](CHANGELOG.md) | **Português**

Todas as mudanças relevantes do FotoGeometria. Cada etapa do [plano](docs/PLANO.md) chega como um pull request e uma entrada em *Unreleased*, até a primeira versão.

## Unreleased

### Etapa 1: a matemática da correção (`src/core/`), presa à referência

- **Os módulos.** `linalg` (vetores, matrizes 3x3, Rodrigues como o OpenCV calcula e o menor vetor singular por Jacobi unilateral), `camera` (a focal a partir do equivalente de 35 mm, as predefinições de lente, os raios), `panini` (a projeção nos dois sentidos e a compressão vertical), `leveling` (a rotação a partir do ponto de fuga, a força, o ajuste fino), `framing` (o enquadramento de saída, o pixel de origem de cada pixel de saída, a máscara de validade) e `correction` (os parâmetros do §5 do plano e a única função que os transforma em projeção).
- **Paridade com a referência.** O `scripts/generate_fixtures.py` roda as próprias funções da referência em quatro casos (entre eles o caso de referência do plano) e grava `tests/fixtures/parity.json`: a rotação, o enquadramento, as coordenadas de origem de uma grade de 21 x 21 pixels de saída, a contagem de pixels válidos e os retângulos de corte. O TypeScript bate a rotação a 10⁻¹², o enquadramento a 10⁻¹², cada coordenada amostrada a 10⁻⁶ px (o plano pede 10⁻² px) e a contagem de pixels válidos exatamente, 1.054.636 deles no caso de referência. O CI gera os fixtures de novo com Python 3.12 e o NumPy e o OpenCV fixados, e compara (job novo `fixtures`).
- **As verticais ficam verticais.** Linhas de uma fachada sintética, vistas por uma câmera de pitch e roll conhecidos e corrigidas, ficam a menos de 0,2° da vertical (§7 do plano); sem o nivelamento ficam a mais de 5°, o que mostra que a checagem morde.
- **A regra de arquitetura, as duas metades.** O ESLint recusa em `src/core/` um import de `gl/`, `ui/`, `io/` ou `detect/`, e o `tsconfig.core.json` compila `src/core/` sem os tipos do DOM; o `tests/architecture.test.ts` reintroduz cada violação e espera exatamente um achado.
- **Mutações.** Cinco defeitos postos à mão no núcleo (a latitude da Panini, o sinal do vetor para baixo, o centro óptico, a escala de Rodrigues, o centro do pixel) derrubam cada um de 1 a 16 testes.
- **Timeouts do CI** de 5 minutos, o dobro do job mais longo das primeiras execuções (14 s) arredondado para cima, menos o novo job `fixtures`, provisório em 10.
- **Testes.** 183 casos.

### Etapa 0: a estrutura do projeto, seus portões e o CI

- **O projeto.** Vite 8, TypeScript 6 em modo estrito, ESLint 10 com as regras com tipos do typescript-eslint, Prettier 3 e Vitest 5, todas as versões fixadas exatamente. O `npm run dev` serve uma página provisória no padrão Ângulo; o editor chega nas etapas 1 a 5.
- **A referência.** O Python validado, `reference/corrigir_geometria.py`, byte a byte (sha256 `754e5154…`, fixado por um teste). Com um ponto de fuga montado a partir de um pitch de 17,5° e um roll de 0,8°, ele reproduz a saída de referência do plano, 711×1016, sem a foto de referência.
- **Os portões, cada um com suas mutações em `tests/tools/`.** Uma varredura de segredos (arquivos de chave, material de chave privada, tokens de acesso, credenciais literais); o padrão Ângulo onde uma máquina consegue conferir (as cópias fixadas do simut-rx e o CSS do app: nenhuma cor literal, gradiente, sombra em cartão, raio fora dos três, distância fora da grade de 4 px ou tipo fora da escala; nenhum emoji; selos em flat-square); os avisos de terceiros, gerados de `tools/third-party.json`; e um orçamento exato de tamanho do build, que falha quando uma categoria cresce ou encolhe sem ser registrada.
- **O padrão de interface.** `src/styles/angulo.css`, a fonte de títulos e `docs/ANGULO.md` são cópias fixadas do simut-rx. O tema segue o aparelho desde a primeira pintura.
- **O repositório.** Licença MIT; README, CONTRIBUTING e Código de Conduta em inglês, português e espanhol; SECURITY; modelos de issue e de pull request; Dependabot para o npm e as GitHub Actions; um rotulador de pull requests por caminho; ganchos de pre-commit; e CI com um job por portão.
- **Testes.** 42 casos.
