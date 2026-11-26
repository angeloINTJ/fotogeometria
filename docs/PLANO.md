# Plano de implementação — app de correção de geometria para fotos grande angular

> Documento de planejamento para implementação com Claude Code.
> Referência do algoritmo: `reference/corrigir_geometria.py` (script Python já validado).

## 1. Visão geral

**Objetivo:** app para celular que corrige, de forma configurável, a geometria de fotos
feitas com lente grande angular: verticais convergentes (câmera inclinada) e
esticamento de pessoas e objetos nas bordas.

**Formato:** app web instalável (PWA), 100% no navegador, sem servidor.

**Princípios**

- **Privacidade:** nenhuma foto sai do aparelho. Todo o processamento é local.
- **Tempo real:** a prévia responde aos controles sem atraso perceptível (GPU).
- **Automático com ajuste manual:** o app propõe a correção e o usuário refina.
- **Código aberto:** repositório público, licença MIT.

**Fora do escopo da v1:** vídeo, edição de cor, processamento em lote, RAW,
correção de distorção de barril por perfil de lente, lojas de aplicativos.

## 2. Decisões técnicas

| Tema | Decisão | Motivo |
|---|---|---|
| Plataforma | PWA | Um código para Android e iOS, sem loja |
| Linguagem | TypeScript (modo `strict`) | Tipagem para a matemática de matrizes |
| Build | Vite | Simples, rápido, bom suporte a PWA |
| Interface | TypeScript + DOM, sem framework | A tela é pequena; evita dependências |
| Reprojeção | WebGL2, fragment shader | Prévia em tempo real e exportação rápida |
| Detecção de linhas | OpenCV.js em Web Worker, carregado sob demanda | Só é necessário no modo automático; o arquivo é grande |
| EXIF | `exifr` | Ler distância focal e orientação |
| PWA | `vite-plugin-pwa` | Manifesto e service worker (uso offline) |
| Testes | Vitest (unitário) + Playwright (fumaça) | Validar a matemática contra o Python |
| Hospedagem | GitHub Pages via GitHub Actions | Gratuito, integrado ao repositório |
| Licença | MIT | Permissiva; compatível com OpenCV (Apache 2.0) |

**Decisões em aberto (definir no início)**

1. Nome do projeto e do repositório.
2. Idioma do código e da documentação pública. Sugestão: identificadores e README
   em inglês (alcance do projeto público), com README.pt-BR.md e comentários
   detalhados em todo o código.
3. Idioma da interface: português, com estrutura pronta para tradução.

## 3. Algoritmo (especificação para o porte)

Todas as fórmulas abaixo estão implementadas e validadas no script de referência.

### 3.1 Modelo de câmera

- Imagem de entrada assumida **retilínea** (o celular já corrige o barril da ultra-wide).
- Centro óptico no centro da imagem: `cx = (W-1)/2`, `cy = (H-1)/2`.
- Distância focal em pixels: `f = f35 / 43,27 * diagonal_px`, onde `f35` é a
  distância focal equivalente a 35 mm.
- Raio de um pixel: `r = ((x-cx)/f, (y-cy)/f, 1)`.

**Origem de `f35`, em ordem de prioridade**

1. EXIF `FocalLengthIn35mmFormat`.
2. Predefinição escolhida pelo usuário: 0,5x ≈ 13 mm, 1x ≈ 24 mm, 2x ≈ 48 mm.
3. Padrão: 13 mm (equivale a `f ≈ 0,30 * diagonal_px`).

Fotos recebidas por aplicativos de mensagem normalmente chegam sem EXIF, então o
controle manual de focal é obrigatório.

### 3.2 Ponto de fuga vertical

**Modo automático**

1. Converter para tons de cinza e reduzir para no máximo ~1280 px no lado maior.
2. Detectar segmentos de reta (LSD ou Hough probabilístico).
3. Manter segmentos com desvio ≤ 25° da vertical e comprimento ≥ 5% do lado maior.
4. RANSAC: sortear 2 segmentos, calcular a interseção (produto vetorial das retas
   homogêneas), contar como consistentes os segmentos cujo ângulo até o ponto é
   < 1°, ponderando pelo comprimento. 3000 iterações, semente fixa.
5. Refinar por mínimos quadrados ponderados (SVD) sobre os consistentes.

**Modo manual:** o usuário traça 2 ou mais linhas que deveriam ser verticais; o
ponto de fuga é a interseção (ou o ajuste por mínimos quadrados, se houver mais de 2).

**Falha:** com menos de ~8 segmentos consistentes, avisar e cair no modo manual.

### 3.3 Rotação de nivelamento

Com o ponto de fuga homogêneo `vp = (vx, vy, vw)`:

```
baixo   = normalizar( (vx - cx*vw, vy - cy*vw, f*vw) )   // inverter o sinal se baixo.y < 0
frente  = normalizar( z - baixo * (z · baixo) ),  z = (0, 0, 1)
direita = baixo × frente
R       = [ direita | baixo | frente ]                   // colunas
pitch   = asin(baixo.z)
roll    = atan2(-baixo.x, baixo.y)
```

`R` leva raios da câmera nivelada para a câmera original: `r_orig = R * r_nivelada`.

**Força (0 a 1):** converter `R` para eixo-ângulo, multiplicar o ângulo pela força
e converter de volta.

**Ajuste fino:** deslizadores de pitch e roll somam uma rotação extra a `R`.

### 3.4 Projeção Panini (parâmetro `d`)

`d = 0` é retilínea; `d = 1` é a Panini clássica. Mantém verticais retas e reduz o
esticamento horizontal nas bordas.

**Direta (raio → plano de saída)**

```
lon = atan2(X, Z)        lat = asin(Y / |r|)
S   = (d + 1) / (d + cos(lon))
x   = S * sin(lon)       y   = S * tan(lat)
```

**Inversa (plano de saída → raio)**

```
k        = x² / (d + 1)²
delta    = k²d² - (k + 1)(k d² - 1)
cos_lon  = (-k d + sqrt(delta)) / (k + 1)
S        = (d + 1) / (d + cos_lon)
lon      = atan2(x / S, cos_lon)
lat      = atan(y / S)
r        = (cos(lat) sin(lon), sin(lat), cos(lat) cos(lon))
```

### 3.5 Compressão vertical (parâmetro `c`)

Reduz o esticamento no topo e na base. Com `c = 0`, nada muda.

```
y_saida = atan(c * y) / c          // direta
y       = tan(c * y_saida) / c     // inversa
```

### 3.6 Reprojeção (o que o shader faz)

Para cada pixel de saída:

1. Coordenadas no plano: `x = x_min + (px + 0,5)/f`, `y = y_min + (py + 0,5)/f`.
2. Desfazer a compressão vertical em `y`.
3. Raio pela Panini inversa.
4. Girar: `r_orig = R * r`.
5. Se `r_orig.z <= 0`, pixel inválido (transparente).
6. Projetar: `u = f * r_orig.x / r_orig.z + cx`, `v = f * r_orig.y / r_orig.z + cy`.
7. Amostrar a textura; fora dos limites é inválido.

**Enquadramento de saída (CPU):** projetar ~800 pontos do contorno da imagem
original (Panini direta + compressão) e usar a caixa envolvente. A escala `f`
pixels por unidade mantém a resolução do centro da foto.

### 3.7 Corte automático

1. Gerar a máscara de pixels válidos em baixa resolução (~256 px no lado maior).
2. Achar o maior retângulo contido na máscara:
   - proporção livre: algoritmo do maior retângulo em histograma;
   - proporção fixa: busca binária no tamanho com imagem integral.
3. Entre posições equivalentes, preferir a mais alta (preserva cabeças).
4. Escalar o retângulo para a resolução real, com 1 px de margem de segurança.

O usuário pode mover e redimensionar o corte manualmente.

### 3.8 Caso de referência

Foto de 960×1280, sem EXIF. Resultado validado do script Python:

| Parâmetro | Valor |
|---|---|
| Focal | 480 px (13 mm equivalente) |
| Pitch detectado | 17,5° |
| Roll detectado | 0,8° |
| Força | 0,9 |
| Panini `d` | 0,7 |
| Compressão vertical `c` | 0,5 |
| Proporção do corte | 0,7 |
| Saída | 711×1016 |

Esses valores são os **padrões iniciais** dos controles.

## 4. Interface

**Tela 1 — Início**

- Botão "Escolher foto" (galeria) e "Tirar foto" (câmera).
- Aviso curto: "Suas fotos não saem do aparelho".

**Tela 2 — Editor**

- Prévia ocupando a maior parte da tela, com grade opcional.
- Pressionar e segurar a prévia mostra o original (antes/depois).
- Barra de ferramentas inferior, uma ferramenta por vez:

| Ferramenta | Controles |
|---|---|
| Nivelar | Automático; força (0–100%); ajuste fino de inclinação e rotação; traçar linhas |
| Bordas | Panini `d` (0–1); compressão vertical `c` (0–1) |
| Lente | Predefinições 0,5x / 1x / 2x; focal em mm (10–60) |
| Corte | Automático; proporções original, 3:4, 4:5, 1:1, 9:16, livre |

- Ações: desfazer, restaurar padrões, exportar.

**Exportação**

- JPEG, qualidade 95%, resolução total.
- Compartilhar (Web Share API) ou baixar.

**Requisitos de usabilidade**

- Alvos de toque ≥ 44 px; uso com uma mão; orientação retrato.
- Tema claro e escuro conforme o sistema.
- Últimos valores dos controles guardados em `localStorage` (com `try/catch`).

## 5. Arquitetura

```
<repositorio>/
├── reference/
│   └── corrigir_geometria.py      # algoritmo de referência (não é usado em produção)
├── src/
│   ├── core/                      # matemática pura, sem DOM nem WebGL
│   │   ├── camera.ts              # focal, raios, projeção
│   │   ├── vanishing-point.ts     # RANSAC e refinamento
│   │   ├── leveling.ts            # rotação de nivelamento, força, ajuste fino
│   │   ├── panini.ts              # projeção direta e inversa, compressão vertical
│   │   ├── framing.ts             # enquadramento de saída
│   │   ├── crop.ts                # maior retângulo válido
│   │   └── linalg.ts              # vetores e matrizes 3x3
│   ├── gl/
│   │   ├── renderer.ts            # contexto, textura, uniforms, desenho
│   │   ├── reproject.frag         # shader de reprojeção
│   │   └── export.ts              # renderização em resolução total
│   ├── detect/
│   │   ├── worker.ts              # Web Worker com OpenCV.js
│   │   └── segments.ts            # detecção e filtragem de segmentos
│   ├── io/
│   │   ├── load-image.ts          # decodificação, orientação EXIF, redução
│   │   ├── exif.ts                # leitura da focal
│   │   └── save-image.ts          # exportar e compartilhar
│   ├── ui/
│   │   ├── app.ts                 # estado e navegação
│   │   ├── editor.ts              # prévia e gestos
│   │   ├── controls.ts            # deslizadores e ferramentas
│   │   └── i18n.ts                # textos da interface
│   └── main.ts
├── tests/
│   ├── fixtures/                  # valores gerados pelo script Python
│   └── *.test.ts
├── scripts/
│   └── gerar_fixtures.py          # exporta casos de teste do Python para JSON
├── .github/workflows/
│   ├── ci.yml                     # lint, tipos, testes
│   └── deploy.yml                 # GitHub Pages
├── CLAUDE.md
├── README.md
├── LICENSE
└── package.json
```

**Regras de arquitetura**

- `core/` não importa nada de `gl/`, `ui/`, `io/` nem `detect/`.
- O estado do editor é um único objeto imutável; cada mudança gera novo estado e
  redesenho.
- A mesma função de `core/` alimenta o shader (via uniforms) e o corte (CPU),
  para não haver duas versões da matemática.

**Estado do editor**

```ts
/** Parâmetros que definem completamente uma correção. */
interface CorrectionParams {
  focal35mm: number;          // distância focal equivalente, em mm
  vanishingPoint: Vec3 | null; // ponto de fuga homogêneo; null = sem nivelamento
  strength: number;           // 0 a 1
  pitchOffsetDeg: number;     // ajuste fino
  rollOffsetDeg: number;      // ajuste fino
  paniniD: number;            // 0 a 1
  verticalCompression: number; // 0 a 1
  cropAspect: number | null;  // largura/altura; null = livre
  cropRect: Rect | null;      // null = automático
}
```

## 6. Pontos de atenção

| Risco | Tratamento |
|---|---|
| Limite de textura da GPU (4096 px em alguns aparelhos) | Consultar `MAX_TEXTURE_SIZE`; reduzir a entrada ou exportar em blocos |
| Memória no iOS Safari (canvas grandes) | Limitar a área total do canvas; liberar texturas e `ImageBitmap` |
| Orientação EXIF | `createImageBitmap` com `imageOrientation: 'from-image'` |
| Serrilhado onde a imagem é comprimida | Mipmaps + filtro trilinear na textura de entrada |
| OpenCV.js pesado | Carregar só ao acionar "Automático"; cache pelo service worker |
| Detecção automática errada | Mostrar as linhas usadas; permitir corrigir manualmente |
| Foto sem linhas verticais | Mensagem clara e modo manual |
| Precisão `mediump` no shader | Declarar `precision highp float` |
| Perda de contexto WebGL | Tratar `webglcontextlost` e recriar recursos |
| Metadados na exportação | v1 exporta sem EXIF; documentar |

## 7. Testes

**Unitários (`core/`)**

- Panini: ida e volta (`inversa(direta(r)) ≈ r`) para `d` em {0; 0,5; 1}.
- Compressão vertical: ida e volta.
- Nivelamento: `R` ortonormal, determinante 1; ponto de fuga sintético com pitch
  conhecido devolve o mesmo pitch (erro < 0,1°).
- Força: 0 devolve identidade; 1 devolve `R`.
- Corte: máscaras sintéticas com resposta conhecida.

**Paridade com o Python**

- `scripts/gerar_fixtures.py` exporta, para parâmetros fixos: `R`, enquadramento,
  coordenadas de origem de uma grade de pixels de saída e retângulo de corte.
- Os testes comparam o TypeScript com esses valores (tolerância de 0,01 px).

**Imagem**

- Renderizar uma grade sintética com pitch conhecido, corrigir e verificar que as
  linhas verticais ficam verticais (desvio < 0,2°).

**Fumaça (Playwright)**

- Abrir o app, carregar imagem de teste, mover um controle, exportar.

**Imagens de teste:** usar apenas imagens sintéticas ou de licença livre. Não
versionar fotos com pessoas identificáveis sem autorização — o repositório é público.

## 8. Etapas

Cada etapa termina com testes passando e um commit.

### Etapa 0 — Estrutura do projeto

- Criar repositório público, Vite + TypeScript, ESLint, Prettier, Vitest.
- `LICENSE` (MIT), `README.md`, `CLAUDE.md`, CI.
- Copiar o script de referência para `reference/`.
- **Pronto quando:** `npm run dev`, `npm test` e o CI funcionam.

### Etapa 1 — Núcleo matemático

- Implementar `linalg`, `camera`, `panini`, `leveling`, `framing`.
- Criar `gerar_fixtures.py` e os testes de paridade.
- **Pronto quando:** todos os testes unitários e de paridade passam.

### Etapa 2 — Reprojeção em WebGL

- Carregar imagem, criar textura, shader de reprojeção, prévia no canvas.
- Parâmetros fixos (caso de referência) com ponto de fuga informado no código.
- **Pronto quando:** a prévia da grade sintética bate com a saída do Python.

### Etapa 3 — Editor e controles

- Telas, deslizadores, predefinições de lente, antes/depois, grade.
- Leitura da focal por EXIF.
- **Pronto quando:** todos os controles alteram a prévia a ≥ 30 quadros por segundo
  em um celular intermediário.

### Etapa 4 — Nivelamento manual

- Traçar linhas guia sobre a foto; calcular o ponto de fuga.
- **Pronto quando:** duas linhas traçadas nivelam a foto corretamente.

### Etapa 5 — Corte e exportação

- Corte automático, proporções, ajuste manual.
- Exportação em resolução total, compartilhar e baixar.
- **Pronto quando:** o arquivo exportado bate com a prévia e não tem bordas vazias.

### Etapa 6 — Nivelamento automático

- Web Worker com OpenCV.js, detecção de segmentos, RANSAC.
- Exibir as linhas usadas; alternar para manual em caso de falha.
- **Pronto quando:** o pitch detectado no caso de referência fica em 17,5° ± 0,5°.

### Etapa 7 — PWA e publicação

- Manifesto, ícones, service worker, uso offline.
- Deploy automático no GitHub Pages.
- **Pronto quando:** o app instala no Android e no iOS e funciona em modo avião.

### Etapa 8 — Acabamento

- Acessibilidade (rótulos, contraste, teclado), mensagens de erro, desempenho.
- README com capturas de tela, explicação do algoritmo e guia de contribuição.
- **Pronto quando:** Lighthouse PWA e acessibilidade ≥ 90.

### Depois da v1 (ideias)

- Correção de distorção de barril (`k1`), preservar EXIF, proporção do corte
  personalizada, processamento em lote, projeção estereográfica como alternativa,
  detecção de rostos para proteger regiões do esticamento.

## 9. Repositório público

- **Licença:** MIT. Registrar OpenCV.js (Apache 2.0) e `exifr` (MIT) em
  `THIRD_PARTY_NOTICES.md`.
- **README:** o que o app faz, demonstração, como rodar, como funciona, privacidade,
  limitações, licença.
- **Privacidade:** declarar que não há servidor, coleta nem telemetria.
- **Contribuição:** `CONTRIBUTING.md`, modelos de issue e de pull request.
- **Segredos:** nada de chaves ou tokens; o projeto não precisa de nenhum.
- **Commits:** mensagens no padrão Conventional Commits.

## 10. Conteúdo sugerido para o `CLAUDE.md`

```markdown
# Instruções do projeto

- Responder e explicar em português brasileiro.
- Código bem comentado, com indentação consistente (Prettier).
- Toda função exportada tem comentário de documentação (TSDoc).
- Em alterações pontuais, mostrar apenas as funções modificadas.
- Nunca remover funções em refatorações sem confirmar antes.
- `src/core/` é matemática pura: sem DOM, sem WebGL, sem efeitos colaterais.
- O algoritmo de referência está em `reference/corrigir_geometria.py`;
  qualquer divergência numérica deve ser justificada e coberta por teste.
- Antes de concluir uma tarefa: `npm run lint`, `npm run typecheck`, `npm test`.
- Não versionar fotos com pessoas identificáveis.
- Seguir o plano em `PLANO.md`, uma etapa por vez.
```

## 11. Primeiro pedido para o Claude Code

```text
Leia PLANO.md e reference/corrigir_geometria.py.
Execute a Etapa 0: crie a estrutura do projeto conforme a seção 5,
com Vite, TypeScript strict, ESLint, Prettier, Vitest, licença MIT,
README inicial, CLAUDE.md (seção 10) e o workflow de CI.
Não avance para a Etapa 1 sem eu confirmar.
```
