from __future__ import annotations

from typing import TypedDict


class EnvironmentEvidenceSource(TypedDict):
    title: str
    source_type: str
    source_url: str
    relevance: str
    evidence: str


class EnvironmentEvidence(TypedDict):
    environment: str
    label: str
    setting: str
    gravity: str
    conditions: str
    sources: list[EnvironmentEvidenceSource]


ENVIRONMENT_EVIDENCE: dict[str, EnvironmentEvidence] = {
    "earth": {
        "label": "Earth",
        "setting": "Open-air surface baseline",
        "gravity": "1 g",
        "conditions": "Oxygen-containing atmosphere at ordinary surface pressure.",
        "sources": [
            {
                "title": "NASA Combustion Science",
                "source_type": "NASA context",
                "source_url": (
                    "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/"
                    "physical-sciences-program/combustion-science/"
                ),
                "relevance": (
                    "NASA describes how gravity-driven buoyancy lifts and tilts "
                    "flames in normal-gravity conditions."
                ),
                "evidence": (
                    "NASA explains that hot flame gases are less dense than ambient "
                    "gas. At normal gravity, the resulting buoyant flow lifts and "
                    "points flames upward, and its instabilities cause flame flicker. "
                    "NASA also notes that buoyancy can dominate and obscure other "
                    "combustion processes in ground experiments."
                ),
            },
            {
                "title": "Solid Fuel Ignition and Extinction (SoFIE)",
                "source_type": "NASA context",
                "source_url": (
                    "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/"
                    "physical-sciences-program/combustion-science/"
                    "solid-fuel-ignition-and-extinction-sofie/"
                ),
                "relevance": (
                    "NASA describes spacecraft material-flammability evaluation "
                    "and cautions that one-gravity tests may not fully represent "
                    "reduced-gravity behavior."
                ),
                "evidence": (
                    "NASA describes a 1-g flame-propagation test for proposed "
                    "spaceflight materials and notes that some researchers believe "
                    "it may not be conservative for low-gravity conditions."
                ),
            },
        ],
    },
    "iss": {
        "label": "Pressurized habitat (ISS)",
        "setting": "Pressurized, ventilated crew cabin",
        "gravity": "Microgravity (~0 g)",
        "conditions": (
            "The card describes the inhabited cabin, not the vacuum outside the station."
        ),
        "sources": [
            {
                "title": "A Researcher's Guide to: Combustion Science",
                "source_type": "NASA context",
                "source_url": (
                    "https://www.nasa.gov/missions/station/"
                    "a-researchers-guide-to-combustion-science/"
                ),
                "relevance": (
                    "NASA explains why reduced-gravity combustion research matters "
                    "for spacecraft fire safety."
                ),
                "evidence": (
                    "NASA says buoyancy can be suppressed in the absence of gravity "
                    "and identifies fire safety as an important operational element "
                    "for spacecraft and future human habitats."
                ),
            },
            {
                "title": "NASA Combustion Science",
                "source_type": "NASA context",
                "source_url": (
                    "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/"
                    "physical-sciences-program/combustion-science/"
                ),
                "relevance": (
                    "NASA identifies the Space Station as a test bed for spacecraft "
                    "fire risk and combustion research."
                ),
                "evidence": (
                    "NASA describes the International Space Station environment as "
                    "an important test bed for spacecraft fire risk, including "
                    "research on material flammability and fire suppression."
                ),
            },
            {
                "title": "25 Years Ago: Fire Aboard Space Station Mir",
                "source_type": "NASA incident history",
                "source_url": (
                    "https://www.nasa.gov/history/"
                    "25-years-ago-fire-aboard-space-station-mir/"
                ),
                "relevance": (
                    "NASA documents how a fire and smoke affected a confined crewed "
                    "space-station environment."
                ),
                "evidence": (
                    "NASA recounts a fire aboard Mir that produced dense smoke, "
                    "affected access to an escape vehicle, and took hours for the "
                    "station life-support system to clear. NASA says lessons from "
                    "the incident informed later station design and operations."
                ),
            },
        ],
    },
    "moon": {
        "label": "Moon",
        "setting": "Lunar surface or a future habitat",
        "gravity": "About 1/6 g",
        "conditions": (
            "The lunar exterior has an extremely thin exosphere; a crew habitat is "
            "a sealed interior with different conditions."
        ),
        "sources": [
            {
                "title": "Moon Facts",
                "source_type": "NASA context",
                "source_url": "https://science.nasa.gov/moon/facts/",
                "relevance": (
                    "NASA describes the Moon's weak atmosphere and reduced surface "
                    "gravity."
                ),
                "evidence": (
                    "NASA describes the Moon's atmosphere as very thin and weak, "
                    "and states that surface gravity is one-sixth of Earth's."
                ),
            },
            {
                "title": "Flammability of Materials on the Moon (FM2)",
                "source_type": "NASA combustion experiment",
                "source_url": (
                    "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/"
                    "physical-sciences-program/combustion-science/"
                    "flammability-of-materials-on-the-moon-fm2/"
                ),
                "relevance": (
                    "NASA's FM2 research investigates material burning at lunar "
                    "gravity in an atmosphere relevant to future habitats."
                ),
                "evidence": (
                    "NASA says FM2 investigates burning materials at lunar gravity. "
                    "The experiment burns samples in a sealed chamber using "
                    "atmospheric conditions planned for future lunar habitats or "
                    "vehicles. NASA reports that earlier modeling and tests suggest "
                    "some materials may burn at lower oxygen concentrations in "
                    "lunar gravity than on Earth; FM2 is intended to investigate "
                    "that possibility."
                ),
            },
            {
                "title": "A Researcher's Guide to: Combustion Science",
                "source_type": "NASA context",
                "source_url": (
                    "https://www.nasa.gov/missions/station/"
                    "a-researchers-guide-to-combustion-science/"
                ),
                "relevance": (
                    "NASA explains why fire-safety knowledge must be adapted for "
                    "reduced-gravity exploration."
                ),
                "evidence": (
                    "NASA identifies fire safety as important for future human "
                    "exploration and says reduced-gravity combustion research helps "
                    "adapt fire-safety concepts and systems to space conditions."
                ),
            },
        ],
    },
    "mars": {
        "label": "Mars",
        "setting": "Martian surface or a future habitat",
        "gravity": "About 0.38 g",
        "conditions": (
            "The exterior has a very thin, mostly carbon-dioxide atmosphere; a "
            "pressurized habitat would be different."
        ),
        "sources": [
            {
                "title": "Mars Facts",
                "source_type": "NASA context",
                "source_url": "https://science.nasa.gov/mars/facts/",
                "relevance": (
                    "NASA describes Mars's very thin atmosphere; the source does "
                    "not evaluate fire behavior in a Mars habitat."
                ),
                "evidence": (
                    "NASA describes Mars as having a very thin atmosphere. The "
                    "retrieved page does not provide a Mars-habitat fire test."
                ),
            },
            {
                "title": "Mars Fact Sheet",
                "source_type": "NASA Goddard fact sheet",
                "source_url": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
                "relevance": (
                    "NASA Goddard provides Mars's surface gravity and atmospheric "
                    "pressure and composition."
                ),
                "evidence": (
                    "NASA Goddard's fact sheet lists Mars surface gravity as about "
                    "0.38 of Earth's. It gives a mean surface pressure of about "
                    "6.36 millibars and atmospheric composition of about 95.1% "
                    "carbon dioxide and 0.16% oxygen by volume."
                ),
            },
            {
                "title": "A Researcher's Guide to: Combustion Science",
                "source_type": "NASA context",
                "source_url": (
                    "https://www.nasa.gov/missions/station/"
                    "a-researchers-guide-to-combustion-science/"
                ),
                "relevance": (
                    "NASA identifies fire safety as an important concern for future "
                    "human habitats and reduced-gravity missions."
                ),
                "evidence": (
                    "NASA says fire safety is an important operational element for "
                    "future exploration missions and that reduced-gravity research "
                    "is needed to adapt fire-safety concepts and systems."
                ),
            },
            {
                "title": "Solid Fuel Ignition and Extinction (SoFIE)",
                "source_type": "NASA context",
                "source_url": (
                    "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/"
                    "physical-sciences-program/combustion-science/"
                    "solid-fuel-ignition-and-extinction-sofie/"
                ),
                "relevance": (
                    "NASA studies how material flammability changes in low gravity; "
                    "this is not a Mars-specific habitat test."
                ),
                "evidence": (
                    "NASA describes microgravity material-flammability research "
                    "and notes that one-gravity tests may not fully represent "
                    "reduced-gravity behavior. The page does not report a Mars "
                    "surface or Mars-habitat fire test."
                ),
            },
        ],
    },
}

ENVIRONMENT_POINT_CATEGORIES = (
    "Atmosphere and fire potential",
    "Flame, heat, and smoke behavior",
    "Fire-safety implications and evidence limits",
)


def get_environment_evidence(environment: str) -> EnvironmentEvidence:
    evidence = ENVIRONMENT_EVIDENCE.get(environment)
    if evidence is None:
        raise ValueError("Unsupported environment.")
    return {
        "environment": environment,
        "label": evidence["label"],
        "setting": evidence["setting"],
        "gravity": evidence["gravity"],
        "conditions": evidence["conditions"],
        "sources": evidence["sources"],
    }
