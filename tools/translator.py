"""Message-Translator filter: renders a text-agnostic Clue into baked clueText.

One constraint -> one atomic sentence, baked into the manifest at build time. The
solver stays text-agnostic; nothing here runs in the browser. Params are typed
loosely (list/tuple) to keep generate.py's Cat/Clue types out of a circular import.
"""

from __future__ import annotations

_TEMPLATES = {
    "eq": "{a} sits with the {b}.",
    "neq": "{a} is not with the {b}.",
    "ends": "{a} is far {side}.",
    "adjacent": "{a} is next to {b}.",
    "distance": "{a} and {b} are {k} apart.",
    "before": "{a} is before {b}.",
    "opposite": "{a} sits across from {b}.",
    "between": "{a} sits between {b} and {c}.",
}


def _label(cats: list, cat: str, val: str) -> str:
    c = next(c for c in cats if c.id == cat)
    return c.labels[c.value_ids.index(val)]


def clue_text(cats: list, n: int, clue: tuple) -> str:
    typ, ops, params = clue
    p = dict(params)
    a = _label(cats, *ops[0])
    if typ == "ends":
        return _TEMPLATES[typ].format(a=a, side="left" if p["pos"] == 0 else "right")
    b = _label(cats, *ops[1])
    c = _label(cats, *ops[2]) if len(ops) > 2 else ""
    return _TEMPLATES[typ].format(a=a, b=b, c=c, k=p.get("k", ""))
