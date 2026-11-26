# Como contribuir com o FotoGeometria

[English](CONTRIBUTING.md) | **Português** | [Español](CONTRIBUTING.es-ES.md)

Obrigado pelo interesse. O FotoGeometria é um app web que corrige, no próprio aparelho, a geometria de fotos de grande angular: verticais convergentes e bordas esticadas. Aqui está como ajudar, e o que uma mudança precisa mostrar antes de ser integrada.

## Antes de começar

- **Abra uma issue primeiro** para qualquer coisa maior que um erro de digitação, para combinarmos a mudança antes de você escrevê-la.
- Leia a [Política de Segurança](SECURITY.md) (em inglês) se a mudança mexe em como os arquivos são lidos, no que a página pode carregar ou na publicação.
- O plano que o projeto segue é o [docs/PLANO.md](docs/PLANO.md), e o [docs/DECISIONS.md](docs/DECISIONS.md) registra onde o código se afasta dele, e por quê.

## Preparar o ambiente

Você precisa do Node.js 22.13 ou mais novo (o `.nvmrc` diz 22) e do npm.

```bash
git clone https://github.com/angeloINTJ/fotogeometria.git
cd fotogeometria
npm ci
npm run dev
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Serve o app com recarga automática em `http://localhost:5173/fotogeometria/` |
| `npm test` | Roda os testes unitários (Vitest) |
| `npm run lint` | ESLint e depois o Prettier em modo de verificação |
| `npm run typecheck` | O compilador TypeScript, em modo estrito, sem gerar arquivos |
| `npm run build` | Gera o app em `dist/` |
| `npm run budget` | Confere `dist/` contra os tamanhos de `tools/budget.json` (rode depois do build) |
| `npm run gates` | Os portões do repositório: segredos, o padrão Ângulo, os avisos de terceiros |
| `npm run format` | Reescreve o código no formato do Prettier |

### Ganchos de pre-commit

```bash
pip install pre-commit
pre-commit install
```

Eles rodam as verificações de espaços em branco, de YAML e de JSON e os portões rápidos, para você encontrar o problema no segundo que leva o commit, e não nos minutos que o CI leva para responder. Os testes e o build ficam de fora de propósito: gancho que leva minutos é gancho que as pessoas desligam.

## As verificações que um pull request precisa passar

A `main` é protegida: toda mudança chega por pull request, e o CI precisa passar nele. O CI roda os mesmos comandos acima, então rode-os antes do push:

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run budget && npm run gates
```

- **O orçamento é exato.** O `tools/budget.json` registra os bytes do build por categoria, e qualquer diferença falha, inclusive para menos: orçamento que só sobe deixa de medir. Quando sua mudança altera um tamanho, registre-o com `node tools/check-budget.mjs --write` e diga o motivo no commit.
- **Os avisos de terceiros são gerados.** Uma dependência nova de tempo de execução precisa de uma entrada em `tools/third-party.json` e do texto da licença em `LICENSES/`, sem alteração; depois, `npm run notices` reescreve o `THIRD_PARTY_NOTICES.md`.
- **Arquivo gerado nunca se edita à mão.** Mude a fonte e gere de novo.

## Testes primeiro

- Antes de implementar uma funcionalidade, uma função ou um refactor, descreva os testes que vão prová-lo. Ao terminar, rode-os e ponha o resultado no pull request.
- Refactor se prova com comportamento inalterado; correção, com uma reprodução que falha antes e passa depois; comportamento novo que dá para exercitar automaticamente ganha um caso de teste.
- Um teste só vale se morder: ele precisa de um controle negativo, uma execução em que a correção é desfeita e o teste falha. Uma checagem nova se prova por mutação: reintroduzir a violação dá exatamente um achado.
- A matemática de `src/core/` fica presa ao Python validado de `reference/` por testes de paridade. Uma diferença numérica em relação à referência é um bug ou uma decisão, e uma decisão é justificada no código e coberta por teste.

## Convenções de código

- TypeScript em modo estrito, formatado pelo Prettier e verificado pelo ESLint.
- Toda função exportada tem comentário de documentação (TSDoc).
- Comentários explicam o **porquê** e trazem a medição que decidiu a questão, com a data. Um comentário que deixou de bater com o código é defeito, não ruído.
- `src/core/` é matemática pura: sem DOM, sem WebGL, sem efeitos colaterais. O ESLint recusa um import das pastas que lidam com o navegador, e o compilador confere a pasta sem os tipos do DOM.
- Identificadores, comentários, mensagens de commit e pull requests são escritos em inglês.

## O padrão de interface

Tudo o que tem tela ou leitor segue o Ângulo, em [docs/ANGULO.md](docs/ANGULO.md): uma cor de destaque, duas famílias de fonte, linha antes de sombra, dois raios e o círculo, uma grade de 4 px, um conjunto de ícones, microcopy que diz o que faz e todo estado desenhado. Os valores vêm dos tokens de `src/styles/angulo.css`, que é uma cópia fixada e nunca se edita. O `tools/check-angulo.mjs` confere o que uma máquina consegue; o checklist do §8 é seu, nos dois temas.

A interface é em português do Brasil, inglês e espanhol. Um texto novo precisa dos três.

## Mensagens de commit

[Conventional Commits](https://www.conventionalcommits.org/pt-br/): `tipo(escopo): resumo`, com `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci` ou `chore`. Se a mudança diz ser mais rápida, menor ou uma correção, o número ou a reprodução vai na mensagem.

## Pull requests

- Preencha o modelo: o porquê, o que muda e a prova (os comandos que você rodou e o que eles imprimiram).
- Atualize os documentos que sua mudança deixa errados, em todos os idiomas em que existem: os READMEs (três), o CONTRIBUTING (três) e o CHANGELOG (dois). Acrescente uma linha em *Unreleased* nos dois changelogs.
- Um pull request trata de um assunto só.

## Imagens e privacidade

O repositório é público. Imagens de teste precisam ser sintéticas ou de licença livre, e não podem mostrar pessoas identificáveis. Nunca versione uma foto pessoal: a pasta `local-photos/` é ignorada pelo Git, para as fotos que você confere à mão.

## Licença

Ao contribuir, você concorda que sua contribuição fica sob a [Licença MIT](LICENSE).
