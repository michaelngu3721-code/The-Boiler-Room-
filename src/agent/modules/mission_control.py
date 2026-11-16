from ..module_runner import generate_module_data, run_module_cli

GUIDANCE = (
    "Return a compact static reference for Mission Control: up to 3 source-supported "
    "spacecraft fire hazards and up to 3 relevant studies. This is not a response to a "
    "specific user scenario. Do not invent likelihoods, severity scores, or statistics."
)
SCHEMA = {
    "type": "object",
    "properties": {
        "hazards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "hazard": {"type": "string"},
                    "evidence": {"type": "string"},
                    "source_url": {"type": "string"},
                },
                "required": ["hazard", "evidence", "source_url"],
                "additionalProperties": False,
            },
        },
        "suggested_studies": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "study": {"type": "string"},
                    "reason": {"type": "string"},
                    "source_url": {"type": "string"},
                },
                "required": ["study", "reason", "source_url"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["hazards", "suggested_studies"],
    "additionalProperties": False,
}


def generate(refresh=False):
    return generate_module_data("mission_control", GUIDANCE, SCHEMA, refresh)


if __name__ == "__main__":
    run_module_cli(generate)
