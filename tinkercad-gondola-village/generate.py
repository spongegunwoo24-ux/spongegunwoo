"""산비탈 마을 + 도시형 곤돌라 디오라마 -> Tinkercad용 STL 생성기.

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
    "03_hill_terrace":     ("#BFD8A2", "언덕 계단식 지형"),
    "04_river":            ("#8FC8E8", "강"),
    "05_paths_gray":       ("#C4C4CC", "도로·골목 계단길·지하철 계단"),
    "06_walls_cream":      ("#FFF1D0", "집 벽(크림)"),
    "07_walls_pink":       ("#F8D3D6", "집 벽(분홍)"),
    "08_walls_sky":        ("#D3E6F5", "집 벽(하늘)"),
    "09_roof_blue":        ("#8DB3E2", "지붕(파랑)"),
    "10_roof_orange":      ("#F2B489", "지붕(주황)"),
    "11_roof_green":       ("#9AD1A5", "옥상 초록 방수면"),
    "12_brown_details":    ("#A9805F", "문·나무줄기·가판대·다리"),
    "13_trees":            ("#86C784", "나무"),
    "14_white_structures": ("#FAFAFA", "곤돌라 정거장·철탑·병원·곤돌라 칸"),
    "15_glass":            ("#BDE2F2", "유리(창문·엘리베이터·캐노피)"),
    "16_solar_panels":     ("#3D5A8A", "태양광 패널"),
    "17_cable_dark":       ("#555B66", "케이블·회전 바퀴"),
    "18_accent_yellow":    ("#FFD98A", "곤돌라 칸 장식·물탱크·차양"),
    "19_accent_red":       ("#EE8A8A", "병원 십자가·지붕(빨강)·차양"),
    "20_wheelchair_blue":  ("#4A8FD9", "휠체어·지하철 표지"),
    "21_people_goods":     ("#F49A7A", "휠체어 탄 사람·시장 물건"),
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
    cyl((x, y, z), (x, y, z + 1.4 * size), 0.35 * size, "12_brown_details", n=10)
    if rng.random() < 0.5:
        sphere((x, y, z + 2.6 * size), 1.5 * size, "13_trees", n=12)
    else:
        cone(x, y, z + 1.0 * size, 1.5 * size, 3.6 * size, "13_trees", n=14)


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


# ---------------------------------------------------------------- 언덕 (큰 계단 4단)
TERRACES = [(-90.0, -66.0, 41.0), (-66.0, -46.0, 31.0), (-46.0, -26.0, 21.0), (-26.0, -8.0, 11.0)]


def terrain_z(x):
    for x0, x1, z in TERRACES:
        if x0 <= x < x1:
            return z
    return GROUND


for x0, x1, z in TERRACES:
    box(x0, x1, YMIN, YMAX, GROUND, z, "03_hill_terrace")
    # 곤돌라 칸이 지형에 닿지 않는지 확인
    assert min(cable_z(x0), cable_z(x1)) - HANG - CABIN_H > z, (x0, z)

# 골목 계단길: 강가 다리에서 꼭대기 정거장까지 한 줄로 올라간다.
LANE_Y0, LANE_Y1 = -18.0, -14.0
RUN = 8.0
edges = [(x1, z, TERRACES[k + 1][2] if k + 1 < len(TERRACES) else GROUND)
         for k, (x0, x1, z) in enumerate(TERRACES)]
for x_edge, z_hi, z_lo in edges:
    rise = z_hi - z_lo
    n = int(round(rise / 1.25))
    for s in range(n):
        box(x_edge, x_edge + RUN * (n - s) / n, LANE_Y0, LANE_Y1,
            z_lo, z_lo + rise * (s + 1) / n, "05_paths_gray")
for k, (x0, x1, z) in enumerate(TERRACES):
    start = -80.0 if k == 0 else x0 + RUN
    box(start, x1, LANE_Y0, LANE_Y1, z, z + 0.3, "05_paths_gray")
box(-80.0, -76.0, LANE_Y1, -10.0, 41.0, 41.3, "05_paths_gray")    # 정거장 입구로
box(0.0, 1.0, LANE_Y0, LANE_Y1, GROUND, GROUND + 0.3, "05_paths_gray")

# 집 6채: (가운데 x, 가운데 y, 벽 색, 지붕)
HOUSES = [
    (-56.0, -38.0, "06_walls_cream", "09_roof_blue"),
    (-55.0, 28.0, "08_walls_sky", "flat"),
    (-36.0, -32.0, "07_walls_pink", "10_roof_orange"),
    (-37.0, 40.0, "06_walls_cream", "19_accent_red"),
    (-17.0, -42.0, "08_walls_sky", "10_roof_orange"),
    (-16.0, 30.0, "07_walls_pink", "09_roof_blue"),
]
HW, HD, HH = 11.0, 9.0, 7.5
for k, (cx, cy, wall, roof) in enumerate(HOUSES):
    z = terrain_z(cx)
    x0, x1, y0, y1 = cx - HW / 2, cx + HW / 2, cy - HD / 2, cy + HD / 2
    box(x0, x1, y0, y1, z, z + HH, wall)
    box(cx - 1.0, cx + 1.0, y0 - 0.3, y0, z, z + 3.4, "12_brown_details")       # 문
    for wx in (cx - 3.5, cx + 3.5):
        box(wx - 1.0, wx + 1.0, y0 - 0.3, y0, z + 4.4, z + 6.2, "15_glass")      # 창
    if roof == "flat":
        box(x0 + 0.4, x1 - 0.4, y0 + 0.4, y1 - 0.4, z + HH, z + HH + 0.5, "11_roof_green")
        cyl((x1 - 2.2, y1 - 2.2, z + HH), (x1 - 2.2, y1 - 2.2, z + HH + 2.6), 1.4,
            "18_accent_yellow", n=20)
    else:
        gable(x0, x1, y0, y1, z + HH, 3.2, k % 2 == 0, roof, o=0.7)

# 나무 몇 그루
for (tx, ty) in [(-70.0, -42.0), (-76.0, 36.0), (-50.0, -54.0), (-30.0, 52.0), (-12.0, -54.0),
                 (-3.0, 44.0), (-52.0, 6.0), (-20.0, -6.0)]:
    tree(tx, ty, terrain_z(tx), 1.4, rng)

# ---------------------------------------------------------------- 위 정거장 (언덕 꼭대기)
z0 = TERRACES[0][2]
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
box(1, 27, -18, -14, GROUND + 0.2, GROUND + 1.0, "12_brown_details")
for x in np.arange(1.5, 27, 6.2):
    for y in (-18, -14.4):
        box(x, x + 0.4, y, y + 0.4, GROUND + 1.0, GROUND + 2.6, "12_brown_details")
for y in (-18, -14.4):
    box(1, 27, y, y + 0.4, GROUND + 2.4, GROUND + 2.8, "12_brown_details")

# ---------------------------------------------------------------- 시장 (가판대 4칸)
for k, x in enumerate((38.0, 47.0, 56.0, 65.0)):
    yb, yf = -54.0, -49.0
    box(x, x + 8, yb, yf, GROUND, 7.5, "12_brown_details")
    for px in (x + 0.2, x + 7.4):
        box(px, px + 0.4, yf + 1.0, yf + 1.4, GROUND, 8.8, "12_brown_details")
    for s_ in range(3):
        g = ("21_people_goods", "18_accent_yellow", "13_trees")[(s_ + k) % 3]
        sphere((x + 1.8 + s_ * 2.2, yf - 1.0, 8.3), 0.8, g, n=12)
    col = "19_accent_red" if k % 2 == 0 else "18_accent_yellow"
    convex([(x - 0.2, yb, 10.2), (x + 8.2, yb, 10.2), (x - 0.2, yf + 1.8, 8.8), (x + 8.2, yf + 1.8, 8.8),
            (x - 0.2, yb, 10.6), (x + 8.2, yb, 10.6), (x - 0.2, yf + 1.8, 9.2), (x + 8.2, yf + 1.8, 9.2)], col)

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

    light = np.array([-0.4, -0.6, 0.9])
    light /= np.linalg.norm(light)
    for fname, elev, azim in (("preview.png", 32, -62), ("preview_front.png", 18, -88)):
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
        ax = fig.add_subplot(111, projection="3d")
        pc = Poly3DCollection(polys, facecolors=cols, edgecolors="none", linewidths=0)
        ax.add_collection3d(pc)
        ax.set_xlim(XMIN, XMAX)
        ax.set_ylim(YMIN, YMAX)
        ax.set_zlim(0, 65)
        ax.set_box_aspect((180, 120, 65))
        ax.view_init(elev=elev, azim=azim)
        ax.set_axis_off()
        ax.set_facecolor("#F4F1EA")
        fig.patch.set_facecolor("#F4F1EA")
        plt.subplots_adjust(0, 0, 1, 1)
        out = os.path.join(HERE, fname)
        plt.savefig(out, facecolor=fig.get_facecolor())
        plt.close(fig)
        from PIL import Image, ImageChops
        img = Image.open(out).convert("RGB")
        diff = ImageChops.difference(img, Image.new("RGB", img.size, to_rgb_255("#F4F1EA")))
        l, t, r, b = diff.getbbox()
        img.crop((max(0, l - 30), max(0, t - 30), min(img.width, r + 30), min(img.height, b + 30))).save(out)
