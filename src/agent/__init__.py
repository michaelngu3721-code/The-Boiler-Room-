import argparse
import importlib
import json
import logging

from .modules import MODULE_NAMES


def main():
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description="Generate data for one website module.")
    parser.add_argument("module", choices=MODULE_NAMES)
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Ignore the shared source cache and recrawl NASA pages.",
    )
    args = parser.parse_args()

    module = importlib.import_module(f".modules.{args.module}", __package__)
    data = module.generate(refresh=args.refresh)
    print(json.dumps(data, ensure_ascii=False, separators=(",", ":")), flush=True)
