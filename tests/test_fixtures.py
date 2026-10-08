import json, subprocess, sys, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class FixtureTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  subprocess.run([sys.executable,str(ROOT/'scripts/generate_mock.py')],check=True,cwd=ROOT)
  cls.d=json.loads((ROOT/'data/mock-data.json').read_text())
 def test_catalogue_and_history(self):
  self.assertEqual(len(self.d['products']),30)
  self.assertEqual(sum(p['category']=='Dupattas' for p in self.d['products']),6)
  self.assertEqual(self.d['asOf'],'2026-10-06')
  self.assertEqual(self.d['historyStart'],'2024-10-06')
  self.assertEqual(len(self.d['locations']),6)
 def test_ledger_and_sales_reconcile(self):
  balances={}
  for row in self.d['openingInventory']+self.d['movements']:
   key=(row['variantId'],row['locationId'],row['binId'],row['condition'])
   balances[key]=balances.get(key,0)+row['quantity']
   self.assertGreaterEqual(balances[key],0,key)
  for b in self.d['balances']:
   self.assertEqual(b['quantity'],balances.get((b['variantId'],b['locationId'],b['binId'],b['condition']),0))
  movements={m['id']:m for m in self.d['movements']}
  for s in self.d['sales']:
   self.assertEqual(movements[s['movementId']]['quantity'],-s['quantity'])
   self.assertIn('netValue',s)
 def test_transit_conserves_consignment(self):
  for t in self.d['transfers']:
   self.assertEqual(t['inTransit'],t['dispatched']-t['received'])
   self.assertGreaterEqual(t['inTransit'],0)
   self.assertEqual(t['ownership'],'Central')
 def test_images_and_business_scenarios(self):
  for p in self.d['products']:
   self.assertTrue(p['image'].startswith('https://img.theloom.in/'))
   self.assertTrue(p['sourceProductUrl'].startswith('https://theloom.in/'))
   self.assertNotIn('sellingPrice',p)
  self.assertEqual(len(self.d['scenarios']),15)
  self.assertTrue(any(b['excluded'] for b in self.d['bins']))
  self.assertTrue(any(b['condition']=='quarantine' and b['quantity']>0 for b in self.d['balances']))
 def test_chronological_ledger_and_transfer_dates(self):
  stock={}
  for m in sorted(self.d['openingInventory']+self.d['movements'],key=lambda m:(m['date'],0 if m['reason']=='Opening balance' else 1,m['id'])):
   key=(m['variantId'],m['locationId'],m['binId'],m['condition'])
   stock[key]=stock.get(key,0)+m['quantity'];self.assertGreaterEqual(stock[key],0,key)
  for t in self.d['transfers']:
   issues=[m for m in self.d['movements'] if m['reference']==t['id'] and m['reason']=='Consignment issue']
   self.assertEqual(sum(-m['quantity'] for m in issues),t['dispatched'])
   self.assertTrue(all(m['date']==t['dispatchDate'] for m in issues))
 def test_size_forecasts_reconcile(self):
  for f in self.d['forecasts']:
   sizes=[s for s in self.d['sizeForecasts'] if s['productId']==f['productId'] and s['month']==f['month']]
   self.assertEqual(sum(s['units'] for s in sizes),f['units'])
 def test_no_prelaunch_sales_and_all_inputs_present(self):
  launches={p['id']:p['launchDate'] for p in self.d['products']}
  self.assertTrue(all(s['date']>=launches[s['productId']] for s in self.d['sales']))
  self.assertEqual(len(list((ROOT/'data/inputs').glob('*.json'))),11)
  self.assertEqual({e['start'][:4] for e in self.d['events']},{'2024','2025','2026'})
 def test_dispatch_staging_is_an_internal_move(self):
  staged=[m for m in self.d['movements'] if m['reason']=='Dispatch staging']
  self.assertEqual(sum(m['quantity'] for m in staged),0)
 def test_deterministic(self):
  before=(ROOT/'data/mock-data.json').read_bytes()
  subprocess.run([sys.executable,str(ROOT/'scripts/generate_mock.py')],check=True,cwd=ROOT,stdout=subprocess.DEVNULL)
  self.assertEqual(before,(ROOT/'data/mock-data.json').read_bytes())
if __name__=='__main__':unittest.main()
