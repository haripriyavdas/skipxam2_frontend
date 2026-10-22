"""
Regenerates data/colleges.js from data/colleges.json.

colleges.json is the source of truth. The app fetches it directly when served
over http(s). Browsers block fetch() for pages opened from disk (file://), so
the app falls back to colleges.js, a copy wrapped in a script.

After replacing colleges.json (for example with the full AISHE list), run:
    python data/make-colleges-js.py
"""
import json
import pathlib

here = pathlib.Path(__file__).parent
colleges = json.loads((here / "colleges.json").read_text(encoding="utf-8"))
(here / "colleges.js").write_text(
    "// Generated from colleges.json by make-colleges-js.py. Do not edit by hand.\n"
    "window.SKIPXAM_COLLEGES = " + json.dumps(colleges, ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8",
)
print(f"Wrote colleges.js with {len(colleges)} colleges")
