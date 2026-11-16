import unittest
from unittest.mock import patch

from fastapi import HTTPException

from agent.api import (
    FactorExplanationRequest,
    ExplainRequest,
    analyze_research_gaps,
    explain,
    explain_factor_chart,
    explain_investigation_detail,
    factor_chart,
    investigation_detail,
    list_investigations,
)


class ExplainEndpointTests(unittest.TestCase):
    def test_returns_research_gaps_with_only_the_cited_psi_records(self):
        studies = [
            {
                "accession": f"PSI-{index}",
                "title": f"Study {index}",
                "source_url": f"https://psi.nasa.gov/studies/PSI-{index}",
            }
            for index in range(1, 4)
        ]
        gaps = [
            {
                "gap": f"Potential opportunity {index}.",
                "why_it_matters": "The condition may affect flame behavior.",
                "evidence_basis": "The sample includes related investigation records.",
                "research_question": "How does the condition affect combustion?",
                "evidence_status": "Coverage observation in this PSI sample",
                "source_urls": [study["source_url"]],
            }
            for index, study in enumerate(studies, start=1)
        ]
        evidence = {
            "sample_size": 5,
            "analyzed_study_count": 3,
            "studies": studies,
        }

        with (
            patch("agent.api.get_research_gap_evidence", return_value=evidence),
            patch(
                "agent.api.generate_research_gaps",
                return_value={"gaps": gaps},
            ) as explain_agent,
        ):
            response = analyze_research_gaps()

        self.assertEqual(response.sample_size, 5)
        self.assertEqual(response.analyzed_study_count, 3)
        self.assertEqual(len(response.gaps), 3)
        self.assertEqual(
            [source.accession for source in response.sources],
            ["PSI-1", "PSI-2", "PSI-3"],
        )
        explain_agent.assert_called_once_with(studies)

    def test_rejects_research_gap_citation_outside_psi_sample(self):
        studies = [
            {
                "accession": f"PSI-{index}",
                "title": f"Study {index}",
                "source_url": f"https://psi.nasa.gov/studies/PSI-{index}",
            }
            for index in range(1, 4)
        ]
        gaps = [
            {
                "gap": f"Potential opportunity {index}.",
                "why_it_matters": "The condition may affect flame behavior.",
                "evidence_basis": "The sample includes related investigation records.",
                "research_question": "How does the condition affect combustion?",
                "evidence_status": "Coverage observation in this PSI sample",
                "source_urls": [
                    "https://example.com/unverified"
                    if index == 1
                    else study["source_url"]
                ],
            }
            for index, study in enumerate(studies, start=1)
        ]

        with (
            patch(
                "agent.api.get_research_gap_evidence",
                return_value={
                    "sample_size": 3,
                    "analyzed_study_count": 3,
                    "studies": studies,
                },
            ),
            patch(
                "agent.api.generate_research_gaps",
                return_value={"gaps": gaps},
            ),
        ):
            with self.assertRaises(HTTPException) as error:
                analyze_research_gaps()

        self.assertEqual(error.exception.status_code, 503)

    def test_builds_factor_explanation_with_titles_from_allowlisted_psi_sources(self):
        studies = [
            {
                "accession": f"PSI-{index}",
                "title": f"Oxygen study {index}",
                "source_url": f"https://psi.nasa.gov/studies/PSI-{index}",
                "evidence": {"objective": "Study oxygen and flame behavior."},
            }
            for index in range(1, 4)
        ]
        points = [
            {
                "source_url": study["source_url"],
                "evidence_point": f"Evidence from study {index}.",
                "combustion_relevance": "The source relates oxygen to combustion.",
                "fire_safety_impact": "The source does not discuss fire safety.",
                "suppression_tactics": "The source does not identify a suppression tactic.",
            }
            for index, study in enumerate(studies, start=1)
        ]
        request = FactorExplanationRequest(factor="Oxygen concentration")

        with (
            patch("agent.api.get_factor_evidence", return_value=studies) as get_evidence,
            patch(
                "agent.api.generate_factor_explanation",
                return_value={"points": points},
            ) as explain_agent,
        ):
            response = explain_factor_chart(request)

        self.assertEqual(response.factor, "Oxygen concentration")
        self.assertEqual([point.study_title for point in response.points], [
            "Oxygen study 1",
            "Oxygen study 2",
            "Oxygen study 3",
        ])
        self.assertEqual(len(response.points), 3)
        get_evidence.assert_called_once_with("Oxygen concentration")
        explain_agent.assert_called_once_with("Oxygen concentration", studies)

    def test_rejects_factor_explanation_citations_outside_retrieved_sources(self):
        studies = [
            {
                "accession": f"PSI-{index}",
                "title": f"Oxygen study {index}",
                "source_url": f"https://psi.nasa.gov/studies/PSI-{index}",
                "evidence": {},
            }
            for index in range(1, 4)
        ]
        points = [
            {
                "source_url": (
                    "https://example.com/unverified"
                    if index == 3
                    else study["source_url"]
                ),
                "evidence_point": "Evidence.",
                "combustion_relevance": "Relevance.",
                "fire_safety_impact": "Safety.",
                "suppression_tactics": "Suppression.",
            }
            for index, study in enumerate(studies, start=1)
        ]

        with (
            patch("agent.api.get_factor_evidence", return_value=studies),
            patch(
                "agent.api.generate_factor_explanation",
                return_value={"points": points},
            ),
        ):
            with self.assertRaises(HTTPException) as error:
                explain_factor_chart(FactorExplanationRequest(factor="Oxygen concentration"))

        self.assertEqual(error.exception.status_code, 503)

    @patch(
        "agent.api.get_combustion_factor_chart",
        return_value={
            "sample_size": 2,
            "factors": [
                {
                    "factor": "Fire Safety",
                    "study_count": 2,
                    "source_urls": [
                        "https://psi.nasa.gov/physci/repo/data/investigations/PSI-1",
                        "https://psi.nasa.gov/physci/repo/data/investigations/PSI-2",
                    ],
                }
            ],
        },
    )
    def test_returns_factor_counts_from_psi_keywords(self, get_factor_chart):
        response = factor_chart()

        self.assertEqual(response["sample_size"], 2)
        self.assertEqual(response["factors"][0]["study_count"], 2)
        get_factor_chart.assert_called_once_with()

    @patch("agent.api.explain_comparison", return_value="A brief explanation.")
    def test_computes_result_before_requesting_agent_explanation(self, explain_agent):
        request = ExplainRequest(
            measurement="soot",
            value_a=10,
            value_b=15,
            unit_a="mg",
            unit_b="mg",
            study_a="Study A",
            study_b="Study B",
            outcome_a="Reported outcome A",
            outcome_b="Reported outcome B",
        )

        response = explain(request)

        self.assertEqual(response.explanation, "A brief explanation.")
        computed_result, study_a, study_b, outcome_a, outcome_b = (
            explain_agent.call_args.args
        )
        self.assertEqual(computed_result["difference"], 5)
        self.assertEqual((study_a, study_b), ("Study A", "Study B"))
        self.assertEqual((outcome_a, outcome_b), ("Reported outcome A", "Reported outcome B"))

    @patch("agent.api.explain_comparison")
    def test_rejects_mismatched_units_before_calling_agent(self, explain_agent):
        request = ExplainRequest(
            measurement="soot",
            value_a=1,
            value_b=1000,
            unit_a="g",
            unit_b="mg",
            study_a="Study A",
            study_b="Study B",
            outcome_a="Reported outcome A",
            outcome_b="Reported outcome B",
        )

        with self.assertRaises(HTTPException) as error:
            explain(request)

        self.assertEqual(error.exception.status_code, 422)
        explain_agent.assert_not_called()

    @patch(
        "agent.api.get_combustion_investigations",
        return_value=[{"accession": "PSI-1", "title": "A study"}],
    )
    def test_lists_psi_investigations(self, get_investigations):
        response = list_investigations()

        self.assertEqual(response, [{"accession": "PSI-1", "title": "A study"}])
        get_investigations.assert_called_once_with()

    @patch(
        "agent.api.get_investigation",
        return_value={"accession": "PSI-1", "title": "A study"},
    )
    def test_loads_selected_investigation(self, get_investigation):
        response = investigation_detail("PSI-1")

        self.assertEqual(response["accession"], "PSI-1")
        get_investigation.assert_called_once_with("PSI-1")

    @patch(
        "agent.api.explain_investigation",
        return_value={
            "summary": "A short explanation.",
            "goal": "The goal.",
            "approach": "The method.",
            "hypothesis": "The expected result.",
        },
    )
    @patch("agent.api.get_investigation", return_value={"accession": "PSI-1"})
    def test_explains_the_selected_investigation(
        self,
        get_investigation,
        explain_agent,
    ):
        response = explain_investigation_detail("PSI-1")

        self.assertEqual(response.summary, "A short explanation.")
        get_investigation.assert_called_once_with("PSI-1")
        explain_agent.assert_called_once_with({"accession": "PSI-1"})


if __name__ == "__main__":
    unittest.main()
