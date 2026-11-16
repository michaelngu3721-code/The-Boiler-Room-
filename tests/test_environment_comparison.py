import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from agent.analysis_agent import explain_environment
from agent.api import (
    EnvironmentExplanationRequest,
    explain_environment_comparison,
)
from agent.environment_comparison import (
    ENVIRONMENT_POINT_CATEGORIES,
    get_environment_evidence,
)


def valid_explanation(context):
    sources = context["sources"]
    return {
        "summary": f"NASA context for {context['label']}.",
        "points": [
            {
                "category": category,
                "fire_safety_effect": f"Safety context for {category}.",
                "evidence_status": "NASA background context",
                "source_urls": [sources[index % len(sources)]["source_url"]],
            }
            for index, category in enumerate(ENVIRONMENT_POINT_CATEGORIES)
        ],
    }


class EnvironmentEvidenceTests(unittest.TestCase):
    def test_provides_four_distinct_environment_profiles_and_nasa_sources(self):
        environments = ("earth", "iss", "moon", "mars")
        profiles = {key: get_environment_evidence(key) for key in environments}

        self.assertEqual(len(profiles), 4)
        self.assertEqual(profiles["iss"]["label"], "Pressurized habitat (ISS)")
        self.assertIn("sealed", profiles["moon"]["conditions"])
        self.assertIn("thin", profiles["mars"]["conditions"])
        for profile in profiles.values():
            self.assertTrue(profile["sources"])
            self.assertTrue(
                all(source["source_url"].startswith("https://") for source in profile["sources"])
            )

    def test_rejects_unknown_environment(self):
        with self.assertRaises(ValueError):
            get_environment_evidence("jupiter")


class EnvironmentAgentTests(unittest.TestCase):
    def setUp(self):
        self.context = get_environment_evidence("iss")
        self.explanation = valid_explanation(self.context)

    @patch("agent.analysis_agent.get_api_key", return_value="test-key")
    @patch("agent.analysis_agent.OpenAI")
    def test_generates_three_distinct_cited_safety_topics(
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
                        content=json.dumps(self.explanation),
                    ),
                    finish_reason="stop",
                )
            ]
        )

        result = explain_environment("iss", self.context)

        self.assertEqual(result["summary"], self.explanation["summary"])
        self.assertEqual(
            {point["category"] for point in result["points"]},
            set(ENVIRONMENT_POINT_CATEGORIES),
        )
        self.assertTrue(all(point["source_urls"] for point in result["points"]))

    @patch("agent.analysis_agent.get_api_key", return_value="test-key")
    @patch("agent.analysis_agent.OpenAI")
    def test_rejects_environment_citations_outside_the_supplied_sources(
        self,
        openai_class,
        _get_api_key,
    ):
        invalid = valid_explanation(self.context)
        invalid["points"][0]["source_urls"] = ["https://example.com/not-nasa"]
        client = openai_class.return_value
        client.chat.completions.create.return_value = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        refusal=None,
                        content=json.dumps(invalid),
                    ),
                    finish_reason="stop",
                )
            ]
        )

        with self.assertRaises(RuntimeError):
            explain_environment("iss", self.context)


class EnvironmentApiTests(unittest.TestCase):
    def setUp(self):
        self.context = get_environment_evidence("moon")
        self.request = EnvironmentExplanationRequest(environment="moon")
        self.explanation = valid_explanation(self.context)

    def test_returns_environment_analysis_and_curated_source_links(self):
        with (
            patch("agent.api.get_environment_evidence", return_value=self.context),
            patch(
                "agent.api.generate_environment_explanation",
                return_value=self.explanation,
            ),
        ):
            response = explain_environment_comparison(self.request)

        self.assertEqual(response.environment, "moon")
        self.assertEqual(response.label, "Moon")
        self.assertEqual(len(response.points), 3)
        self.assertTrue(any("FM2" in source.title for source in response.sources))

    def test_rejects_citations_not_in_the_retrieved_context(self):
        invalid = valid_explanation(self.context)
        invalid["points"][0]["source_urls"] = ["https://example.com/not-nasa"]

        with (
            patch("agent.api.get_environment_evidence", return_value=self.context),
            patch(
                "agent.api.generate_environment_explanation",
                return_value=invalid,
            ),
        ):
            with self.assertRaises(HTTPException) as error:
                explain_environment_comparison(self.request)

        self.assertEqual(error.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
