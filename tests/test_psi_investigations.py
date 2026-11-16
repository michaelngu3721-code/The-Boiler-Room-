import json
import unittest
from io import BytesIO
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

from agent.psi_investigations import (
    PSIInvestigationNotFound,
    get_combustion_factor_chart,
    get_combustion_investigations,
    get_factor_evidence,
    get_investigation,
    get_research_gap_evidence,
)


def json_response(value):
    return BytesIO(json.dumps(value).encode("utf-8"))


class PSIInvestigationTests(unittest.TestCase):
    @patch(
        "agent.psi_investigations.get_combustion_investigations",
        return_value=[
            {
                "accession": f"PSI-{index}",
                "title": f"Oxygen study {index}",
                "detail_url": f"https://psi.nasa.gov/physci/repo/data/investigations/PSI-{index}",
                "factor_search_text": f"Oxygen concentration study {index}",
                "factor_evidence": {
                    "keywords": "oxygen concentration",
                    "objective": f"Study {index} examines oxygen and combustion.",
                    "approach": None,
                },
            }
            for index in range(1, 4)
        ],
    )
    def test_selects_three_distinct_factor_matched_psi_records(self, get_investigations):
        evidence = get_factor_evidence("Oxygen concentration")

        self.assertEqual(len(evidence), 3)
        self.assertEqual(
            [study["accession"] for study in evidence],
            ["PSI-1", "PSI-2", "PSI-3"],
        )
        self.assertTrue(all(study["evidence"]["keywords"] for study in evidence))
        get_investigations.assert_called_once_with(include_factor_text=True)

    def test_rejects_an_unsupported_factor(self):
        with self.assertRaises(ValueError):
            get_factor_evidence("unsupported")

    @patch(
        "agent.psi_investigations.get_combustion_investigations",
        return_value=[
            {
                "factor_search_text": "Airflow velocity; FLOW SPEED; oxygen concentration",
                "detail_url": "https://psi.nasa.gov/physci/repo/data/investigations/PSI-1",
            },
            {
                "factor_search_text": "forced flow and fuel geometry",
                "detail_url": "https://psi.nasa.gov/physci/repo/data/investigations/PSI-2",
            },
        ],
    )
    def test_counts_a_keyword_once_per_investigation_and_keeps_source_links(
        self,
        get_investigations,
    ):
        chart = get_combustion_factor_chart()

        self.assertEqual(chart["sample_size"], 2)
        self.assertEqual(
            chart["factors"][0],
            {
                "factor": "Airflow speed/direction",
                "study_count": 2,
                "source_urls": [
                    "https://psi.nasa.gov/physci/repo/data/investigations/PSI-1",
                    "https://psi.nasa.gov/physci/repo/data/investigations/PSI-2",
                ],
            },
        )
        self.assertIn(
            {
                "factor": "Oxygen concentration",
                "study_count": 1,
                "source_urls": [
                    "https://psi.nasa.gov/physci/repo/data/investigations/PSI-1"
                ],
            },
            chart["factors"],
        )
        get_investigations.assert_called_once_with(include_factor_text=True)

    @patch("agent.psi_investigations.urlopen")
    def test_loads_all_search_pages_and_normalizes_investigation_fields(self, urlopen):
        source = {
            "Accession": "PSI-1",
            "Title": "A combustion investigation",
            "Acronym": "Fire study",
            "Research Area": "Combustion Science",
            "SubResearch Area": "Flames",
            "Project Type": "Microgravity Investigation",
            "Flight Platform": "ISS",
            "Investigation Start Date": "01-01-2020",
            "Investigation End Date": "01-01-2021",
            "Keywords": "flame soot",
            "Thumbnail": "/geode-py/ws/investigations/PSI-1/image",
        }
        first_page = {"hits": {"total": 2, "hits": [{"_source": source}]}}
        second_page = {
            "hits": {
                "total": 2,
                "hits": [
                    {
                        "_source": {
                            **source,
                            "Accession": "PSI-2",
                            "Title": "Another investigation",
                        }
                    }
                ],
            }
        }
        urlopen.side_effect = [json_response(first_page), json_response(second_page)]

        investigations = get_combustion_investigations()

        self.assertEqual(len(investigations), 2)
        self.assertEqual(
            [item["title"] for item in investigations],
            ["A combustion investigation", "Another investigation"],
        )
        self.assertEqual(investigations[0]["accession"], "PSI-1")
        self.assertEqual(investigations[0]["research_area"], "Combustion Science")
        self.assertNotIn("factor_search_text", investigations[0])
        self.assertEqual(
            investigations[0]["image_url"],
            "https://psi.nasa.gov/geode-py/ws/investigations/PSI-1/image",
        )
        first_url = urlopen.call_args_list[0].args[0].full_url
        query = parse_qs(urlparse(first_url).query)
        self.assertEqual(query["term"], ["combustion"])
        self.assertEqual(query["type"], ["investigation"])

    @patch("agent.psi_investigations.urlopen")
    def test_includes_source_evidence_only_when_requested(self, urlopen):
        urlopen.return_value = json_response(
            {
                "hits": {
                    "total": 1,
                    "hits": [
                        {
                            "_source": {
                                "Accession": "PSI-1",
                                "Title": "Oxygen and flame behavior",
                                "Keywords": "oxygen, flame",
                                "Objectives": "Study oxygen concentration effects.",
                                "Approach": "Measure flame behavior at two oxygen levels.",
                            }
                        }
                    ],
                }
            }
        )

        [investigation] = get_combustion_investigations(include_factor_text=True)

        self.assertEqual(
            investigation["factor_evidence"]["objective"],
            "Study oxygen concentration effects.",
        )
        self.assertIn("oxygen", investigation["factor_search_text"])
        self.assertIn("approach", investigation["factor_evidence"])

    @patch("agent.psi_investigations.urlopen")
    def test_loads_uniform_detail_fields_and_publications(self, urlopen):
        urlopen.return_value = json_response(
            {
                "accession": "PSI-7",
                "title": "A study of flames",
                "investigationAcronym": "FLAME",
                "researchArea": "Combustion Science",
                "subResearchArea": "Laminar Flames",
                "projectType": "Microgravity Investigation",
                "flightProgram": "ISS",
                "investigationStartDate": "01-01-2020",
                "investigationEndDate": "01-01-2021",
                "objective": "Understand flame behavior.",
                "approach": "Measure flames in microgravity.",
                "hypothesis": "Gravity changes flame behavior.",
                "description": "A study description.",
                "researchImpacts": "Could improve combustion systems.",
                "images": [{}],
                "publications": [{"title": "Flame paper"}, {"title": ""}],
            }
        )

        investigation = get_investigation("PSI-7")

        self.assertEqual(investigation["objective"], "Understand flame behavior.")
        self.assertEqual(investigation["approach"], "Measure flames in microgravity.")
        self.assertEqual(investigation["hypothesis"], "Gravity changes flame behavior.")
        self.assertEqual(investigation["publications"], ["Flame paper"])
        self.assertEqual(
            investigation["detail_url"],
            "https://psi.nasa.gov/physci/repo/data/investigations/PSI-7",
        )

    @patch("agent.psi_investigations.urlopen")
    def test_rejects_invalid_accession_before_request(self, urlopen):
        with self.assertRaises(ValueError):
            get_investigation("../PSI-7")

        urlopen.assert_not_called()

    @patch("agent.psi_investigations.urlopen")
    def test_reports_missing_psi_investigation(self, urlopen):
        from urllib.error import HTTPError

        urlopen.side_effect = HTTPError("https://psi.nasa.gov", 404, "not found", {}, None)

        with self.assertRaises(PSIInvestigationNotFound):
            get_investigation("PSI-7")


class PSIResearchGapEvidenceTests(unittest.TestCase):
    @patch("agent.psi_investigations.get_combustion_investigations")
    def test_bounds_and_evenly_samples_research_gap_evidence(self, get_investigations):
        get_investigations.return_value = [
            {
                "accession": f"PSI-{index}",
                "title": f"Study {index}",
                "detail_url": f"https://psi.nasa.gov/studies/PSI-{index}",
                "research_area": "Combustion",
                "subresearch_area": None,
                "project_type": "Ground",
                "flight_platform": None,
                "start_date": None,
                "end_date": None,
                "factor_evidence": {
                    "objective": f"Study objective {index}.",
                    "description": "x" * 700,
                    "approach": None,
                },
            }
            for index in range(42)
        ]

        evidence = get_research_gap_evidence()

        self.assertEqual(evidence["sample_size"], 42)
        self.assertEqual(evidence["analyzed_study_count"], 40)
        self.assertEqual(len(evidence["studies"]), 40)
        self.assertEqual(evidence["studies"][0]["accession"], "PSI-0")
        self.assertEqual(evidence["studies"][-1]["accession"], "PSI-41")
        self.assertLessEqual(
            len(evidence["studies"][0]["evidence"]["description"]),
            500,
        )
        self.assertNotIn("approach", evidence["studies"][0]["evidence"])
        get_investigations.assert_called_once_with(include_factor_text=True)


if __name__ == "__main__":
    unittest.main()
