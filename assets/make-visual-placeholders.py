"""Writes the placeholder images used by Visual memory:

  assets/figures/jvm-architecture.svg, assets/figures/thread-states.svg
      Figures "from the PDF", drawn without their labels: the page puts
      numbered hotspots on top and lists the labels below.
  assets/palace/java-topic-1.svg ... java-topic-6.svg
      One simple room per topic for the memory palace.

Run from the project root: python assets/make-visual-placeholders.py
Hotspot positions in data.js (visuals, type "figure") are percentages of
these images, so update them together.
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
PAPER, INK, FILL = "#f7f3ea", "#3a342c", "#ece4d3"


def write(path, body, w, h):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n{body}\n</svg>\n'
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(svg)


def arrow_defs():
    return (f'<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            f'<path d="M0 0 10 5 0 10z" fill="{INK}"/></marker></defs>')


def box(cx, cy, w, h, fill=FILL, sw=2, dash=""):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<rect x="{cx - w / 2}" y="{cy - h / 2}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{INK}" stroke-width="{sw}"{d}/>'


def scribble(cx, cy, w):
    # Faint grey bars where a label would be printed.
    return f'<rect x="{cx - w / 2}" y="{cy - 3}" width="{w}" height="6" rx="3" fill="#cfc5b2"/>'


def jvm():
    w, h = 800, 520
    parts = [arrow_defs(), f'<rect width="{w}" height="{h}" fill="{PAPER}"/>']
    parts.append(box(400, 70, 400, 80))
    parts.append(f'<line x1="400" y1="110" x2="400" y2="138" stroke="{INK}" stroke-width="2" marker-end="url(#ah)"/>')
    parts.append(box(400, 230, 740, 180, fill="none", dash="8 6"))
    parts.append(scribble(400, 157, 160))
    for x in (120, 260, 400, 540, 680):
        parts.append(box(x, 229, 120, 100))
    parts.append(f'<line x1="400" y1="320" x2="400" y2="358" stroke="{INK}" stroke-width="2" marker-end="url(#ah)"/>')
    parts.append(box(250, 420, 440, 120, fill="none", dash="8 6"))
    parts.append(scribble(250, 374, 140))
    for x in (112, 248, 384):
        parts.append(box(x, 427, 115, 70))
    parts.append(box(640, 427, 160, 70))
    parts.append(f'<line x1="472" y1="427" x2="556" y2="427" stroke="{INK}" stroke-width="2" marker-start="url(#ah)" marker-end="url(#ah)"/>')
    parts.append(f'<text x="400" y="510" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="{INK}">Fig. 1.2</text>')
    write(os.path.join(ROOT, "figures", "jvm-architecture.svg"), "\n".join(parts), w, h)


def threads():
    w, h = 800, 460
    states = {"new": (88, 230), "run": (296, 230), "blk": (520, 80), "wait": (520, 230), "tw": (520, 380), "end": (720, 230)}
    parts = [arrow_defs(), f'<rect width="{w}" height="{h}" fill="{PAPER}"/>']

    def line(a, b, bend=0):
        (x1, y1), (x2, y2) = states[a], states[b]
        dx, dy = x2 - x1, y2 - y1
        dist = (dx * dx + dy * dy) ** 0.5
        ux, uy = dx / dist, dy / dist
        sx, sy, ex, ey = x1 + ux * 50, y1 + uy * 50, x2 - ux * 52, y2 - uy * 52
        mx, my = (sx + ex) / 2 - uy * bend, (sy + ey) / 2 + ux * bend
        return f'<path d="M{sx:.0f} {sy:.0f} Q{mx:.0f} {my:.0f} {ex:.0f} {ey:.0f}" fill="none" stroke="{INK}" stroke-width="2" marker-end="url(#ah)"/>'

    parts.append(line("new", "run"))
    for s in ("blk", "wait", "tw"):
        parts.append(line("run", s, 18))
        parts.append(line(s, "run", 18))
    parts.append(f'<path d="M336 202 C 430 150 610 150 676 206" fill="none" stroke="{INK}" stroke-width="2" marker-end="url(#ah)"/>')
    for x, y in states.values():
        parts.append(f'<circle cx="{x}" cy="{y}" r="48" fill="{FILL}" stroke="{INK}" stroke-width="2"/>')
    parts.append(f'<circle cx="720" cy="230" r="40" fill="none" stroke="{INK}" stroke-width="1.5"/>')
    parts.append(f'<text x="400" y="450" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="{INK}">Fig. 7.1</text>')
    write(os.path.join(ROOT, "figures", "thread-states.svg"), "\n".join(parts), w, h)


# Memory palace rooms: (wall, floor, accent) per topic, plus the room's furniture.
ROOMS = [
    ("#3b2f2a", "#5a4130", "#e0673a"),
    ("#2f3a36", "#4d4a3c", "#d9a52a"),
    ("#332c3d", "#4a3d36", "#a78bfa"),
    ("#2c3540", "#4b3f33", "#4fa3d9"),
    ("#3a3226", "#55442f", "#6fbf73"),
    ("#26323d", "#3f3a35", "#3fb8af"),
]


def furniture(i, accent):
    if i == 1:  # sofa and a capsule
        return (f'<rect x="250" y="300" width="300" height="70" rx="18" fill="{accent}"/>'
                f'<rect x="230" y="280" width="40" height="95" rx="14" fill="{accent}" opacity=".85"/>'
                f'<rect x="530" y="280" width="40" height="95" rx="14" fill="{accent}" opacity=".85"/>'
                f'<rect x="350" y="268" width="70" height="34" rx="17" fill="#f0eae0" opacity=".9"/>'
                f'<rect x="610" y="120" width="90" height="110" rx="4" fill="#1d1916" stroke="#c9b9a0" stroke-width="5"/>')
    if i == 2:  # counter and fridge
        return (f'<rect x="120" y="270" width="380" height="110" fill="#6b5a48"/><rect x="120" y="258" width="380" height="16" fill="#cbbfa9"/>'
                f'<rect x="560" y="150" width="120" height="230" rx="10" fill="#d8d2c6"/><rect x="664" y="200" width="6" height="40" fill="#8a8172"/>'
                f'<circle cx="260" cy="244" r="24" fill="{accent}"/><rect x="236" y="244" width="48" height="12" fill="#3a2f26"/>')
    if i == 3:  # staircase
        steps = "".join(f'<rect x="{220 + k * 60}" y="{380 - (k + 1) * 40}" width="{420 - k * 60}" height="40" fill="{accent}" opacity="{0.45 + k * 0.08:.2f}"/>' for k in range(6))
        return steps + '<rect x="560" y="120" width="12" height="260" fill="#cbbfa9"/>'
    if i == 4:  # desk and lamp
        return (f'<rect x="200" y="260" width="400" height="22" fill="#8a6a4a"/><rect x="220" y="282" width="18" height="100" fill="#6b5236"/>'
                f'<rect x="562" y="282" width="18" height="100" fill="#6b5236"/><rect x="420" y="282" width="140" height="70" fill="#7a5d40"/>'
                f'<path d="M300 258 L310 200 L350 180" stroke="#cbbfa9" stroke-width="6" fill="none"/><path d="M330 168 L380 178 L360 205 Z" fill="{accent}"/>'
                f'<rect x="440" y="226" width="90" height="34" rx="4" fill="#2c2620" stroke="{accent}" stroke-width="3"/>')
    if i == 5:  # bookshelf
        books = ""
        for row, y in enumerate((150, 230, 310)):
            x = 250
            for k in range(9):
                bw = 18 + (k * 7 + row * 5) % 14
                books += f'<rect x="{x}" y="{y - 52 + (k % 3) * 4}" width="{bw}" height="{52 - (k % 3) * 4}" fill="{accent}" opacity="{0.5 + ((k + row) % 4) * 0.12:.2f}"/>'
                x += bw + 4
        return f'<rect x="230" y="80" width="340" height="300" fill="#5b4632"/>' + "".join(
            f'<rect x="230" y="{y}" width="340" height="10" fill="#3e2f22"/>' for y in (150, 230, 310)) + books
    # balcony railing and sky
    rails = "".join(f'<rect x="{110 + k * 40}" y="250" width="8" height="130" fill="#cbbfa9"/>' for k in range(15))
    return (f'<rect x="100" y="70" width="600" height="180" fill="{accent}" opacity=".35"/><circle cx="600" cy="130" r="34" fill="#f5d38a"/>'
            f'<rect x="100" y="240" width="600" height="12" fill="#cbbfa9"/>{rails}')


def palace():
    w, h = 800, 500
    for i, (wall, floor, accent) in enumerate(ROOMS, start=1):
        parts = [
            f'<rect width="{w}" height="{h}" fill="{wall}"/>',
            f'<polygon points="0,500 120,380 680,380 800,500" fill="{floor}"/>',
            '<polygon points="0,0 120,60 120,380 0,500" fill="#000" opacity=".18"/>',
            '<polygon points="800,0 680,60 680,380 800,500" fill="#000" opacity=".12"/>',
            '<line x1="120" y1="60" x2="680" y2="60" stroke="#000" stroke-opacity=".2" stroke-width="2"/>',
            f'<ellipse cx="400" cy="440" rx="220" ry="34" fill="{accent}" opacity=".25"/>',
        ]
        if i in (1, 3):
            parts.append(f'<rect x="140" y="110" width="80" height="120" fill="{accent}" opacity=".25" stroke="#c9b9a0" stroke-width="4"/>')
        parts.append(furniture(i, accent))
        parts.append('<text x="784" y="488" text-anchor="end" font-family="Arial, sans-serif" font-size="13" fill="#f0eae0" opacity=".6">Placeholder image</text>')
        write(os.path.join(ROOT, "palace", f"java-topic-{i}.svg"), "\n".join(parts), w, h)


if __name__ == "__main__":
    jvm()
    threads()
    palace()
    print("Wrote figures and palace images")
