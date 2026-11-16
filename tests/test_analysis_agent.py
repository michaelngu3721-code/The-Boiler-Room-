import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from agent.analysis_agent import (
    explain_comparison,
    explain_factor,
    explain_investigation,
    explain_research_gaps,
)
from agent.modules.experiment_comparison import compare_measurements


class ExplainComparisonTests(unittest.TestCase):
    @patch("agent.analysis_agent.get_api_key", return_value="test-key")
    @patch("agent.analysis_agent.OpenAI")
    def test_explains_the_computed_result_without_recalculating(
        self,
        openai_class,
        _get_api_key,
    ):
        client = openai_class.return_value
        client.chat.completions.create.return_value = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(refusal=None, content="B is 5 mg higher than A."),
                    finish_reason="stop",
                )
            ]
        )
        result = compare_measurements(
            measurement="soot",
            value_a=10,
            value_b=15,
            unit_a="mg",
            unit_b="mg",
        )

        explanation = explain_comparison(
            result,
            "Study A",
            "Study B",
            "reported outcome A",
            "reported outcome B",
        )

        self.assertEqual(explanation, "B is 5 mg higher than A.")
        prompt = client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        prompt_data = json.loads(prompt)
        self.assertEqual(prompt_data["computed_result"]["difference"], 5)
        self.assertEqual(prompt_data["baseline_reported_outcome"], "reported outcome A")

    @patch("agent.analysis_agent.get_api_key", return_value="test-key")
    @patch("agent.analysis_agent.OpenAI")
    def test_explains_psi_fields_in_plain_language(
        self,
        openai_class,
        _get_api_key,
    ):
        client = openai_class.return_value
        client.chat.completions.create.return_value = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        refusal=None,
                        content=json.dumps(
                            {
                                "summary": "The project studies electric fields and flames.",
                                "goal": "The goal is to learn how voltage affects flames.",
                                "approach": "The team measures flame behavior under different fields.",
                                "hypothesis": "The team expects electric fields to change flame behavior.",
                            }
                        ),
                    ),
                    finish_reason="stop",
                )
            ]
        )

        explanation = explain_investigation(
            {
                "accession": "PSI-22",
                "title": "Electric-field effects on flames",
                "objective": "Study the effect of voltage on flames.",
                "approach": "Measure flame behavior at different voltages.",
                "hypothesis": "Electric fields influence flame behavior.",
            }
        )

        self.assertEqual(explanation["goal"], "The goal is to learn how voltage affects flames.")
        self.assertEqual(
            explanation["hypothesis"],
            "The team expects electric fields to change flame behavior.",
        )
        prompt = client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        prompt_data = json.loads(prompt)
        self.assertEqual(prompt_data["accession"], "PSI-22")


class ExplainFactorTests(unittest.TestCase):
    def setUp(self):
        self.studies = [
            {
                "title": f"Study {index}",
                "source_url": f"https://psi.nasa.gov/studies/PSI-{index}",
                "evidence": {"objective": f"Study {index} examines oxygen and flames."},
            }
            for index in range(1, 4)
        ]
        self.points = [
            {
                "source_url": study["source_url"],
                "evidence_point": f"Finding from {study['title']}.",
                "combustion_relevance": "The record connects oxygen to flame behavior.",
                "fire_safety_impact": "The record does not discuss fire safety.",
                "suppression_tactics": "The record does not identify a suppression tactic.",
            }
            for study in self.studies
        ]

    @patch("agent.analysis_agent.get_api_key", return_value="test-key")
    @patch("agent.analysis_agent.OpenAI")
    def test_returns_three_distinct_points_from_supplied_psi_sources(
        self,
        openai_class,
        _get_api_key,
    ):
        client = openai_class.return_value
        client.chat.completions.create.return_value = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        refusal=None,
                        content=json.dumps({"points": self.points}),
                    ),
                    finish_reason="stop",
                )
            ]
        )

        explanation = explain_factor("Oxygen concentration", self.studies)

        self.assertEqual(len(explanation["points"]), 3)
        self.assertEqual(
            {point["source_url"] for point in explanation["points"]},
            {study["source_url"] for study in self.studies},
        )
        self.assertTrue(all(point["suppression_tactics"] for point in explanation["points"]))
        request = client.chat.completions.create.call_args.kwargs
        self.assertTrue(request["response_format"]["json_schema"]["strict"])
        self.assertEqual(
            json.loads(request["messages"][1]["content"])["factor"],
            "Oxygen concentration",
        )

    @patch("agent.analysis_agent.get_api_key", return_value="test-key")
    @patch("agent.analysis_agent.OpenAI")
    def test_rejects_points_with_unapproved_source_urls(
        self,
        openai_class,
        _get_api_key,
    ):
        bad_points = [*self.points]
        bad_points[2] = {**bad_points[2], "source_url": "https://example.com/unverified"}
        client = openai_class.return_value
        client.chat.completions.create.return_value = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        refusal=None,
                        content=json.dumps({"points": bad_points}),
                    ),
                    finish_reason="stop",
                )
            ]
        )

        with self.assertRaises(RuntimeError):
            explain_factor("Oxygen concentration", self.studies)

    @patch("agent.analysis_agent.get_api_key", return_value="test-key")
    @patch("agent.analysis_agent.OpenAI")
    def test_requires_exactly_three_points(
        self,
        openai_class,
        _get_api_key,
    ):
        client = openai_class.return_value
        client.chat.completions.create.return_value = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        refusal=None,
                        content=json.dumps({"points": self.points[:2]}),
                    ),
                    finish_reason="stop",
                )
            ]
        )

        with self.assertRaises(RuntimeError):
            explain_factor("Oxygen concentration", self.studies)


class ExplainResearchGapsTests(unittest.TestCase):
    def setUp(self):
        self.studies = [
            {
                "accession": f"PSI-{index}",
                "title": f"Study {index}",
                "source_url": f"https://psi.nasa.gov/studies/PSI-{index}",
                "evidence": {"objective": f"Study {index} examines flame behavior."},
            }
            for index in range(1, 4)
        ]
        self.gaps = [
            {
                "gap": f"Potential opportunity {index}.",
                "why_it_matters": f"This could matter for question {index}.",
                "evidence_basis": f"The sampled records describe topic {index}.",
                "research_question": f"How does condition {index} affect combustion?",
                "evidence_status": "Coverage observation in this PSI sample",
                "source_urls": [study["source_url"]],
            }
            for index, study in enumerate(self.studies, start=1)
        ]

    @patch("agent.analysis_agent.get_api_key", return_value="test-key")
    @patch("agent.analysis_agent.OpenAI")
    def test_returns_three_cited_sample_based_opportunities(
        self,
        openai_class,
        _get_api_key,
    ):
        client = openai_class.return_value
        client.chat.completions.create.return_value = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        refusal=None,
                        content=json.dumps({"gaps": self.gaps}),
                    ),
                    finish_reason="stop",
                )
            ]
        )

        result = explain_research_gaps(self.studies)

        self.assertEqual(len(result["gaps"]), 3)
        self.assertEqual(
            {url for gap in result["gaps"] for url in gap["source_urls"]},
            {study["source_url"] for study in self.studies},
        )
        request = client.chat.completions.create.call_args.kwargs
        self.assertTrue(request["response_format"]["json_schema"]["strict"])
        self.assertEqual(
            json.loads(request["messages"][1]["content"])["studies"],
            self.studies,
        )

    @patch("agent.analysis_agent.get_api_key", return_value="test-key")
    @patch("agent.analysis_agent.OpenAI")
    def test_rejects_research_gap_citation_outside_psi_sample(
        self,
        openai_class,
        _get_api_key,
    ):
        invalid_gaps = [*self.gaps]
        invalid_gaps[0] = {
            **invalid_gaps[0],
            "source_urls": ["https://example.com/unverified"],
        }
        client = openai_class.return_value
        client.chat.completions.create.return_value = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        refusal=None,
                        content=json.dumps({"gaps": invalid_gaps}),
                    ),
                    finish_reason="stop",
                )
            ]
        )

        with self.assertRaises(RuntimeError):
            explain_research_gaps(self.studies)

    @patch("agent.analysis_agent.get_api_key", return_value="test-key")
    @patch("agent.analysis_agent.OpenAI")
    def test_requires_exactly_three_research_gaps(
        self,
        openai_class,
        _get_api_key,
    ):
        client = openai_class.return_value
        client.chat.completions.create.return_value = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        refusal=None,
                        content=json.dumps({"gaps": self.gaps[:2]}),
                    ),
                    finish_reason="stop",
                )
            ]
        )

        with self.assertRaises(RuntimeError):
            explain_research_gaps(self.studies)


if __name__ == "__main__":
    unittest.main()
