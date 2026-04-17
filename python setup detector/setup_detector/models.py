from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class SwingPoint:
    index: int
    price: float
    type: Literal["HIGH", "LOW"]
    atr: float = 0.0
    prominence: float = 0.0


@dataclass
class EntrySignal:
    index: int
    date: object
    price: float
    type: str
    stop: float
    target: float
    rr: float
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Level:
    price: float
    type: Literal["RESISTANCE", "SUPPORT"]
    touches: int
    indices: list[int] = field(default_factory=list)
