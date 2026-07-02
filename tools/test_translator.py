"""Translator unit tests for the story-first renderers: render_story fills the narrative
(entity-count word + date-seeded flavor picks) and render_clue renders each clue type to
exact ASCII from the scenario templates, honoring the tier indirection mode. Pure filter -
no solver, no mocks (the scenario + cats are minimal duck-typed stand-ins). The legacy
positional clue_text renderer is retired (Row 9d matrix-only)."""

from dataclasses import dataclass

from translator import render_clue, render_story


@dataclass(frozen=True)
class _Cat:
    """Minimal stand-in exposing only the attributes render_clue + render_story read."""

    id: str
    value_ids: list[str]
    labels: list[str]
    phrases: list[str] | None = None
    ref_phrases: list[str] | None = None
    label: str = ""
    anchor: bool = False


@dataclass(frozen=True)
class _ClueTemplate:
    variants: list[str]


@dataclass(frozen=True)
class _Indirection:
    byTier: dict[str, str]


@dataclass(frozen=True)
class _Scenario:
    narrativeTemplate: str
    flavorPools: dict[str, list[str]]
    indirection: _Indirection
    clueTemplates: dict[str, _ClueTemplate]
    subjectNoun: str = "friend"
    id: str = "demo"


CATS = [
    _Cat("name", ["ana", "ben"], ["Ana", "Ben"], label="Friend", anchor=True),
    _Cat(
        "craft", ["pottery", "jam"], ["Pottery", "Jam"],
        phrases=["threw the pottery", "made the jam"], ref_phrases=["potter", "jam-maker"],
        label="Craft",
    ),
]

SCENARIO = _Scenario(
    narrativeTemplate="{n} friends run stalls, watched by {mentor}.",
    flavorPools={"mentor": ["Sam"]},
    indirection=_Indirection(byTier={"standard": "name", "sharp": "attribute"}),
    clueTemplates={
        "eq": _ClueTemplate(["{a_label} likes {b_label}."]),
        "neq": _ClueTemplate(["{a_label} is not {b_ref}."]),
        "numDiff": _ClueTemplate(["{a_label} charged {delta} more than {b_label}."]),
    },
)


def test_render_story_fills_count_and_flavor() -> None:
    # {n} -> the entity count as a word; {mentor} -> the single-item pool; deterministic. The
    # renderer then appends a premise + match-line built from the NON-anchor categories present
    # (here just craft), so a tier that slices a dimension out never names it in the story.
    assert render_story(SCENARIO, 2, seed=7, cats=CATS) == (
        "two friends run stalls, watched by Sam. "
        "Each friend has a different craft. "
        "Using the clues, match every friend to their craft."
    )


def test_render_story_match_line_lists_present_categories() -> None:
    # With two non-anchor categories present the match-line lists both (Oxford-free 'a and b'),
    # and never names the anchor (the subject the player is matching FROM).
    cats = CATS + [_Cat("price", ["p5"], ["$5"], phrases=["charged 5"], label="Price")]
    story = render_story(SCENARIO, 2, seed=7, cats=cats)
    assert "match every friend to their craft and price." in story
    assert "Friend" not in story.split("watched by Sam.")[1]  # anchor label never in the tail


def test_render_clue_name_mode_uses_labels() -> None:
    clue = ("eq", (("name", "ana"), ("craft", "pottery")), ())
    assert render_clue(SCENARIO, "standard", CATS, clue, seed=7, index=0) == "Ana likes Pottery."


def test_render_clue_attribute_mode_uses_refphrase() -> None:
    # In attribute mode a refPhrase-bearing value reads as "the <refPhrase>".
    clue = ("neq", (("name", "ana"), ("craft", "pottery")), ())
    assert render_clue(SCENARIO, "sharp", CATS, clue, seed=7, index=0) == "Ana is not the potter."


def test_render_clue_fills_numeric_params() -> None:
    clue = ("numDiff", (("name", "ana"), ("name", "ben")),
            (("delta", 5), ("numericCat", "price"), ("dir", "greater")))
    out = render_clue(SCENARIO, "standard", CATS, clue, seed=7, index=0)
    assert out == "Ana charged 5 more than Ben."
    assert out.isascii() and "{" not in out and "}" not in out
