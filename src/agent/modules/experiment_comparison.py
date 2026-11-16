from __future__ import annotations

import math
from typing import Literal, TypedDict

Measurement = Literal["soot", "temperature", "gravity"]
Direction = Literal["increase", "decrease", "no_change"]


class ComparisonResult(TypedDict):
    measurement: Measurement
    unit: str
    baseline_value: float
    comparison_value: float
    difference: float
    absolute_difference: float
    direction: Direction
    percent_change: float | None
    percent_change_note: str | None


def _is_kelvin(unit: str) -> bool:
    return unit.strip().casefold() in {"k", "kelvin", "kelvins"}


def compare_measurements(
    *,
    measurement: Measurement,
    value_a: float,
    value_b: float,
    unit_a: str,
    unit_b: str,
) -> ComparisonResult:
    if not math.isfinite(value_a) or not math.isfinite(value_b):
        raise ValueError("Both measurement values must be finite numbers.")

    normalized_unit_a = unit_a.strip()
    normalized_unit_b = unit_b.strip()
    if not normalized_unit_a or not normalized_unit_b:
        raise ValueError("Both measurements must have a reported unit.")
    if normalized_unit_a.casefold() != normalized_unit_b.casefold():
        raise ValueError("The measurements must use the same unit; no conversion is performed.")

    if measurement in {"soot", "gravity"} and (value_a < 0 or value_b < 0):
        raise ValueError(f"{measurement.capitalize()} values cannot be negative.")
    if measurement == "temperature" and _is_kelvin(normalized_unit_a):
        if value_a < 0 or value_b < 0:
            raise ValueError("Kelvin temperatures cannot be below absolute zero.")

    difference = value_b - value_a
    if difference > 0:
        direction: Direction = "increase"
    elif difference < 0:
        direction = "decrease"
    else:
        direction = "no_change"

    percent_change: float | None = None
    percent_change_note: str | None = None
    if measurement == "temperature" and not _is_kelvin(normalized_unit_a):
        percent_change_note = (
            "Percent change is omitted for non-Kelvin temperature scales; "
            "use the absolute difference instead."
        )
    elif value_a == 0:
        percent_change_note = "Percent change is undefined because the baseline value is zero."
    else:
        percent_change = (difference / value_a) * 100

    return {
        "measurement": measurement,
        "unit": normalized_unit_a,
        "baseline_value": value_a,
        "comparison_value": value_b,
        "difference": difference,
        "absolute_difference": abs(difference),
        "direction": direction,
        "percent_change": percent_change,
        "percent_change_note": percent_change_note,
    }
