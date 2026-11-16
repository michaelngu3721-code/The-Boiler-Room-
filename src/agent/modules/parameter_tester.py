from ..module_runner import generate_module_data, run_module_cli

GUIDANCE = (
    "Return up to 5 directly reported experiment data points for the Parameter Tester. "
    "Only include reported soot, temperature, material, gravity, and outcome data. "
    "Use null for unreported inputs. Do not combine values from different experiments, "
    "interpolate, or invent data. For each point, explain briefly why the reported "
    "measurements make it relevant to this explorer. Base the explanation only on "
    "what the cited source reports; do not infer causes, importance, or predictions. "
    "Cite the retrieved study URL for every row."
)
SCHEMA = {
    "type": "object",
    "properties": {
        "data_points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "study": {"type": "string"},
                    "soot_value": {"type": ["number", "null"]},
                    "soot_unit": {"type": ["string", "null"]},
                    "temperature_value": {"type": ["number", "null"]},
                    "temperature_unit": {"type": ["string", "null"]},
                    "material": {"type": ["string", "null"]},
                    "gravity_g": {"type": ["number", "null"]},
                    "result": {"type": "string"},
                    "source_url": {"type": "string"},
                    "relevance": {"type": "string"},
                },
                "required": [
                    "study",
                    "soot_value",
                    "soot_unit",
                    "temperature_value",
                    "temperature_unit",
                    "material",
                    "gravity_g",
                    "result",
                    "source_url",
                    "relevance",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["data_points"],
    "additionalProperties": False,
}


def generate(refresh=False):
    return generate_module_data("parameter_tester", GUIDANCE, SCHEMA, refresh)


if __name__ == "__main__":
    run_module_cli(generate)
