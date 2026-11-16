from ..module_runner import generate_module_data, run_module_cli

GUIDANCE = (
    "Return exactly 3 potential research opportunities based only on the retrieved NASA "
    "combustion pages. Treat these pages as a sample, not the full scientific literature; "
    "do not claim a topic is absent from all research. Distinguish a coverage observation "
    "in this sample from an explicitly stated limitation, and use the explicit-limitation "
    "status only when the source says so. For each opportunity, include why it may matter, "
    "the evidence basis, a focused research question, and one or more retrieved source URLs."
)
SCHEMA = {
    "type": "object",
    "properties": {
        "gaps": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "gap": {"type": "string"},
                    "why_it_matters": {"type": "string"},
                    "evidence_basis": {"type": "string"},
                    "research_question": {"type": "string"},
                    "evidence_status": {
                        "type": "string",
                        "enum": [
                            "Coverage observation in this PSI sample",
                            "Explicit limitation stated by a PSI record",
                        ],
                    },
                    "source_urls": {
                        "type": "array",
                        "minItems": 1,
                        "items": {"type": "string"},
                    },
                },
                "required": [
                    "gap",
                    "why_it_matters",
                    "evidence_basis",
                    "research_question",
                    "evidence_status",
                    "source_urls",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["gaps"],
    "additionalProperties": False,
}


def generate(refresh=False):
    return generate_module_data("research_gaps", GUIDANCE, SCHEMA, refresh)


if __name__ == "__main__":
    run_module_cli(generate)
