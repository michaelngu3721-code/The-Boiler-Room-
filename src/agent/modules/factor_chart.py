from ..module_runner import generate_module_data, run_module_cli

GUIDANCE = (
    "Count how often each experiment factor appears across the retrieved PSI investigation "
    "pages only. Return up to 5 factors, highest study_count first, plus the number of "
    "retrieved PSI investigation pages counted. Count studies, not repeated mentions. "
    "Do not present this sample as the entire NASA database."
)
SCHEMA = {
    "type": "object",
    "properties": {
        "sample_size": {"type": "integer"},
        "factors": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "factor": {"type": "string"},
                    "study_count": {"type": "integer"},
                    "source_urls": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["factor", "study_count", "source_urls"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["sample_size", "factors"],
    "additionalProperties": False,
}


def generate(refresh=False):
    return generate_module_data("factor_chart", GUIDANCE, SCHEMA, refresh)


if __name__ == "__main__":
    run_module_cli(generate)
