"""산비탈 마을 + 수소 트램 + 도시형 곤돌라 디오라마 -> Tinkercad용 STL 생성기.

단위는 mm. X: 서(언덕) -> 동(도심), Y: 앞 -> 뒤, Z: 위.
색깔별로 STL을 나눠 저장하므로 Tinkercad에서 파일마다 색을 지정하면 된다.
모든 파일(바닥판 제외)에는 바닥판 모서리 속에 숨은 0.3mm 정렬 마커가 들어 있어
따로따로 가져와도 같은 자리에 정렬된다.
"""
import math
import os
import random
import struct
import zipfile

import numpy as np
from scipy.spatial import ConvexHull

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "stl")

# ---------------------------------------------------------------- 색 그룹
COLORS = {
    "01_base_plate":       ("#E9E4DA", "바닥판"),
    "02_ground":           ("#CFE8C4", "평지 잔디"),
    "03_hill":             ("#BFD8A2", "매끈한 언덕 비탈"),
    "04_river":            ("#8FC8E8", "강"),
    "05_paths_gray":       ("#C4C4CC", "도로·트램 선로 바닥·빌라 주차 바닥"),
    "06_walls_cream":      ("#FFF1D0", "빌라 벽(밝은 크림)"),
    "07_red_brick":        ("#CF8A72", "빌라 벽(붉은 벽돌)"),
    "08_walls_sky":        ("#D3E6F5", "빌라 벽(밝은 하늘)"),
    "09_roof_blue":        ("#8DB3E2", "시장 지붕·자동차(파랑)"),
    "10_roof_orange":      ("#F2B489", "시장 지붕(주황)"),
    "11_roof_green":       ("#9AD1A5", "빌라 옥상 초록 방수면"),
    "12_brown_details":    ("#A9805F", "나무줄기·화단·가판대·나무다리"),
    "13_trees":            ("#86C784", "둥근 나무"),
    "14_white_structures": ("#FAFAFA", "곤돌라 정거장·철탑·병원·필로티 기둥·트램 차체"),
    "15_glass":            ("#BDE2F2", "유리(창문·엘리베이터·캐노피)"),
    "16_solar_panels":     ("#3D5A8A", "태양광 패널"),
    "17_cable_dark":       ("#555B66", "케이블·회전 바퀴·트램 레일과 대차"),
    "18_accent_yellow":    ("#FFD98A", "곤돌라 장식·물탱크·꽃·시장 지붕"),
    "19_accent_red":       ("#EE8A8A", "병원 십자가·꽃·시장 지붕·자동차"),
    "20_wheelchair_blue":  ("#4A8FD9", "휠체어·지하철 표지"),
    "21_people_goods":     ("#F49A7A", "휠체어 탄 사람·시장 물건"),
    "22_tram_mint":        ("#7FD3C0", "수소 트램 지붕·띠·노즐"),
    "23_water":            ("#CDEFFF", "트램 분수와 물줄기"),
    "24_flowers_pink":     ("#F7A6C8", "화단 꽃(분홍)"),
}
parts = {k: [] for k in COLORS}


# ---------------------------------------------------------------- 도형
def convex(points, group):
    pts = np.asarray(points, dtype=float)
    hull = ConvexHull(pts)
    tris = []
    for simplex, eq in zip(hull.simplices, hull.equations):
        a, b, c = pts[simplex]
        if np.dot(np.cross(b - a, c - a), eq[:3]) < 0:
            b, c = c, b
        tris.append((a, b, c))
    parts[group].extend(tris)


def box(x0, x1, y0, y1, z0, z1, group):
    convex([(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)], group)


def frustum(cx, cy, z0, z1, w0, w1, group):
    pts = []
    for z, w in ((z0, w0), (z1, w1)):
        h = w / 2
        pts += [(cx - h, cy - h, z), (cx + h, cy - h, z), (cx - h, cy + h, z), (cx + h, cy + h, z)]
    convex(pts, group)


def cyl(p0, p1, r, group, n=18):
    p0, p1 = np.array(p0, float), np.array(p1, float)
    axis = p1 - p0
    axis /= np.linalg.norm(axis)
    ref = np.array([0, 0, 1.0]) if abs(axis[2]) < 0.9 else np.array([1.0, 0, 0])
    u = np.cross(axis, ref)
    u /= np.linalg.norm(u)
    v = np.cross(axis, u)
    pts = []
    for k in range(n):
        t = 2 * math.pi * k / n
        off = r * (math.cos(t) * u + math.sin(t) * v)
        pts += [p0 + off, p1 + off]
    convex(pts, group)


def sphere(c, r, group, n=14, squash=1.0):
    pts = []
    for i in range(1, n // 2):
        phi = math.pi * i / (n // 2)
        for k in range(n):
            t = 2 * math.pi * k / n
            pts.append((c[0] + r * math.sin(phi) * math.cos(t),
                        c[1] + r * math.sin(phi) * math.sin(t),
                        c[2] + r * squash * math.cos(phi)))
    pts += [(c[0], c[1], c[2] + r * squash), (c[0], c[1], c[2] - r * squash)]
    convex(pts, group)


def cone(cx, cy, z0, r, h, group, n=16):
    pts = [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n), z0)
           for k in range(n)]
    pts.append((cx, cy, z0 + h))
    convex(pts, group)


def gable(x0, x1, y0, y1, zt, h, along_x, group, o=0.4):
    if along_x:
        ym = (y0 + y1) / 2
        pts = [(x0 - o, y0 - o, zt), (x1 + o, y0 - o, zt), (x0 - o, y1 + o, zt), (x1 + o, y1 + o, zt),
               (x0 - o, ym, zt + h), (x1 + o, ym, zt + h)]
    else:
        xm = (x0 + x1) / 2
        pts = [(x0 - o, y0 - o, zt), (x1 + o, y0 - o, zt), (x0 - o, y1 + o, zt), (x1 + o, y1 + o, zt),
               (xm, y0 - o, zt + h), (xm, y1 + o, zt + h)]
    convex(pts, group)


def tilted_panel(x0, x1, y0, depth, z0, angle_deg, group, t=0.4):
    """앞(-y)을 향해 기울어진 판. 뒤쪽 모서리가 높다."""
    a = math.radians(angle_deg)
    dy, dz = depth * math.cos(a), depth * math.sin(a)
    nz, ny = t * math.cos(a), -t * math.sin(a)
    pts = []
    for x in (x0, x1):
        for (y, z) in ((y0, z0), (y0 + dy, z0 + dz)):
            pts += [(x, y, z), (x, y + ny, z + nz)]
    convex(pts, group)


def tree(x, y, z, size, rng):
    cyl((x, y, z - 0.5), (x, y, z + 1.4 * size), 0.35 * size, "12_brown_details", n=6)
    sphere((x, y, z + 2.6 * size), 1.5 * size * rng.uniform(0.9, 1.1), "13_trees", n=8)


rng = random.Random(7)

# ---------------------------------------------------------------- 바닥
XMIN, XMAX, YMIN, YMAX = -90.0, 90.0, -60.0, 60.0
BASE_TOP, GROUND = 3.0, 5.0
RIVER_X0, RIVER_X1 = 4.0, 24.0
box(XMIN, XMAX, YMIN, YMAX, 0, BASE_TOP, "01_base_plate")
box(XMIN, RIVER_X0, YMIN, YMAX, BASE_TOP, GROUND, "02_ground")
box(RIVER_X0, RIVER_X1, YMIN, YMAX, BASE_TOP, 4.1, "04_river")

# 오른쪽 평지는 지하철 출입구 구멍을 비워 두고 깐다.
HOLE = (60.0, 76.0, -23.0, -15.0)
hx0, hx1, hy0, hy1 = HOLE
box(RIVER_X1, XMAX, YMIN, hy0, BASE_TOP, GROUND, "02_ground")
box(RIVER_X1, XMAX, hy1, YMAX, BASE_TOP, GROUND, "02_ground")
box(RIVER_X1, hx0, hy0, hy1, BASE_TOP, GROUND, "02_ground")
box(hx1, XMAX, hy0, hy1, BASE_TOP, GROUND, "02_ground")

# ---------------------------------------------------------------- 곤돌라 노선
TOP_X, BOT_X = -82.0, 76.0
TOP_Z, BOT_Z = 55.0, 27.0
LINE_Y = (-4.0, 4.0)
CABIN_H, HANG = 7.0, 2.5


def cable_z(x):
    return TOP_Z + (BOT_Z - TOP_Z) * (x - TOP_X) / (BOT_X - TOP_X)


# ---------------------------------------------------------------- 언덕: 계단 없는 매끈한 비탈
HILL_TOP = 41.0
SLOPE_X0, SLOPE_X1 = -70.0, -4.0     # 이 사이가 비탈, 서쪽은 평평한 꼭대기
SAMPLES = 16


def slope_profile(t):
    """0(아래)..1(위). 직선과 smoothstep을 섞어 너무 가파르지 않게 이어 준다."""
    return 0.5 * t + 0.5 * (3 * t * t - 2 * t * t * t)


HX = [SLOPE_X0 + (SLOPE_X1 - SLOPE_X0) * k / SAMPLES for k in range(SAMPLES + 1)]
HZ = [GROUND + (HILL_TOP - GROUND) * slope_profile((SLOPE_X1 - x) / (SLOPE_X1 - SLOPE_X0)) for x in HX]


def terrain_z(x):
    if x <= SLOPE_X0:
        return HILL_TOP
    if x >= SLOPE_X1:
        return GROUND
    return float(np.interp(x, HX, HZ))


# 꼭대기 평지 + 비탈을 볼록한 조각들로 쌓는다 (조각 윗면이 지형 그 자체).
box(XMIN, SLOPE_X0, YMIN, YMAX, GROUND, HILL_TOP, "03_hill")
for xa, xb, za, zb in zip(HX, HX[1:], HZ, HZ[1:]):
    convex([(x, y, z) for (x, zt) in ((xa, za), (xb, zb)) for y in (YMIN, YMAX)
            for z in (GROUND, zt)], "03_hill")
for x in np.linspace(SLOPE_X0 - 4, SLOPE_X1, 60):
    assert cable_z(x) - HANG - CABIN_H > terrain_z(x) + 1.0, x


def on_slope(x0, x1, y0, y1, lift, thick, group):
    """지형을 따라 휘는 띠 (선로 바닥, 화단 등)."""
    xs = sorted({x0, x1, *[x for x in HX if x0 < x < x1]})
    for xa, xb in zip(xs, xs[1:]):
        pts = []
        for x in (xa, xb):
            z = terrain_z(x)
            for y in (y0, y1):
                pts += [(x, y, z + lift - 0.4), (x, y, z + lift + thick)]
        convex(pts, group)


# ---------------------------------------------------------------- 수소 트램 노선 (언덕 아래 -> 꼭대기)
TRACK_Y0, TRACK_Y1 = -54.0, -48.0
TRAM_Y = (TRACK_Y0 + TRACK_Y1) / 2
TRACK_X0, TRACK_X1 = -84.0, 3.0
on_slope(TRACK_X0, TRACK_X1, TRACK_Y0, TRACK_Y1, 0.0, 0.3, "05_paths_gray")
for ry in (TRAM_Y - 1.5, TRAM_Y + 1.5):
    on_slope(TRACK_X0, TRACK_X1, ry - 0.25, ry + 0.25, 0.3, 0.35, "17_cable_dark")

# 길가 화단 (트램이 물을 뿌려 주는 곳)
BED_Y0, BED_Y1 = -58.6, -55.0
BED_X0, BED_X1 = -68.0, -6.0
on_slope(BED_X0, BED_X1, BED_Y0, BED_Y1, 0.0, 1.0, "12_brown_details")
FLOWER_COLS = ["24_flowers_pink", "18_accent_yellow", "19_accent_red"]
k = 0
for x in np.arange(BED_X0 + 0.9, BED_X1 - 0.5, 1.5):
    for y in (BED_Y0 + 1.0, BED_Y1 - 1.0):
        sphere((x, y, terrain_z(x) + 1.0 + 0.5), 0.6, FLOWER_COLS[k % 3], n=8)
        k += 1


# 정류장 두 곳 (아래·꼭대기)
def tram_stop(x0, x1):
    z = terrain_z((x0 + x1) / 2)
    ya, yb = TRACK_Y1 + 0.2, TRACK_Y1 + 3.0
    box(x0, x1, ya, yb, z - 0.4, z + 0.8, "14_white_structures")
    for x in (x0 + 0.3, x1 - 0.7):
        box(x, x + 0.4, yb - 0.6, yb - 0.2, z + 0.8, z + 5.6, "14_white_structures")
    box(x0 - 0.4, x1 + 0.4, ya - 0.4, yb + 0.2, z + 5.6, z + 6.1, "15_glass")


tram_stop(-82.0, -74.0)
tram_stop(-3.5, 3.0)


class Frame:
    """비탈을 따라 기울어진 트램의 국소 좌표 (u: 길이, v: 폭(+y), w: 지붕 쪽)."""

    def __init__(self, xc, y, half):
        xa, xb = xc - half, xc + half
        za, zb = terrain_z(xa), terrain_z(xb)
        self.t = np.array([xb - xa, 0.0, zb - za])
        self.t /= np.linalg.norm(self.t)
        self.n = np.array([-self.t[2], 0.0, self.t[0]])
        self.o = np.array([xc, y, (za + zb) / 2 + 0.65])   # 레일 윗면

    def p(self, u, v, w):
        return self.o + u * self.t + np.array([0, v, 0]) + w * self.n

    def box(self, u0, u1, v0, v1, w0, w1, group):
        convex([self.p(u, v, w) for u in (u0, u1) for v in (v0, v1) for w in (w0, w1)], group)

    def cyl(self, a, b, r, group, n=14):
        cyl(self.p(*a), self.p(*b), r, group, n=n)

    def sphere(self, c, r, group, n=10):
        sphere(self.p(*c), r, group, n=n)


def hydrogen_tram(xc):
    L, Wd = 8.0, 2.2     # 반 길이, 반 폭
    f = Frame(xc, TRAM_Y, L)
    for u in (-5.0, 5.0):
        f.box(u - 1.6, u + 1.6, -1.6, 1.6, 0.0, 0.9, "17_cable_dark")             # 대차
    f.box(-L, L, -Wd, Wd, 0.9, 1.6, "14_white_structures")                          # 바닥
    for (v0, v1) in ((-Wd, -Wd + 0.3), (Wd - 0.3, Wd)):
        f.box(-L, L, v0, v1, 1.6, 2.5, "22_tram_mint")                              # 아래 띠
        for u in (-L, -3.6, 0.8, 4.0 if False else 4.4):
            f.box(u, u + 0.6, v0, v1, 2.5, 5.3, "14_white_structures")             # 창 기둥
        f.box(L - 0.6, L, v0, v1, 2.5, 5.3, "14_white_structures")
    for (u0, u1) in ((-L, -L + 0.5), (L - 0.5, L)):
        f.box(u0, u1, -Wd, Wd, 1.6, 5.3, "14_white_structures")                     # 앞뒤 운전칸 벽
    f.box(-L - 0.1, -L + 0.1, -1.6, 1.6, 3.0, 4.8, "15_glass")
    f.box(L - 0.1, L + 0.1, -1.6, 1.6, 3.0, 4.8, "15_glass")
    f.box(-L, L, -Wd, Wd, 5.3, 6.0, "22_tram_mint")                                # 지붕
    for v in (-0.9, 0.9):
        f.cyl((-5.0, v, 6.6), (5.0, v, 6.6), 0.6, "14_white_structures")           # 수소 탱크
    # 안에 보이는 작은 분수 장치: 수소 + 산소 -> 물
    f.cyl((-1.2, 0, 1.6), (-1.2, 0, 2.3), 1.2, "14_white_structures", n=20)
    f.cyl((-1.2, 0, 2.3), (-1.2, 0, 3.4), 0.25, "14_white_structures", n=10)
    f.cyl((-1.2, 0, 3.4), (-1.2, 0, 3.6), 0.7, "14_white_structures", n=16)
    f.sphere((-1.2, 0, 3.9), 0.55, "23_water")
    for a in range(6):
        ang = 2 * math.pi * a / 6
        f.cyl((-1.2 + 0.5 * math.cos(ang), 0.5 * math.sin(ang), 3.5),
              (-1.2 + 1.0 * math.cos(ang), 1.0 * math.sin(ang), 2.35), 0.12, "23_water", n=6)
    # 옆구리 노즐에서 화단으로 물줄기 (배출물은 물뿐)
    for u in (-5.5, -1.0, 3.5):
        f.cyl((u, -Wd, 1.9), (u, -Wd - 0.5, 1.9), 0.3, "22_tram_mint", n=10)
        p0 = f.p(u, -Wd - 0.5, 1.9)
        for dx in (-1.2, 1.2):
            tx = p0[0] + dx
            p1 = np.array([tx, (BED_Y0 + BED_Y1) / 2, terrain_z(tx) + 1.6])
            prev = p0
            for s in np.linspace(0.1, 1.0, 9):
                cur = p0 + s * (p1 - p0) + np.array([0, 0, 3.0 * 4 * s * (1 - s) * 0.5])
                cyl(prev, cur, 0.16, "23_water", n=6)
                prev = cur
            for j in range(3):
                sphere(p1 + np.array([rng.uniform(-0.6, 0.6), rng.uniform(-0.5, 0.5), 0.3]),
                       0.22, "23_water", n=6)


hydrogen_tram(-38.0)


# ---------------------------------------------------------------- 3~4층 필로티 빌라
WALLS = ["07_red_brick", "06_walls_cream", "07_red_brick", "08_walls_sky"]
CARS = ["09_roof_blue", "19_accent_red", "18_accent_yellow", "14_white_structures"]
VW, VD, PILOTI, STORY = 11.0, 9.0, 3.0, 2.8


def villa(x0, y0, floors, wall, car):
    x1, y1 = x0 + VW, y0 + VD
    zp = terrain_z(x0) + 0.3                   # 평평하게 다진 주차 바닥 (비탈 위쪽 기준)
    box(x0, x1, y0, y1, terrain_z(x1) - 0.5, zp, "05_paths_gray")
    zb = zp + PILOTI
    box(x0, x0 + 3.0, y0 + 2.5, y1, zp, zb, wall)                                 # 계단실
    for x in (x0 + 4.6, x1 - 0.8):
        for y in (y0, y1 - 0.8):
            box(x, x + 0.8, y, y + 0.8, zp, zb, "14_white_structures")            # 필로티 기둥
    box(x0 - 0.2, x1 + 0.2, y0 - 0.2, y1 + 0.2, zb - 0.4, zb, "14_white_structures")
    top = zb + STORY * floors
    box(x0, x1, y0, y1, zb, top, wall)
    for fl in range(floors):
        z = zb + fl * STORY
        for wx in (x0 + 1.2, x0 + 4.6, x0 + 8.0):
            box(wx, wx + 1.8, y0 - 0.25, y0, z + 0.9, z + 2.1, "15_glass")
        for wy in (y0 + 1.2, y0 + 5.4):
            box(x1, x1 + 0.25, wy, wy + 2.4, z + 0.9, z + 2.1, "15_glass")
    box(x0 - 0.15, x1 + 0.15, y0 - 0.15, y1 + 0.15, top, top + 0.5, "14_white_structures")  # 난간
    box(x0 + 0.5, x1 - 0.5, y0 + 0.5, y1 - 0.5, top + 0.3, top + 0.55, "11_roof_green")
    cyl((x0 + 2.0, y1 - 2.0, top + 0.5), (x0 + 2.0, y1 - 2.0, top + 2.0), 0.9, "18_accent_yellow", n=12)
    if car:
        box(x0 + 4.0, x0 + 8.4, y0 + 1.4, y0 + 3.6, zp, zp + 0.9, car)
        box(x0 + 5.0, x0 + 7.6, y0 + 1.6, y0 + 3.4, zp + 0.9, zp + 1.6, "15_glass")


COLS = [-84.0, -71.0, -57.0, -44.0, -31.0, -18.0]
ROWS = [-44.0, -33.0, -22.0, 14.0, 26.0, 38.0]
for y0 in ROWS:
    for x0 in COLS:
        if rng.random() < 0.12:
            tree(x0 + 5.5, y0 + 4.5, terrain_z(x0 + 5.5), 1.5, rng)
            continue
        villa(x0, y0, rng.choice([2, 3, 3]), rng.choice(WALLS),
              rng.choice(CARS) if rng.random() < 0.55 else None)

# 둥근 나무 몇 그루 (언덕)
for (tx, ty) in [(-86.0, 54.0), (-62.0, 54.0), (-40.0, 55.0), (-16.0, 54.0), (-56.0, 6.0),
                 (-24.0, -6.0), (-86.5, -46.0), (-1.0, 40.0)]:
    tree(tx, ty, terrain_z(tx), 1.5, rng)

# ---------------------------------------------------------------- 위 정거장 (언덕 꼭대기)
z0 = HILL_TOP
SX0, SX1, SY = -88.0, -72.0, 10.0
box(SX0, SX1, -SY, SY, z0, z0 + 0.8, "14_white_structures")               # 승강장 바닥
box(SX0, SX0 + 1.2, -SY, SY, z0, 56.5, "14_white_structures")              # 뒷벽
for y in (-SY, SY - 0.6):
    box(SX0, SX1, y, y + 0.6, z0, z0 + 2.6, "15_glass")                    # 옆 유리 난간
for x in (SX0 + 0.6, (SX0 + SX1) / 2, SX1 - 0.6):
    for y in (-SY + 0.4, SY - 0.4):
        box(x - 0.6, x + 0.6, y - 0.6, y + 0.6, z0, 56.5, "14_white_structures")
box(SX0 - 1, SX1 + 1, -SY - 1, SY + 1, 56.5, 57.5, "14_white_structures")  # 지붕
cyl((TOP_X, 0, 53.6), (TOP_X, 0, 54.4), 4.3, "17_cable_dark", n=28)        # 회전 바퀴
cyl((TOP_X, 0, 54.4), (TOP_X, 0, 56.5), 0.6, "14_white_structures", n=12)


def solar_roof(x0, x1, y0, y1, zr):
    y = y0 + 0.5
    while y + 3.4 <= y1:
        x = x0 + 0.5
        seg = (x1 - x0 - 1.0 - 0.8) / 3
        for _ in range(3):
            tilted_panel(x, x + seg, y, 3.4, zr + 0.5, 25, "16_solar_panels")
            x += seg + 0.4
        box(x0 + 0.5, x1 - 0.5, y + 2.4, y + 3.0, zr, zr + 0.5 + 3.4 * math.sin(math.radians(25)) - 0.2,
            "14_white_structures")
        y += 4.6


solar_roof(SX0 - 1, SX1 + 1, -SY - 1, SY + 1, 57.5)

# ---------------------------------------------------------------- 아래 정거장 (병원·지하철 사이, 높이 띄움)
BX0, BX1, BY = 61.0, 85.0, 10.0
FLOOR, ROOF = 18.0, 31.0
for x in (BX0 + 1.5, BX1 - 1.5):
    for y in (-BY + 1.5, BY - 1.5):
        box(x - 0.9, x + 0.9, y - 0.9, y + 0.9, GROUND, FLOOR, "14_white_structures")
box(BX0, BX1, -BY, BY, FLOOR, FLOOR + 1.2, "14_white_structures")
box(BX1 - 1.2, BX1, -BY, BY, FLOOR + 1.2, ROOF, "14_white_structures")
for y in (-BY, BY - 0.6):
    box(BX0, BX1, y, y + 0.6, FLOOR + 1.2, FLOOR + 3.6, "15_glass")
for x in (BX0 + 0.6, (BX0 + BX1) / 2, BX1 - 0.6):
    for y in (-BY + 0.4, BY - 0.4):
        box(x - 0.6, x + 0.6, y - 0.6, y + 0.6, FLOOR + 1.2, ROOF, "14_white_structures")
box(BX0 - 1, BX1 + 1, -BY - 1, BY + 1, ROOF, ROOF + 1, "14_white_structures")
cyl((BOT_X, 0, 25.6), (BOT_X, 0, 26.4), 4.3, "17_cable_dark", n=28)
cyl((BOT_X, 0, 26.4), (BOT_X, 0, ROOF), 0.6, "14_white_structures", n=12)
solar_roof(BX0 - 1, BX1 + 1, -BY - 1, BY + 1, ROOF + 1)

# 휠체어도 탈 수 있게: 엘리베이터 + 병원으로 가는 하늘다리
box(85.2, 89.4, -3, 3, GROUND, ROOF + 1, "15_glass")
box(85.0, 89.6, -3.2, 3.2, ROOF + 1, ROOF + 1.8, "14_white_structures")
for x in (85.2, 89.0):
    for y in (-3.0, 2.6):
        box(x, x + 0.4, y, y + 0.4, GROUND, ROOF + 1, "14_white_structures")
box(66, 71, BY, 16, FLOOR, FLOOR + 1.2, "14_white_structures")
for x in (66, 70.6):
    box(x, x + 0.4, BY, 16, FLOOR + 1.2, FLOOR + 3.4, "15_glass")
box(65.6, 71.4, BY, 16, FLOOR + 3.4, FLOOR + 3.9, "14_white_structures")

# ---------------------------------------------------------------- 케이블, 철탑, 곤돌라 칸
for y in LINE_Y:
    cyl((TOP_X, y, TOP_Z), (BOT_X, y, BOT_Z), 0.35, "17_cable_dark", n=10)


def pylon(x, ground_z):
    zc = cable_z(x)
    box(x - 1.8, x + 1.8, -1.8, 1.8, ground_z, ground_z + 1.0, "14_white_structures")
    frustum(x, 0, ground_z + 1.0, zc - 1.2, 2.4, 1.3, "14_white_structures")
    box(x - 0.6, x + 0.6, -5.6, 5.6, zc - 1.2, zc - 0.35, "14_white_structures")
    for y in LINE_Y:
        cyl((x - 0.9, y, zc - 0.35), (x + 0.9, y, zc - 0.35), 0.3, "17_cable_dark", n=10)


pylon(-36.0, terrain_z(-36.0))
pylon(30.0, GROUND)


def cabin(x, y, wheelchair=False):
    zc = cable_z(x)
    ztop = zc - HANG
    zb = ztop - CABIN_H
    box(x - 0.6, x + 0.6, y - 0.5, y + 0.5, zc - 0.5, zc + 0.6, "17_cable_dark")  # 그립
    cyl((x, y, zc - 0.4), (x, y, ztop), 0.3, "17_cable_dark", n=10)
    L, Wd = 7.0, 5.4
    xa, xb, ya, yb = x - L / 2, x + L / 2, y - Wd / 2, y + Wd / 2
    box(xa, xb, ya, yb, zb, zb + 0.7, "14_white_structures")                     # 바닥
    for px in (xa, xb - 0.7):
        for py in (ya, yb - 0.7):
            box(px, px + 0.7, py, py + 0.7, zb, ztop - 0.8, "14_white_structures")
    for (a0, a1, b0, b1) in ((xa, xb, ya, ya + 0.35), (xa, xb, yb - 0.35, yb),
                             (xa, xa + 0.35, ya, yb), (xb - 0.35, xb, ya, yb)):
        box(a0, a1, b0, b1, zb + 0.7, zb + 2.0, "18_accent_yellow")              # 아래 띠
    convex([(xa, ya, ztop - 0.8), (xb, ya, ztop - 0.8), (xa, yb, ztop - 0.8), (xb, yb, ztop - 0.8),
            (xa + 0.8, ya + 0.6, ztop), (xb - 0.8, ya + 0.6, ztop),
            (xa + 0.8, yb - 0.6, ztop), (xb - 0.8, yb - 0.6, ztop)], "18_accent_yellow")  # 지붕
    if not wheelchair:
        return
    f = zb + 0.7  # 바닥 윗면
    for wy in (y - 1.45, y + 1.45):
        cyl((x - 0.4, wy - 0.18, f + 1.4), (x - 0.4, wy + 0.18, f + 1.4), 1.4, "20_wheelchair_blue", n=22)
        cyl((x + 1.7, wy - 0.12, f + 0.45), (x + 1.7, wy + 0.12, f + 0.45), 0.45, "20_wheelchair_blue", n=12)
    box(x - 1.2, x + 1.2, y - 1.2, y + 1.2, f + 1.6, f + 1.9, "20_wheelchair_blue")     # 좌석
    box(x - 1.45, x - 1.15, y - 1.2, y + 1.2, f + 1.9, f + 3.9, "20_wheelchair_blue")   # 등받이
    box(x + 1.3, x + 2.0, y - 0.9, y + 0.9, f + 0.15, f + 0.35, "20_wheelchair_blue")   # 발판
    box(x + 1.2, x + 1.4, y - 1.2, y + 1.2, f + 0.35, f + 1.7, "20_wheelchair_blue")    # 앞 다리 프레임
    # 사람
    box(x - 1.0, x + 1.3, y - 0.85, y + 0.85, f + 1.9, f + 2.6, "21_people_goods")     # 허벅지
    box(x + 1.1, x + 1.7, y - 0.85, y + 0.85, f + 0.35, f + 2.4, "21_people_goods")    # 종아리
    box(x - 1.1, x - 0.1, y - 1.0, y + 1.0, f + 1.9, f + 4.3, "21_people_goods")       # 몸통
    for ay in (y - 1.2, y + 0.9):
        box(x - 0.6, x + 0.9, ay, ay + 0.3, f + 3.0, f + 3.4, "21_people_goods")       # 팔
    sphere((x - 0.55, y, f + 4.9), 0.62, "21_people_goods", n=14)                    # 머리


for x in (-58.0, 14.0):
    cabin(x, LINE_Y[0], wheelchair=(x == 14.0))
for x in (-16.0, 46.0):
    cabin(x, LINE_Y[1])

# ---------------------------------------------------------------- 병원
box(44, 72, 16, 44, GROUND, 25, "14_white_structures")
box(50, 66, 22, 40, 25, 33, "14_white_structures")
for zb_ in (13.5, 19.5):
    x = 45.5
    while x + 2.6 <= 64.5:
        box(x, x + 2.6, 15.7, 16, zb_, zb_ + 2.0, "15_glass")
        x += 3.6
box(51, 57, 15.8, 16, GROUND, 9.5, "15_glass")                               # 출입문
box(49, 59, 12, 16, 10.0, 10.6, "14_white_structures")                       # 차양
for x in (49.3, 58.3):
    box(x, x + 0.4, 12.2, 12.6, GROUND, 10.0, "14_white_structures")
box(57.2, 58.8, 21.6, 22, 26, 32, "19_accent_red")                           # 십자가(앞)
box(55, 61, 21.6, 22, 28.2, 29.8, "19_accent_red")
box(56.8, 59.2, 27, 35, 33, 33.3, "19_accent_red")                           # 십자가(옥상)
box(54, 62, 29.8, 32.2, 33, 33.3, "19_accent_red")

# ---------------------------------------------------------------- 지하철역 출입구
n = 7
for s in range(n):
    xa = hx1 - (s + 1) * (hx1 - hx0) / n
    box(xa, hx1, -22, -16, BASE_TOP, GROUND - (s + 1) * 1.8 / (n + 1), "05_paths_gray")
for y in (hy0 - 0.6, hy1):
    box(hx0, hx1, y, y + 0.6, GROUND, 7.0, "14_white_structures")
box(hx1, hx1 + 0.6, hy0 - 0.6, hy1 + 0.6, GROUND, 7.0, "14_white_structures")
for x in (hx0 - 0.5, hx1 + 0.1):
    for y in (hy0 - 1.0, hy1 + 0.6):
        box(x, x + 0.4, y, y + 0.4, GROUND, 10.4, "14_white_structures")
convex([(hx0 - 1, hy0 - 1.2, 10.4), (hx1 + 1, hy0 - 1.2, 11.4), (hx0 - 1, hy1 + 1.2, 10.4),
        (hx1 + 1, hy1 + 1.2, 11.4), (hx0 - 1, hy0 - 1.2, 10.8), (hx1 + 1, hy0 - 1.2, 11.8),
        (hx0 - 1, hy1 + 1.2, 10.8), (hx1 + 1, hy1 + 1.2, 11.8)], "15_glass")
cyl((56, -26, GROUND), (56, -26, 15), 0.3, "14_white_structures", n=10)
cyl((56, -26.2, 14), (56, -25.8, 14), 1.8, "20_wheelchair_blue", n=24)

# ---------------------------------------------------------------- 도로·광장
box(24.5, 28.0, YMIN, YMAX, GROUND, GROUND + 0.25, "05_paths_gray")            # 강변길
box(28.0, XMAX, -30, -26, GROUND, GROUND + 0.25, "05_paths_gray")             # 시장 앞길
box(56, XMAX, -14, -10, GROUND, GROUND + 0.25, "05_paths_gray")               # 정거장 광장
box(80, XMAX, -10, 4, GROUND, GROUND + 0.25, "05_paths_gray")
for k in range(5):
    x = 64 + k * 1.6
    box(x, x + 0.8, -29.6, -26.4, GROUND + 0.25, GROUND + 0.35, "14_white_structures")  # 횡단보도

# 강 건너는 보행자 다리
box(1, 27, -46, -42, GROUND + 0.2, GROUND + 1.0, "12_brown_details")
for x in np.arange(1.5, 27, 6.2):
    for y in (-46, -42.4):
        box(x, x + 0.4, y, y + 0.4, GROUND + 1.0, GROUND + 2.6, "12_brown_details")
for y in (-46, -42.4):
    box(1, 27, y, y + 0.4, GROUND + 2.4, GROUND + 2.8, "12_brown_details")

# ---------------------------------------------------------------- 시장 (알록달록 지붕 가판대 4칸)
for k, x in enumerate((38.0, 47.0, 56.0, 65.0)):
    yb, yf = -54.0, -49.0
    box(x, x + 8, yb, yf, GROUND, 7.5, "12_brown_details")
    for px in (x + 0.2, x + 7.4):
        box(px, px + 0.4, yf + 1.0, yf + 1.4, GROUND, 8.8, "12_brown_details")
    for s_ in range(3):
        g = ("21_people_goods", "18_accent_yellow", "13_trees")[(s_ + k) % 3]
        sphere((x + 1.8 + s_ * 2.2, yf - 1.0, 8.3), 0.8, g, n=12)
    col = ("19_accent_red", "18_accent_yellow", "09_roof_blue", "10_roof_orange")[k]
    for px in (x + 0.2, x + 7.4):
        box(px, px + 0.4, yb + 0.2, yb + 0.6, GROUND, 8.8, "12_brown_details")
    gable(x, x + 8, yb, yf + 1.6, 8.8, 2.4, True, col, o=0.5)

# ---------------------------------------------------------------- 나무 (오른쪽)
for (tx, ty) in [(34, -36), (36, 10), (36, 36), (58, 52), (80, 52), (86, 24)]:
    tree(tx, ty, GROUND, 1.4, rng)


# ---------------------------------------------------------------- 저장
def marker_tris():
    tris = []
    store = parts.setdefault("_m", [])
    store.clear()
    for (x0, y0) in ((XMIN, YMIN), (XMAX - 0.3, YMAX - 0.3)):
        box(x0, x0 + 0.3, y0, y0 + 0.3, 0, 0.3, "_m")
    tris = list(store)
    del parts["_m"]
    return tris


def write_stl(path, tris):
    with open(path, "wb") as fh:
        fh.write(b"Tinkercad hillside gondola diorama".ljust(80, b" "))
        fh.write(struct.pack("<I", len(tris)))
        for a, b, c in tris:
            nrm = np.cross(b - a, c - a)
            ln = np.linalg.norm(nrm)
            nrm = nrm / ln if ln > 0 else nrm
            fh.write(struct.pack("<12fH", *nrm, *a, *b, *c, 0))


os.makedirs(OUT, exist_ok=True)
for name, tris in parts.items():
    v = np.array([p for t in tris for p in t])
    assert v[:, 0].min() >= XMIN and v[:, 0].max() <= XMAX, name
    assert v[:, 1].min() >= YMIN and v[:, 1].max() <= YMAX, name
    assert v[:, 2].min() >= 0, name
markers = marker_tris()
all_tris = []
total = 0
for name, tris in parts.items():
    all_tris += tris
    extra = [] if name == "01_base_plate" else markers
    write_stl(os.path.join(OUT, f"{name}.stl"), tris + extra)
    total += len(tris)
    print(f"{name:24s} {len(tris):6d} triangles")
write_stl(os.path.join(HERE, "all_in_one.stl"), all_tris)
print("total", total)

with zipfile.ZipFile(os.path.join(HERE, "tinkercad_parts.zip"), "w", zipfile.ZIP_DEFLATED) as z:
    for name in parts:
        z.write(os.path.join(OUT, f"{name}.stl"), f"{name}.stl")
    z.write(os.path.join(HERE, "all_in_one.stl"), "all_in_one.stl")

if os.environ.get("PREVIEW", "1") == "1":
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    from matplotlib.colors import to_rgb

    def subdivide(a, b, c, max_edge=5.0):
        """큰 면을 잘게 쪼개 matplotlib의 깊이 정렬 오류를 줄인다 (미리보기 전용)."""
        edges = [np.linalg.norm(b - a), np.linalg.norm(c - b), np.linalg.norm(a - c)]
        if max(edges) <= max_edge:
            return [[a, b, c]]
        k = int(np.argmax(edges))
        a, b, c = [(a, b, c), (b, c, a), (c, a, b)][k]
        m = (a + b) / 2
        return subdivide(a, m, c, max_edge) + subdivide(m, b, c, max_edge)

    def to_rgb_255(hexcol):
        return tuple(int(round(v * 255)) for v in to_rgb(hexcol))

    BG = "#F3EBDD"
    light = np.array([-0.4, -0.6, 0.9])
    light /= np.linalg.norm(light)
    for fname, elev, azim in (("preview.png", 30, -55), ("preview_front.png", 16, -88)):
        polys, cols = [], []
        for name, tris in parts.items():
            base = np.array(to_rgb(COLORS[name][0]))
            for a, b, c in tris:
                nrm = np.cross(b - a, c - a)
                ln = np.linalg.norm(nrm)
                if ln == 0:
                    continue
                shade = 0.55 + 0.45 * max(0.0, float(np.dot(nrm / ln, light)))
                col = np.clip(base * shade, 0, 1)
                for t in subdivide(a, b, c):
                    polys.append(t)
                    cols.append(col)
        fig = plt.figure(figsize=(16, 11), dpi=110)
        ax = fig.add_subplot(111, projection="3d", proj_type="ortho")
        pc = Poly3DCollection(polys, facecolors=cols, edgecolors=cols, linewidths=0.25)
        ax.add_collection3d(pc)
        ax.set_xlim(XMIN, XMAX)
        ax.set_ylim(YMIN, YMAX)
        ax.set_zlim(0, 65)
        ax.set_box_aspect((180, 120, 65))
        ax.view_init(elev=elev, azim=azim)
        ax.set_axis_off()
        ax.set_facecolor(BG)
        fig.patch.set_facecolor(BG)
        plt.subplots_adjust(0, 0, 1, 1)
        out = os.path.join(HERE, fname)
        plt.savefig(out, facecolor=fig.get_facecolor())
        plt.close(fig)
        from PIL import Image, ImageChops
        img = Image.open(out).convert("RGB")
        diff = ImageChops.difference(img, Image.new("RGB", img.size, to_rgb_255(BG)))
        l, t, r, b = diff.getbbox()
        img.crop((max(0, l - 30), max(0, t - 30), min(img.width, r + 30), min(img.height, b + 30))).save(out)
