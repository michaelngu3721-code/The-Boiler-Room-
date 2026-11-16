from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from openai import APIError
from pydantic import BaseModel, ConfigDict, Field

from .analysis_agent import (
    explain_comparison,
    explain_environment as generate_environment_explanation,
    explain_factor as generate_factor_explanation,
    explain_investigation,
    explain_research_gaps as generate_research_gaps,
)
from .environment_comparison import get_environment_evidence
from .modules.experiment_comparison import ComparisonResult, compare_measurements
from .psi_investigations import (
    PSIInvestigationNotFound,
    PSIServiceError,
    get_combustion_factor_chart,
    get_combustion_investigations,
    get_factor_evidence,
    get_investigation,
    get_research_gap_evidence,
)

LOGGER = logging.getLogger(__name__)
app = FastAPI(title="Combustion Lab API")


class ComparisonRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    measurement: Literal["soot", "temperature", "gravity"]
    value_a: float = Field(allow_inf_nan=False)
    value_b: float = Field(allow_inf_nan=False)
    unit_a: str = Field(min_length=1, max_length=64)
    unit_b: str = Field(min_length=1, max_length=64)


class ComparisonResponse(BaseModel):
    measurement: Literal["soot", "temperature", "gravity"]
    unit: str
    baseline_value: float
    comparison_value: float
    difference: float
    absolute_difference: float
    direction: Literal["increase", "decrease", "no_change"]
    percent_change: float | None
    percent_change_note: str | None


class ExplainRequest(ComparisonRequest):
    study_a: str = Field(min_length=1, max_length=300)
    study_b: str = Field(min_length=1, max_length=300)
    outcome_a: str = Field(max_length=2000)
    outcome_b: str = Field(max_length=2000)


class ExplainResponse(BaseModel):
    explanation: str


class InvestigationSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    accession: str
    title: str
    acronym: str | None
    research_area: str | None
    subresearch_area: str | None
    project_type: str | None
    flight_platform: str | None
    start_date: str | None
    end_date: str | None
    keywords: str | None
    detail_url: str
    image_url: str | None


class InvestigationDetail(InvestigationSummary):
    objective: str | None
    approach: str | None
    hypothesis: str | None
    description: str | None
    research_impact: str | None
    publications: list[str]


class InvestigationExplanationResponse(BaseModel):
    summary: str
    goal: str
    approach: str
    hypothesis: str


class FactorChartItem(BaseModel):
    factor: str
    study_count: int = Field(ge=1)
    source_urls: list[str]


class FactorChartResponse(BaseModel):
    sample_size: int = Field(ge=0)
    factors: list[FactorChartItem]


FactorName = Literal[
    "Airflow speed/direction",
    "Fuel/material",
    "Oxygen concentration",
    "Gravity/buoyancy",
    "Fuel geometry/thickness",
    "Temperature/preheating",
    "Ignition/extinction",
    "Soot/smoke/aerosols",
    "Pressure",
]


class FactorExplanationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    factor: FactorName


class FactorExplanationPoint(BaseModel):
    study_title: str
    source_url: str
    evidence_point: str
    combustion_relevance: str
    fire_safety_impact: str
    suppression_tactics: str


class FactorExplanationResponse(BaseModel):
    factor: FactorName
    points: list[FactorExplanationPoint] = Field(min_length=3, max_length=3)


EnvironmentId = Literal["earth", "iss", "moon", "mars"]
EnvironmentCategory = Literal[
    "Atmosphere and fire potential",
    "Flame, heat, and smoke behavior",
    "Fire-safety implications and evidence limits",
]
EvidenceStatus = Literal[
    "Directly stated by NASA",
    "NASA background context",
    "Cautious habitat extrapolation",
    "Not addressed by NASA sources",
]


class EnvironmentExplanationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    environment: EnvironmentId


class EnvironmentExplanationPoint(BaseModel):
    category: EnvironmentCategory
    fire_safety_effect: str
    evidence_status: EvidenceStatus
    source_urls: list[str]


class EnvironmentSource(BaseModel):
    title: str
    source_type: str
    source_url: str
    relevance: str


class EnvironmentExplanationResponse(BaseModel):
    environment: EnvironmentId
    label: str
    summary: str
    points: list[EnvironmentExplanationPoint] = Field(min_length=3, max_length=3)
    sources: list[EnvironmentSource]


ResearchGapEvidenceStatus = Literal[
    "Coverage observation in this PSI sample",
    "Explicit limitation stated by a PSI record",
]


class ResearchGapItem(BaseModel):
    gap: str = Field(min_length=1)
    why_it_matters: str = Field(min_length=1)
    evidence_basis: str = Field(min_length=1)
    research_question: str = Field(min_length=1)
    evidence_status: ResearchGapEvidenceStatus
    source_urls: list[str] = Field(min_length=1)


class ResearchGapSource(BaseModel):
    title: str
    accession: str
    source_url: str


class ResearchGapsResponse(BaseModel):
    sample_size: int = Field(ge=0)
    analyzed_study_count: int = Field(ge=0)
    gaps: list[ResearchGapItem] = Field(min_length=3, max_length=3)
    sources: list[ResearchGapSource]


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/factor-chart", response_model=FactorChartResponse)
def factor_chart() -> dict:
    try:
        return get_combustion_factor_chart()
    except PSIServiceError as error:
        LOGGER.warning("Could not calculate the NASA PSI factor chart: %s", error)
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.post(
    "/api/factor-chart/explain",
    response_model=FactorExplanationResponse,
)
def explain_factor_chart(
    request: FactorExplanationRequest,
) -> FactorExplanationResponse:
    try:
        studies = get_factor_evidence(request.factor)
        explanation = generate_factor_explanation(request.factor, studies)
        studies_by_url = {study["source_url"]: study for study in studies}
        explanation_points = explanation.get("points")
        if not isinstance(explanation_points, list) or len(explanation_points) != 3:
            raise RuntimeError("The agent returned an invalid number of factor points.")

        cited_sources = set()
        for point in explanation_points:
            source_url = point.get("source_url") if isinstance(point, dict) else None
            if (
                not isinstance(source_url, str)
                or source_url not in studies_by_url
                or source_url in cited_sources
            ):
                raise RuntimeError("The agent returned a citation outside the retrieved PSI sources.")
            cited_sources.add(source_url)

        points = [
            FactorExplanationPoint(
                study_title=studies_by_url[point["source_url"]]["title"],
                source_url=point["source_url"],
                evidence_point=point["evidence_point"],
                combustion_relevance=point["combustion_relevance"],
                fire_safety_impact=point["fire_safety_impact"],
                suppression_tactics=point["suppression_tactics"],
            )
            for point in explanation_points
        ]
        return FactorExplanationResponse(factor=request.factor, points=points)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except PSIServiceError as error:
        LOGGER.warning(
            "Could not retrieve NASA PSI evidence for factor %s: %s",
            request.factor,
            error,
        )
        raise HTTPException(status_code=502, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        LOGGER.exception("Agent factor explanation failed.")
        raise HTTPException(
            status_code=502,
            detail="The AI explanation service is unavailable.",
        ) from error


@app.post(
    "/api/environment-comparison/explain",
    response_model=EnvironmentExplanationResponse,
)
def explain_environment_comparison(
    request: EnvironmentExplanationRequest,
) -> EnvironmentExplanationResponse:
    try:
        context = get_environment_evidence(request.environment)
        explanation = generate_environment_explanation(request.environment, context)
        raw_sources = context["sources"]
        allowed_sources = {
            source["source_url"]: source for source in raw_sources
        }
        points = explanation["points"]
        if any(
            source_url not in allowed_sources
            for point in points
            for source_url in point["source_urls"]
        ):
            raise RuntimeError("The agent cited a source outside the supplied NASA evidence.")

        return EnvironmentExplanationResponse(
            environment=request.environment,
            label=context["label"],
            summary=explanation["summary"],
            points=[
                EnvironmentExplanationPoint(**point)
                for point in points
            ],
            sources=[
                EnvironmentSource(
                    title=source["title"],
                    source_type=source["source_type"],
                    source_url=source["source_url"],
                    relevance=source["relevance"],
                )
                for source in raw_sources
            ],
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        LOGGER.exception("Agent environment explanation failed.")
        raise HTTPException(
            status_code=502,
            detail="The AI explanation service is unavailable.",
        ) from error


@app.post("/api/research-gaps/analyze", response_model=ResearchGapsResponse)
def analyze_research_gaps() -> ResearchGapsResponse:
    try:
        evidence = get_research_gap_evidence()
        if not evidence["studies"]:
            raise PSIServiceError("NASA PSI returned no combustion studies to analyze.")
        analysis = generate_research_gaps(evidence["studies"])
        studies_by_url = {
            study["source_url"]: study for study in evidence["studies"]
        }
        cited_urls = {
            source_url
            for gap in analysis["gaps"]
            for source_url in gap["source_urls"]
        }
        if not cited_urls.issubset(studies_by_url):
            raise RuntimeError("The agent cited a source outside the analyzed PSI sample.")

        return ResearchGapsResponse(
            sample_size=evidence["sample_size"],
            analyzed_study_count=evidence["analyzed_study_count"],
            gaps=[ResearchGapItem(**gap) for gap in analysis["gaps"]],
            sources=[
                ResearchGapSource(
                    title=study["title"],
                    accession=study["accession"],
                    source_url=study["source_url"],
                )
                for study in evidence["studies"]
                if study["source_url"] in cited_urls
            ],
        )
    except PSIServiceError as error:
        LOGGER.warning("Could not retrieve NASA PSI research-gap evidence: %s", error)
        raise HTTPException(status_code=502, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        LOGGER.exception("Agent research-gap analysis failed.")
        raise HTTPException(
            status_code=502,
            detail="The AI research-gap service is unavailable.",
        ) from error


@app.get("/api/investigations", response_model=list[InvestigationSummary])
def list_investigations() -> list[dict]:
    try:
        return get_combustion_investigations()
    except PSIServiceError as error:
        LOGGER.warning("Could not retrieve NASA PSI investigations: %s", error)
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.get("/api/investigations/{accession}", response_model=InvestigationDetail)
def investigation_detail(accession: str) -> dict:
    try:
        return get_investigation(accession)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except PSIInvestigationNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except PSIServiceError as error:
        LOGGER.warning("Could not retrieve NASA PSI investigation %s: %s", accession, error)
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.post(
    "/api/investigations/{accession}/explain",
    response_model=InvestigationExplanationResponse,
)
def explain_investigation_detail(accession: str) -> InvestigationExplanationResponse:
    try:
        record = get_investigation(accession)
        explanation = explain_investigation(record)
        return InvestigationExplanationResponse(**explanation)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except PSIInvestigationNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except PSIServiceError as error:
        LOGGER.warning("Could not retrieve NASA PSI investigation %s: %s", accession, error)
        raise HTTPException(status_code=502, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        LOGGER.exception("Agent investigation explanation failed.")
        raise HTTPException(
            status_code=502,
            detail="The AI explanation service is unavailable.",
        ) from error


@app.post("/api/compare", response_model=ComparisonResponse)
def compare(request: ComparisonRequest) -> ComparisonResult:
    try:
        return compare_measurements(
            measurement=request.measurement,
            value_a=request.value_a,
            value_b=request.value_b,
            unit_a=request.unit_a,
            unit_b=request.unit_b,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/api/explain", response_model=ExplainResponse)
def explain(request: ExplainRequest) -> ExplainResponse:
    try:
        result = compare_measurements(
            measurement=request.measurement,
            value_a=request.value_a,
            value_b=request.value_b,
            unit_a=request.unit_a,
            unit_b=request.unit_b,
        )
        return ExplainResponse(
            explanation=explain_comparison(
                result,
                request.study_a,
                request.study_b,
                request.outcome_a,
                request.outcome_b,
            )
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        LOGGER.exception("Agent comparison explanation failed.")
        raise HTTPException(
            status_code=502,
            detail="The AI explanation service is unavailable.",
        ) from error


WEB_DIST = Path(__file__).resolve().parents[2] / "web" / "dist"
if (WEB_DIST / "index.html").is_file():
    app.mount(
        "/",
        StaticFiles(directory=WEB_DIST, html=True),
        name="frontend",
    )
