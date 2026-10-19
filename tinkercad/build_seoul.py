#!/usr/bin/env python3
"""서울 디오라마 3D 모델 생성기 (Tinkercad용 STL)

단위는 mm. 200 x 150 mm 판 위에 서울 한 장면을 쌓는다.
  - 북쪽: 북한산·북악산 능선, 한양도성 성곽
  - 경복궁: 광화문(홍예 3개), 흥례문, 근정전(2단 월대·품계석), 경회루(돌기둥 48개)
  - 북촌 한옥마을, 광화문광장(이순신·세종대왕 동상, 분수), 시청·서울광장
  - 숭례문, 흥인지문(옹성), 종로·세종대로의 차량
  - 남산: N서울타워, 봉수대 5기, 팔각정, 케이블카, 해방촌 집들
  - 한강: 물결, 밤섬, 반포대교(달빛무지개분수·잠수교), 아치교 + 지하철 2호선
  - 강남: 아파트 단지, 여의도(63빌딩·파크원), 잠실(롯데월드타워·석촌호수·매직아일랜드)

실행:  python3 build_seoul.py
출력:  seoul_diorama.stl (전체 한 덩어리), parts/*.stl (색칠용 부품), preview.png
"""
import math
import os
import struct
import sys
from contextlib import contextmanager

import numpy as np

OUT = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261019)

# 부품(색) 그룹. Tinkercad에서 부품별로 불러와 색을 따로 칠할 수 있다.
GROUPS = {
    'base':      (62, 64, 70),     # 바닥판·도로(아스팔트)
    'water':     (64, 140, 214),   # 한강·연못·분수
    'greenery':  (104, 160, 84),   # 산·공원 잔디
    'trees':     (46, 110, 58),    # 나무
    'blocks':    (176, 178, 180),  # 보도·블록
    'markings':  (245, 245, 240),  # 차선·횡단보도·글씨
    'buildings': (232, 228, 220),  # 아파트·주택·빌딩 외벽
    'glass':     (120, 176, 214),  # 유리 빌딩·롯데월드타워
    'landmarks': (246, 246, 250),  # N서울타워
    'gold':      (214, 170, 60),   # 63빌딩·세종대왕상
    'stone':     (204, 190, 160),  # 석축·성곽·월대
    'palace':    (176, 52, 44),    # 궁궐 기둥·벽(단청 붉은색)
    'roofs':     (54, 58, 64),     # 기와지붕·동상
    'bridges':   (150, 154, 160),  # 다리
    'vehicles':  (240, 196, 40),   # 자동차·버스·지하철
    'accents':   (220, 40, 40),    # 교회 십자가·타워 안테나 띠·파크원 프레임
}


class Mesh:
    def __init__(self):
        self.V, self.F, self.n = [], [], 0

    def add(self, V, F):
        self.V.append(V)
        self.F.append(F + self.n)
        self.n += len(V)

    def arrays(self):
        if not self.V:
            return np.zeros((0, 3)), np.zeros((0, 3), int)
        return np.vstack(self.V), np.vstack(self.F)


G = {g: Mesh() for g in GROUPS}

# ---------------------------------------------------------------- 변환 스택
_TF = []


@contextmanager
def rotated(ang, ox, oy):
    _TF.append((ang, ox, oy))
    yield
    _TF.pop()


def put(group, VF):
    V, F = VF
    V = V.copy()
    for ang, ox, oy in reversed(_TF):
        c, s = math.cos(ang), math.sin(ang)
        x, y = V[:, 0] - ox, V[:, 1] - oy
        V[:, 0], V[:, 1] = ox + c * x - s * y, oy + s * x + c * y
    G[group].add(V, F)


# ---------------------------------------------------------------- 기본 도형
def solid(V, F):
    """닫힌 도형의 면 방향을 바깥쪽으로 맞춘다(부호 있는 부피 기준)."""
    V = np.asarray(V, float)
    F = np.asarray(F, int)
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    if np.einsum('ij,ij->i', a, np.cross(b, c)).sum() < 0:
        F = F[:, ::-1]
    return V, F


BOX_F = np.array([[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
                  [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]])


def box(x0, y0, z0, x1, y1, z1):
    x0, x1 = min(x0, x1), max(x0, x1)
    y0, y1 = min(y0, y1), max(y0, y1)
    z0, z1 = min(z0, z1), max(z0, z1)
    V = np.array([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
                  [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], float)
    return solid(V, BOX_F)


def box_rot(cx, cy, z0, L, W, H, ang):
    """중심 (cx, cy), 길이 L 방향이 ang인 회전 상자."""
    V, F = box(-L / 2, -W / 2, z0, L / 2, W / 2, z0 + H)
    c, s = math.cos(ang), math.sin(ang)
    x, y = V[:, 0].copy(), V[:, 1].copy()
    V[:, 0], V[:, 1] = cx + c * x - s * y, cy + s * x + c * y
    return V, F


def loft(rings, apex=None, cap0=True, cap1=True):
    """같은 꼭짓점 수의 고리들을 이어 붙인 닫힌 도형. apex가 있으면 끝을 한 점으로 모은다."""
    rings = [np.asarray(r, float) for r in rings]
    n = len(rings[0])
    V = np.vstack(rings)
    i = np.arange(n)
    j = (i + 1) % n
    F = []
    for k in range(len(rings) - 1):
        a, b = k * n, (k + 1) * n
        F.append(np.stack([a + i, a + j, b + j], 1))
        F.append(np.stack([a + i, b + j, b + i], 1))
    last = (len(rings) - 1) * n
    extra = []
    if cap0:
        c0 = len(V) + len(extra)
        extra.append(rings[0].mean(0))
        F.append(np.stack([np.full(n, c0), j, i], 1))
    if apex is not None:
        ca = len(V) + len(extra)
        extra.append(np.asarray(apex, float))
        F.append(np.stack([last + i, last + j, np.full(n, ca)], 1))
    elif cap1:
        c1 = len(V) + len(extra)
        extra.append(rings[-1].mean(0))
        F.append(np.stack([np.full(n, c1), last + i, last + j], 1))
    if extra:
        V = np.vstack([V, np.array(extra)])
    return solid(V, np.vstack(F))


def circle(cx, cy, z, r, n, rot=0.0):
    t = rot + np.linspace(0, 2 * np.pi, n, endpoint=False)
    return np.stack([cx + r * np.cos(t), cy + r * np.sin(t), np.full(n, z)], 1)


def ellipse(cx, cy, z, rx, ry, n):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    return np.stack([cx + rx * np.cos(t), cy + ry * np.sin(t), np.full(n, z)], 1)


def ellipse_ring(group, cx, cy, rx, ry, w, z0, z1, n=40):
    """타원 둘레의 띠(호숫가 석축). 반쪽씩 두 번 밀어낸다."""
    for t0 in (0, np.pi):
        ts = np.linspace(t0, t0 + np.pi, n // 2 + 1)
        poly = ([(cx + (rx + w) * math.cos(t), cy + (ry + w) * math.sin(t)) for t in ts] +
                [(cx + rx * math.cos(t), cy + ry * math.sin(t)) for t in ts[::-1]])
        put(group, extrude(poly, z0, z1, 'xy'))


def cyl(cx, cy, z0, z1, r0, r1=None, n=12, rot=0.0):
    r1 = r0 if r1 is None else r1
    if r1 <= 1e-6:
        return loft([circle(cx, cy, z0, r0, n, rot)], apex=(cx, cy, z1))
    return loft([circle(cx, cy, z0, r0, n, rot), circle(cx, cy, z1, r1, n, rot)])


def tube(P, r, n=6, ang0=0.0):
    """경로 P를 따라가는 관(케이블, 아치, 분수 물줄기)."""
    P = np.asarray(P, float)
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    ref = np.array([0, 0, 1.0]) if abs(T[0, 2]) < 0.9 else np.array([1.0, 0, 0])
    N = np.cross(T[0], ref)
    N /= np.linalg.norm(N)
    r = np.broadcast_to(np.asarray(r, float), (len(P),))
    th = ang0 + np.linspace(0, 2 * np.pi, n, endpoint=False)
    rings = []
    for k in range(len(P)):
        t = T[k]
        N = N - t * np.dot(N, t)
        N /= np.linalg.norm(N)
        B = np.cross(t, N)
        rings.append(P[k] + r[k] * (np.cos(th)[:, None] * N + np.sin(th)[:, None] * B))
    return loft(rings)


def grid_solid(X, Y, Zt, Zb=None, zflat=None):
    """격자 높이면(위) + 바닥(격자 또는 평평한 면)으로 만든 닫힌 도형."""
    nu, nv = X.shape
    top = np.stack([X, Y, Zt], -1).reshape(-1, 3)
    I, J = np.meshgrid(np.arange(nu - 1), np.arange(nv - 1), indexing='ij')
    a, b, c, d = I * nv + J, (I + 1) * nv + J, (I + 1) * nv + J + 1, I * nv + J + 1
    Ft = np.vstack([np.stack([a, b, c], -1).reshape(-1, 3), np.stack([a, c, d], -1).reshape(-1, 3)])
    loop = ([i * nv for i in range(nu)] + [(nu - 1) * nv + j for j in range(1, nv)] +
            [i * nv + nv - 1 for i in range(nu - 2, -1, -1)] + [j for j in range(nv - 2, 0, -1)])
    loop = np.array(loop)
    N = len(top)
    if Zb is not None:
        bot = np.stack([X, Y, Zb], -1).reshape(-1, 3)
        V = np.vstack([top, bot])
        Fb = Ft[:, ::-1] + N
        bl = loop + N
        extra = []
    else:
        bot = top[loop].copy()
        bot[:, 2] = zflat
        V = np.vstack([top, bot, bot.mean(0)[None]])
        bl = N + np.arange(len(loop))
        cidx = N + len(loop)
        k = np.arange(len(loop))
        Fb = np.stack([np.full(len(loop), cidx), bl[(k + 1) % len(loop)], bl[k]], 1)
    k = np.arange(len(loop))
    ta, tb = loop[k], loop[(k + 1) % len(loop)]
    ba, bb = bl[k], bl[(k + 1) % len(loop)]
    Fw = np.vstack([np.stack([ta, ba, bb], 1), np.stack([ta, bb, tb], 1)])
    return solid(V, np.vstack([Ft, Fb, Fw]))


def _tri_area2(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def triangulate(poly):
    """귀 자르기(ear clipping)로 단순 다각형을 삼각형으로 나눈다. poly는 반시계 방향."""
    idx = list(range(len(poly)))
    tris = []
    guard = 0
    while len(idx) > 3 and guard < 20000:
        guard += 1
        for k in range(len(idx)):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            a, b, c = poly[i0], poly[i1], poly[i2]
            if _tri_area2(a, b, c) <= 1e-12:
                continue
            ok = True
            for m in idx:
                if m in (i0, i1, i2):
                    continue
                p = poly[m]
                if (_tri_area2(a, b, p) >= 0 and _tri_area2(b, c, p) >= 0 and _tri_area2(c, a, p) >= 0):
                    ok = False
                    break
            if ok:
                tris.append((i0, i1, i2))
                idx.pop(k)
                break
        else:
            break
    if len(idx) == 3:
        tris.append(tuple(idx))
    return tris


def extrude(poly, d0, d1, plane='xy'):
    """2D 다각형을 d0~d1 두께로 밀어낸다. plane: 'xy'(z방향), 'xz'(y방향), 'yz'(x방향)."""
    poly = np.asarray(poly, float)
    area = 0.5 * np.sum(poly[:, 0] * np.roll(poly[:, 1], -1) - np.roll(poly[:, 0], -1) * poly[:, 1])
    if area < 0:
        poly = poly[::-1]
    n = len(poly)
    tris = np.array(triangulate(poly))

    def lift(d):
        a, b, dd = poly[:, 0], poly[:, 1], np.full(n, d)
        if plane == 'xy':
            return np.stack([a, b, dd], 1)
        if plane == 'xz':
            return np.stack([a, dd, b], 1)
        return np.stack([dd, a, b], 1)

    V = np.vstack([lift(d0), lift(d1)])
    i = np.arange(n)
    j = (i + 1) % n
    F = np.vstack([tris[:, ::-1], tris + n, np.stack([i, j, j + n], 1), np.stack([i, j + n, i + n], 1)])
    return solid(V, F)


# 정이십면체(나무 수관용)
_p = (1 + 5 ** 0.5) / 2
ICO_V = np.array([[-1, _p, 0], [1, _p, 0], [-1, -_p, 0], [1, -_p, 0], [0, -1, _p], [0, 1, _p],
                  [0, -1, -_p], [0, 1, -_p], [_p, 0, -1], [_p, 0, 1], [-_p, 0, -1], [-_p, 0, 1]], float)
ICO_V /= np.linalg.norm(ICO_V[0])
ICO_F = np.array([[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4],
                  [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8],
                  [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]])


def blob(x, y, z, rx, ry, rz, jitter=0.12):
    V = ICO_V * (1 + rng.uniform(-jitter, jitter, (12, 1))) * [rx, ry, rz] + [x, y, z]
    return solid(V, ICO_F)


def tree(x, y, z, size=1.0, kind=None):
    kind = kind or ('round' if rng.random() < 0.72 else 'pine')
    if kind == 'round':
        r = size * rng.uniform(0.8, 1.2)
        put('trees', blob(x, y, z + r * 0.75, r, r, r * 0.9))
    else:
        r = size * rng.uniform(0.6, 0.85)
        h = size * rng.uniform(2.2, 3.0)
        rot = rng.uniform(0, 1)
        put('trees', cyl(x, y, z - 0.2, z + h * 0.65, r, 0, 6, rot))
        put('trees', cyl(x, y, z + h * 0.35, z + h, r * 0.72, 0, 6, rot + 0.5))


# ---------------------------------------------------------------- 지형
PLATE_Z = 5.0
HW = 10.0  # 한강 반폭


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def river_c(x):
    return -40.0 + 2.5 * np.sin(np.asarray(x) / 30.0 + 0.5)


def fbm(x, y, seed, octaves=5, f0=0.06):
    r = np.random.default_rng(seed)
    s, amp, f, tot = 0.0, 1.0, f0, 0.0
    for _ in range(octaves):
        for _ in range(3):
            th, ph = r.uniform(0, 2 * np.pi, 2)
            s = s + amp * np.sin(f * (x * np.cos(th) + y * np.sin(th)) + ph)
        tot += amp
        amp *= 0.5
        f *= 2.07
    return s / tot


NAMSAN = (12.0, 2.0)


def namsan_h(x, y):
    r2 = ((x - NAMSAN[0]) / 17.0) ** 2 + ((y - NAMSAN[1]) / 11.5) ** 2
    h = 25.0 * np.exp(-r2) * (1 + 0.10 * fbm(x, y, 7)) + 1.6 * fbm(x, y, 8, 4, 0.2) * np.exp(-r2 * 0.6)
    return np.clip(h - 0.35, 0, None)


PEAKS = [(-90, 60, 20, 12, 8), (-45, 69, 24, 13, 8), (-12, 72, 19, 14, 7), (22, 73, 28, 12, 7),
         (50, 71, 36, 10, 7), (80, 70, 27, 14, 8), (101, 66, 18, 10, 8)]


def mountain_h(x, y):
    h = 9.0 * smoothstep(52, 74, y)
    for px, py, a, sx, sy in PEAKS:
        h = h + a * np.exp(-((x - px) / sx) ** 2 - ((y - py) / sy) ** 2)
    h = h + 4.5 * fbm(x, y, 3) * smoothstep(50, 70, y)
    # 북한산 화강암 봉우리(인수봉·백운대) 느낌의 거친 바위 능선
    rock = np.exp(-((x - 50) / 14) ** 2 - ((y - 71) / 6) ** 2)
    h = h + 5.0 * rock * (1 - np.abs(np.sin(0.9 * x + 0.4 * y))) ** 2
    h = h * smoothstep(48, 57, y)
    return np.clip(h - 0.3, 0, None)


def hill_h(x, y):
    return np.maximum(namsan_h(x, y), mountain_h(x, y))


def ground_z(x, y):
    return PLATE_Z + hill_h(x, y)


def build_terrain():
    # 바닥판: 한강 띠만 격자로, 나머지는 상자
    put('base', box(-100, -75, 0, 100, -58.5, PLATE_Z))
    put('base', box(-100, -23.5, 0, 100, 75, PLATE_Z))
    xs = np.linspace(-100, 100, 201)
    ys = np.linspace(-59, -23, 73)
    X, Y = np.meshgrid(xs, ys, indexing='ij')
    d = np.abs(Y - river_c(X))
    Z = 2.0 + 3.0 * np.clip((d - HW) / 1.6, 0, 1)
    # 밤섬
    e = np.sqrt(((X + 58) / 9.0) ** 2 + ((Y - river_c(-58) - 1.5) / 2.6) ** 2)
    Z = np.maximum(Z, 2.0 + 2.3 * np.clip((1 - e) / 0.3, 0, 1))
    put('base', grid_solid(X, Y, Z, zflat=0.0))

    # 한강 물결
    xs = np.linspace(-100, 100, 281)
    ys = np.linspace(-54, -26, 50)
    X, Y = np.meshgrid(xs, ys, indexing='ij')
    W = (3.55 + 0.07 * np.sin(1.7 * X + 0.6 * Y) + 0.05 * np.sin(-0.9 * X + 2.3 * Y + 1.0)
         + 0.03 * np.sin(3.1 * X - 1.3 * Y))
    put('water', grid_solid(X, Y, W, zflat=1.9))

    # 남산
    xs = np.linspace(-26, 50, 128)
    ys = np.linspace(-24, 28, 88)
    X, Y = np.meshgrid(xs, ys, indexing='ij')
    H = namsan_h(X, Y)
    Z = np.where(H > 0.05, PLATE_Z + H, PLATE_Z - 0.3)
    put('greenery', grid_solid(X, Y, Z, zflat=PLATE_Z - 0.4))

    # 북쪽 산줄기
    xs = np.linspace(-100, 100, 251)
    ys = np.linspace(47, 75, 41)
    X, Y = np.meshgrid(xs, ys, indexing='ij')
    H = mountain_h(X, Y)
    Z = np.where(H > 0.05, PLATE_Z + H, PLATE_Z - 0.3)
    put('greenery', grid_solid(X, Y, Z, zflat=PLATE_Z - 0.4))

    # 한강공원 잔디 띠 (양쪽 둔치)
    xs = np.linspace(-100, 100, 161)
    for sgn in (1, -1):
        X = np.stack([xs, xs], 1)
        yc = river_c(xs)
        Y = np.stack([yc + sgn * (HW + 1.6), yc + sgn * (HW + 4.5)], 1)
        Zt = np.full(X.shape, PLATE_Z + 0.3)
        put('greenery', grid_solid(X, Y, Zt, zflat=PLATE_Z - 0.2))
    # 밤섬 숲
    yc = river_c(-58) + 1.5
    put('greenery', loft([[(-58 + 8.6 * math.cos(t), yc + 2.3 * math.sin(t), 3.8)
                           for t in np.linspace(0, 2 * np.pi, 28, endpoint=False)],
                          [(-58 + 8.0 * math.cos(t), yc + 2.0 * math.sin(t), 4.45)
                           for t in np.linspace(0, 2 * np.pi, 28, endpoint=False)]]))
    for _ in range(26):
        t = rng.uniform(0, 2 * np.pi)
        rr = math.sqrt(rng.uniform(0, 1)) * 0.85
        tree(-58 + 7.6 * rr * math.cos(t), yc + 1.8 * rr * math.sin(t), 4.4, 0.7, 'round')


# ---------------------------------------------------------------- 한옥 지붕
def hip_roof(cx, cy, z0, Lx, Ly, H, over=1.2, lift=0.6, thick=0.3, res=0.3,
             tile=0.0, pitch=0.8, japsang=False, rot=False):
    """처마 끝이 휘어 올라간 우진각 기와지붕. 벽선에서의 지붕 밑면 높이를 돌려준다."""
    if rot:
        with rotated(np.pi / 2, cx, cy):
            return hip_roof(cx, cy, z0, Ly, Lx, H, over, lift, thick, res, tile, pitch, japsang, False)
    A, B = Lx / 2 + over, Ly / 2 + over
    R = max(A - B, 0.0)
    # 기와골은 앞뒤 면에만 x방향으로 새기므로, 그때는 y방향 격자를 성글게 둔다
    nu = max(int(2 * A / res) + 1, 6)
    nv = max(int(2 * B / (res * 2 if tile > 0 else res)) + 1, 6)
    fine = res <= 0.3
    X, Y = np.meshgrid(np.linspace(-A, A, nu), np.linspace(-B, B, nv), indexing='ij')

    def prof(x, y):
        ex = (np.abs(x) - R) / B
        ey = np.abs(y) / B
        d = np.clip(np.maximum(ex, ey), 0, 1)
        z = H * (1 - d) ** 1.6 + lift * (np.abs(x) / A) ** 3 * (np.abs(y) / B) ** 3
        return z, d, ey >= ex

    Z, D, front = prof(X, Y)
    Zt = z0 + Z
    if tile > 0:
        wave = np.where(front, 0.5 + 0.5 * np.cos(2 * np.pi * X / pitch), 0.5)
        Zt = Zt + tile * wave * np.clip(D * 6, 0, 1)
    put('roofs', grid_solid(X + cx, Y + cy, Zt, Zb=z0 + Z - thick))
    # 용마루 (양 끝이 살짝 솟음)
    if R > 0.3:
        m = 12 if fine else 5
        xs = np.linspace(-R - 0.3, R + 0.3, m)
        zs = z0 + H + 0.12 + 0.35 * (np.abs(xs) / (R + 0.3)) ** 4
        put('roofs', tube(np.stack([xs + cx, np.full(m, cy), zs], 1), 0.24, 6 if fine else 4))
        for sx in (-1, 1):  # 취두
            put('roofs', box(cx + sx * (R + 0.3) - 0.2, cy - 0.25, z0 + H, cx + sx * (R + 0.3) + 0.2,
                             cy + 0.25, z0 + H + 0.75))
    else:
        put('roofs', cyl(cx, cy, z0 + H - 0.2, z0 + H + 0.6, 0.25, 0.05, 8))
    # 추녀마루 4개 + 잡상
    for sx in (-1, 1):
        for sy in (-1, 1):
            t = np.linspace(0, 1, 10 if fine else 4)
            px = sx * (R + t * (A * 0.97 - R))
            py = sy * t * B * 0.97
            pz = prof(px, py)[0] + 0.14
            put('roofs', tube(np.stack([px + cx, py + cy, z0 + pz], 1), 0.16, 5 if fine else 4))
            if japsang:
                for tt in np.linspace(0.5, 0.78, 4):
                    qx = sx * (R + tt * (A * 0.97 - R))
                    qy = sy * tt * B * 0.97
                    qz = z0 + prof(qx, qy)[0] + 0.25
                    put('roofs', box(qx + cx - 0.1, qy + cy - 0.1, qz, qx + cx + 0.1, qy + cy + 0.1, qz + 0.3))
    dw = (Ly / 2) / B
    return z0 + H * (1 - dw) ** 1.6 - thick


def roof_wall_z(z0, Lx, Ly, H, over, thick=0.3):
    B = min(Lx, Ly) / 2 + over
    return z0 + H * (1 - (min(Lx, Ly) / 2) / B) ** 1.6 - thick


def ring_boxes(group, cx, cy, Lx, Ly, z0, z1, step, size, out=0.0):
    """사각형 둘레를 따라 작은 상자(공포, 난간동자)를 촘촘히 놓는다."""
    for sx in (-1, 1):
        for x in np.arange(-Lx / 2, Lx / 2 + 1e-6, step):
            y = sx * (Ly / 2 + out)
            put(group, box(cx + x - size / 2, cy + y - size / 2, z0, cx + x + size / 2, cy + y + size / 2, z1))
        for y in np.arange(-Ly / 2 + step, Ly / 2 - 1e-6, step):
            x = sx * (Lx / 2 + out)
            put(group, box(cx + x - size / 2, cy + y - size / 2, z0, cx + x + size / 2, cy + y + size / 2, z1))


def pavilion(cx, cy, z0, Lx, Ly, h1, H1, over1=1.2, lift1=0.6, bays=(3, 1), story2=None,
             tile=0.0, japsang=False, res=0.3, col_r=0.2, rot=False, brackets=True):
    """기둥·공포·지붕을 갖춘 목조 전각. story2 = (Lx2, Ly2, h2, H2, over2, lift2)."""
    if rot:
        with rotated(np.pi / 2, cx, cy):
            return pavilion(cx, cy, z0, Ly, Lx, h1, H1, over1, lift1, bays, story2, tile, japsang,
                            res, col_r, False, brackets)
    z0r = z0 + h1
    zw = roof_wall_z(z0r, Lx, Ly, H1, over1)
    put('palace', box(cx - Lx / 2 + 0.35, cy - Ly / 2 + 0.35, z0, cx + Lx / 2 - 0.35, cy + Ly / 2 - 0.35, zw + 0.1))
    xs = np.linspace(-Lx / 2, Lx / 2, bays[0] + 1)
    ysd = np.linspace(-Ly / 2, Ly / 2, bays[1] + 1)
    for x in xs:
        for y in (-Ly / 2, Ly / 2):
            put('palace', cyl(cx + x, cy + y, z0, zw + 0.1, col_r, n=8))
    for y in ysd[1:-1]:
        for x in (-Lx / 2, Lx / 2):
            put('palace', cyl(cx + x, cy + y, z0, zw + 0.1, col_r, n=8))
    # 창방(가로 보) + 공포
    put('palace', box(cx - Lx / 2 - 0.15, cy - Ly / 2 - 0.15, zw - 0.45, cx + Lx / 2 + 0.15, cy + Ly / 2 + 0.15, zw - 0.2))
    if brackets:
        ring_boxes('palace', cx, cy, Lx, Ly, zw - 0.2, zw + 0.1, 0.45, 0.22, out=0.15)
    hip_roof(cx, cy, z0r, Lx, Ly, H1, over1, lift1, res=res, tile=tile, japsang=japsang and not story2)
    if story2:
        Lx2, Ly2, h2, H2, over2, lift2 = story2
        z0r2 = z0r + h2
        zw2 = roof_wall_z(z0r2, Lx2, Ly2, H2, over2)
        put('palace', box(cx - Lx2 / 2 + 0.3, cy - Ly2 / 2 + 0.3, z0r - 0.3, cx + Lx2 / 2 - 0.3, cy + Ly2 / 2 - 0.3, zw2 + 0.1))
        for x in np.linspace(-Lx2 / 2, Lx2 / 2, bays[0] + 1):
            for y in (-Ly2 / 2, Ly2 / 2):
                put('palace', cyl(cx + x, cy + y, z0r + H1 * 0.3, zw2 + 0.1, col_r * 0.9, n=8))
        # 2층 난간
        ring_boxes('palace', cx, cy, Lx2 + 0.5, Ly2 + 0.5, z0r + H1 * 0.3, z0r + H1 * 0.3 + 0.5, 0.5, 0.1)
        put('palace', box(cx - Lx2 / 2 - 0.15, cy - Ly2 / 2 - 0.15, zw2 - 0.45, cx + Lx2 / 2 + 0.15, cy + Ly2 / 2 + 0.15, zw2 - 0.2))
        if brackets:
            ring_boxes('palace', cx, cy, Lx2, Ly2, zw2 - 0.2, zw2 + 0.1, 0.45, 0.22, out=0.15)
        hip_roof(cx, cy, z0r2, Lx2, Ly2, H2, over2, lift2, res=res, tile=tile, japsang=japsang)
        return z0r2 + H2
    return z0r + H1


def gate(cx, cy, z0, W, D, H, arches, pav, ongseong=False):
    """홍예(아치) 문이 뚫린 석축 + 위의 2층 문루. 정면은 -y(남쪽)."""
    y0, y1 = cy - D / 2, cy + D / 2
    opens = sorted((cx + o - w / 2, cx + o + w / 2, w, h) for o, w, h in arches)
    xs = cx - W / 2
    for a, b, w, h in opens:
        put('stone', box(xs, y0, z0, a, y1, z0 + H))
        R = w / 2
        s = h - R
        oc = (a + b) / 2
        arc = [(oc + R * math.cos(t), z0 + s + R * math.sin(t)) for t in np.linspace(0, np.pi, 16)[1:-1]]
        poly = [(a, z0 + s), (a, z0 + H), (b, z0 + H), (b, z0 + s)] + arc
        put('stone', extrude(poly, y0, y1, 'xz'))
        # 홍예 테두리 돌(홍예석)
        ring = [(oc + (R + 0.25) * math.cos(t), y0 - 0.06, z0 + s + (R + 0.25) * math.sin(t))
                for t in np.linspace(0, np.pi, 14)]
        put('stone', tube(ring, 0.14, 4))
        xs = b
    put('stone', box(xs, y0, z0, cx + W / 2, y1, z0 + H))
    # 돌 쌓은 줄눈(가로 줄)
    for z in np.arange(z0 + 0.55, z0 + H - 0.3, 0.55):
        cuts = []
        for a, b, w, h in opens:
            R = w / 2
            s = h - R
            if z < z0 + s:
                cuts.append((a, b))
            elif z < z0 + s + R:
                hw = math.sqrt(max(R * R - (z - z0 - s) ** 2, 0))
                cuts.append(((a + b) / 2 - hw - 0.3, (a + b) / 2 + hw + 0.3))
        segs, x = [], cx - W / 2
        for a, b in sorted(cuts):
            if a > x:
                segs.append((x, a))
            x = max(x, b)
        segs.append((x, cx + W / 2))
        for a, b in segs:
            if b - a > 0.2:
                put('stone', box(a, y0 - 0.07, z, b, y0, z + 0.1))
                put('stone', box(a, y1, z, b, y1 + 0.07, z + 0.1))
    # 여장(성가퀴)
    zt = z0 + H
    for (ax, ay, bx, by) in [(cx - W / 2, y0, cx + W / 2, y0 + 0.4), (cx - W / 2, y1 - 0.4, cx + W / 2, y1),
                             (cx - W / 2, y0, cx - W / 2 + 0.4, y1), (cx + W / 2 - 0.4, y0, cx + W / 2, y1)]:
        put('stone', box(ax, ay, zt, bx, by, zt + 0.6))
    for x in np.arange(cx - W / 2 + 0.6, cx + W / 2 - 0.3, 1.2):
        put('stone', box(x, y0, zt + 0.6, x + 0.6, y0 + 0.4, zt + 0.95))
    if ongseong:
        R0, R1 = W / 2 + 1.2, W / 2 + 2.1
        ts = np.linspace(np.pi + 0.55, 2 * np.pi, 30)
        poly = ([(cx + R1 * math.cos(t), y0 + R1 * math.sin(t)) for t in ts] +
                [(cx + R0 * math.cos(t), y0 + R0 * math.sin(t)) for t in ts[::-1]])
        put('stone', extrude(poly, z0, z0 + H * 0.8, 'xy'))
        for t in ts[::2]:
            put('stone', box_rot(cx + (R1 - 0.2) * math.cos(t), y0 + (R1 - 0.2) * math.sin(t), z0 + H * 0.8,
                                 0.4, 0.4, 0.35, t))
    return pavilion(cx, cy, zt, *pav)


# ---------------------------------------------------------------- 경복궁·북촌
def build_palace():
    zb = PLATE_Z
    # 궁궐 마당(마사토)
    put('stone', box(-79, 25.5, zb - 0.1, -21, 53, zb + 0.15))
    zg = zb + 0.15
    # 궁성 담장 + 기와 지붕선
    walls = [(-79, 25.5, -61, 26.3), (-39, 25.5, -21, 26.3), (-79, 52.2, -21, 53),
             (-79, 25.5, -78.2, 53), (-21.8, 25.5, -21, 53)]
    for x0, y0, x1, y1 in walls:
        put('palace', box(x0, y0, zg, x1, y1, zg + 2.4))
        if x1 - x0 > y1 - y0:
            cy = (y0 + y1) / 2
            put('roofs', extrude([(cy - 0.75, zg + 2.3), (cy + 0.75, zg + 2.3), (cy, zg + 2.9)], x0 - 0.3, x1 + 0.3, 'yz'))
        else:
            cx = (x0 + x1) / 2
            put('roofs', extrude([(cx - 0.75, zg + 2.3), (cx + 0.75, zg + 2.3), (cx, zg + 2.9)], y0 - 0.3, y1 + 0.3, 'xz'))
    # 동십자각
    put('stone', box(-23.5, 23.0, zb, -18.5, 28.0, zb + 3.2))
    pavilion(-21, 25.5, zb + 3.2, 2.6, 2.6, 1.5, 1.6, 0.9, 0.4, bays=(1, 1), res=0.2)

    # 광화문: 홍예 3개, 2층 문루
    gate(-50, 26, zb, 22, 7, 4.6, [(-6, 2.8, 3.4), (0, 3.2, 3.8), (6, 2.8, 3.4)],
         (14, 5.4, 2.4, 1.5, 1.7, 0.9, (5, 2), (13, 4.4, 2.7, 3.4, 1.8, 1.1), 0.09, True, 0.2))
    # 해치상
    for sx in (-1, 1):
        x = -50 + sx * 3.4
        put('stone', box(x - 0.5, 21.2, zb, x + 0.5, 22.2, zb + 0.9))
        put('stone', blob(x, 21.7, zb + 1.3, 0.45, 0.5, 0.45, 0.05))

    # 흥례문 + 좌우 행각
    pavilion(-50, 33.5, zg + 0.6, 8, 3.6, 2.0, 2.4, 1.3, 0.6, (5, 1), tile=0.07, res=0.22)
    put('stone', box(-55, 31.3, zg, -45, 35.7, zg + 0.6))
    for sx in (-1, 1):
        x0 = -50 + sx * 5
        x1 = -50 + sx * 17
        put('palace', box(min(x0, x1), 32.8, zg, max(x0, x1), 34.2, zg + 1.5))
        hip_roof((x0 + x1) / 2, 33.5, zg + 1.5, abs(x1 - x0), 1.4, 0.9, 0.6, 0.2, res=0.5)
    # 영제교(금천 위 돌다리)
    put('water', box(-62, 30.0, zg - 0.1, -38, 30.7, zg + 0.05))
    put('stone', box(-51.5, 29.7, zg, -48.5, 31.0, zg + 0.35))

    # 근정전 회랑
    cx, cy = -50, 44
    x0, x1, y0, y1 = -60, -40, 36, 52
    for (a, b, c, d) in [(x0, y0, -52.5, y0 + 1.6), (-47.5, y0, x1, y0 + 1.6), (x0, y1 - 1.6, x1, y1),
                         (x0, y0, x0 + 1.6, y1), (x1 - 1.6, y0, x1, y1)]:
        put('palace', box(a, b, zg, c, d, zg + 1.3))
        if c - a > d - b:
            hip_roof((a + c) / 2, (b + d) / 2, zg + 1.3, c - a, d - b, 0.8, 0.5, 0.15, res=0.5)
        else:
            hip_roof((a + c) / 2, (b + d) / 2, zg + 1.3, c - a, d - b, 0.8, 0.5, 0.15, res=0.5, rot=True)
    pavilion(-50, y0 + 0.8, zg, 4.4, 1.8, 1.6, 1.6, 0.8, 0.5, (3, 1), res=0.22)  # 근정문
    # 박석 마당 + 어도
    put('stone', box(x0 + 1.6, y0 + 1.6, zg, x1 - 1.6, y1 - 1.6, zg + 0.08))
    put('stone', box(-50.6, y0 + 1.6, zg, -49.4, 41, zg + 0.18))
    # 품계석 두 줄
    for y in np.arange(37.9, 39.1, 0.4):
        for sx in (-1, 1):
            put('stone', box(-50 + sx * 2.2 - 0.12, y - 0.12, zg, -50 + sx * 2.2 + 0.12, y + 0.12, zg + 0.45))
    # 2단 월대 + 난간 + 계단
    tiers = [(14.0, 9.4, 0.8), (11.6, 7.6, 0.8)]
    z = zg
    for Lx, Ly, th in tiers:
        put('stone', box(cx - Lx / 2, cy + 1 - Ly / 2, z, cx + Lx / 2, cy + 1 + Ly / 2, z + th))
        ring_boxes('stone', cx, cy + 1, Lx - 0.2, Ly - 0.2, z + th, z + th + 0.45, 0.5, 0.13)
        for sgn in (-1, 1):
            put('stone', box(cx - Lx / 2 + 0.05, cy + 1 + sgn * (Ly / 2 - 0.1) - 0.05, z + th + 0.35,
                             cx + Lx / 2 - 0.05, cy + 1 + sgn * (Ly / 2 - 0.1) + 0.05, z + th + 0.48))
        for k in range(4):
            put('stone', box(cx - 1.4, cy + 1 - Ly / 2 - (4 - k) * 0.3, z, cx + 1.4, cy + 1 - Ly / 2, z + (k + 1) * th / 4))
        z += th
    pavilion(cx, cy + 1, z, 9.0, 5.0, 2.2, 1.3, 1.4, 0.8, (5, 3), (8.2, 4.2, 2.3, 3.0, 1.6, 1.0),
             tile=0.08, japsang=True, res=0.2)
    # 드므(방화수 항아리)
    for sx in (-1, 1):
        put('roofs', cyl(cx + sx * 5.2, cy - 3.3, zg + 0.8, zg + 1.3, 0.3, 0.38, 10))

    # 경회루 연못
    px0, px1, py0, py1 = -77.5, -61.5, 37.5, 51
    put('water', box(px0, py0, zg - 0.1, px1, py1, zg + 0.25))
    for a, b, c, d in [(px0 - 0.5, py0 - 0.5, px1 + 0.5, py0), (px0 - 0.5, py1, px1 + 0.5, py1 + 0.5),
                       (px0 - 0.5, py0, px0, py1), (px1, py0, px1 + 0.5, py1)]:
        put('stone', box(a, b, zg - 0.1, c, d, zg + 0.55))
    # 연못 속 작은 섬 2개 (소나무)
    for ix, iy in [(-70, 50.2), (-70, 38.5)]:
        put('stone', box(ix - 0.8, iy - 0.5, zg, ix + 0.8, iy + 0.5, zg + 0.5))
        tree(ix, iy, zg + 0.5, 0.6, 'pine')
    # 경회루: 석축 섬 + 돌기둥 48개
    gx, gy = -69.5, 44.5
    put('stone', box(gx - 6.0, gy - 4.6, zg - 0.1, gx + 6.0, gy + 4.6, zg + 0.55))
    zp = zg + 0.55
    xs = np.linspace(-5.0, 5.0, 8)
    ys = np.linspace(-3.6, 3.6, 6)
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            outer = i in (0, 7) or j in (0, 5)
            if outer:
                put('stone', box(gx + x - 0.22, gy + y - 0.22, zp, gx + x + 0.22, gy + y + 0.22, zp + 2.3))
            else:
                put('stone', cyl(gx + x, gy + y, zp, zp + 2.3, 0.2, n=8))
    put('palace', box(gx - 5.6, gy - 4.2, zp + 2.3, gx + 5.6, gy + 4.2, zp + 2.75))
    ring_boxes('palace', gx, gy, 11.0, 8.2, zp + 2.75, zp + 3.25, 0.5, 0.1)
    pavilion(gx, gy, zp + 2.75, 9.6, 6.8, 2.2, 3.0, 1.5, 0.9, (7, 5), tile=0.08, japsang=True, res=0.2)
    # 돌다리 3개
    for y in (gy - 3.0, gy, gy + 3.0):
        put('stone', box(gx + 6.0, y - 0.5, zg + 0.3, px1 + 0.5, y + 0.5, zg + 0.6))

    # 궁궐 안 나무
    for _ in range(40):
        x, y = rng.uniform(-77, -23), rng.uniform(27, 51.5)
        if (-62 < x < -38) or 31 < y < 36 or (px0 - 1 < x < px1 + 1 and py0 - 1 < y < py1 + 1):
            continue
        tree(x, y, zg, 0.7)


def hanok(cx, cy, w, d, shape, ang):
    """북촌 한옥 한 채: ㄱ/ㄷ/ㅁ자 집 + 담장."""
    zb = PLATE_Z
    with rotated(ang, cx, cy):
        # 담장(기와 얹은 돌담)
        put('stone', box(cx - w / 2, cy - d / 2, zb, cx + w / 2, cy - d / 2 + 0.22, zb + 0.75))
        put('stone', box(cx - w / 2, cy + d / 2 - 0.22, zb, cx + w / 2, cy + d / 2, zb + 0.75))
        put('stone', box(cx - w / 2, cy - d / 2, zb, cx - w / 2 + 0.22, cy + d / 2, zb + 0.75))
        put('stone', box(cx + w / 2 - 0.22, cy - d / 2, zb, cx + w / 2, cy + d / 2, zb + 0.75))
        for y in (cy - d / 2 + 0.11, cy + d / 2 - 0.11):
            put('roofs', box(cx - w / 2 - 0.1, y - 0.22, zb + 0.75, cx + w / 2 + 0.1, y + 0.22, zb + 0.9))
        put('blocks', box(cx - w / 2 + 0.25, cy - d / 2 + 0.25, zb, cx + w / 2 - 0.25, cy + d / 2 - 0.25, zb + 0.12))
        wing = 1.5
        iw, idp = w - 0.8, d - 0.8
        wings = [(cx, cy + idp / 2 - wing / 2, iw, wing, False)]  # 안채
        if shape in ('ㄱ', 'ㄷ', 'ㅁ'):
            wings.append((cx - iw / 2 + wing / 2, cy - wing * 0.15, wing, idp - wing * 0.3, True))
        if shape in ('ㄷ', 'ㅁ'):
            wings.append((cx + iw / 2 - wing / 2, cy - wing * 0.15, wing, idp - wing * 0.3, True))
        if shape == 'ㅁ':
            wings.append((cx, cy - idp / 2 + wing / 2, iw, wing, False))
        for wx, wy, lx, ly, r in wings:
            put('buildings', box(wx - lx / 2, wy - ly / 2, zb + 0.12, wx + lx / 2, wy + ly / 2, zb + 1.05))
            put('stone', box(wx - lx / 2 - 0.1, wy - ly / 2 - 0.1, zb, wx + lx / 2 + 0.1, wy + ly / 2 + 0.1, zb + 0.3))
            if r:
                hip_roof(wx, wy, zb + 1.05, lx, ly, 0.9, 0.45, 0.25, 0.22, 0.45, rot=True)
            else:
                hip_roof(wx, wy, zb + 1.05, lx, ly, 0.9, 0.45, 0.25, 0.22, 0.45)


def build_bukchon():
    shapes = ['ㄱ', 'ㄷ', 'ㅁ', 'ㄷ', 'ㄱ', 'ㅁ']
    for i, x in enumerate(np.arange(-17.5, -1, 5.2)):
        for j, y in enumerate(np.arange(30.5, 51, 5.0)):
            if mountain_h(x, y) > 0.4:
                continue
            hanok(x + rng.uniform(-0.2, 0.2), y, 4.6, 4.4, shapes[(i * 3 + j) % 6], rng.choice([0, 0, np.pi]))
            if rng.random() < 0.5:
                tree(x + 2.4, y + 2.2, PLATE_Z, 0.45)


# ---------------------------------------------------------------- 광화문광장·시청·성문
def statue_yi(x, y):
    zb = PLATE_Z + 0.25
    put('stone', box(x - 1.0, y - 1.0, zb, x + 1.0, y + 1.0, zb + 0.6))
    put('stone', box(x - 0.7, y - 0.7, zb + 0.6, x + 0.7, y + 0.7, zb + 2.6))
    put('stone', box(x - 0.8, y - 0.8, zb + 2.6, x + 0.8, y + 0.8, zb + 2.8))
    z = zb + 2.8
    put('roofs', cyl(x, y, z, z + 1.5, 0.48, 0.28, 10))           # 갑옷 입은 몸
    put('roofs', blob(x, y, z + 1.75, 0.22, 0.22, 0.25, 0.02))       # 머리
    put('roofs', cyl(x, y, z + 1.9, z + 2.2, 0.26, 0.08, 8))         # 투구
    put('roofs', tube([(x + 0.35, y - 0.3, z + 0.1), (x + 0.35, y - 0.35, z + 1.6)], 0.06, 4))  # 칼
    # 거북선 모형
    hull = [[(x + 0.5 * math.cos(t) * w, y - 2.4 + l, PLATE_Z + 0.25 + 0.35 * math.sin(t) * w + 0.35)
             for t in np.linspace(np.pi, 2 * np.pi, 8)] for l, w in [(-0.9, 0.3), (-0.4, 1.0), (0.5, 1.0), (0.9, 0.4)]]
    hull = [list(r) + [(r[-1][0], r[-1][1], r[-1][2] + 0.4), (r[0][0], r[0][1], r[0][2] + 0.4)] for r in hull]
    put('roofs', loft(hull))
    put('roofs', box(x - 0.05, y - 1.75, PLATE_Z + 0.9, x + 0.05, y - 1.45, PLATE_Z + 1.2))
    # 분수 물줄기 (12.23 분수)
    for k in range(12):
        t = k / 12 * 2 * np.pi
        px, py = x + 1.35 * math.cos(t), y + 1.35 * math.sin(t)
        P = [(px + 0.2 * s * math.cos(t), py + 0.2 * s * math.sin(t), PLATE_Z + 0.25 + 1.5 * s) for s in np.linspace(0, 1, 5)]
        put('water', tube(P, np.linspace(0.08, 0.04, 5), 4))


def statue_sejong(x, y):
    zb = PLATE_Z + 0.25
    put('stone', box(x - 1.6, y - 1.3, zb, x + 1.6, y + 1.3, zb + 1.1))
    for k in range(3):  # 계단식 기단
        put('stone', box(x - 1.4, y - 1.3 - 0.35 * (k + 1), zb, x + 1.4, y - 1.3 - 0.35 * k, zb + 1.1 - 0.35 * (k + 1)))
    z = zb + 1.1
    put('gold', box(x - 1.0, y - 0.3, z, x + 1.0, y + 0.8, z + 0.6))          # 어좌
    put('gold', box(x - 0.6, y - 0.6, z + 0.6, x + 0.6, y + 0.5, z + 1.0))     # 무릎
    put('gold', cyl(x, y + 0.2, z + 0.6, z + 1.9, 0.62, 0.38, 10))            # 몸
    put('gold', blob(x, y + 0.2, z + 2.2, 0.28, 0.28, 0.3, 0.02))             # 머리
    put('gold', cyl(x, y + 0.2, z + 2.4, z + 2.75, 0.26, 0.22, 8))            # 익선관
    put('gold', box(x - 0.25, y - 0.65, z + 1.0, x + 0.25, y - 0.4, z + 1.35))  # 책


def build_center():
    zb = PLATE_Z
    # 광화문광장
    put('blocks', box(-51.6, -8, zb, -48.4, 21, zb + 0.25))
    statue_yi(-50, 3)
    statue_sejong(-50, 12)
    for y in np.arange(-6.5, 20.5, 1.6):
        for sx in (-1, 1):
            if not (0.2 < y < 5.5 or 9.5 < y < 14.5):
                tree(-50 + sx * 1.25, y, zb + 0.25, 0.4, 'round')
    # 서울광장(타원 잔디) + 서울시청
    put('greenery', loft([ellipse(-50, -13.5, zb - 0.1, 5.5, 3.6, 32), ellipse(-50, -13.5, zb + 0.3, 5.3, 3.4, 32)]))
    put('blocks', box(-57.5, -24.5, zb, -42.5, -9.5, zb + 0.15))
    # 신청사: 파도처럼 앞으로 굽은 유리 처마
    prof = ([(-24.3, 0), (-19.5, 0), (-19.5, 4.5)] +
            [(-19.5 + 1.8 * math.sin(t * np.pi / 2), 4.5 + 3.3 * t) for t in np.linspace(0, 1, 9)[1:]] +
            [(-17.7 - 6.6 * u, 7.8 - 1.3 * u * u) for u in np.linspace(0, 1, 9)[1:]])
    poly = [(y, zb + z) for y, z in prof]
    put('glass', extrude(poly, -53.0, -44.5, 'yz'))
    for x in np.arange(-52.8, -44.6, 0.7):
        put('buildings', box(x, -19.55, zb, x + 0.1, -19.45, zb + 4.5))
    # 구청사(서울도서관) + 시계탑
    put('stone', box(-57.5, -19.0, zb, -53.5, -16.6, zb + 3.0))
    put('stone', box(-56.1, -17.3, zb + 3.0, -54.9, -16.6, zb + 4.6))
    put('roofs', cyl(-55.5, -17.0, zb + 4.6, zb + 5.4, 0.5, 0, 4, np.pi / 4))

    # 숭례문 (남대문)
    put('blocks', box(-41, -27, zb, -26, -14, zb + 0.15))
    gate(-33.5, -20.5, zb + 0.15, 12, 6.4, 4.0, [(0, 3.0, 3.4)],
         (8.6, 4.2, 2.2, 1.4, 1.5, 0.8, (5, 2), (8.0, 3.6, 2.5, 3.0, 1.6, 1.0), 0.08, True, 0.2))
    for x in (-40, -27):
        put('palace', box(x - 0.4, -24, zb + 0.15, x + 0.4, -17, zb + 1.8))

    # 흥인지문 (동대문) — 동쪽을 바라보고, 앞에 반원 옹성
    put('blocks', box(31, 3, zb, 49, 17, zb + 0.15))
    with rotated(np.pi / 2, 40, 10):
        gate(40, 10, zb + 0.15, 11, 6.2, 3.8, [(0, 2.8, 3.2)],
             (8.0, 4.0, 2.1, 1.3, 1.4, 0.8, (5, 2), (7.4, 3.4, 2.4, 2.9, 1.5, 1.0), 0.08, True, 0.2), ongseong=True)


# ---------------------------------------------------------------- 남산
def build_namsan():
    xs = np.linspace(4, 20, 81)
    ys = np.linspace(-6, 10, 81)
    X, Y = np.meshgrid(xs, ys, indexing='ij')
    H = namsan_h(X, Y)
    k = np.argmax(H)
    tx, ty = X.flat[k], Y.flat[k]
    zs = PLATE_Z + H.flat[k]
    # 정상 광장 + 사랑의 자물쇠 울타리
    put('stone', cyl(tx, ty, zs - 2.5, zs + 0.3, 5.0, 4.6, 32))
    zs += 0.3
    for t in np.linspace(0, 2 * np.pi, 56, endpoint=False):
        put('accents', box(tx + 4.45 * math.cos(t) - 0.05, ty + 4.45 * math.sin(t) - 0.05, zs,
                           tx + 4.45 * math.cos(t) + 0.05, ty + 4.45 * math.sin(t) + 0.05, zs + 0.5))
    fence = circle(tx, ty, zs + 0.5, 4.45, 56)
    put('accents', tube(np.vstack([fence, fence[:1]]), 0.06, 4))

    # N서울타워
    put('landmarks', cyl(tx, ty, zs, zs + 2.2, 2.6, 2.3, 32))
    for z in np.arange(zs + 0.4, zs + 2.2, 0.5):
        put('glass', cyl(tx, ty, z, z + 0.22, 2.62, 2.58, 32))
    rings = []
    for z in np.linspace(0, 26, 27):
        r = 0.95 + 1.15 * math.exp(-z / 2.2) - 0.15 * z / 26
        rings.append(circle(tx, ty, zs + 2.2 + z, r, 24))
    put('landmarks', loft(rings))
    zp = zs + 28.2
    put('landmarks', cyl(tx, ty, zp - 1.0, zp, 1.0, 2.7, 32))           # 전망대 받침
    put('landmarks', cyl(tx, ty, zp, zp + 0.5, 2.7, 2.7, 40))           # 하부 데크
    put('glass', cyl(tx, ty, zp + 0.5, zp + 2.6, 2.9, 3.1, 40))         # 전망 유리층
    for t in np.linspace(0, 2 * np.pi, 48, endpoint=False):             # 창틀
        put('landmarks', box_rot(tx + 3.05 * math.cos(t), ty + 3.05 * math.sin(t), zp + 0.5, 0.12, 0.12, 2.1, t))
    put('landmarks', cyl(tx, ty, zp + 2.6, zp + 3.0, 3.2, 3.2, 40))
    put('landmarks', cyl(tx, ty, zp + 3.0, zp + 4.0, 3.2, 1.9, 40))
    put('glass', cyl(tx, ty, zp + 4.0, zp + 4.9, 1.9, 1.7, 32))
    put('landmarks', cyl(tx, ty, zp + 4.9, zp + 5.5, 1.7, 1.0, 32))
    # 안테나: 빨강/흰색 띠
    z = zp + 5.5
    stages = [(0.95, 0.8, 3.0), (0.8, 0.6, 3.0), (0.6, 0.45, 2.8), (0.45, 0.3, 2.6), (0.3, 0.18, 2.4), (0.18, 0.08, 2.4)]
    for k, (r0, r1, h) in enumerate(stages):
        put('landmarks' if k % 2 == 0 else 'accents', cyl(tx, ty, z, z + h, r0, r1, 16))
        put('accents' if k % 2 == 0 else 'landmarks', cyl(tx, ty, z + h - 0.25, z + h, r1 + 0.12, r1 + 0.12, 16))
        z += h
    put('landmarks', cyl(tx, ty, z, z + 1.6, 0.08, 0.02, 8))
    tower_top = z + 1.6

    # 봉수대 5기 (정상 서쪽)
    for k in range(5):
        bx, by = tx - 9.5 + k * 1.3, ty - 4.6
        bz = ground_z(bx, by)
        put('stone', cyl(bx, by, bz - 1.0, bz + 0.6, 0.5, 0.45, 10))
        put('stone', cyl(bx, by, bz + 0.6, bz + 1.4, 0.45, 0.22, 10))
    # 팔각정
    ox, oy = tx - 7.0, ty + 3.0
    oz = ground_z(ox, oy)
    put('stone', cyl(ox, oy, oz - 1.2, oz + 0.35, 1.7, 1.6, 8, np.pi / 8))
    for t in np.linspace(0, 2 * np.pi, 8, endpoint=False):
        put('palace', cyl(ox + 1.2 * math.cos(t + np.pi / 8), oy + 1.2 * math.sin(t + np.pi / 8), oz + 0.35, oz + 1.7, 0.1, n=6))
    put('roofs', loft([circle(ox, oy, oz + 1.75, 2.1, 8, np.pi / 8), circle(ox, oy, oz + 1.95, 2.0, 8, np.pi / 8)],
                      apex=(ox, oy, oz + 3.0)))
    for t in np.linspace(0, 2 * np.pi, 8, endpoint=False):  # 처마 끝 솟음
        a = t + np.pi / 8
        put('roofs', tube([(ox + 1.2 * math.cos(a), oy + 1.2 * math.sin(a), oz + 2.45),
                           (ox + 2.2 * math.cos(a), oy + 2.2 * math.sin(a), oz + 2.05)], 0.07, 4))

    # 한양도성 성곽: 남산 정상에서 서쪽으로
    path = [(tx - 4, ty - 1.5), (tx - 10, ty - 3.5), (tx - 16, ty - 5), (tx - 22, ty - 7.5), (tx - 28, ty - 9),
            (tx - 34, ty - 12)]
    fortress(path)
    # 케이블카
    sx_, sy_ = -5.5, 16.0
    sz = ground_z(sx_, sy_)
    put('buildings', box(sx_ - 1.6, sy_ - 1.2, sz - 0.6, sx_ + 1.6, sy_ + 1.2, sz + 2.2))
    put('roofs', box(sx_ - 1.8, sy_ - 1.4, sz + 2.2, sx_ + 1.8, sy_ + 1.4, sz + 2.5))
    ex_, ey_ = tx - 5.0, ty + 6.2
    ez = ground_z(ex_, ey_)
    put('buildings', box(ex_ - 1.3, ey_ - 1.0, ez - 1.0, ex_ + 1.3, ey_ + 1.0, ez + 1.8))
    for off in (-0.35, 0.35):
        P = []
        for s in np.linspace(0, 1, 24):
            P.append((sx_ + (ex_ - sx_) * s + off, sy_ + (ey_ - sy_) * s, sz + 1.9 + (ez + 1.6 - sz - 1.9) * s - 1.6 * s * (1 - s)))
        put('markings', tube(P, 0.05, 4))
        cabin_s = 0.35 if off < 0 else 0.68
        cx_ = sx_ + (ex_ - sx_) * cabin_s + off
        cy_ = sy_ + (ey_ - sy_) * cabin_s
        cz_ = sz + 1.9 + (ez + 1.6 - sz - 1.9) * cabin_s - 1.6 * cabin_s * (1 - cabin_s)
        put('accents', box(cx_ - 0.5, cy_ - 0.4, cz_ - 1.4, cx_ + 0.5, cy_ + 0.4, cz_ - 0.5))
        put('glass', box(cx_ - 0.52, cy_ - 0.42, cz_ - 1.0, cx_ + 0.52, cy_ + 0.42, cz_ - 0.7))
        put('markings', box(cx_ - 0.04, cy_ - 0.04, cz_ - 0.55, cx_ + 0.04, cy_ + 0.04, cz_))

    # 해방촌: 남쪽 비탈의 촘촘한 집들
    pts = []
    for _ in range(1600):
        x, y = rng.uniform(-6, 34), rng.uniform(-23, -6)
        h = float(namsan_h(x, y))
        if not (0.5 < h < 9):
            continue
        slope = float(namsan_h(x + 1, y) - namsan_h(x - 1, y)) ** 2 + float(namsan_h(x, y + 1) - namsan_h(x, y - 1)) ** 2
        if slope > 2.0:
            continue
        if any((x - a) ** 2 + (y - b) ** 2 < 2.4 ** 2 for a, b in pts):
            continue
        pts.append((x, y))
        w, d, hh = rng.uniform(1.2, 2.0), rng.uniform(1.0, 1.6), rng.uniform(0.8, 1.8)
        corners = [float(namsan_h(x + sx * w / 2, y + sy * d / 2)) for sx in (-1, 1) for sy in (-1, 1)]
        zb = PLATE_Z + min(corners) - 0.1
        zt = PLATE_Z + max(corners) + hh
        put('buildings', box(x - w / 2, y - d / 2, zb, x + w / 2, y + d / 2, zt))
        if rng.random() < 0.45:
            put('greenery', cyl(x + w / 4, y, zt, zt + 0.4, 0.22, n=8))  # 옥상 물탱크
        if rng.random() < 0.06:
            cross(x - w / 4, y, zt)
    # 남산 숲
    for _ in range(4500):
        x, y = rng.uniform(-22, 46), rng.uniform(-22, 26)
        h = float(namsan_h(x, y))
        if h < 1.2:
            continue
        if (x - tx) ** 2 + (y - ty) ** 2 < 5.4 ** 2:
            continue
        if any((x - a) ** 2 + (y - b) ** 2 < 1.4 ** 2 for a, b in pts[-200:]) and h < 9:
            continue
        if (x - ox) ** 2 + (y - oy) ** 2 < 2.4 ** 2 or (-9 < x < tx - 5 + 1.5 and abs((y - sy_) - (x - sx_) * (ey_ - sy_) / (ex_ - sx_)) < 1.0):
            continue
        if rng.random() < 0.35:
            continue
        tree(x, y, PLATE_Z + h - 0.25, rng.uniform(0.7, 1.05))
    return tower_top


def fortress(path, step=0.6):
    """지형을 따라 오르내리는 성곽(여장 포함)."""
    P = []
    for (a, b), (c, d) in zip(path[:-1], path[1:]):
        L = math.hypot(c - a, d - b)
        for s in np.arange(0, L, step):
            P.append((a + (c - a) * s / L, b + (d - b) * s / L))
    P.append(path[-1])
    for k in range(len(P) - 1):
        (a, b), (c, d) = P[k], P[k + 1]
        za, zc = float(ground_z(a, b)), float(ground_z(c, d))
        ang = math.atan2(d - b, c - a)
        z0 = min(za, zc) - 0.8
        zt = max(za, zc) + 0.9
        put('stone', box_rot((a + c) / 2, (b + d) / 2, z0, step + 0.06, 0.7, zt - z0, ang))
        if k % 2 == 0:
            put('stone', box_rot((a + c) / 2, (b + d) / 2, zt, step * 0.55, 0.7, 0.35, ang))


def cross(x, y, z):
    put('buildings', box(x - 0.15, y - 0.15, z, x + 0.15, y + 0.15, z + 0.9))
    put('accents', box(x - 0.05, y - 0.05, z + 0.9, x + 0.05, y + 0.05, z + 2.0))
    put('accents', box(x - 0.3, y - 0.05, z + 1.55, x + 0.3, y + 0.05, z + 1.65))


def build_mountains():
    # 한양도성: 경복궁 서북 모서리 → 북악산 → 동쪽 능선
    wall = [(-80, 53.5), (-70, 58.5), (-58, 63.5), (-46, 67.5), (-36, 66), (-24, 63), (-12, 60), (0, 56.5), (8, 52.5)]
    fortress(wall)
    wp = np.vstack([np.linspace(a, b, 40) for a, b in zip(wall[:-1], wall[1:])])
    for _ in range(3600):
        x, y = rng.uniform(-99, 99), rng.uniform(49, 74.5)
        h = float(mountain_h(x, y))
        if h < 0.8 or rng.random() < 0.25:
            continue
        rock = math.exp(-((x - 50) / 14) ** 2 - ((y - 71) / 6) ** 2)
        if h > 26 or (rock > 0.45 and rng.random() < 0.85):   # 화강암 봉우리는 맨바위로
            continue
        if -80 < x < -20 and y < 54:
            continue
        if np.min(np.hypot(wp[:, 0] - x, wp[:, 1] - y)) < 1.1:
            continue
        tree(x, y, PLATE_Z + h - 0.3, rng.uniform(0.75, 1.15), 'pine' if h > 14 and rng.random() < 0.6 else None)


# ---------------------------------------------------------------- 한강: 다리·배·도로
def bridge_banpo(x):
    """반포대교(상판) + 잠수교(하판) + 달빛무지개분수."""
    w = 7.0
    ys = np.linspace(-75, -12, 140)
    yc = river_c(x)

    def deck_z(y):
        d = abs(y - yc)
        return 7.4 if d < HW + 8.2 else 7.4 - (7.4 - 5.05) * min((d - HW - 8.2) / 5.0, 1)

    pts = [(y, deck_z(y)) for y in ys if abs(y - yc) < HW + 13.2]
    rings = [[(x - w / 2, y, z), (x + w / 2, y, z), (x + w / 2, y, z - 1.0), (x - w / 2, y, z - 1.0)] for y, z in pts]
    put('bridges', loft(rings))
    # 난간
    for sx in (-1, 1):
        rr = [[(x + sx * (w / 2 - 0.15) - 0.1, y, z), (x + sx * (w / 2 - 0.15) + 0.1, y, z),
               (x + sx * (w / 2 - 0.15) + 0.1, y, z + 0.45), (x + sx * (w / 2 - 0.15) - 0.1, y, z + 0.45)] for y, z in pts]
        put('bridges', loft(rr))
    # 잠수교 (물 바로 위)
    put('bridges', box(x - 2.6, yc - HW - 1.0, 3.75, x + 2.6, yc + HW + 1.0, 4.25))
    # 교각
    for y in np.arange(yc - HW + 1.5, yc + HW - 1.0, 4.0):
        for sx in (-1, 1):
            put('bridges', cyl(x + sx * 2.0, y, 2.0, 6.5, 0.55, n=10))
        put('bridges', box(x - 3.2, y - 0.5, 6.0, x + 3.2, y + 0.5, 6.5))
    # 달빛무지개분수: 상판 양옆에서 강으로 떨어지는 물줄기
    for sx in (-1, 1):
        for y in np.arange(yc - HW + 0.6, yc + HW - 0.4, 0.9):
            P = [(x + sx * (w / 2 + 0.2 + 3.6 * s), y, 6.4 + 0.9 * s - 3.6 * s * s) for s in np.linspace(0, 1, 9)]
            put('water', tube(P, 0.08, 4))
    return [(x - 1.8, x + 1.8, deck_z)]


def bridge_arch(x):
    """3경간 타이드 아치교 + 옆의 철교(지하철 2호선)."""
    w = 6.0
    yc = river_c(x)
    ys = np.linspace(-75, -12, 140)

    def deck_z(y):
        d = abs(y - yc)
        return 7.2 if d < HW + 8.2 else 7.2 - (7.2 - 5.05) * min((d - HW - 8.2) / 5.0, 1)

    pts = [(y, deck_z(y)) for y in ys if abs(y - yc) < HW + 13.2]
    put('bridges', loft([[(x - w / 2, y, z), (x + w / 2, y, z), (x + w / 2, y, z - 0.9), (x - w / 2, y, z - 0.9)] for y, z in pts]))
    spans = [(yc - HW - 1.5 + k * (2 * HW + 3) / 3, yc - HW - 1.5 + (k + 1) * (2 * HW + 3) / 3) for k in range(3)]
    for s0, s1 in spans:
        for sx in (-1, 1):
            ax = x + sx * (w / 2 - 0.3)
            P = [(ax, s0 + (s1 - s0) * t, 7.2 + 3.6 * math.sin(np.pi * t)) for t in np.linspace(0, 1, 22)]
            put('bridges', tube(P, 0.28, 4, np.pi / 4))
            for t in np.linspace(0.08, 0.92, 12):
                yy = s0 + (s1 - s0) * t
                put('bridges', box(ax - 0.05, yy - 0.05, 7.2, ax + 0.05, yy + 0.05, 7.2 + 3.6 * math.sin(np.pi * t)))
        # 아치 사이 가로 브레이싱
        for t in (0.35, 0.5, 0.65):
            yy = s0 + (s1 - s0) * t
            zz = 7.2 + 3.6 * math.sin(np.pi * t)
            put('bridges', box(x - w / 2 + 0.3, yy - 0.12, zz - 0.15, x + w / 2 - 0.3, yy + 0.12, zz + 0.1))
        put('bridges', box(x - w / 2 - 2.6, s1 - 0.8, 2.0, x + w / 2 + 3.6, s1 + 0.8, 6.3))
    put('bridges', box(x - w / 2 - 2.6, spans[0][0] - 0.8, 2.0, x + w / 2 + 3.6, spans[0][0] + 0.8, 6.3))
    # 철교 (트러스)
    rx = x + w / 2 + 2.0
    put('bridges', loft([[(rx - 1.4, y, z - 0.4), (rx + 1.4, y, z - 0.4), (rx + 1.4, y, z - 1.2), (rx - 1.4, y, z - 1.2)] for y, z in pts]))
    for sx in (-1, 1):
        tx = rx + sx * 1.3
        put('bridges', box(tx - 0.08, yc - HW - 3, 9.2, tx + 0.08, yc + HW + 3, 9.4))
        ys2 = np.arange(yc - HW - 3, yc + HW + 3.01, 1.4)
        for a, b in zip(ys2[:-1], ys2[1:]):
            put('bridges', tube([(tx, a, 6.8), (tx, b, 9.3)], 0.07, 4))
            put('bridges', box(tx - 0.07, a - 0.07, 6.8, tx + 0.07, a + 0.07, 9.3))
    # 지하철 2호선 열차 (초록 띠는 accent 부품)
    y = yc - 9
    for k in range(6):
        put('vehicles', box(rx - 0.6, y, 6.8, rx + 0.6, y + 2.8, 7.95))
        put('greenery', box(rx - 0.62, y + 0.1, 7.25, rx + 0.62, y + 2.7, 7.45))
        y += 3.0
    return [(x - w / 2 + 0.6, x + w / 2 - 0.6, deck_z)]


def boat(x, y, L, W, ang):
    with rotated(ang, x, y):
        rings = []
        for t in np.linspace(-1, 1, 9):
            hw = W / 2 * (1 - abs(t) ** 3) ** 0.5 + 0.05
            yy = y
            xx = x + t * L / 2
            rings.append([(xx, yy - hw, 3.9), (xx, yy + hw, 3.9), (xx, yy + hw * 0.8, 3.3), (xx, yy - hw * 0.8, 3.3)])
        put('buildings', loft(rings))
        put('buildings', box(x - L * 0.3, y - W * 0.32, 3.9, x + L * 0.2, y + W * 0.32, 4.7))
        put('glass', box(x - L * 0.31, y - W * 0.33, 4.25, x + L * 0.21, y + W * 0.33, 4.5))
        put('buildings', box(x - L * 0.22, y - W * 0.25, 4.7, x + L * 0.08, y + W * 0.25, 5.2))
        put('accents', cyl(x - L * 0.05, y, 5.2, 5.8, 0.15, n=6))


def car(x, y, ang, bus=False):
    z = PLATE_Z
    if bus:
        put('vehicles', box_rot(x, y, z, 2.6, 0.85, 0.85, ang))
        put('glass', box_rot(x, y, z + 0.4, 2.62, 0.87, 0.22, ang))
    else:
        put('vehicles', box_rot(x, y, z, 1.25, 0.62, 0.32, ang))
        put('glass', box_rot(x - 0.05 * math.cos(ang), y - 0.05 * math.sin(ang), z + 0.32, 0.68, 0.56, 0.22, ang))


def build_river():
    for sgn in (1, -1):
        xs = np.arange(-99, 99, 0.5)
        # 강변북로 / 올림픽대로: 차선 점선
        for d in (HW + 5.3, HW + 7.2):
            for x0 in np.arange(-99, 98, 2.0):
                x1 = x0 + 1.0
                y0, y1 = river_c(x0) + sgn * d, river_c(x1) + sgn * d
                put('markings', box_rot((x0 + x1) / 2, (y0 + y1) / 2, PLATE_Z - 0.05, 1.0, 0.1, 0.1, math.atan2(y1 - y0, x1 - x0)))
        # 중앙분리대
        for x0 in np.arange(-99, 98, 3.0):
            x1 = x0 + 3.0
            y0, y1 = river_c(x0) + sgn * (HW + 6.25), river_c(x1) + sgn * (HW + 6.25)
            put('blocks', box_rot((x0 + x1) / 2, (y0 + y1) / 2, PLATE_Z - 0.05, 3.05, 0.25, 0.4, math.atan2(y1 - y0, x1 - x0)))
        # 차량
        for lane, dirn in [(HW + 4.9, 1), (HW + 5.7, 1), (HW + 6.8, -1), (HW + 7.6, -1)]:
            x = -98 + rng.uniform(0, 4)
            while x < 98:
                y = float(river_c(x)) + sgn * lane
                dy = float(river_c(x + 0.1) - river_c(x - 0.1)) / 0.2
                ang = math.atan2(dy, 1) + (0 if dirn > 0 else np.pi)
                car(x, y, ang, bus=rng.random() < 0.07)
                x += rng.uniform(2.2, 7)
        # 강변 가로수
        for x in np.arange(-98, 98, 2.6):
            y = float(river_c(x)) + sgn * (HW + 3.0 + rng.uniform(-0.6, 0.6))
            tree(x + rng.uniform(-0.5, 0.5), y, PLATE_Z + 0.3, 0.6, 'round')
    decks = bridge_banpo(-20) + bridge_arch(30)
    boat(-45, float(river_c(-45)) - 3.5, 7, 2.0, 0.08)
    boat(70, float(river_c(70)) + 4, 6, 1.8, np.pi - 0.05)
    boat(-80, float(river_c(-80)) + 2.0, 3.6, 1.2, 0.1)
    # 다리 위 차량
    for x0, x1, dz in decks:
        for lane, dirn in [(x0 + 0.45, -1), (x0 + 1.3, -1), (x1 - 1.3, 1), (x1 - 0.45, 1)]:
            y = -70 + rng.uniform(0, 3)
            while y < -14:
                if abs(y - river_c(lane)) < HW + 12.5:
                    z = dz(y)
                    if abs(y - river_c(lane)) < HW + 7:
                        put('vehicles', box_rot(lane, y, z, 1.25, 0.62, 0.32, np.pi / 2 * dirn))
                        put('glass', box_rot(lane, y, z + 0.32, 0.68, 0.56, 0.22, np.pi / 2 * dirn))
                y += rng.uniform(2.2, 6)


# ---------------------------------------------------------------- 도시 블록과 건물
SITES = [
    (-80, 24.5, -20, 54),       # 경복궁
    (-20, 28, 0.5, 53),         # 북촌
    (-54, -9, -46, 24),         # 세종대로·광장
    (-58, -26, -42, -9),        # 시청·서울광장
    (-41, -27, -26, -14),       # 숭례문
    (31, 3, 49, 17),            # 흥인지문
    (-9, 13, -2, 19.5),         # 케이블카 승강장
    (47, -78, 101, -55),        # 잠실(롯데)
    (-87, -76, -72, -60),       # 63빌딩
    (-71, -76, -58, -59),       # 파크원
]
BRIDGE_SITES = [(-25, -78, -15, -50), (-25, -32, -15, -13),   # 반포대교
                (24, -78, 38, -50), (24, -32, 38, -13)]       # 아치교
RESERVED = SITES + BRIDGE_SITES


def rect_sub(r, s):
    x0, y0, x1, y1 = r
    a0, b0, a1, b1 = s
    if a0 >= x1 or a1 <= x0 or b0 >= y1 or b1 <= y0:
        return [r]
    out = []
    if b0 > y0:
        out.append((x0, y0, x1, b0))
    if b1 < y1:
        out.append((x0, b1, x1, y1))
    yy0, yy1 = max(y0, b0), min(y1, b1)
    if a0 > x0:
        out.append((x0, yy0, a0, yy1))
    if a1 < x1:
        out.append((a1, yy0, x1, yy1))
    return out


XR = [(-100, 0), (-88, 1.8), (-76, 1.8), (-64, 1.8), (-50, 8), (-38, 2.2), (-26, 1.8), (-14, 1.8), (-2, 2.2),
      (10, 1.8), (22, 1.8), (34, 2.2), (46, 1.8), (58, 1.8), (70, 2.2), (82, 1.8), (94, 1.8), (100, 0)]
YR_N = [(-12, 1.8), (-1, 2.2), (10, 4.0), (21, 1.8), (33, 1.8), (44, 1.8), (75, 0)]
YR_S = [(-75, 0), (-66, 1.8)]


def zone(x, y):
    if y < -40:
        if x < -58:
            return 'yeouido'
        return 'apt'
    if -46 < x < -4 and y < 8:
        return 'cbd'
    if y > 12 and x < 22:
        return 'old'
    if x > 22:
        return 'east'
    if x < -56:
        return 'mapo'
    return 'mixed'


def make_blocks():
    blocks = []
    for (xa, wa), (xb, wb) in zip(XR[:-1], XR[1:]):
        bx0, bx1 = xa + wa / 2 + (1.0 if wa == 0 else 0), xb - wb / 2 - (1.0 if wb == 0 else 0)
        xs = np.linspace(bx0, bx1, 20)
        north_edge = float(np.max(river_c(xs))) + HW + 8.8
        south_edge = float(np.min(river_c(xs))) - HW - 8.8
        ys = [(north_edge, 0)] + YR_N
        for (ya, wa2), (yb, wb2) in zip(ys[:-1], ys[1:]):
            y0 = max(ya + wa2 / 2, north_edge)
            y1 = yb - wb2 / 2 - (1.0 if wb2 == 0 else 0)
            if y1 - y0 > 2.5 and y0 < 56:
                blocks.append((bx0, y0, bx1, min(y1, 56)))
        ys = YR_S + [(south_edge, 0)]
        for (ya, wa2), (yb, wb2) in zip(ys[:-1], ys[1:]):
            y0 = ya + wa2 / 2 + (1.0 if wa2 == 0 else 0)
            y1 = min(yb - wb2 / 2, south_edge)
            if y1 - y0 > 2.5:
                blocks.append((bx0, y0, bx1, y1))
    for s in RESERVED:
        blocks = [p for b in blocks for p in rect_sub(b, s)]
    return [b for b in blocks if b[2] - b[0] > 2.5 and b[3] - b[1] > 2.5]


def split_lots(r, target, out):
    x0, y0, x1, y1 = r
    w, h = x1 - x0, y1 - y0
    if max(w, h) < target * 1.6:
        out.append(r)
        return
    t = rng.uniform(0.38, 0.62)
    g = 0.35
    if w >= h:
        xm = x0 + w * t
        split_lots((x0, y0, xm - g / 2, y1), target, out)
        split_lots((xm + g / 2, y0, x1, y1), target, out)
    else:
        ym = y0 + h * t
        split_lots((x0, y0, x1, ym - g / 2), target, out)
        split_lots((x0, ym + g / 2, x1, y1), target, out)


def glass_tower(x0, y0, x1, y1, zb, h):
    tiers = [(0, h * (0.72 if rng.random() < 0.5 else 1.0), 0)]
    if tiers[0][1] < h:
        tiers.append((h * 0.72, h * 0.9, 0.5))
        tiers.append((h * 0.9, h, 1.0))
    for za, zt, inset in tiers:
        a0, b0, a1, b1 = x0 + inset, y0 + inset, x1 - inset, y1 - inset
        if a1 - a0 < 0.8 or b1 - b0 < 0.8:
            break
        put('glass', box(a0, b0, zb + za, a1, b1, zb + zt))
        for x in np.arange(a0 + 0.45, a1 - 0.2, 0.85):     # 세로 멀리언
            put('buildings', box(x - 0.05, b0 - 0.1, zb + za, x + 0.05, b0, zb + zt - 0.1))
            put('buildings', box(x - 0.05, b1, zb + za, x + 0.05, b1 + 0.1, zb + zt - 0.1))
        for y in np.arange(b0 + 0.45, b1 - 0.2, 0.85):
            put('buildings', box(a0 - 0.1, y - 0.05, zb + za, a0, y + 0.05, zb + zt - 0.1))
            put('buildings', box(a1, y - 0.05, zb + za, a1 + 0.1, y + 0.05, zb + zt - 0.1))
        put('buildings', box(a0 - 0.12, b0 - 0.12, zb + zt - 0.3, a1 + 0.12, b1 + 0.12, zb + zt))
        top = (a0, b0, a1, b1, zb + zt)
    a0, b0, a1, b1, zt = top
    cx, cy = (a0 + a1) / 2, (b0 + b1) / 2
    r = rng.random()
    if r < 0.3:   # 헬기장
        put('buildings', cyl(cx, cy, zt, zt + 0.3, min(a1 - a0, b1 - b0) * 0.35, n=16))
        put('markings', box(cx - 0.3, cy - 0.05, zt + 0.3, cx + 0.3, cy + 0.05, zt + 0.35))
    elif r < 0.55:
        put('buildings', cyl(cx, cy, zt, zt + 3.0, 0.1, 0.03, 6))
    else:
        put('buildings', box(cx - 0.8, cy - 0.6, zt, cx + 0.8, cy + 0.6, zt + 0.9))


def office(x0, y0, x1, y1, zb, h):
    put('buildings', box(x0, y0, zb, x1, y1, zb + h))
    for z in np.arange(zb + 0.9, zb + h - 0.3, 0.75):
        put('glass', box(x0 - 0.06, y0 - 0.06, z, x1 + 0.06, y1 + 0.06, z + 0.35))
    if x1 - x0 > 1.5 and y1 - y0 > 1.5:
        put('buildings', box(x0 + 0.4, y0 + 0.4, zb + h, x0 + 1.2, y0 + 1.2, zb + h + 0.6))


def lowrise(x0, y0, x1, y1, zb, h):
    put('buildings', box(x0, y0, zb, x1, y1, zb + h))
    put('buildings', box(x0 - 0.05, y0 - 0.05, zb + h, x1 + 0.05, y1 + 0.05, zb + h + 0.15))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = rng.random()
    if r < 0.35:
        put('greenery', cyl(x1 - 0.4, y1 - 0.4, zb + h, zb + h + 0.45, 0.25, n=8))   # 옥상 물탱크
    elif r < 0.5:
        put('buildings', box(x0 + 0.2, y0 + 0.2, zb + h, x0 + 0.8, y0 + 0.7, zb + h + 0.5))
    if rng.random() < 0.07:
        cross(cx, cy, zb + h)
    # 1층 상가 차양
    if rng.random() < 0.5:
        put('accents' if rng.random() < 0.3 else 'glass', box(x0 + 0.1, y0 - 0.25, zb + 0.6, x1 - 0.1, y0, zb + 0.72))


def apartment(x0, y0, x1, y1, zb, h):
    """남향 판상형 아파트: 층마다 발코니, 세대 벽, 옥상 엘리베이터실."""
    put('buildings', box(x0, y0, zb, x1, y1, zb + h))
    fh = 0.62
    for z in np.arange(zb + fh, zb + h - 0.2, fh):
        put('buildings', box(x0 + 0.1, y0 - 0.32, z - 0.08, x1 - 0.1, y0, z))
    for x in np.arange(x0 + 1.1, x1 - 0.5, 2.2):
        put('buildings', box(x - 0.06, y0 - 0.34, zb + 0.6, x + 0.06, y0, zb + h - 0.2))
    for x in np.arange(x0 + 2.2, x1 - 1.0, 4.4):
        put('buildings', box(x - 0.6, y0 + 0.4, zb + h, x + 0.6, y1 - 0.2, zb + h + 0.8))
        put('buildings', box(x - 0.55, y1, zb, x + 0.55, y1 + 0.5, zb + h + 0.3))   # 뒤편 계단실
    put('accents', box(x0 - 0.02, y0 + 0.4, zb + h - 1.6, x0, y1 - 0.4, zb + h - 0.4))  # 측벽 단지 로고 자리


def danji(b, zb):
    x0, y0, x1, y1 = b
    x0, y0, x1, y1 = x0 + 0.7, y0 + 0.7, x1 - 0.7, y1 - 0.7
    W, gap = 2.4, 3.4
    nrow = int((y1 - y0 + gap) // (W + gap))
    if nrow < 1:
        return False
    base_h = rng.uniform(9, 17)
    put('greenery', box(x0 - 0.3, y0 - 0.3, zb - 0.05, x1 + 0.3, y1 + 0.3, zb + 0.1))
    y = y0
    for r in range(nrow):
        L = x1 - x0
        n = max(1, int(L // 13))
        seg = (L - (n - 1) * 1.6) / n
        for k in range(n):
            a = x0 + k * (seg + 1.6)
            apartment(a, y, a + seg, y + W, zb, base_h + rng.uniform(-1.5, 2.5))
        # 동 사이 주차장 + 조경수
        yy = y + W + 0.6
        if r < nrow - 1:
            for x in np.arange(x0 + 0.6, x1 - 0.6, 0.85):
                if rng.random() < 0.55:
                    put('vehicles', box(x - 0.3, yy, zb + 0.1, x + 0.3, yy + 1.1, zb + 0.45))
            for x in np.arange(x0 + 1.0, x1 - 0.5, 2.3):
                tree(x, y + W + gap - 0.9, zb + 0.1, 0.5, 'round')
        y += W + gap
    return True


def build_city():
    blocks = make_blocks()
    for b in blocks:
        x0, y0, x1, y1 = b
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if hill_h(cx, cy) > 3:
            continue
        put('blocks', box(x0, y0, PLATE_Z - 0.1, x1, y1, PLATE_Z + 0.3))
        zb = PLATE_Z + 0.3
        z = zone(cx, cy)
        if z == 'apt' or (z == 'east' and rng.random() < 0.35) or (z == 'mapo' and rng.random() < 0.3):
            if hill_h(cx, cy) < 0.3 and danji(b, zb):
                continue
        target = {'cbd': 6.5, 'yeouido': 6.0, 'old': 2.6, 'east': 3.2, 'mapo': 4.0, 'mixed': 3.6, 'apt': 4}[z]
        lots = []
        split_lots((x0 + 0.5, y0 + 0.5, x1 - 0.5, y1 - 0.5), target, lots)
        for a0, b0, a1, b1 in lots:
            if a1 - a0 < 0.9 or b1 - b0 < 0.9:
                continue
            if max(hill_h(a0, b0), hill_h(a1, b1), hill_h(a0, b1), hill_h(a1, b0)) > 0.3:
                continue
            if z == 'cbd':
                d = math.hypot((a0 + a1) / 2 + 28, (b0 + b1) / 2 + 12)
                h = rng.uniform(12, 34) * max(0.45, 1 - d / 45)
                (glass_tower if rng.random() < 0.6 else office)(a0, b0, a1, b1, zb, max(h, 8))
            elif z == 'yeouido':
                glass_tower(a0, b0, a1, b1, zb, rng.uniform(16, 32))
            elif z == 'old':
                if rng.random() < 0.12:
                    office(a0, b0, a1, b1, zb, rng.uniform(4, 9))
                else:
                    lowrise(a0, b0, a1, b1, zb, rng.uniform(1.0, 3.6))
            else:
                r = rng.random()
                if r < 0.62:
                    lowrise(a0, b0, a1, b1, zb, rng.uniform(1.2, 4.5))
                elif r < 0.88:
                    office(a0, b0, a1, b1, zb, rng.uniform(5, 13))
                else:
                    glass_tower(a0, b0, a1, b1, zb, rng.uniform(10, 20))
    return blocks


def in_any(x, y, rects, pad=0.0):
    return any(a - pad <= x <= c + pad and b - pad <= y <= d + pad for a, b, c, d in rects)


def build_streets(blocks):
    """도로 위 차량·차선·횡단보도·가로수."""
    zone_free = lambda x, y: (not in_any(x, y, blocks, 0.3) and not in_any(x, y, SITES, 0.0)
                              and hill_h(x, y) < 0.2 and abs(y - river_c(x)) > HW + 8.6 and -74 < y < 54)
    # 남북 도로
    for xr, w in XR[1:-1]:
        if w > 3:
            continue
        y = -73.0
        while y < 52:
            for off, ang in ((-w / 4, -np.pi / 2), (w / 4, np.pi / 2)):
                if zone_free(xr + off, y) and rng.random() < 0.35:
                    car(xr + off, y, ang, bus=rng.random() < 0.08)
            y += rng.uniform(1.8, 3.2)
    # 동서 도로
    for yr, w in YR_N[:-1] + YR_S[1:]:
        x = -99.0
        while x < 99:
            for off, ang in ((-w / 4, 0.0), (w / 4, np.pi)):
                p = 0.7 if w >= 4 else 0.3
                if zone_free(x, yr + off) and rng.random() < p:
                    car(x, yr + off, ang, bus=rng.random() < (0.15 if w >= 4 else 0.05))
            x += rng.uniform(1.8, 3.2)
        if w >= 4:   # 종로: 중앙 점선 + 가로수
            for x in np.arange(-99, 99, 2.0):
                if zone_free(x, yr):
                    put('markings', box(x, yr - 0.06, PLATE_Z - 0.05, x + 1.0, yr + 0.06, PLATE_Z + 0.04))
    # 세종대로 양쪽 차로
    for x, ang in ((-53.3, -np.pi / 2), (-52.3, -np.pi / 2), (-47.7, np.pi / 2), (-46.7, np.pi / 2)):
        y = -8.0 + rng.uniform(0, 2)
        while y < 20:
            car(x, y, ang, bus=rng.random() < 0.12)
            y += rng.uniform(1.8, 3.5)
    # 큰 교차로 횡단보도
    for xr, w in XR[1:-1]:
        for yr, w2 in YR_N[:-1]:
            if w2 < 2.2 and w < 2.2:
                continue
            for sgn in (-1, 1):
                yy = yr + sgn * (w2 / 2 + 0.6)
                if not zone_free(xr, yy):
                    continue
                for k in np.arange(-w / 2 + 0.15, w / 2 - 0.1, 0.4):
                    put('markings', box(xr + k, yy - 0.5, PLATE_Z - 0.05, xr + k + 0.2, yy + 0.5, PLATE_Z + 0.04))


# ---------------------------------------------------------------- 여의도·잠실
def building_63(cx, cy):
    zb = PLATE_Z
    put('blocks', box(cx - 7, cy - 4, zb - 0.1, cx + 7, cy + 4, zb + 0.3))
    zb += 0.3
    prof = [(-5, 0), (5, 0), (5, 34), (4.2, 36), (3.4, 38.5), (2.6, 41), (1.8, 43)] + [(-1.8, 43), (-2.6, 41), (-3.4, 38.5), (-4.2, 36), (-5, 34)]
    poly = [(cx + x, zb + z) for x, z in prof]
    put('gold', extrude(poly, cy - 1.8, cy + 1.8, 'xz'))
    for x in np.arange(-4.7, 4.75, 0.6):
        top = np.interp(abs(x), [0, 1.8, 2.6, 3.4, 4.2, 5.0], [43, 43, 41, 38.5, 36, 34]) - 0.3
        for y, s in ((cy - 1.8, -1), (cy + 1.8, 1)):
            put('gold', box(cx + x - 0.06, y, zb, cx + x + 0.06, y + s * 0.12, zb + top))
    put('gold', box(cx - 6, cy - 3, zb, cx + 6, cy + 3, zb + 2.5))         # 저층부(아쿠아리움)
    put('glass', box(cx - 6.05, cy - 3.05, zb + 1.0, cx + 6.05, cy + 3.05, zb + 1.8))


def parc1(cx, cy):
    zb = PLATE_Z
    put('blocks', box(cx - 6, cy - 6.5, zb - 0.1, cx + 6, cy + 6.5, zb + 0.3))
    zb += 0.3
    for (x, y, h) in [(cx - 2.6, cy - 3.0, 46), (cx + 2.4, cy + 3.0, 40)]:
        put('glass', box(x - 2.2, y - 2.0, zb, x + 2.2, y + 2.0, zb + h))
        for z in np.arange(zb + 1.0, zb + h, 1.0):
            put('buildings', box(x - 2.25, y - 2.05, z, x + 2.25, y + 2.05, z + 0.08))
        # 빨간 수직 프레임: 모서리 메가 기둥이 지붕 위로 솟는다
        for sx in (-1, 1):
            for sy in (-1, 1):
                put('accents', box(x + sx * 2.45 - 0.3, y + sy * 2.25 - 0.3, zb, x + sx * 2.45 + 0.3, y + sy * 2.25 + 0.3, zb + h + 2.4))
            put('accents', box(x + sx * 2.45 - 0.3, y - 2.55, zb + h + 2.0, x + sx * 2.45 + 0.3, y + 2.55, zb + h + 2.4))
    put('glass', box(cx - 5, cy - 6.2, zb, cx + 0, cy - 4.8, zb + 6))       # 백화점
    put('glass', box(cx - 5.5, cy + 0.5, zb, cx - 1.0, cy + 6.5, zb + 3))


def lotte_tower(cx, cy):
    zb = PLATE_Z + 0.3
    H = 84.0
    rings = []
    th = np.linspace(0, 2 * np.pi, 96, endpoint=False)
    c, s = np.cos(th), np.sin(th)
    p = 3.4
    bx = np.sign(c) * np.abs(c) ** (2 / p)
    by = np.sign(s) * np.abs(s) ** (2 / p)
    delta = np.abs(((th + np.pi / 4) % (np.pi / 2)) - np.pi / 4)   # 각 면 중앙선까지의 각거리
    for z in np.linspace(0, H, 64):
        t = z / H
        half = 5.6 * (1 - 0.6 * t ** 1.3)
        seam = 1 - 0.045 * np.exp(-(delta / 0.05) ** 2) * (t < 0.95)
        rings.append(np.stack([cx + half * bx * seam, cy + half * by * seam, np.full(96, zb + z)], 1))
    put('glass', loft(rings))
    # 스카이 로비 띠
    for z in (16, 32, 48, 62, 74):
        t = z / H
        half = 5.6 * (1 - 0.6 * t ** 1.3) + 0.08
        put('landmarks', loft([np.stack([cx + half * bx, cy + half * by, np.full(96, zb + z)], 1),
                               np.stack([cx + half * bx, cy + half * by, np.full(96, zb + z + 0.35)], 1)]))
    # 꼭대기 랜턴(다이아그리드 왕관)
    top = 5.6 * (1 - 0.6)
    for sx in (-1, 1):
        for sy in (-1, 1):
            P = [(cx + sx * top * 0.8 * (1 - 0.35 * u), cy + sy * top * 0.8 * (1 - 0.35 * u), zb + H + 8 * u) for u in np.linspace(0, 1, 6)]
            put('landmarks', tube(P, 0.14, 4))
    for k, z in enumerate((H + 2.0, H + 4.5, H + 7.0)):
        u = (z - H) / 8
        a = top * 0.8 * (1 - 0.35 * u)
        for sx in (-1, 1):
            put('landmarks', box(cx - a, cy + sx * a - 0.07, zb + z, cx + a, cy + sx * a + 0.07, zb + z + 0.14))
            put('landmarks', box(cx + sx * a - 0.07, cy - a, zb + z, cx + sx * a + 0.07, cy + a, zb + z + 0.14))
        for sx in (-1, 1):   # 대각 부재
            put('landmarks', tube([(cx - a, cy + sx * a, zb + z - 2.4 if k else zb + H), (cx + a, cy + sx * a, zb + z + 0.1)], 0.06, 4))
    put('landmarks', cyl(cx, cy, zb + H, zb + H + 9.5, 0.3, 0.05, 8))
    return zb + H + 9.5


def build_jamsil():
    zb = PLATE_Z
    put('blocks', box(48, -74, zb - 0.1, 99, -57, zb + 0.3))
    # 석촌호수 + 매직아일랜드
    lx, ly = 60, -65.5
    ellipse_ring('stone', lx, ly, 9.0, 5.5, 0.6, zb - 0.1, zb + 0.7)
    put('water', loft([ellipse(lx, ly, zb + 0.1, 9.05, 5.55, 40), ellipse(lx, ly, zb + 0.45, 9.05, 5.55, 40)]))
    ix, iy = lx + 2.5, ly - 0.5
    put('greenery', cyl(ix, iy, zb, zb + 0.7, 2.4, 2.2, 20))
    z = zb + 0.7
    put('buildings', box(ix - 0.9, iy - 0.7, z, ix + 0.9, iy + 0.7, z + 1.4))
    put('buildings', cyl(ix, iy, z, z + 3.6, 0.45, n=10))
    put('glass', cyl(ix, iy, z + 3.6, z + 5.0, 0.6, 0, 10))
    for sx, sy, hh in [(-1, -1, 2.2), (1, -1, 2.2), (-1, 1, 2.6), (1, 1, 2.6)]:
        put('buildings', cyl(ix + sx * 0.95, iy + sy * 0.75, z, z + hh, 0.28, n=8))
        put('glass', cyl(ix + sx * 0.95, iy + sy * 0.75, z + hh, z + hh + 0.9, 0.38, 0, 8))
    for _ in range(30):
        t = rng.uniform(0, 2 * np.pi)
        tree(lx + 9.4 * math.cos(t), ly + 5.9 * math.sin(t), zb + 0.6, 0.55, 'round')
    # 롯데월드타워 + 몰
    top = lotte_tower(83, -65.0)
    put('glass', box(89.5, -73.5, zb + 0.3, 98.5, -62, zb + 4.5))
    put('buildings', box(89.3, -73.7, zb + 4.5, 98.7, -61.8, zb + 4.8))
    put('glass', box(73, -73.5, zb + 0.3, 77.5, -60, zb + 5.5))
    put('buildings', box(70, -60.5, zb + 0.3, 96, -58, zb + 2.2))
    return top


# ---------------------------------------------------------------- 이름판
def build_label():
    from PIL import Image, ImageDraw, ImageFont
    font = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 120)
    text = '서울  SEOUL'
    tmp = Image.new('L', (10, 10))
    l, t, r, b = ImageDraw.Draw(tmp).textbbox((0, 0), text, font=font)
    img = Image.new('L', (r - l + 8, b - t + 8), 0)
    ImageDraw.Draw(img).text((4 - l, 4 - t), text, font=font, fill=255)
    H_mm = 3.2
    px = H_mm / img.size[1]
    ds = 3
    img = img.resize((img.size[0] // ds, img.size[1] // ds), Image.LANCZOS)
    px *= ds
    A = np.array(img) > 110
    rows, cols = A.shape
    W_mm = cols * px
    x_left = -W_mm / 2
    z_top = 0.9 + H_mm
    # 같은 가로 구간이 이어지면 세로로 합친 직사각형으로 만든다
    open_runs = {}
    rects = []
    for i in range(rows + 1):
        runs = set()
        if i < rows:
            row = A[i]
            j = 0
            while j < cols:
                if row[j]:
                    k = j
                    while k < cols and row[k]:
                        k += 1
                    runs.add((j, k))
                    j = k
                else:
                    j += 1
        for key in list(open_runs):
            if key not in runs:
                rects.append((key[0], key[1], open_runs.pop(key), i))
        for key in runs:
            if key not in open_runs:
                open_runs[key] = i
    for j0, j1, i0, i1 in rects:
        put('markings', box(x_left + j0 * px, -75.6, z_top - i1 * px, x_left + j1 * px, -74.95, z_top - i0 * px))
    # 테두리 선
    put('markings', box(-W_mm / 2 - 3, -75.4, 0.5, W_mm / 2 + 3, -74.95, 0.7))


# ---------------------------------------------------------------- 출력
def write_stl(path, V, F):
    tri = V[F].astype(np.float32)
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    n = (n / np.where(ln > 0, ln, 1)).astype(np.float32)
    rec = np.zeros(len(F), dtype=[('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')])
    rec['n'], rec['v'] = n, tri
    with open(path, 'wb') as f:
        f.write(b'Seoul diorama for Tinkercad - units: mm'.ljust(80, b' '))
        f.write(struct.pack('<I', len(F)))
        f.write(rec.tobytes())


def main():
    build_terrain()
    build_palace()
    build_bukchon()
    build_center()
    tower_top = build_namsan()
    build_mountains()
    build_river()
    blocks = build_city()
    build_streets(blocks)
    building_63(-80, -67)
    parc1(-64.5, -67.5)
    lotte_top = build_jamsil()
    build_label()

    os.makedirs(os.path.join(OUT, 'parts'), exist_ok=True)
    arrays = {g: G[g].arrays() for g in GROUPS if G[g].n}
    lo = np.min([V.min(0) for V, F in arrays.values()], 0)
    hi = np.max([V.max(0) for V, F in arrays.values()], 0)
    # 부품마다 같은 두 모서리에 0.3 mm 정렬용 큐브를 넣어 경계 상자를 똑같이 맞춘다.
    # Tinkercad는 가져온 파일을 경계 상자 기준으로 놓기 때문에 부품들이 제자리에 겹쳐진다.
    mk = [box(lo[0], lo[1], lo[2], lo[0] + 0.3, lo[1] + 0.3, lo[2] + 0.3),
          box(hi[0] - 0.3, hi[1] - 0.3, hi[2] - 0.3, hi[0], hi[1], hi[2])]
    allV, allF, n0, total = [], [], 0, 0
    print(f'{"부품":<10} {"삼각형":>9}')
    for g, (V, F) in arrays.items():
        PV = np.vstack([V, mk[0][0], mk[1][0]])
        PF = np.vstack([F, mk[0][1] + len(V), mk[1][1] + len(V) + 8])
        write_stl(os.path.join(OUT, 'parts', f'{g}.stl'), PV, PF)
        allV.append(V)
        allF.append(F + n0)
        n0 += len(V)
        total += len(F)
        print(f'{g:<10} {len(F):>9,}')
    V, F = np.vstack(allV), np.vstack(allF)
    write_stl(os.path.join(OUT, 'seoul_diorama.stl'), V, F)
    print(f'{"합계":<10} {total:>9,}')
    print('크기(mm):', np.round(V.min(0), 1), '~', np.round(V.max(0), 1))
    print(f'N서울타워 꼭대기 z={tower_top:.1f}, 롯데월드타워 꼭대기 z={lotte_top:.1f}')
    return V, F


if __name__ == '__main__':
    main()
