"""Message-Translator filter: renders a text-agnostic Clue into baked clueText.

One constraint -> one atomic sentence, baked into the manifest at build time. The
solver stays text-agnostic; nothing here runs in the browser. Params are typed
loosely (list/tuple) to keep generate.py's Cat/Clue types out of a circular import.
"""

from __future__ import annotations

import random


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


_COMPOUND_TYPES = ("oneOf", "oneEachOf", "ifThen")


def _parts(cats: list, op: tuple, mode: str) -> tuple[str, str, str]:
    """(ref, label, phrase) for one (cat, value) operand under the tier indirection mode."""
    s = _clue_slots(cats, op[0], op[1], mode, "z")
    return s["z_ref"], s["z_label"], s["z_phrase"]


def _compound_slots(typ: str, cats: list, ops: tuple, mode: str) -> dict:
    """Slot bundle for a reified compound clue. Each type maps its heterogeneous operands onto the
    named slots its clueTemplate variants use: oneOf names entity a plus two candidate labels
    (x, y); oneEachOf names two entities (x, y) and two attribute phrases (a, b); ifThen names an
    entity + phrase antecedent (a) and an entity + phrase consequent (b)."""
    if typ == "oneOf":  # ops = (entity a, value x, value y)
        a_ref, _, _ = _parts(cats, ops[0], mode)
        _, x_label, _ = _parts(cats, ops[1], mode)
        _, y_label, _ = _parts(cats, ops[2], mode)
        return {"a_ref": a_ref, "x_label": x_label, "y_label": y_label}
    if typ == "oneEachOf":  # ops = (entity x, entity y, fact A, fact B)
        x_ref, _, _ = _parts(cats, ops[0], mode)
        y_ref, _, _ = _parts(cats, ops[1], mode)
        _, _, a_phrase = _parts(cats, ops[2], mode)
        _, _, b_phrase = _parts(cats, ops[3], mode)
        return {"x_ref": x_ref, "y_ref": y_ref, "a_phrase": a_phrase, "b_phrase": b_phrase}
    if typ == "ifThen":  # ops = (entity a, fact P, entity b, fact Q)
        a_ref, _, _ = _parts(cats, ops[0], mode)
        _, _, a_phrase = _parts(cats, ops[1], mode)
        b_ref, _, _ = _parts(cats, ops[2], mode)
        _, _, b_phrase = _parts(cats, ops[3], mode)
        return {"a_ref": a_ref, "a_phrase": a_phrase, "b_ref": b_ref, "b_phrase": b_phrase}
    raise KeyError(f"unknown compound clue type {typ!r}")


def render_clue(scenario, tier: str, cats: list, clue: tuple, seed: int, index: int = 0) -> str:
    """Render a story clue to a full sentence from scenario.clueTemplates[type] (date-seeded
    variant), honoring indirection.byTier[tier]. Atomic clues supply a_ref/a_label/a_phrase (+ the
    b_* trio when a second operand exists) plus any numeric params (delta/bound); compound clues
    fill their own named slots (see _compound_slots). Unused slots are ignored by str.format."""
    typ, ops = clue[0], clue[1]
    params = dict(clue[2]) if len(clue) > 2 else {}
    variants = scenario.clueTemplates[typ].variants
    rng = random.Random((seed ^ _CLUE_SALT) + index)
    variant = variants[rng.randrange(len(variants))]
    mode = scenario.indirection.byTier[tier]
    if typ in _COMPOUND_TYPES:
        slots: dict = _compound_slots(typ, cats, ops, mode)
    else:
        slots = {}
        slots.update(_clue_slots(cats, ops[0][0], ops[0][1], mode, "a"))
        if len(ops) > 1:
            slots.update(_clue_slots(cats, ops[1][0], ops[1][1], mode, "b"))
    slots.update(params)  # numeric params: delta / bound (numericCat, dir ignored by the templates)
    return variant.format(**slots)
