# Changelog

[English](CHANGELOG.md) | **Português**

Todas as mudanças relevantes do FotoGeometria. Cada etapa do [plano](docs/PLANO.md) chega como um pull request e uma entrada em *Unreleased*, até a primeira versão.

## Unreleased

### Etapa 2: a reprojeção na GPU, e uma página que a mostra

- **O shader.** `src/gl/reproject.frag` e `src/gl/renderer.ts`: WebGL2, um triângulo sobre o alvo, a foto como textura com mipmaps e filtro trilinear (anisotrópico até 8x onde a GPU tem), alta precisão em tudo. Desenha no canvas para a prévia e num framebuffer lido de volta para os testes e, a partir da etapa 5, para a exportação; os dois são desenhados no mesmo sentido, então o canvas mostra byte a byte o que a leitura lê. Um contexto WebGL perdido é refeito e desenhado de novo (§6 do plano).
- **Nenhuma trigonometria na GPU.** As coordenadas no plano, a expansão vertical e a Panini inversa dependem só da coluna ou só da linha de saída, então o `src/core` as calcula em precisão dupla como duas tabelas (`outputColumn`, `outputRow` e `paniniColumn`, a metade de coluna da `paniniInverse`), e o shader só gira e divide. Calculada no shader, a trigonometria punha a origem amostrada a 0,139 px da referência no SwiftShader, cujos `sin` e `cos` as regras do Vulkan permitem errar 2⁻¹¹; com as tabelas, 0,00025 px no pior caso. A `paniniInverse` dá os mesmos bits de antes (sha256 de 133.352 saídas, antes e depois).
- **A página.** `src/ui/`: escolher uma foto e vê-la inteira, na resolução da tela, com a correção do caso de referência: pitch de 17,5°, roll de 0,8° e a focal da referência, 480 px numa diagonal de 1600 px (12,98 mm, `docs/DECISIONS.md`). A foto abre de pé, pela orientação EXIF, e é reduzida uma vez quando passa do que a GPU ou o iOS aceitam (`src/io/load-image.ts`). Em português, inglês ou espanhol, conforme o aparelho; todo estado desenhado, entre eles abrindo, arquivo que não é imagem e navegador sem WebGL2; no padrão Ângulo, nos dois temas.
- **A foto sintética.** O `scripts/generate_fixtures.py` também grava uma grade de fachada vista pela câmera do caso de referência (verticais vermelhas, horizontais azuis, verde constante) e a correção dela feita pela própria referência, e o `--check` compara as duas imagens exatamente.
- **Testes no navegador** (Playwright, `e2e/`, job novo `e2e` no CI), no SwiftShader: as posições de origem do shader contra as da referência nas amostras dela, nos quatro casos de paridade, e contra o `src/core` em todo pixel, inclusive 2.308 pixels atrás da câmera; as linhas da grade onde o OpenCV as desenha, a 0,028 e 0,038 px em média, onde meio pixel de erro mede 0,50; as verticais a 0,015° no pior caso (o plano pede 0,2°); o canvas igual à leitura; e o app abrindo uma foto, recusando um arquivo que não é imagem, avisando num navegador sem WebGL2, voltando depois de perder o contexto e falando três línguas. Onze defeitos postos no shader, nas tabelas e na leitura derrubam cada um de 2 a 13 dos 18; tirar o redesenho depois do contexto perdido, ou o novo envio da foto, derruba o teste do contexto.
- **CI.** O timeout do job `fixtures` desce para 5 minutos, medido (15 s); o job novo `e2e` fica provisório em 10.
- **Testes.** 216 casos unitários e 18 no navegador.

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
