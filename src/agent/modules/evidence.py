from ..module_runner import generate_module_data, run_module_cli

GUIDANCE = (
    "Return up to 8 retrieved sources actually used for combustion/fire-safety facts. "
    "Include only source pages present in the retrieved page headings."
)
SCHEMA = {
    "type": "object",
    "properties": {
        "sources": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "source_type": {
                        "type": "string",
                        "enum": ["PSI investigation", "NASA context"],
                    },
                    "source_url": {"type": "string"},
                },
                "required": ["title", "source_type", "source_url"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["sources"],
    "additionalProperties": False,
}


def generate(refresh=False):
    return generate_module_data("evidence", GUIDANCE, SCHEMA, refresh)


if __name__ == "__main__":
    run_module_cli(generate)
