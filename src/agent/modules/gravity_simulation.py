from ..module_runner import generate_module_data, run_module_cli

GUIDANCE = (
    "Return up to 4 simple, source-supported gravity/flame observations for the basic "
    "0-1g simulator. Include only gravity conditions present in the retrieved sources; "
    "do not interpolate or introduce external factors. If the exact gravity is not "
    "reported, use null and label the observation qualitative."
)
SCHEMA = {
    "type": "object",
    "properties": {
        "points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "gravity_g": {"type": ["number", "null"]},
                    "flame_shape": {"type": "string"},
                    "combustion_effect": {"type": "string"},
                    "evidence_status": {
                        "type": "string",
                        "enum": ["direct_evidence", "qualitative"],
                    },
                    "source_url": {"type": ["string", "null"]},
                },
                "required": [
                    "gravity_g",
                    "flame_shape",
                    "combustion_effect",
                    "evidence_status",
                    "source_url",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["points"],
    "additionalProperties": False,
}


def generate(refresh=False):
    return generate_module_data("gravity_simulation", GUIDANCE, SCHEMA, refresh)


if __name__ == "__main__":
    run_module_cli(generate)
