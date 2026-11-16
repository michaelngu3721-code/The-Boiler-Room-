import unittest

from agent.modules.experiment_comparison import compare_measurements


class CompareMeasurementsTests(unittest.TestCase):
    def test_increase_includes_difference_and_percent_change(self):
        result = compare_measurements(
            measurement="soot",
            value_a=10,
            value_b=15,
            unit_a="mg",
            unit_b="mg",
        )

        self.assertEqual(result["difference"], 5)
        self.assertEqual(result["absolute_difference"], 5)
        self.assertEqual(result["percent_change"], 50)
        self.assertEqual(result["direction"], "increase")

    def test_zero_baseline_omits_percent_change(self):
        result = compare_measurements(
            measurement="gravity",
            value_a=0,
            value_b=0.16,
            unit_a="g",
            unit_b="g",
        )

        self.assertIsNone(result["percent_change"])
        self.assertIn("baseline value is zero", result["percent_change_note"])

    def test_celsius_comparison_reports_only_absolute_change(self):
        result = compare_measurements(
            measurement="temperature",
            value_a=20,
            value_b=25,
            unit_a="deg C",
            unit_b="deg C",
        )

        self.assertEqual(result["absolute_difference"], 5)
        self.assertIsNone(result["percent_change"])
        self.assertIn("non-Kelvin", result["percent_change_note"])

    def test_kelvin_comparison_supports_percent_change(self):
        result = compare_measurements(
            measurement="temperature",
            value_a=200,
            value_b=300,
            unit_a="K",
            unit_b="K",
        )

        self.assertEqual(result["absolute_difference"], 100)
        self.assertEqual(result["percent_change"], 50)

    def test_rejects_mismatched_units(self):
        with self.assertRaisesRegex(ValueError, "same unit"):
            compare_measurements(
                measurement="soot",
                value_a=1,
                value_b=1000,
                unit_a="g",
                unit_b="mg",
            )

    def test_rejects_non_finite_values(self):
        with self.assertRaisesRegex(ValueError, "finite numbers"):
            compare_measurements(
                measurement="gravity",
                value_a=float("nan"),
                value_b=1,
                unit_a="g",
                unit_b="g",
            )


if __name__ == "__main__":
    unittest.main()
