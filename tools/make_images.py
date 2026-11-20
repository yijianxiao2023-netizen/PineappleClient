import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "docs" / "img"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 320, 180
SCALE = 4
B = 8

GLYPHS = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["111", "010", "010", "010", "010", "010", "111"],
    "J": ["00001", "00001", "00001", "00001", "10001", "10001", "01110"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10011", "10101", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "11111"],
    "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "10001", "00010", "00100", "00100", "00100", "00100"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    " ": ["000", "000", "000", "000", "000", "000", "000"],
    ":": ["0", "1", "1", "0", "1", "1", "0"],
    "|": ["1", "1", "1", "1", "1", "1", "1"],
    ".": ["0", "0", "0", "0", "0", "1", "1"],
    ",": ["00", "00", "00", "00", "00", "01", "10"],
    "!": ["1", "1", "1", "1", "1", "0", "1"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
    "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    ">": ["10000", "01000", "00100", "00010", "00100", "01000", "10000"],
    "<": ["00001", "00010", "00100", "01000", "00100", "00010", "00001"],
    "(": ["0011", "0100", "1000", "1000", "1000", "0100", "0011"],
    ")": ["1100", "0010", "0001", "0001", "0001", "0010", "1100"],
    "%": ["11001", "11001", "00010", "00100", "01000", "10011", "10011"],
    "'": ["1", "1", "0", "0", "0", "0", "0"],
}


def text_width(s, size=1):
    w = 0
    for ch in s.upper():
        g = GLYPHS.get(ch, GLYPHS[" "])
        w += (len(g[0]) + 1) * size
    return max(w - size, 0)


def draw_text(img, x, y, s, color, size=1, shadow=True):
    px = img.load()
    if shadow:
        sc = tuple(max(0, c // 4) for c in color[:3])
        draw_text(img, x + size, y + size, s, sc, size, False)
    cx = x
    for ch in s.upper():
        g = GLYPHS.get(ch, GLYPHS[" "])
        for r, row in enumerate(g):
            for c, bit in enumerate(row):
                if bit == "1":
                    for dy in range(size):
                        for dx in range(size):
                            X, Y = cx + c * size + dx, y + r * size + dy
                            if 0 <= X < img.width and 0 <= Y < img.height:
                                px[X, Y] = color[:3]
        cx += (len(g[0]) + 1) * size
    return cx


def jitter(rng, color, amount=14):
    return tuple(max(0, min(255, c + rng.randint(-amount, amount))) for c in color)


def make_texture(rng, base, amount=16, top=None, speckle=None):
    t = Image.new("RGB", (B, B))
    p = t.load()
    for y in range(B):
        for x in range(B):
            c = jitter(rng, base, amount)
            if speckle and rng.random() < speckle[1]:
                c = jitter(rng, speckle[0], 10)
            if top and y < top[1] + (1 if rng.random() < 0.35 else 0):
                c = jitter(rng, top[0], 14)
            p[x, y] = c
    return t


class Blocks:
    def __init__(self, seed=1):
        rng = random.Random(seed)
        self.grass = [make_texture(rng, (134, 96, 67), top=((94, 157, 52), 2)) for _ in range(4)]
        self.dirt = [make_texture(rng, (134, 96, 67)) for _ in range(4)]
        self.stone = [make_texture(rng, (125, 125, 125), 12) for _ in range(4)]
        self.coal = [make_texture(rng, (125, 125, 125), 12, speckle=((30, 30, 30), 0.25))]
        self.iron = [make_texture(rng, (125, 125, 125), 12, speckle=((216, 175, 147), 0.22))]
        self.diamond = [make_texture(rng, (125, 125, 125), 12, speckle=((90, 220, 220), 0.22))]
        self.gold = [make_texture(rng, (125, 125, 125), 12, speckle=((250, 220, 60), 0.22))]
        self.sand = [make_texture(rng, (219, 207, 163), 10) for _ in range(3)]
        self.water = [make_texture(rng, (52, 90, 205), 8) for _ in range(3)]
        self.log = [self._log(rng)]
        self.leaves = [make_texture(rng, (60, 128, 40), 26, speckle=((30, 80, 20), 0.2)) for _ in range(4)]
        self.planks = [self._planks(rng)]
        self.deepslate = [make_texture(rng, (72, 72, 78), 10) for _ in range(3)]
        self.bedrock = [make_texture(rng, (60, 60, 60), 40) for _ in range(3)]
        self.torch = None

    def _log(self, rng):
        t = Image.new("RGB", (B, B))
        p = t.load()
        for y in range(B):
            for x in range(B):
                base = (104, 83, 50) if x % 3 else (78, 60, 36)
                p[x, y] = jitter(rng, base, 10)
        return t

    def _planks(self, rng):
        t = Image.new("RGB", (B, B))
        p = t.load()
        for y in range(B):
            for x in range(B):
                base = (162, 130, 78) if y % 4 else (115, 90, 52)
                p[x, y] = jitter(rng, base, 10)
        return t

    def get(self, name, x, y):
        arr = getattr(self, name)
        return arr[(x * 7 + y * 13) % len(arr)]


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sky(img, top, bottom, stars=False, rng=None):
    d = ImageDraw.Draw(img)
    for y in range(img.height):
        d.line([(0, y), (img.width, y)], fill=lerp(top, bottom, y / img.height))
    if stars and rng:
        p = img.load()
        for _ in range(140):
            x, y = rng.randrange(img.width), rng.randrange(int(img.height * 0.6))
            p[x, y] = (255, 255, 240) if rng.random() < 0.6 else (180, 190, 255)


def clouds(img, rng, color=(255, 255, 255), count=6, alpha=235):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(count):
        cx, cy = rng.randrange(-40, img.width), rng.randrange(8, 50)
        for _ in range(rng.randint(2, 4)):
            w, h = rng.randint(3, 7) * 6, rng.randint(1, 2) * 6
            ox, oy = rng.randint(-12, 12), rng.randint(-4, 4)
            d.rectangle([cx + ox, cy + oy, cx + ox + w, cy + oy + h], fill=color + (alpha,))
    img.paste(layer, (0, 0), layer)


def far_hills(img, rng, color, base, amp, step=6):
    d = ImageDraw.Draw(img)
    phase = rng.random() * 10
    for x in range(0, img.width, step):
        h = base - int(amp * (math.sin(x * 0.02 + phase) * 0.6 + math.sin(x * 0.051 + phase * 2) * 0.4))
        h -= h % 4
        d.rectangle([x, h, x + step - 1, img.height], fill=color)


def heightmap(rng, cols, base, amp):
    phase = rng.random() * 100
    hs = []
    for c in range(cols):
        v = math.sin(c * 0.25 + phase) * 0.55 + math.sin(c * 0.11 + phase * 1.7) * 0.45
        hs.append(base - int(round(v * amp)))
    return hs


def terrain(img, blocks, rng, base_row, amp, sea_row=None, trees=True, ores=True):
    cols, rows = img.width // B + 1, img.height // B + 1
    hs = heightmap(rng, cols, base_row, amp)
    grid = {}
    for c in range(cols):
        top = hs[c]
        for r in range(top, rows):
            depth = r - top
            if depth == 0:
                name = "sand" if sea_row is not None and top >= sea_row - 1 else "grass"
            elif depth < 3:
                name = "sand" if sea_row is not None and top >= sea_row - 1 else "dirt"
            else:
                name = "stone"
                if ores:
                    roll = rng.random()
                    if roll < 0.05:
                        name = "coal"
                    elif roll < 0.075:
                        name = "iron"
                    elif roll < 0.085 and depth > 6:
                        name = "diamond"
            grid[(c, r)] = name
        if sea_row is not None:
            for r in range(sea_row, top):
                grid[(c, r)] = "water"
    if trees:
        c = rng.randint(2, 5)
        while c < cols - 2:
            top = hs[c]
            if grid.get((c, top)) == "grass" and (sea_row is None or top < sea_row - 1):
                th = rng.randint(3, 5)
                for i in range(1, th + 1):
                    grid[(c, top - i)] = "log"
                crown = top - th
                for dc in range(-2, 3):
                    for dr in range(-2, 1):
                        if abs(dc) == 2 and dr == -2:
                            continue
                        key = (c + dc, crown + dr)
                        if key not in grid:
                            grid[key] = "leaves"
                grid.setdefault((c, crown - 1), "leaves")
            c += rng.randint(5, 10)
    for (c, r), name in grid.items():
        tex = blocks.get(name, c, r)
        if name == "water":
            w = tex.copy()
            img.paste(Image.blend(img.crop((c * B, r * B, c * B + B, r * B + B)), w, 0.75), (c * B, r * B))
        else:
            img.paste(tex, (c * B, r * B))
    return hs


def upscale(img, s=SCALE):
    return img.resize((img.width * s, img.height * s), Image.NEAREST)


def scene_day(seed=3):
    rng = random.Random(seed)
    img = Image.new("RGB", (W, H))
    sky(img, (110, 160, 255), (190, 216, 255))
    d = ImageDraw.Draw(img)
    d.rectangle([250, 22, 266, 38], fill=(255, 250, 200))
    d.rectangle([253, 25, 263, 35], fill=(255, 255, 230))
    clouds(img, rng)
    far_hills(img, rng, (150, 180, 215), 112, 18)
    far_hills(img, rng, (110, 150, 120), 124, 12)
    terrain(img, Blocks(seed), rng, 15, 3, sea_row=16)
    return img


def scene_sunset(seed=11):
    rng = random.Random(seed)
    img = Image.new("RGB", (W, H))
    sky(img, (64, 44, 120), (255, 150, 80))
    d = ImageDraw.Draw(img)
    d.rectangle([140, 88, 172, 104], fill=(255, 214, 120))
    clouds(img, rng, (255, 190, 150), 5, 160)
    far_hills(img, rng, (120, 70, 110), 110, 20)
    far_hills(img, rng, (80, 50, 80), 122, 12)
    terrain(img, Blocks(seed), rng, 15, 3, sea_row=None)
    dark = Image.new("RGB", img.size, (60, 30, 60))
    return Image.blend(img, dark, 0.18)


def scene_night(seed=21):
    rng = random.Random(seed)
    img = Image.new("RGB", (W, H))
    sky(img, (8, 10, 30), (30, 40, 90), stars=True, rng=rng)
    d = ImageDraw.Draw(img)
    d.rectangle([60, 20, 76, 36], fill=(230, 230, 245))
    d.rectangle([64, 24, 68, 28], fill=(200, 200, 220))
    far_hills(img, rng, (24, 30, 60), 114, 18)
    terrain(img, Blocks(seed), rng, 15, 3, sea_row=16)
    dark = Image.new("RGB", img.size, (10, 12, 40))
    return Image.blend(img, dark, 0.45)


def scene_cave(seed=31, bright=False):
    rng = random.Random(seed)
    blocks = Blocks(seed)
    img = Image.new("RGB", (W, H), (20, 20, 24))
    cols, rows = W // B + 1, H // B + 1
    ceil = heightmap(rng, cols, 6, 3)
    floor = heightmap(random.Random(seed + 1), cols, 17, 3)
    for c in range(cols):
        for r in range(rows):
            if r <= ceil[c] or r >= floor[c]:
                roll = rng.random()
                name = "deepslate" if r > 18 else "stone"
                if roll < 0.06:
                    name = "coal"
                elif roll < 0.09:
                    name = "iron"
                elif roll < 0.11:
                    name = "gold"
                elif roll < 0.13:
                    name = "diamond"
                img.paste(blocks.get(name, c, r), (c * B, r * B))
            else:
                bg = make_texture(rng, (58, 58, 60), 10)
                img.paste(bg, (c * B, r * B))
    if not bright:
        light = Image.new("L", img.size, 0)
        ld = ImageDraw.Draw(light)
        for tx, ty in [(60, 120), (230, 110)]:
            for rad in range(110, 0, -6):
                ld.ellipse([tx - rad, ty - rad, tx + rad, ty + rad], fill=int(215 * (1 - rad / 110)) + 40)
        dark = Image.new("RGB", img.size, (4, 4, 8))
        img = Image.composite(img, dark, light)
        d = ImageDraw.Draw(img)
        for tx, ty in [(60, 120), (230, 110)]:
            d.rectangle([tx, ty, tx + 1, ty + 7], fill=(120, 90, 50))
            d.rectangle([tx, ty - 2, tx + 1, ty - 1], fill=(255, 220, 90))
    return img


def mc_button(img, x, y, w, h, label, color=(255, 255, 255), hover=False):
    d = ImageDraw.Draw(img)
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=(0, 0, 0))
    fill = (130, 130, 150) if hover else (111, 111, 111)
    d.rectangle([x + 1, y + 1, x + w - 2, y + h - 2], fill=fill)
    d.line([(x + 1, y + 1), (x + w - 2, y + 1)], fill=(170, 170, 170))
    d.line([(x + 1, y + 1), (x + 1, y + h - 2)], fill=(170, 170, 170))
    d.line([(x + 1, y + h - 2), (x + w - 2, y + h - 2)], fill=(85, 85, 85))
    if hover:
        d.rectangle([x, y, x + w - 1, y + h - 1], outline=(255, 255, 255))
    parts = label if isinstance(label, list) else [(label, color)]
    tw = sum(text_width(t) for t, _ in parts)
    cx = x + (w - tw) // 2
    for t, col in parts:
        cx = draw_text(img, cx, y + (h - 7) // 2, t, col)


def hotbar(img, sel=0):
    d = ImageDraw.Draw(img)
    slots, s = 9, 12
    x0 = (W - slots * s) // 2
    y0 = H - s - 2
    d.rectangle([x0 - 1, y0 - 1, x0 + slots * s, y0 + s], fill=(40, 40, 40))
    for i in range(slots):
        d.rectangle([x0 + i * s, y0, x0 + i * s + s - 1, y0 + s - 1], outline=(110, 110, 110), fill=(70, 70, 70))
    d.rectangle([x0 + sel * s - 1, y0 - 1, x0 + sel * s + s, y0 + s], outline=(240, 240, 240))
    icons = [(200, 200, 220), (160, 120, 70), (125, 125, 125), (94, 157, 52), (255, 210, 60), (220, 60, 60)]
    for i, col in enumerate(icons):
        cx, cy = x0 + i * s + 3, y0 + 3
        if i == 0:
            d.line([(cx, cy + 5), (cx + 5, cy)], fill=col, width=2)
            d.point((cx, cy + 5), fill=(120, 80, 40))
        else:
            d.rectangle([cx, cy, cx + 5, cy + 5], fill=col)
    hy = y0 - 9
    for i in range(10):
        hx = x0 + i * 6
        d.rectangle([hx, hy, hx + 4, hy + 4], fill=(200, 30, 30))
        d.point((hx + 1, hy + 1), fill=(255, 160, 160))
    for i in range(10):
        fx = x0 + slots * s - 5 - i * 6
        d.rectangle([fx, hy, fx + 4, hy + 4], fill=(170, 110, 50))
    d.rectangle([x0, y0 - 3, x0 + slots * s - 1, y0 - 2], fill=(30, 30, 30))
    d.rectangle([x0, y0 - 3, x0 + int(slots * s * 0.6), y0 - 2], fill=(128, 255, 32))
    cx, cy = W // 2, H // 2
    d.line([(cx - 3, cy), (cx + 3, cy)], fill=(240, 240, 240))
    d.line([(cx, cy - 3), (cx, cy + 3)], fill=(240, 240, 240))


ACCENT = (255, 216, 77)
WHITE = (255, 255, 255)


def hud_line(img, x, y, label, value):
    cx = draw_text(img, x, y, label + ": ", ACCENT)
    draw_text(img, cx, y, value, WHITE)
    return y + 10


def keystroke(img, x, y, w, h, label, down):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rectangle([x, y, x + w - 1, y + h - 1], fill=(255, 255, 255, 176) if down else (0, 0, 0, 112))
    img.paste(Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB"))
    tw = text_width(label)
    draw_text(img, x + (w - tw) // 2, y + (h - 7) // 2, label, (0, 0, 0) if down else WHITE, shadow=not down)


def armor_icon(img, x, y, kind, dur, max_dur):
    d = ImageDraw.Draw(img)
    col = (90, 220, 220)
    if kind == "helmet":
        d.rectangle([x + 1, y + 2, x + 8, y + 5], fill=col)
        d.rectangle([x + 1, y + 6, x + 2, y + 8], fill=col)
        d.rectangle([x + 7, y + 6, x + 8, y + 8], fill=col)
    elif kind == "chest":
        d.rectangle([x + 1, y + 1, x + 8, y + 9], fill=col)
        d.rectangle([x + 4, y + 1, x + 5, y + 3], fill=(40, 120, 120))
    elif kind == "legs":
        d.rectangle([x + 2, y + 1, x + 7, y + 3], fill=col)
        d.rectangle([x + 2, y + 4, x + 3, y + 9], fill=col)
        d.rectangle([x + 6, y + 4, x + 7, y + 9], fill=col)
    elif kind == "boots":
        d.rectangle([x + 1, y + 5, x + 3, y + 9], fill=col)
        d.rectangle([x + 6, y + 5, x + 8, y + 9], fill=col)
    else:
        d.line([(x + 1, y + 9), (x + 8, y + 1)], fill=col, width=2)
        d.line([(x + 1, y + 7), (x + 3, y + 9)], fill=(120, 80, 40), width=2)
    pct = dur / max_dur
    colr = (85, 255, 85) if pct > 0.6 else (255, 255, 85) if pct > 0.3 else (255, 85, 85)
    s = str(dur)
    draw_text(img, x - text_width(s) - 3, y + 2, s, colr)


def hud_overlay(img, keys_down=("W",), lmb=True, cps=(11, 4), fullbright=False, sprint=False, facing="NORTH", xyz="-284 72 1093", fps=243):
    y = 4
    y = hud_line(img, 4, y, "FPS", str(fps))
    y = hud_line(img, 4, y, "XYZ", xyz)
    y = hud_line(img, 4, y, "FACING", facing)
    y = hud_line(img, 4, y, "CPS", f"{cps[0]} | {cps[1]}")
    if fullbright:
        y = hud_line(img, 4, y, "FULLBRIGHT", "ON")
    if sprint:
        y = hud_line(img, 4, y, "SPRINT", "SPRINTING")
    s, g = 15, 1
    kx, ky = 4, y + 3
    keystroke(img, kx + s + g, ky, s, s, "W", "W" in keys_down)
    keystroke(img, kx, ky + s + g, s, s, "A", "A" in keys_down)
    keystroke(img, kx + s + g, ky + s + g, s, s, "S", "S" in keys_down)
    keystroke(img, kx + (s + g) * 2, ky + s + g, s, s, "D", "D" in keys_down)
    full = s * 3 + g * 2
    half = (full - g) // 2
    my = ky + (s + g) * 2
    keystroke(img, kx, my, half, s, "LMB", lmb)
    keystroke(img, kx + half + g, my, full - half - g, s, "RMB", False)
    keystroke(img, kx, my + s + g, full, 9, "SPACE", "SPACE" in keys_down)
    ax, ay = W - 14, H // 2 - 30
    for kind, dur, mx in [("helmet", 337, 363), ("chest", 412, 528), ("legs", 301, 495), ("boots", 120, 429), ("sword", 1402, 1561)]:
        armor_icon(img, ax, ay, kind, dur, mx)
        ay += 12


def save(img, name, scale=SCALE):
    upscale(img, scale).save(OUT / name, optimize=True)
    print("wrote", OUT / name)


def bg_images():
    save(scene_day(), "bg-day.png")
    save(scene_sunset(), "bg-sunset.png")
    save(scene_night(), "bg-night.png")


def shot_hud():
    img = scene_day(5)
    hotbar(img, 0)
    hud_overlay(img, keys_down=("W", "D"), lmb=True, cps=(12, 3), sprint=True)
    save(img, "shot-hud.png")


def shot_menu():
    img = scene_sunset(7).filter(ImageFilter.GaussianBlur(1.2))
    img = Image.blend(img, Image.new("RGB", img.size, (0, 0, 0)), 0.55)
    cx = W // 2
    title = "PINEAPPLE"
    tw = text_width(title + "CLIENT", 2)
    x = cx - tw // 2
    x = draw_text(img, x, 14, title, ACCENT, 2)
    draw_text(img, x + 2, 14, "CLIENT", WHITE, 2)
    sub = "REBIND KEYS IN OPTIONS > CONTROLS"
    draw_text(img, cx - text_width(sub) // 2, 34, sub, (170, 170, 170))
    bw, bh = 96, 14
    lx, rx = cx - bw - 3, cx + 3
    items = [("FPS", True), ("COORDINATES", True), ("CPS", True), ("KEYSTROKES", True),
             ("ARMOR HUD", True), ("FULLBRIGHT", False), ("TOGGLE SPRINT", True), ("SMOOTH ZOOM", True)]
    y0 = 48
    for i, (name, on) in enumerate(items):
        x = lx if i % 2 == 0 else rx
        y = y0 + (i // 2) * 17
        mc_button(img, x, y, bw, bh, [(name + ": ", WHITE), ("ON" if on else "OFF", (85, 255, 85) if on else (255, 85, 85))], hover=(i == 5))
    mc_button(img, lx, y0 + 4 * 17, bw * 2 + 6, bh, "ZOOM STRENGTH: 4X")
    mc_button(img, cx - 60, y0 + 5 * 17 + 6, 120, bh, "DONE")
    save(img, "shot-menu.png")


def shot_zoom():
    base = scene_day(9)
    hotbar(base, 2)
    crop_w, crop_h = W // 4, H // 4
    cx, cy = int(W * 0.62), int(H * 0.52)
    zoomed = base.crop((cx - crop_w // 2, cy - crop_h // 2, cx + crop_w // 2, cy + crop_h // 2)).resize((W, H), Image.NEAREST)
    zoomed = zoomed.filter(ImageFilter.GaussianBlur(0.4))
    hotbar(zoomed, 2)
    hud_overlay(zoomed, keys_down=(), lmb=False, cps=(0, 0), facing="EAST", xyz="12 81 -440", fps=231)
    label = "ZOOM 4X (HOLD C)"
    draw_text(zoomed, W - text_width(label) - 6, 6, label, ACCENT)
    save(zoomed, "shot-zoom.png")


def shot_fullbright():
    dark = scene_cave(31, bright=False)
    bright = scene_cave(31, bright=True)
    img = dark.copy()
    img.paste(bright.crop((W // 2, 0, W, H)), (W // 2, 0))
    d = ImageDraw.Draw(img)
    d.line([(W // 2, 0), (W // 2, H)], fill=ACCENT, width=1)
    draw_text(img, 8, H - 14, "NORMAL", WHITE)
    draw_text(img, W - text_width("FULLBRIGHT (G)") - 8, H - 14, "FULLBRIGHT (G)", ACCENT)
    save(img, "shot-fullbright.png")


def font(size, bold=False):
    names = ["DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"]
    for n in names:
        for base in ["/usr/share/fonts/truetype/dejavu/", "/Library/Fonts/", "C:/Windows/Fonts/"]:
            try:
                return ImageFont.truetype(base + n, size)
            except OSError:
                pass
    return ImageFont.load_default(size)


def shot_launcher():
    w, h = 1280, 1120
    img = Image.new("RGB", (w, h), (20, 22, 28))
    d = ImageDraw.Draw(img)
    acc, panel, fg, sub = (247, 201, 72), (30, 33, 43), (232, 232, 232), (154, 160, 173)
    d.rectangle([0, 0, w, 56], fill=(36, 38, 46))
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse([24 + i * 36, 18, 44 + i * 36, 38], fill=c)
    d.text((w // 2, 28), "PineappleClient Launcher", font=font(26), fill=sub, anchor="mm")
    y = 90
    d.text((48, y), "PineappleClient", font=font(64, True), fill=acc)
    d.text((48, y + 84), "Instance folder: ~/Library/Application Support/pineappleclient", font=font(24), fill=sub)

    def frame(top, height, title):
        d.rounded_rectangle([40, top, w - 40, top + height], 10, outline=(52, 56, 70), width=2)
        d.rectangle([60, top - 14, 60 + 18 * len(title) + 10, top + 14], fill=(20, 22, 28))
        d.text((66, top), title, font=font(26, True), fill=acc, anchor="lm")

    def radio(x, yy, label, on):
        d.ellipse([x, yy, x + 26, yy + 26], outline=fg, width=3)
        if on:
            d.ellipse([x + 7, yy + 7, x + 19, yy + 19], fill=acc)
        d.text((x + 40, yy + 13), label, font=font(26), fill=fg, anchor="lm")

    def entry(x, yy, ww, text):
        d.rounded_rectangle([x, yy, x + ww, yy + 46], 6, fill=panel, outline=(60, 64, 80), width=2)
        d.text((x + 14, yy + 23), text, font=font(26), fill=fg, anchor="lm")

    def button(x, yy, ww, text):
        d.rounded_rectangle([x, yy, x + ww, yy + 48], 6, fill=panel, outline=(60, 64, 80), width=2)
        d.text((x + ww // 2, yy + 24), text, font=font(24), fill=fg, anchor="mm")

    top = 230
    frame(top, 300, "Account")
    radio(70, top + 34, "Offline (singleplayer / offline servers)", False)
    radio(70, top + 76, "Microsoft account", True)
    d.text((70, top + 140), "Username", font=font(26), fill=sub, anchor="lm")
    entry(300, top + 117, 360, "")
    d.text((70, top + 196), "Azure client ID", font=font(26), fill=fg, anchor="lm")
    entry(300, top + 173, 560, "a1b2c3d4-••••-••••-••••-0e9f")
    d.text((70, top + 242), "Signed in as SlaxY1r", font=font(24), fill=sub, anchor="lm")
    button(860, top + 220, 150, "Sign in")
    button(1030, top + 220, 170, "Sign out")

    top = 580
    frame(top, 250, "Game")
    d.text((70, top + 50), "Version", font=font(26), fill=fg, anchor="lm")
    entry(220, top + 27, 220, "1.21.1   ▾")
    d.rectangle([480, top + 37, 506, top + 63], outline=fg, width=3)
    d.line([(485, top + 50), (492, top + 58), (502, top + 42)], fill=acc, width=4)
    d.text((522, top + 50), "Fabric + PineappleClient mod", font=font(26), fill=fg, anchor="lm")
    d.text((70, top + 118), "RAM", font=font(26), fill=fg, anchor="lm")
    d.rounded_rectangle([220, top + 112, 720, top + 124], 6, fill=panel)
    d.rounded_rectangle([220, top + 112, 360, top + 124], 6, fill=acc)
    d.rounded_rectangle([352, top + 100, 378, top + 136], 4, fill=(200, 200, 210))
    d.text((750, top + 118), "6 GB", font=font(26), fill=fg, anchor="lm")
    button(70, top + 168, 220, "Add mod jar…")
    button(310, top + 168, 260, "Open game folder")

    d.rounded_rectangle([40, 870, w - 40, 950], 8, fill=acc)
    d.text((w // 2, 910), "PLAY", font=font(40, True), fill=(11, 13, 18), anchor="mm")
    d.text((48, 980), "Launching fabric-loader-0.16.14-1.21.1 as SlaxY1r", font=font(24), fill=sub)
    d.rounded_rectangle([40, 1018, w - 40, 1030], 6, fill=panel)
    d.rounded_rectangle([40, 1018, w - 40, 1030], 6, fill=acc)
    d.text((48, 1052), "[Render thread/INFO]: PineappleClient loaded", font=font(22), fill=(184, 188, 198))
    d.text((48, 1082), "[Render thread/INFO]: Backend library: LWJGL version 3.3.3", font=font(22), fill=(130, 134, 144))
    img.save(OUT / "shot-launcher.png", optimize=True)
    print("wrote", OUT / "shot-launcher.png")


def icon():
    s = 32
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    leaf = (70, 160, 60)
    for x0, y0, x1, y1 in [(14, 1, 17, 9), (9, 3, 12, 9), (19, 3, 22, 9), (11, 6, 20, 10)]:
        d.rectangle([x0, y0, x1, y1], fill=leaf)
    d.rectangle([8, 10, 23, 30], fill=(230, 170, 40))
    d.rectangle([7, 13, 24, 27], fill=(230, 170, 40))
    for yy in range(11, 30, 4):
        for xx in range(8 + (yy // 4) % 2 * 2, 24, 4):
            d.rectangle([xx, yy, xx + 1, yy + 1], fill=(170, 110, 20))
    d.rectangle([9, 11, 10, 20], fill=(255, 215, 90))
    img.resize((256, 256), Image.NEAREST).save(OUT / "icon.png")
    img.resize((64, 64), Image.NEAREST).save(OUT / "favicon.png")
    img.resize((1024, 1024), Image.NEAREST).save(OUT / "icon-1024.png")
    print("wrote icons")


if __name__ == "__main__":
    bg_images()
    shot_hud()
    shot_menu()
    shot_zoom()
    shot_fullbright()
    shot_launcher()
    icon()
