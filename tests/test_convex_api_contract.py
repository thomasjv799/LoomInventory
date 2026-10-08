import json
import re
import unittest
from pathlib import Path

class ConvexContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = json.loads(Path('docs/api/convex-openapi.json').read_text())

    def test_path_templates_and_operation_ids_are_unique(self):
        templates = [re.sub(r'\{[^}]+\}', '{}', path) for path in self.contract['paths']]
        self.assertEqual(len(templates), len(set(templates)))
        operations = [operation['operationId'] for methods in self.contract['paths'].values() for operation in methods.values()]
        self.assertEqual(len(operations), len(set(operations)))
        self.assertNotIn('/seed', self.contract['paths'])
        self.assertNotIn('/bootstrap', self.contract['paths'])

    def test_references_and_path_parameters_resolve(self):
        def walk(value):
            if isinstance(value, dict):
                if '$ref' in value:
                    target = self.contract
                    for part in value['$ref'].removeprefix('#/').split('/'):
                        target = target[part]
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)
        walk(self.contract)
        for path, methods in self.contract['paths'].items():
            names = set(re.findall(r'\{([^}]+)\}', path))
            for operation in methods.values():
                parameters = {p['name'] for p in operation.get('parameters', []) if p['in'] == 'path' and p['required']}
                self.assertEqual(names, parameters)
