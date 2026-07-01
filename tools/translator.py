"""Message-Translator filter: renders a text-agnostic Clue into baked clueText.

One constraint -> one atomic sentence, baked into the manifest at build time. The
solver stays text-agnostic; nothing here runs in the browser. Params are typed
loosely (list/tuple) to keep generate.py's Cat/Clue types out of a circular import.
"""

from __future__ import annotations

import random

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


# --- story-first renderers (corpus-driven; scenario duck-typed to avoid a corpus import) ---

_NUM_WORDS = (
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"
)
_FLAVOR_SALT = 0x27D4EB2F  # story flavor-pick PRNG salt
_CLUE_SALT = 0x165667B1    # per-clue variant-pick PRNG salt


def _num_word(n: int) -> str:
    """Small cardinal as an English word ('four'); falls back to digits past the table."""
    return _NUM_WORDS[n] if 0 <= n < len(_NUM_WORDS) else str(n)


def render_story(scenario, entities: int, seed: int) -> str:
    """Fill the scenario narrativeTemplate: {n} = entity count as a word, plus one date-seeded
    pick per flavor pool (e.g. {mentor}, {ink}). Deterministic for a given seed."""
    rng = random.Random(seed ^ _FLAVOR_SALT)
    slots = {"n": _num_word(entities)}
    for slot, pool in sorted(scenario.flavorPools.items()):
        slots[slot] = pool[rng.randrange(len(pool))]
    return scenario.narrativeTemplate.format(**slots)


def _clue_slots(cats: list, cat_id: str, val_id: str, mode: str, prefix: str) -> dict:
    """Slot bundle for one operand: <p>_ref (indirection-aware), <p>_label, <p>_phrase. In
    'attribute' mode a value with a refPhrase reads as 'the <refPhrase>'; else the label."""
    cat = next(c for c in cats if c.id == cat_id)
    i = cat.value_ids.index(val_id)
    label = cat.labels[i]
    phrases = getattr(cat, "phrases", None)
    ref_phrases = getattr(cat, "ref_phrases", None)
    phrase = (phrases[i] if phrases else None) or ""
    ref_phrase = (ref_phrases[i] if ref_phrases else None) or ""
    ref = f"the {ref_phrase}" if (mode == "attribute" and ref_phrase) else label
    return {f"{prefix}_ref": ref, f"{prefix}_label": label, f"{prefix}_phrase": phrase}


def render_clue(scenario, tier: str, cats: list, clue: tuple, seed: int, index: int = 0) -> str:
    """Render a story clue to a full sentence from scenario.clueTemplates[type] (date-seeded
    variant), honoring indirection.byTier[tier]. Supplies a_ref/a_label/a_phrase (+ the b_* trio
    when a second operand exists) plus any numeric params (delta/bound) so numDiff/threshold
    variants fill cleanly; unused slots are ignored by str.format."""
    typ, ops = clue[0], clue[1]
    params = dict(clue[2]) if len(clue) > 2 else {}
    variants = scenario.clueTemplates[typ].variants
    rng = random.Random((seed ^ _CLUE_SALT) + index)
    variant = variants[rng.randrange(len(variants))]
    mode = scenario.indirection.byTier[tier]
    slots: dict = {}
    slots.update(_clue_slots(cats, ops[0][0], ops[0][1], mode, "a"))
    if len(ops) > 1:
        slots.update(_clue_slots(cats, ops[1][0], ops[1][1], mode, "b"))
    slots.update(params)  # numeric params: delta / bound (numericCat, dir ignored by the templates)
    return variant.format(**slots)
