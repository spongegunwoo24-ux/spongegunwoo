#!/usr/bin/env python3
"""parts/*.stl 을 부품 색으로 칠해 미리보기 PNG를 만든다 (numpy 소프트웨어 래스터라이저)."""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_seoul import GROUPS, OUT  # noqa: E402


def read_stl(path):
    with open(path, 'rb') as f:
        f.seek(80)
        n = int(np.frombuffer(f.read(4), '<u4')[0])
        rec = np.frombuffer(f.read(), dtype=[('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')], count=n)
    return rec['v'].astype(np.float64)


def look_at(eye, target, up=(0, 0, 1)):
    f = np.asarray(target, float) - eye
    f /= np.linalg.norm(f)
    r = np.cross(f, up)
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    return r, u, f


def render(tris, cols, eye, target, fov, W, H, sky=((150, 190, 230), (238, 232, 222))):
    eye = np.asarray(eye, float)
    r, u, f = look_at(eye, target)
    P = tris - eye
    cx, cy, cz = P @ r, P @ u, P @ f
    keep = (cz > 1).all(1)
    tris, cols, cx, cy, cz = tris[keep], cols[keep], cx[keep], cy[keep], cz[keep]
    s = (W / 2) / np.tan(np.radians(fov) / 2)
    sx = W / 2 + s * cx / cz
    sy = H / 2 - s * cy / cz

    # 평면 음영: 해질녘 남서쪽 햇빛 + 하늘빛
    n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    view = eye - tris.mean(1)
    n[np.einsum('ij,ij->i', n, view) < 0] *= -1
    L = np.array([-0.45, -0.55, 0.7])
    L /= np.linalg.norm(L)
    diff = np.clip(n @ L, 0, 1)
    shade = 0.42 + 0.5 * diff + 0.12 * n[:, 2]
    col = np.clip(cols * shade[:, None], 0, 255)

    zbuf = np.full(W * H, np.inf)
    cbuf = np.zeros((W * H, 3))
    x0 = np.floor(sx.min(1)).astype(int)
    y0 = np.floor(sy.min(1)).astype(int)
    ext = np.maximum(np.ceil(sx.max(1)).astype(int) - x0, np.ceil(sy.max(1)).astype(int) - y0) + 1
    vis = (sx.max(1) >= 0) & (sx.min(1) < W) & (sy.max(1) >= 0) & (sy.min(1) < H)
    def raster(t, px, py):
        """삼각형 묶음 t 의 후보 픽셀(px, py)에 깊이 검사를 하며 색을 쓴다."""
        fx, fy = px + 0.5, py + 0.5
        ax, ay = sx[t, 0, None], sy[t, 0, None]
        bx, by = sx[t, 1, None], sy[t, 1, None]
        qx, qy = sx[t, 2, None], sy[t, 2, None]
        den = (by - qy) * (ax - qx) + (qx - bx) * (ay - qy)
        den = np.where(np.abs(den) < 1e-12, 1e-12, den)
        w0 = ((by - qy) * (fx - qx) + (qx - bx) * (fy - qy)) / den
        w1 = ((qy - ay) * (fx - qx) + (ax - qx) * (fy - qy)) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6) & (px >= 0) & (px < W) & (py >= 0) & (py < H)
        iz = w0 / cz[t, 0, None] + w1 / cz[t, 1, None] + w2 / cz[t, 2, None]
        depth = 1 / np.where(iz > 0, iz, 1e-12)
        ti = np.broadcast_to(np.arange(len(t))[:, None], px.shape)[inside]
        pix = (py * W + px)[inside]
        d = depth[inside]
        if len(pix) == 0:
            return
        o = np.lexsort((d, pix))
        pix, d, ti = pix[o], d[o], ti[o]
        first = np.r_[True, pix[1:] != pix[:-1]]
        pix, d, ti = pix[first], d[first], ti[first]
        win = d < zbuf[pix]
        zbuf[pix[win]] = d[win]
        cbuf[pix[win]] = col[t[ti[win]]]

    for S in (2, 4, 8, 16, 32, 64, 128):
        sel = np.where(vis & (ext <= S) & (ext > S // 2 if S > 2 else True))[0]
        chunk = max(1, 3_000_000 // (S * S))
        oy, ox = np.mgrid[0:S, 0:S]
        ox, oy = ox.ravel(), oy.ravel()
        for k in range(0, len(sel), chunk):
            t = sel[k:k + chunk]
            raster(t, x0[t, None] + ox[None], y0[t, None] + oy[None])
    # 큰 삼각형은 화면 안으로 잘라낸 영역을 띠 단위로 처리
    for i in np.where(vis & (ext > 128))[0]:
        a0, a1 = max(x0[i], 0), min(int(np.ceil(sx[i].max())) + 1, W)
        b0, b1 = max(y0[i], 0), min(int(np.ceil(sy[i].max())) + 1, H)
        for r0 in range(b0, b1, 128):
            yy, xx = np.mgrid[r0:min(r0 + 128, b1), a0:a1]
            raster(np.array([i]), xx.ravel()[None], yy.ravel()[None])
    # 하늘 그라데이션 + 약한 대기 원근
    grad = np.linspace(0, 1, H)[:, None, None]
    bg = np.array(sky[0]) * (1 - grad) + np.array(sky[1]) * grad
    img = np.broadcast_to(bg, (H, W, 3)).reshape(-1, 3).copy()
    hit = np.isfinite(zbuf)
    dmin, dmax = zbuf[hit].min(), zbuf[hit].max()
    fog = np.clip((zbuf[hit] - dmin) / (dmax - dmin), 0, 1)[:, None] * 0.18
    img[hit] = cbuf[hit] * (1 - fog) + np.array(sky[1]) * fog
    return img.reshape(H, W, 3)


def main():
    tris, cols = [], []
    for g, c in GROUPS.items():
        p = os.path.join(OUT, 'parts', f'{g}.stl')
        if os.path.exists(p):
            t = read_stl(p)
            tris.append(t)
            cols.append(np.tile(np.array(c, float), (len(t), 1)))
    tris, cols = np.vstack(tris), np.vstack(cols)
    views = {
        'preview.png': dict(eye=(30, -300, 175), target=(0, -2, 14), fov=42),
        'preview_palace.png': dict(eye=(-30, -40, 55), target=(-52, 36, 7), fov=38),
        'preview_namsan.png': dict(eye=(55, -70, 70), target=(12, 0, 30), fov=42),
        'preview_river.png': dict(eye=(-75, -105, 32), target=(0, -45, 6), fov=42),
    }
    only = sys.argv[1:]
    for name, v in views.items():
        if only and name not in only:
            continue
        W, H, ss = 1600, 1000, 2
        img = render(tris, cols, v['eye'], v['target'], v['fov'], W * ss, H * ss)
        im = Image.fromarray(img.astype(np.uint8)).resize((W, H), Image.LANCZOS)
        im.save(os.path.join(OUT, name))
        print('saved', name)


if __name__ == '__main__':
    main()
