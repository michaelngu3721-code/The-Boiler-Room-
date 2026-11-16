from __future__ import annotations

import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

PSI_ORIGIN = "https://psi.nasa.gov"
PSI_SEARCH_URL = f"{PSI_ORIGIN}/geode-py/ws/repo/search"
PSI_INVESTIGATION_URL = f"{PSI_ORIGIN}/geode-py/ws/repo/investigations"
PSI_REPOSITORY_URL = f"{PSI_ORIGIN}/physci/repo/data/investigations"
ACCESSION_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
PAGE_SIZE = 100
MAX_SEARCH_RESULTS = 10_000
MAX_FACTOR_CHART_ITEMS = 10
FACTOR_EVIDENCE_STUDY_COUNT = 3
MAX_FACTOR_EVIDENCE_FIELD_CHARS = 1_000
MAX_RESEARCH_GAP_STUDIES = 40
MAX_RESEARCH_GAP_FIELD_CHARS = 500
SUPPRESSION_CONTEXT_PATTERN = re.compile(
    r"\b(?:suppress|suppression|extinguish|extinguishing|inert|nitrogen|quench)\b",
    re.IGNORECASE,
)
FACTOR_PATTERNS = (
    (
        "Airflow speed/direction",
        re.compile(
            r"\b(?:air ?flow|forced flow|flow speed|flow velocity|flow direction|"
            r"concurrent flow|opposed flow|co-?flow|air speed)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Fuel/material",
        re.compile(r"\b(?:fuel|fuels|material|materials|fabric|polymer)\b", re.IGNORECASE),
    ),
    (
        "Oxygen concentration",
        re.compile(r"\b(?:oxygen|o2|oxidizer)\b", re.IGNORECASE),
    ),
    (
        "Gravity/buoyancy",
        re.compile(r"\b(?:gravity|microgravity|buoyancy)\b", re.IGNORECASE),
    ),
    (
        "Fuel geometry/thickness",
        re.compile(
            r"\b(?:geometry|geometries|thickness|thick|sheet|slab|cylinder|sphere|rod)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Temperature/preheating",
        re.compile(r"\b(?:temperature|preheat|pre-heating|preheating)\b", re.IGNORECASE),
    ),
    (
        "Ignition/extinction",
        re.compile(r"\b(?:ignition|igniter|extinction|quenching)\b", re.IGNORECASE),
    ),
    (
        "Soot/smoke/aerosols",
        re.compile(r"\b(?:soot|smoke|aerosol)\b", re.IGNORECASE),
    ),
    ("Pressure", re.compile(r"\bpressure\b", re.IGNORECASE)),
)


class PSIServiceError(RuntimeError):
    pass


class PSIInvestigationNotFound(LookupError):
    pass


def _read_json(url: str, *, investigation_lookup: bool = False) -> dict:
    request = Request(url, headers={"Accept": "application/json"})
    try:
        with urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        if investigation_lookup and error.code == 404:
            raise PSIInvestigationNotFound("NASA PSI could not find this investigation.") from error
        raise PSIServiceError(f"NASA PSI returned HTTP {error.code}.") from error
    except (URLError, TimeoutError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PSIServiceError("Could not read investigation data from NASA PSI.") from error

    if not isinstance(data, dict):
        raise PSIServiceError("NASA PSI returned an unexpected response.")
    return data


def _optional_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _required_text(data: dict, key: str) -> str:
    value = _optional_text(data.get(key))
    if value is None:
        raise PSIServiceError(f"NASA PSI returned an investigation without {key}.")
    return value


def _normalize_search_result(source: dict, *, include_factor_text: bool = False) -> dict:
    accession = _required_text(source, "Accession")
    if not ACCESSION_PATTERN.fullmatch(accession):
        raise PSIServiceError("NASA PSI returned an invalid investigation identifier.")

    thumbnail = _optional_text(source.get("Thumbnail"))
    image_url = None
    if (
        thumbnail
        and thumbnail.startswith("/geode-py/ws/investigations/")
        and thumbnail.endswith("/image")
    ):
        image_url = f"{PSI_ORIGIN}{thumbnail}"

    investigation = {
        "accession": accession,
        "title": _required_text(source, "Title"),
        "acronym": _optional_text(source.get("Acronym")),
        "research_area": _optional_text(source.get("Research Area")),
        "subresearch_area": _optional_text(source.get("SubResearch Area")),
        "project_type": _optional_text(source.get("Project Type")),
        "flight_platform": _optional_text(source.get("Flight Platform")),
        "start_date": _optional_text(source.get("Investigation Start Date")),
        "end_date": _optional_text(source.get("Investigation End Date")),
        "keywords": _optional_text(source.get("Keywords")),
        "detail_url": f"{PSI_REPOSITORY_URL}/{quote(accession, safe='')}",
        "image_url": image_url,
    }
    if include_factor_text:
        factor_evidence = {
            "keywords": _optional_text(source.get("Keywords")),
            "objective": _optional_text(source.get("Objectives"))
            or _optional_text(source.get("Objective")),
            "approach": _optional_text(source.get("Approach")),
            "hypothesis": _optional_text(source.get("Hypothesis")),
            "description": _optional_text(source.get("Description")),
            "research_impact": _optional_text(source.get("Research Impacts/Earth Benefits"))
            or _optional_text(source.get("Research Impacts")),
        }
        investigation["factor_evidence"] = factor_evidence
        investigation["factor_search_text"] = "\n".join(
            text for text in (investigation["title"], *factor_evidence.values()) if text
        )
    return investigation


def get_combustion_investigations(*, include_factor_text: bool = False) -> list[dict]:
    investigations = []
    offset = 0
    total = None

    while total is None or offset < total:
        query = urlencode(
            {
                "term": "combustion",
                "type": "investigation",
                "from": offset,
                "size": PAGE_SIZE,
            }
        )
        response = _read_json(f"{PSI_SEARCH_URL}?{query}")
        hits = response.get("hits")
        if not isinstance(hits, dict) or not isinstance(hits.get("hits"), list):
            raise PSIServiceError("NASA PSI returned an unexpected investigation list.")

        total_value = hits.get("total")
        if isinstance(total_value, dict):
            total_value = total_value.get("value")
        if not isinstance(total_value, int) or total_value < 0:
            raise PSIServiceError("NASA PSI returned an invalid investigation count.")
        if total_value > MAX_SEARCH_RESULTS:
            raise PSIServiceError("NASA PSI returned more investigations than can be loaded.")
        total = total_value

        page = hits["hits"]
        if not page and offset < total:
            raise PSIServiceError("NASA PSI returned an incomplete investigation list.")

        for result in page:
            if not isinstance(result, dict) or not isinstance(result.get("_source"), dict):
                raise PSIServiceError("NASA PSI returned an invalid investigation record.")
            investigations.append(
                _normalize_search_result(
                    result["_source"],
                    include_factor_text=include_factor_text,
                )
            )
        offset += len(page)

    return sorted(investigations, key=lambda item: item["title"].casefold())


def get_combustion_factor_chart() -> dict:
    investigations = get_combustion_investigations(include_factor_text=True)
    factor_counts = {
        factor: {"factor": factor, "study_count": 0, "source_urls": []}
        for factor, _ in FACTOR_PATTERNS
    }

    for investigation in investigations:
        research_text = investigation.get("factor_search_text")
        if not isinstance(research_text, str):
            continue

        for factor, pattern in FACTOR_PATTERNS:
            if not pattern.search(research_text):
                continue
            factor_counts[factor]["study_count"] += 1
            factor_counts[factor]["source_urls"].append(investigation["detail_url"])

    ranked_factors = sorted(
        (item for item in factor_counts.values() if item["study_count"]),
        key=lambda item: (-item["study_count"], item["factor"].casefold()),
    )
    return {
        "sample_size": len(investigations),
        "factors": ranked_factors[:MAX_FACTOR_CHART_ITEMS],
    }


def _factor_excerpt(text: str, pattern: re.Pattern[str]) -> str:
    if len(text) <= MAX_FACTOR_EVIDENCE_FIELD_CHARS:
        return text

    match = pattern.search(text)
    start = max(0, match.start() - MAX_FACTOR_EVIDENCE_FIELD_CHARS // 3) if match else 0
    start = min(start, len(text) - MAX_FACTOR_EVIDENCE_FIELD_CHARS)
    end = start + MAX_FACTOR_EVIDENCE_FIELD_CHARS
    return f"{'...' if start else ''}{text[start:end].strip()}{'...' if end < len(text) else ''}"


def get_factor_evidence(factor: str) -> list[dict]:
    factor_pattern = next(
        (pattern for label, pattern in FACTOR_PATTERNS if label == factor),
        None,
    )
    if factor_pattern is None:
        raise ValueError("Unsupported combustion factor.")

    investigations = get_combustion_investigations(include_factor_text=True)
    matching = []
    for investigation in investigations:
        factor_text = investigation.get("factor_search_text")
        evidence = investigation.get("factor_evidence")
        if (
            not isinstance(factor_text, str)
            or not isinstance(evidence, dict)
            or not factor_pattern.search(factor_text)
        ):
            continue

        text_fields = [value for value in evidence.values() if isinstance(value, str)]
        factor_mentions = sum(bool(factor_pattern.search(value)) for value in text_fields)
        suppression_context = any(
            SUPPRESSION_CONTEXT_PATTERN.search(value) for value in text_fields
        )
        matching.append(
            (
                -factor_mentions,
                -int(suppression_context),
                -len(text_fields),
                investigation["title"].casefold(),
                investigation,
            )
        )

    matching.sort(key=lambda result: result[:4])
    selected_records = []
    selected_urls = set()
    for *_, investigation in matching:
        source_url = investigation["detail_url"]
        if source_url in selected_urls:
            continue
        selected_urls.add(source_url)
        evidence = investigation["factor_evidence"]
        selected_records.append(
            {
                "accession": investigation["accession"],
                "title": investigation["title"],
                "source_url": source_url,
                "evidence": {
                    field: _factor_excerpt(value, factor_pattern)
                    for field, value in evidence.items()
                    if isinstance(value, str)
                },
            }
        )
        if len(selected_records) == FACTOR_EVIDENCE_STUDY_COUNT:
            break

    if len(selected_records) < FACTOR_EVIDENCE_STUDY_COUNT:
        raise PSIServiceError(
            f"NASA PSI has fewer than {FACTOR_EVIDENCE_STUDY_COUNT} distinct source records for {factor}."
        )
    return selected_records


def get_research_gap_evidence() -> dict:
    investigations = get_combustion_investigations(include_factor_text=True)
    sample_size = len(investigations)
    if sample_size > MAX_RESEARCH_GAP_STUDIES:
        investigations = [
            investigations[index * (sample_size - 1) // (MAX_RESEARCH_GAP_STUDIES - 1)]
            for index in range(MAX_RESEARCH_GAP_STUDIES)
        ]

    studies = []
    for investigation in investigations:
        evidence = investigation.get("factor_evidence")
        if not isinstance(evidence, dict):
            continue
        bounded_evidence = {
            field: (
                value
                if len(value) <= MAX_RESEARCH_GAP_FIELD_CHARS
                else f"{value[: MAX_RESEARCH_GAP_FIELD_CHARS - 3].rstrip()}..."
            )
            for field, value in evidence.items()
            if isinstance(value, str) and value.strip()
        }
        studies.append(
            {
                "accession": investigation["accession"],
                "title": investigation["title"],
                "source_url": investigation["detail_url"],
                "research_area": investigation["research_area"],
                "subresearch_area": investigation["subresearch_area"],
                "project_type": investigation["project_type"],
                "flight_platform": investigation["flight_platform"],
                "start_date": investigation["start_date"],
                "end_date": investigation["end_date"],
                "evidence": bounded_evidence,
            }
        )

    return {
        "sample_size": sample_size,
        "analyzed_study_count": len(studies),
        "studies": studies,
    }


def get_investigation(accession: str) -> dict:
    if not ACCESSION_PATTERN.fullmatch(accession):
        raise ValueError("Invalid NASA PSI investigation identifier.")

    url = f"{PSI_INVESTIGATION_URL}/{quote(accession, safe='')}"
    record = _read_json(url, investigation_lookup=True)
    if record.get("accession") != accession:
        raise PSIInvestigationNotFound("NASA PSI could not find this investigation.")

    publications = record.get("publications")
    publication_titles = []
    if isinstance(publications, list):
        publication_titles = [
            title
            for publication in publications
            if isinstance(publication, dict)
            if (title := _optional_text(publication.get("title"))) is not None
        ]

    images = record.get("images")
    image_url = (
        f"{PSI_ORIGIN}/geode-py/ws/investigations/{quote(accession, safe='')}/image"
        if isinstance(images, list) and images
        else None
    )

    return {
        "accession": accession,
        "title": _required_text(record, "title"),
        "acronym": _optional_text(record.get("investigationAcronym")),
        "research_area": _optional_text(record.get("researchArea")),
        "subresearch_area": _optional_text(record.get("subResearchArea")),
        "project_type": _optional_text(record.get("projectType")),
        "flight_platform": _optional_text(record.get("flightProgram")),
        "start_date": _optional_text(record.get("investigationStartDate")),
        "end_date": _optional_text(record.get("investigationEndDate")),
        "keywords": None,
        "detail_url": f"{PSI_REPOSITORY_URL}/{quote(accession, safe='')}",
        "image_url": image_url,
        "objective": _optional_text(record.get("objective")),
        "approach": _optional_text(record.get("approach")),
        "hypothesis": _optional_text(record.get("hypothesis")),
        "description": _optional_text(record.get("description")),
        "research_impact": _optional_text(record.get("researchImpacts")),
        "publications": publication_titles,
    }
