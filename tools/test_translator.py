"""Translator unit tests: each clue template renders to exact ASCII, including the
`ends` side branch and the 3-operand `between`. Pure filter - no solver, no mocks."""

from dataclasses import dataclass

import pytest

from translator import clue_text


@dataclass(frozen=True)
class _Cat:
    """Minimal stand-in exposing only the attributes clue_text/_label read."""

    id: str
    value_ids: list[str]
    labels: list[str]


CATS = [
    _Cat("drink", ["tea", "cola"], ["Tea", "Cola"]),
    _Cat("pet", ["cat", "dog", "fish"], ["Cat", "Dog", "Fish"]),
]


@pytest.mark.parametrize(
    "clue, expected",
    [
        (("eq", (("drink", "tea"), ("pet", "cat")), ()), "Tea sits with the Cat."),
        (("neq", (("drink", "tea"), ("pet", "dog")), ()), "Tea is not with the Dog."),
        (("adjacent", (("pet", "cat"), ("pet", "dog")), ()), "Cat is next to Dog."),
        (("distance", (("pet", "cat"), ("pet", "fish")), (("k", 2),)), "Cat and Fish are 2 apart."),
        (("before", (("pet", "cat"), ("pet", "dog")), ()), "Cat is before Dog."),
        (("opposite", (("pet", "cat"), ("pet", "fish")), ()), "Cat sits across from Fish."),
        (("between", (("pet", "cat"), ("pet", "dog"), ("pet", "fish")), ()), "Cat sits between Dog and Fish."),
    ],
)
def test_clue_text_renders(clue: tuple, expected: str) -> None:
    assert clue_text(CATS, 3, clue) == expected


@pytest.mark.parametrize("pos, expected", [(0, "Tea is far left."), (5, "Tea is far right.")])
def test_ends_side_branch(pos: int, expected: str) -> None:
    clue = ("ends", (("drink", "tea"),), (("pos", pos),))
    assert clue_text(CATS, 3, clue) == expected
