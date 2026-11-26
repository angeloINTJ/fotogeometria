"""Correção de geometria de fotos feitas com lente grande angular.

O script executa três etapas:

1. Detecta segmentos de reta quase verticais e estima, via RANSAC, o ponto
   de fuga vertical da cena.
2. A partir do ponto de fuga, calcula a inclinação (pitch) e a rotação
   (roll) da câmera, assumindo uma distância focal em pixels.
3. Reprojeta a imagem para uma câmera virtual nivelada, usando a projeção
   Panini, que mantém as verticais retas e reduz o esticamento das bordas
   típico das lentes ultra-wide.

Uso:
    python3 corrigir_geometria.py entrada.jpg saida.jpg [--focal 480]
"""

import argparse

import cv2
import numpy as np


def detectar_segmentos_verticais(cinza, angulo_max_graus=25.0, comprimento_min=60.0):
    """Retorna segmentos de reta próximos da vertical.

    Args:
        cinza: imagem em tons de cinza.
        angulo_max_graus: desvio máximo em relação à vertical.
        comprimento_min: comprimento mínimo do segmento, em pixels.

    Returns:
        Array (N, 4) com x1, y1, x2, y2 de cada segmento.
    """
    detector = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
    linhas = detector.detect(cinza)[0].reshape(-1, 4)

    dx = linhas[:, 2] - linhas[:, 0]
    dy = linhas[:, 3] - linhas[:, 1]
    comprimento = np.hypot(dx, dy)
    angulo = np.degrees(np.arctan2(np.abs(dx), np.abs(dy)))

    mascara = (comprimento >= comprimento_min) & (angulo <= angulo_max_graus)
    return linhas[mascara]


def estimar_ponto_de_fuga(segmentos, iteracoes=3000, tolerancia_graus=1.0, semente=0):
    """Estima o ponto de fuga dos segmentos via RANSAC.

    Cada segmento é convertido em uma reta homogênea; o ponto de fuga é a
    interseção com mais segmentos consistentes (ponderados pelo comprimento).

    Returns:
        Tupla (ponto_homogeneo, mascara_inliers).
    """
    rng = np.random.default_rng(semente)

    p1 = np.column_stack([segmentos[:, 0], segmentos[:, 1], np.ones(len(segmentos))])
    p2 = np.column_stack([segmentos[:, 2], segmentos[:, 3], np.ones(len(segmentos))])
    retas = np.cross(p1, p2)
    meio = (p1 + p2) / 2.0
    direcao = p2[:, :2] - p1[:, :2]
    comprimento = np.linalg.norm(direcao, axis=1)
    direcao = direcao / comprimento[:, None]

    def erro_angular(vp):
        """Ângulo entre cada segmento e a direção meio-do-segmento -> vp."""
        alvo = vp[:2] - vp[2] * meio[:, :2]
        alvo = alvo / (np.linalg.norm(alvo, axis=1, keepdims=True) + 1e-12)
        cosseno = np.abs(np.sum(alvo * direcao, axis=1)).clip(0, 1)
        return np.degrees(np.arccos(cosseno))

    melhor_pontuacao, melhor_mascara = -1.0, None
    for _ in range(iteracoes):
        i, j = rng.choice(len(retas), size=2, replace=False)
        vp = np.cross(retas[i], retas[j])
        if np.linalg.norm(vp) < 1e-9:
            continue
        mascara = erro_angular(vp) < tolerancia_graus
        pontuacao = comprimento[mascara].sum()
        if pontuacao > melhor_pontuacao:
            melhor_pontuacao, melhor_mascara = pontuacao, mascara

    # Refinamento por mínimos quadrados ponderados sobre os inliers.
    retas_norm = retas[melhor_mascara] / np.linalg.norm(
        retas[melhor_mascara][:, :2], axis=1, keepdims=True
    )
    pesos = comprimento[melhor_mascara][:, None]
    _, _, vt = np.linalg.svd(retas_norm * pesos)
    return vt[-1], melhor_mascara


def rotacao_de_nivelamento(vp, focal, cx, cy):
    """Calcula a rotação que leva a câmera nivelada à câmera real.

    O ponto de fuga vertical, retroprojetado, é a direção da gravidade no
    referencial da câmera. Construímos uma base ortonormal em que esse vetor
    é o eixo Y (para baixo) e o eixo Z fica o mais próximo possível do eixo
    óptico original.

    Returns:
        Tupla (R, pitch_graus, roll_graus), com R mapeando raios da câmera
        nivelada para a câmera original.
    """
    baixo = np.array([vp[0] - cx * vp[2], vp[1] - cy * vp[2], focal * vp[2]])
    baixo = baixo / np.linalg.norm(baixo)
    if baixo[1] < 0:
        baixo = -baixo

    frente = np.array([0.0, 0.0, 1.0])
    frente = frente - baixo * np.dot(frente, baixo)
    frente = frente / np.linalg.norm(frente)
    direita = np.cross(baixo, frente)

    rot = np.column_stack([direita, baixo, frente])
    pitch = np.degrees(np.arcsin(baixo[2]))
    roll = np.degrees(np.arctan2(-baixo[0], baixo[1]))
    return rot, pitch, roll


def raios_panini(xn, yn, d):
    """Converte coordenadas normalizadas do plano Panini em raios 3D.

    Args:
        xn, yn: coordenadas no plano de saída (unidades de distância focal).
        d: parâmetro Panini (0 = retilínea, 1 = Panini clássica).
    """
    k = xn * xn / ((d + 1.0) ** 2)
    discriminante = k * k * d * d - (k + 1.0) * (k * d * d - 1.0)
    cos_lon = (-k * d + np.sqrt(discriminante)) / (k + 1.0)
    escala = (cos_lon + d) / (d + 1.0)
    lon = np.arctan2(xn * escala, cos_lon)
    lat = np.arctan2(yn * escala, 1.0)

    return np.stack(
        [np.cos(lat) * np.sin(lon), np.sin(lat), np.cos(lat) * np.cos(lon)], axis=-1
    )


def projetar_panini(raios, d):
    """Projeta raios 3D no plano Panini (inversa de `raios_panini`)."""
    lon = np.arctan2(raios[..., 0], raios[..., 2])
    lat = np.arcsin(raios[..., 1] / np.linalg.norm(raios, axis=-1))
    escala = (d + 1.0) / (d + np.cos(lon))
    return np.stack([escala * np.sin(lon), escala * np.tan(lat)], axis=-1)


def reprojetar(imagem, focal, rot, d=0.7, compressao_vertical=0.0, margem=0.0):
    """Reprojeta a imagem para uma câmera nivelada com projeção Panini.

    Args:
        imagem: imagem BGR original (assumida retilínea).
        focal: distância focal em pixels.
        rot: rotação câmera nivelada -> câmera original.
        d: intensidade da projeção Panini.
        compressao_vertical: 0 mantém o eixo vertical retilíneo; valores
            maiores comprimem suavemente o topo e a base (reduz esticamento).
        margem: fração do contorno original a descartar ao enquadrar.

    Returns:
        Tupla (imagem_corrigida, mascara_valida).
    """
    altura, largura = imagem.shape[:2]
    cx, cy = (largura - 1) / 2.0, (altura - 1) / 2.0

    def comprimir(y):
        """Compressão vertical suave (tipo estereográfica) do plano de saída."""
        if compressao_vertical <= 0:
            return y
        return np.arctan(y * compressao_vertical) / compressao_vertical

    def expandir(y):
        """Inversa de `comprimir`."""
        if compressao_vertical <= 0:
            return y
        limite = np.pi / 2 - 1e-3
        return np.tan(np.clip(y * compressao_vertical, -limite, limite)) / compressao_vertical

    # Projeta o contorno da imagem original para descobrir o enquadramento.
    borda_x = np.concatenate([
        np.linspace(0, largura - 1, 200), np.full(200, largura - 1),
        np.linspace(largura - 1, 0, 200), np.zeros(200),
    ])
    borda_y = np.concatenate([
        np.zeros(200), np.linspace(0, altura - 1, 200),
        np.full(200, altura - 1), np.linspace(altura - 1, 0, 200),
    ])
    raios_borda = np.stack(
        [(borda_x - cx) / focal, (borda_y - cy) / focal, np.ones_like(borda_x)], axis=-1
    )
    plano = projetar_panini(raios_borda @ rot, d)
    plano[:, 1] = comprimir(plano[:, 1])

    x_min, y_min = plano.min(axis=0)
    x_max, y_max = plano.max(axis=0)

    # Mantém a mesma densidade de pixels do centro da imagem original.
    largura_saida = int(round((x_max - x_min) * focal))
    altura_saida = int(round((y_max - y_min) * focal))

    xs = x_min + (np.arange(largura_saida) + 0.5) / focal
    ys = y_min + (np.arange(altura_saida) + 0.5) / focal
    grade_x, grade_y = np.meshgrid(xs, ys)

    raios = raios_panini(grade_x, expandir(grade_y), d) @ rot.T
    frente = raios[..., 2] > 1e-6
    mapa_x = np.where(frente, focal * raios[..., 0] / raios[..., 2] + cx, -1)
    mapa_y = np.where(frente, focal * raios[..., 1] / raios[..., 2] + cy, -1)

    corrigida = cv2.remap(
        imagem, mapa_x.astype(np.float32), mapa_y.astype(np.float32),
        interpolation=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT,
    )
    valida = (
        (mapa_x >= margem) & (mapa_x <= largura - 1 - margem)
        & (mapa_y >= margem) & (mapa_y <= altura - 1 - margem)
    )
    return corrigida, valida.astype(np.uint8)


def maior_retangulo_valido(mascara):
    """Encontra o maior retângulo alinhado aos eixos contido na máscara.

    Implementa o algoritmo clássico do maior retângulo em histograma,
    aplicado linha a linha.

    Returns:
        Tupla (x, y, largura, altura).
    """
    altura, largura = mascara.shape
    alturas = np.zeros(largura, dtype=np.int32)
    melhor = (0, 0, 0, 0)
    melhor_area = 0

    for linha in range(altura):
        alturas = np.where(mascara[linha] > 0, alturas + 1, 0)
        pilha = []
        for coluna in range(largura + 1):
            atual = alturas[coluna] if coluna < largura else 0
            inicio = coluna
            while pilha and pilha[-1][1] >= atual:
                inicio, h = pilha.pop()
                area = h * (coluna - inicio)
                if area > melhor_area:
                    melhor_area = area
                    melhor = (inicio, linha - h + 1, coluna - inicio, h)
            pilha.append((inicio, atual))
    return melhor


def maior_retangulo_com_aspecto(mascara, aspecto):
    """Encontra o maior retângulo de proporção fixa contido na máscara.

    Usa imagem integral para testar, por busca binária na largura, se existe
    alguma posição em que a janela cabe inteira na região válida. Entre as
    posições possíveis, escolhe a mais alta (preserva as cabeças).

    Args:
        mascara: máscara binária (1 = pixel válido).
        aspecto: razão largura / altura desejada.

    Returns:
        Tupla (x, y, largura, altura).
    """
    altura, largura = mascara.shape
    integral = cv2.integral(mascara.astype(np.uint8))

    def posicoes(w, h):
        """Retorna as posições (y, x) em que a janela w x h cabe inteira."""
        soma = (
            integral[h:, w:] - integral[:-h, w:]
            - integral[h:, :-w] + integral[:-h, :-w]
        )
        return np.argwhere(soma == w * h)

    melhor = (0, 0, 0, 0)
    minimo, maximo = 16, largura
    while minimo <= maximo:
        w = (minimo + maximo) // 2
        h = int(round(w / aspecto))
        candidatos = posicoes(w, h) if h < altura and w < largura else []
        if len(candidatos):
            y, x = candidatos[0]
            melhor = (int(x), int(y), w, h)
            minimo = w + 1
        else:
            maximo = w - 1
    return melhor


def principal():
    """Ponto de entrada da linha de comando."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("entrada")
    parser.add_argument("saida")
    parser.add_argument("--focal", type=float, default=None,
                        help="distância focal em pixels (padrão: 0,30 x diagonal)")
    parser.add_argument("--panini", type=float, default=0.7)
    parser.add_argument("--compressao-vertical", type=float, default=0.0)
    parser.add_argument("--forca", type=float, default=1.0,
                        help="fração da inclinação a corrigir (0 a 1)")
    parser.add_argument("--sem-corte", action="store_true")
    parser.add_argument("--aspecto", type=float, default=None,
                        help="proporção largura/altura do corte (ex.: 0.75)")
    args = parser.parse_args()

    imagem = cv2.imread(args.entrada)
    altura, largura = imagem.shape[:2]
    # 0,30 x diagonal equivale a uma ultra-wide de ~13 mm (35 mm equivalente).
    focal = args.focal or 0.30 * np.hypot(largura, altura)
    cx, cy = (largura - 1) / 2.0, (altura - 1) / 2.0

    cinza = cv2.cvtColor(imagem, cv2.COLOR_BGR2GRAY)
    segmentos = detectar_segmentos_verticais(cinza)
    vp, inliers = estimar_ponto_de_fuga(segmentos)
    rot, pitch, roll = rotacao_de_nivelamento(vp, focal, cx, cy)
    print(f"segmentos: {len(segmentos)}  inliers: {inliers.sum()}")
    print(f"focal: {focal:.0f}px  pitch: {pitch:.1f} graus  roll: {roll:.1f} graus")

    # Correção parcial opcional: interpola a rotação pelo vetor de Rodrigues.
    if args.forca < 1.0:
        vetor, _ = cv2.Rodrigues(rot)
        rot, _ = cv2.Rodrigues(vetor * args.forca)

    corrigida, valida = reprojetar(
        imagem, focal, rot, d=args.panini,
        compressao_vertical=args.compressao_vertical, margem=1.0,
    )
    if not args.sem_corte:
        if args.aspecto:
            x, y, w, h = maior_retangulo_com_aspecto(valida, args.aspecto)
        else:
            x, y, w, h = maior_retangulo_valido(valida)
        corrigida = corrigida[y:y + h, x:x + w]

    cv2.imwrite(args.saida, corrigida, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(f"saida: {corrigida.shape[1]}x{corrigida.shape[0]}")


if __name__ == "__main__":
    principal()
