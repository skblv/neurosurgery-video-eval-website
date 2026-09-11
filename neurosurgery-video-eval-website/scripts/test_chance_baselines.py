import importlib.util
import itertools
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("chance", Path(__file__).with_name("export-chance-baselines.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ChanceBaselineTest(unittest.TestCase):
    def test_analytic_expectation_matches_every_permutation(self):
        for truths in [[[], ["a"], ["a", "b"], ["b"]], [["a"], ["a"], ["b"]], [[], []]]:
            f1, em = [], []
            for predictions in itertools.permutations(truths):
                tp = sum(len(set(t) & set(p)) for t, p in zip(truths, predictions))
                denominator = sum(len(set(t)) + len(set(p)) for t, p in zip(truths, predictions))
                f1.append(200 * tp / denominator if denominator else 0)
                em.append(100 * sum(set(t) == set(p) for t, p in zip(truths, predictions)) / len(truths))
            result = module.chance_metrics(truths)["metrics"]
            self.assertAlmostEqual(result["microF1"], sum(f1) / len(f1))
            self.assertAlmostEqual(result["exactMatch"], sum(em) / len(em))

    def test_duplicate_labels_are_sets_and_empty_samples_are_rejected(self):
        self.assertEqual(module.chance_metrics([["a", "a"]]), module.chance_metrics([["a"]]))
        with self.assertRaises(ValueError):
            module.chance_metrics([])


if __name__ == "__main__":
    unittest.main()
