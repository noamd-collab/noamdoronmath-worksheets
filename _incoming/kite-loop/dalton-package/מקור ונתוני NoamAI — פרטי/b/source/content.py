# -*- coding: utf-8 -*-
u"""G9-KITE -- דלתון. v7 production, levels a, b, c.

Written from principles: the source PDFs are reference input only, and every
question, number and sentence here is new. Uses the exact supported engine. Applicable figure, text, export and
didactic checks must be verified; no gate is presumed passed.

Build (from THIS folder):   LEVEL=a python3 <skill>/build_plus.py
"""
import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# The engine accepts only G<grade>-T<nn>. G9-T99 is a LOCAL build alias for G9-KITE
# (real site ids end at G9-T32). It is not a site id: Noam decides the real one
# before any upload.
PACKAGE = "G9-T99"
TITLE = u"דלתון"
STRICT_FIGURES = True
CURRICULUM = dict(topic="kite", track=u"ט", grade="9")

_KEYS = ("a", "b", "c")
_ONLY = [k.strip() for k in os.environ.get("LEVEL", "").split(",") if k.strip()]
assert all(k in _KEYS for k in _ONLY), "LEVEL=%s" % ",".join(_ONLY)

LEVELS = []
for _k in (_ONLY or _KEYS):
    if not os.path.exists(os.path.join(HERE, "level_%s.py" % _k)):
        continue
    _L = getattr(importlib.import_module("level_%s" % _k), "L%s" % _k)
    if _L is None:
        continue
    assert _L.get("key") == _k, "level_%s.py must set key=%r" % (_k, _k)
    _L.setdefault("curriculum", dict(CURRICULUM))
    LEVELS.append(_L)
assert LEVELS, "no level to build (LEVEL=%s)" % ",".join(_ONLY)
