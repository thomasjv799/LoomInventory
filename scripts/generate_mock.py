"""Reproducible, movement-led demo fixtures. Standard-library only; never reads live inventory."""
from pathlib import Path
from datetime import date, timedelta
import json, random
ROOT=Path(__file__).resolve().parents[1]
AS_OF=date(2026,10,6); START=date(2024,10,6)
rng=random.Random(799)
manifest=json.loads((ROOT/'data/image-manifest.json').read_text())
locations=[{'id':'HO','name':'Head Office','city':'Delhi','type':'warehouse'}]+[{'id':f'S{i+1}','name':name,'city':city,'type':'store'} for i,(name,city) in enumerate([('Delhi · South Extension','Delhi'),('Mumbai · Kala Ghoda','Mumbai'),('Bengaluru · Indiranagar','Bengaluru'),('Jaipur · C-Scheme','Jaipur'),('Hyderabad · Jubilee Hills','Hyderabad')])]
bins=[{'id':loc['id']+'-MAIN','locationId':loc['id'],'name':'Main stock','excluded':False} for loc in locations]+[{'id':'HO-DISPATCH','locationId':'HO','name':'Dispatch center','excluded':True},{'id':'HO-QC','locationId':'HO','name':'Quality hold','excluded':False}]
products=[]; variants=[]
for i,ref in enumerate(manifest):
 name=ref['images'][0]['alt'] or ('Pink Embroidered Chanderi Suit - Set of 3' if ref['id']=='P016' else 'Rust Embroidered Chanderi Suit - Set of 3')
 category='Dupattas' if ref['id'].startswith('D') else ('Suit sets' if 'Suit' in name else 'Kurta sets')
 color=next((x for x in ['Mustard Yellow','Bottle Green','Navy Blue','Teal Blue','Pista Green','Emerald Green','Sage Green','Fuchsia','Purple','Yellow','Pink','Red','White','Rust','Black','Green','Blue'] if x in name),'Ivory')
 fabric=next((x for x in ['Kota Doria','Silk Blend','Chanderi Silk','Chanderi','Cotton'] if x in name),'Chanderi')
 craft=next((x for x in ['Hand Embroidered','Aari Embroidered','Zari Embroidered','Gota Work','Mirror Work','Lace Work','Printed','Embroidered'] if x in name),'Embroidered')
 cost=(rng.randint(750,1800) if category=='Dupattas' else rng.randint(1600,3800))*100
 sku='LM-'+ref['id']
 p={'id':ref['id'],'sku':sku,'name':name,'category':category,'color':color,'fabric':fabric,'craft':craft,'kurtaLength':rng.choice([42,44,46]),'style':rng.choice(['Straight','A-line','Choga']),'collection':rng.choice(['Festive Edit','Everyday Heirlooms','Soft Traditions']),'season':'Festive 2026' if (i%3!=0 and i!=13) else 'Summer 2026','launchDate':(AS_OF-timedelta(days=40 if (i%3!=0 and i!=13) else (AS_OF-START).days)).isoformat(),'cost':cost,'suggestedMrp':cost*2,'image':ref['images'][0]['url'],'secondaryImage':ref['images'][1]['url'] if len(ref['images'])>1 else None,'sourceProductUrl':ref['sourceProductUrl'],'sizes':['Free'] if category=='Dupattas' else ['XS','S','M','L','XL','XXL'],'provenance':{'name':'source','image':'source','color':'source','fabric':'source','craft':'source','cost':'simulated','suggestedMrp':'simulated','kurtaLength':'simulated','style':'simulated','sizes':'simulated','season':'simulated','collection':'simulated','launchDate':'simulated'}}
 for attr in ['color','fabric','craft']:
  if p[attr] not in name:p['provenance'][attr]='simulated'
 products.append(p)
 ref['name']=name;ref['category']=category;ref['primaryImageUrl']=p['image'];ref['secondaryImageUrl']=p['secondaryImage'];ref['alt']=name;ref['provenance']=p['provenance'];ref['verifiedOn']=AS_OF.isoformat()
 for size in p['sizes']: variants.append({'id':p['id']+'-'+size,'productId':p['id'],'sku':sku+'-'+size,'size':size})
stock={};opening=[];movements=[];sales=[];transfers=[];reservations=[]
def move(vid,loc,qty,when,reason,condition='sellable',binid=None,reference=None):
 binid=binid or loc+'-MAIN';key=(vid,loc,binid,condition)
 stock[key]=stock.get(key,0)+qty
 if stock[key]<0: raise ValueError(f'Negative stock: {key}')
 row={'id':f'M{len(movements)+1:06d}','variantId':vid,'locationId':loc,'binId':binid,'condition':condition,'quantity':qty,'date':when.isoformat(),'reason':reason,'reference':reference}
 movements.append(row);return row['id']
for v in variants:
 for loc in locations:
  q=48 if loc['id']=='HO' else rng.randint(4,12)
  if next(p for p in products if p['id']==v['productId'])['launchDate']>START.isoformat():q=0
  row={'id':f'O{len(opening)+1:04d}','variantId':v['id'],'locationId':loc['id'],'binId':loc['id']+'-MAIN','condition':'sellable','quantity':q,'date':START.isoformat(),'reason':'Opening balance','reference':None}
  opening.append(row);stock[(v['id'],loc['id'],loc['id']+'-MAIN','sellable')]=q
# New season styles begin with dated production and store receipts, never pre-launch sales.
for p in products:
 if p['launchDate']<=START.isoformat():continue
 launch=date.fromisoformat(p['launchDate']);dispatch=launch-timedelta(days=3)
 for size in p['sizes']:
  vid=p['id']+'-'+size;move(vid,'HO',88,dispatch,'Production receipt')
  for loc in locations[1:]:
   ref=f'T{len(transfers)+1:05d}';move(vid,'HO',-8,dispatch,'Consignment issue',reference=ref);move(vid,loc['id'],8,launch,'Consignment receipt',reference=ref)
   transfers.append({'id':ref,'variantId':vid,'source':'HO','destination':loc['id'],'dispatched':8,'received':8,'inTransit':0,'dispatchDate':dispatch.isoformat(),'receivedDate':launch.isoformat(),'eta':launch.isoformat(),'ownership':'Central'})
# Sparse older events plus daily recent history; all days have continuous stock reconstruction.
dates=[];d=START
while d<AS_OF-timedelta(days=90):dates.append(d);d+=timedelta(days=28)
d=AS_OF-timedelta(days=90)
while d<AS_OF:dates.append(d);d+=timedelta(days=1)
for day in dates:
 age=(AS_OF-day).days
 if age==14:
  for loc in ['HO','S1']:
   key=('P003-M',loc,loc+'-MAIN','sellable');move('P003-M',loc,-stock[key],day,'QC correction')
 if age==6:
  move('P003-M','HO',30,day,'Production receipt');move('P003-M','S1',12,day,'QC correction')
 for i,p in enumerate(products):
  # Deliberate no-sales held inventory.
  if i in [6,13] and age<95:continue
  if day.isoformat()<p['launchDate']:continue
  for li,loc in enumerate(locations):
   vid=p['id']+'-'+(rng.choice(p['sizes']) if len(p['sizes'])>1 else 'Free')
   if i==2 and li in [0,1] and age<=6:vid='P003-M'
   if vid=='P003-M' and li in [0,1] and 6<age<=14:continue
   # Regional product preference; sample sell-through is synthetic.
   frequency=.58 if li==0 else .28+((i+li)%4)*.1
   if i==2 and age<=7:frequency=1
   if i==4 and age<=10:frequency=.04
   if rng.random()>frequency:continue
   qty=rng.choice([1,1,1,2])
   if i==2 and age<=7:qty=3
   key=(vid,loc['id'],loc['id']+'-MAIN','sellable')
   if stock[key]<qty:
    if loc['id']=='HO':move(vid,'HO',30,day,'Production receipt')
    else:
     ho=(vid,'HO','HO-MAIN','sellable')
     dispatch_day=day-timedelta(days=3+(li%3))
     move(vid,'HO',12,dispatch_day,'Production receipt')
     move(vid,'HO',-12,dispatch_day,'Consignment issue',reference=f'T{len(transfers)+1:05d}')
     move(vid,loc['id'],12,day,'Consignment receipt',reference=f'T{len(transfers)+1:05d}')
     transfers.append({'id':f'T{len(transfers)+1:05d}','variantId':vid,'source':'HO','destination':loc['id'],'dispatched':12,'received':12,'inTransit':0,'dispatchDate':(day-timedelta(days=3+(li%3))).isoformat(),'receivedDate':day.isoformat(),'eta':day.isoformat(),'ownership':'Central'})
   mid=move(vid,loc['id'],-qty,day,'Ecommerce sale' if li==0 else 'Store sale')
   mrp=p['suggestedMrp']+rng.choice([0,10000,20000]); net=round(mrp*rng.choice([.75,.85,.9,1]))*qty
   sales.append({'id':f'SALE{len(sales)+1:06d}','orderId':f'BILL{len(sales)//2:06d}','variantId':vid,'productId':p['id'],'locationId':loc['id'],'channel':'Ecommerce' if li==0 else 'Store','date':day.isoformat(),'quantity':qty,'mrp':mrp,'netValue':net,'movementId':mid,'dupattaAttached':False,'matchingStatus':'unknown' if len(sales)%7==0 else 'without'})
# Deterministic catalogue coverage in three recent windows. Every active
# variant/location has a real sale, linked deduction and received stock.
# The two inactive styles deliberately retain their no-recent-sales evidence.
def coverage_sale(p, size, loc, day, qty=1):
 vid=p['id']+'-'+size;ref=f'TCOV{len(transfers)+1:05d}'
 if loc=='HO':move(vid,'HO',qty,day,'Production receipt')
 else:
  dispatch=day-timedelta(days=3)
  move(vid,'HO',qty,dispatch,'Production receipt')
  move(vid,'HO',-qty,dispatch,'Consignment issue',reference=ref)
  move(vid,loc,qty,day,'Consignment receipt',reference=ref)
  transfers.append({'id':ref,'variantId':vid,'source':'HO','destination':loc,'dispatched':qty,'received':qty,'inTransit':0,'dispatchDate':dispatch.isoformat(),'receivedDate':day.isoformat(),'eta':day.isoformat(),'ownership':'Central'})
 mid=move(vid,loc,-qty,day,'Ecommerce sale' if loc=='HO' else 'Store sale')
 sales.append({'id':f'SALE{len(sales)+1:06d}','orderId':f'COVERAGE{len(sales)+1:06d}','variantId':vid,'productId':p['id'],'locationId':loc,'channel':'Ecommerce' if loc=='HO' else 'Store','date':day.isoformat(),'quantity':qty,'mrp':p['suggestedMrp'],'netValue':round(p['suggestedMrp']*.85)*qty,'movementId':mid,'dupattaAttached':False,'matchingStatus':'without'})
for p in products:
 if p['id'] in ['P007','P014']:continue
 for size in p['sizes']:
  for loc in locations:
   for age in [22,12,1]:coverage_sale(p,size,loc['id'],AS_OF-timedelta(days=age))
# Each store has clear upward and downward trends, not only a network aggregate.
for loc in locations:
 coverage_sale(next(p for p in products if p['id']=='P003'),'M',loc['id'],AS_OF-timedelta(days=1),30)
 coverage_sale(next(p for p in products if p['id']=='P005'),'M',loc['id'],AS_OF-timedelta(days=12),18)
# Named scenarios: store M shortage with HO supply; different location excess; HO fast seller shortage.
for vid,loc,target in [('P001-M','S1',0),('P001-M','S2',28),('P001-L','S1',0),('P001-L','S2',35),('P001-L','HO',0),('P003-M','HO',0),('P003-L','HO',0),('P005-S','S3',0),('P005-M','S3',0),('P010-M','S4',0)]:
 current=stock[(vid,loc,loc+'-MAIN','sellable')]
 if current!=target:move(vid,loc,target-current,AS_OF,'QC correction')
# Per-store feasible rotations with a protected donor, plus an HO shortage.
# Original P001-M transit scenario remains unchanged for accounting drilldowns.
for i,(pid,dest,donor) in enumerate([('P001','S1','S2'),('P004','S2','S3'),('P005','S3','S4'),('P010','S4','S5'),('P009','S5','S1')]):
 for vid,loc,target in [(pid+'-L',dest,0),(pid+'-L',donor,60),(pid+'-L','HO',0),('P003-S',dest,1)]:
  current=stock[(vid,loc,loc+'-MAIN','sellable')]
  if current!=target:move(vid,loc,target-current,AS_OF,'QC correction')
 # An additional open shipment gives every store a transit example.
 vid='P012-M';ref=f'TSTORE{i+1}';qty=6
 if stock[(vid,'HO','HO-MAIN','sellable')]<qty:move(vid,'HO',qty+12,AS_OF,'Production receipt')
 move(vid,'HO',-qty,AS_OF,'Consignment issue',reference=ref)
 transfers.append({'id':ref,'variantId':vid,'source':'HO','destination':dest,'dispatched':qty,'received':0,'inTransit':qty,'dispatchDate':AS_OF.isoformat(),'receivedDate':None,'eta':(AS_OF+timedelta(days=3)).isoformat(),'ownership':'Central'})
for vid in ['P001-M','P004-S','P007-L']:
 move(vid,'HO',-3,AS_OF,'Dispatch staging')
 move(vid,'HO',3,AS_OF,'Dispatch staging',binid='HO-DISPATCH')
 move(vid,'HO',2,AS_OF,'Ecommerce return',condition='quarantine',binid='HO-QC')
 move(vid,'HO',1,AS_OF,'Store return',condition='quarantine',binid='HO-QC')
 move(vid,'HO',1,AS_OF,'Inspection release')
 move(vid,'HO',-1,AS_OF,'Inspection release',condition='quarantine',binid='HO-QC')
for j,vid in enumerate(['P001-M','P005-S','P010-M']):
 dest=['S1','S3','S4'][j];q=4+j
 if stock[(vid,'HO','HO-MAIN','sellable')]<q:move(vid,'HO',q+10,AS_OF,'Production receipt')
 ref=f'TOPEN{j+1}';move(vid,'HO',-q,AS_OF,'Consignment issue',reference=ref)
 received=1 if j==1 else 0
 if received:move(vid,dest,received,AS_OF,'Consignment receipt',reference=ref)
 transfers.append({'id':ref,'variantId':vid,'source':'HO','destination':dest,'dispatched':q,'received':received,'inTransit':q-received,'dispatchDate':AS_OF.isoformat(),'receivedDate':AS_OF.isoformat() if received else None,'eta':(AS_OF+timedelta(days=3)).isoformat(),'ownership':'Central'})
vid='P004-XL'
if stock[(vid,'HO','HO-MAIN','sellable')]<2:move(vid,'HO',10,AS_OF,'Production receipt')
move(vid,'HO',-2,AS_OF,'Returnable issue',reference='RETURNABLE1');move(vid,'S5',2,AS_OF,'Returnable receipt',reference='RETURNABLE1')
move(vid,'S5',-1,AS_OF,'Returnable return',reference='RETURNABLE1');move(vid,'HO',1,AS_OF,'Returnable return',reference='RETURNABLE1')
for vid in ['P002-S','P011-M']:reservations.append({'variantId':vid,'locationId':'HO','quantity':2})
balances=[{'variantId':k[0],'locationId':k[1],'binId':k[2],'condition':k[3],'quantity':v} for k,v in sorted(stock.items())]
mappings=[{'outfitId':f'P{i:03d}','dupattaId':f'D{j:03d}','relationship':'Simulated matching relationship','ratio':1} for i,j in [(1,1),(4,1),(9,2),(12,2),(18,3),(19,4),(14,6),(5,5)]]
for s in sales:
 mapping=next((m for m in mappings if m['outfitId']==s['productId']),None)
 if mapping and int(s['id'][4:])%3==0:s.update(dupattaAttached=True,matchingStatus='with',matchingDupattaId=mapping['dupattaId'])
# Sparse unknown pricing record proves reports don't substitute product MRP.
sales[-1]['netValue']=None
names=['Store shortage with HO supply','HO size stockout','Rotation donor excess','Regional fabric preferences','Selling price and size mix','Store slow sellers','Ecommerce dead stock','Ten-day sales decline','Seven-day sales spike','Seasonal demand projection','Replenishment lead time','Fast-seller stockout','Peak size-pack rationalisation','Broken options and freshness','Matching dupatta shortage']
scenarios=[{'question':i+1,'name':name,'productId':['P001','P003','P001','P004','P009','P007','P014','P005','P003','P011','P001','P003','P009','P005','P001'][i]} for i,name in enumerate(names)]
events=[{'id':'E1','name':'Festive shopping window','start':'2026-10-01','end':'2026-10-20','kind':'Demo seasonal window','multiplier':1.25},{'id':'E2','name':'Wedding season edit','start':'2026-11-01','end':'2026-12-15','kind':'Demo seasonal window','multiplier':1.35},{'id':'E3','name':'Summer preview','start':'2026-03-01','end':'2026-03-20','kind':'Demo seasonal window','multiplier':1.1}]
events += [{'id':'EH2024','name':'Autumn festive shopping','start':'2024-10-06','end':'2024-11-15','kind':'Demo seasonal window','multiplier':1.25},{'id':'EH2025','name':'Autumn festive shopping','start':'2025-09-25','end':'2025-10-25','kind':'Demo seasonal window','multiplier':1.25}]
for year,festival_day,source in [(2024,'2024-10-31','https://cbcindia.gov.in/wp-content/uploads/vbsy_material/national/calendar/cal_2024.pdf'),(2025,'2025-10-20','https://www.drikpanchang.com/hindu-festivals/diwali/diwali.html'),(2026,'2026-11-08','https://www.drikpanchang.com/hindu-festivals/diwali/diwali.html')]:
 events.append({'id':f'DIWALI{year}','name':f'Diwali {year}','start':festival_day,'end':festival_day,'kind':'Referenced festival date','multiplier':1,'sourceUrl':source,'note':'Source reference; regional observance may differ. Demand multipliers are simulated separately.'})
influencers=[{'id':'I1','name':'Anaya Kapoor','type':'Creator','productId':'P003','date':'2026-09-29','channel':'Instagram','note':'Fictional activity; association does not establish causation'},{'id':'I2','name':'Meera Sethi','type':'Stylist','productId':'P009','date':'2026-10-02','channel':'Editorial','note':'Fictional activity; association does not establish causation'}]
influencers += [{'id':'IH2024','name':'Anaya Kapoor','type':'Creator','productId':'P001','date':'2024-10-15','channel':'Instagram','note':'Fictional historical activity'},{'id':'IH2025','name':'Meera Sethi','type':'Stylist','productId':'P007','date':'2025-04-15','channel':'Editorial','note':'Fictional historical activity'}]
# Creator observations for every catalogue product make product drilldowns useful.
# These are explicitly fictional and do not assert a campaign or causal effect.
for p in products:
 influencers.append({'id':'ICOV-'+p['id'],'name':'Demo creator '+p['id'],'type':'Creator','productId':p['id'],'date':'2026-10-04','channel':'Instagram','note':'Fictional demo observation; association does not establish causation'})
forecasts=[];size_forecasts=[]
for p in products:
 base=sum(s['quantity'] for s in sales if s['productId']==p['id'] and s['date']>='2026-09-08')/28
 weights=[sum(s['quantity'] for s in sales if s['variantId']==p['id']+'-'+size and s['date']>='2026-09-08') for size in p['sizes']]
 for month,days,factor in [('2026-11',30,1.35),('2026-12',31,1.35),('2027-01',31,1.0)]:
  forecasts.append({'productId':p['id'],'month':month,'units':round(base*days*factor),'factor':factor,'method':'Precomputed demo baseline · 28-day sales × calendar days × seasonal factor'})
  total=round(base*days*factor);raw=[total*w/sum(weights) if sum(weights) else 0 for w in weights];alloc=[int(w) for w in raw]
  for idx in sorted(range(len(raw)),key=lambda idx:raw[idx]-alloc[idx],reverse=True)[:total-sum(alloc)]:alloc[idx]+=1
  for size,units in zip(p['sizes'],alloc):size_forecasts.append({'productId':p['id'],'variantId':p['id']+'-'+size,'size':size,'month':month,'units':units,'factor':factor,'method':'Precomputed network projection apportioned by recent observed size mix'})
out={'asOf':AS_OF.isoformat(),'historyStart':START.isoformat(),'products':products,'variants':variants,'locations':locations,'bins':bins,'openingInventory':opening,'movements':movements,'sales':sales,'transfers':transfers,'balances':balances,'reservations':reservations,'matchingRelationships':mappings,'events':events,'influencers':influencers,'forecasts':forecasts,'sizeForecasts':size_forecasts,'scenarios':scenarios,'metadata':{'synthetic':True,'currency':'INR','timezone':'Asia/Kolkata','historicalGranularity':'Monthly older history; daily most recent 90 days','forecastStatus':'precomputed'}}
(ROOT/'data/mock-data.json').write_text(json.dumps(out,separators=(',',':')))
(ROOT/'public/mock-data.json').write_text(json.dumps(out,separators=(',',':')))
(ROOT/'data/image-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
inputs={'product-master':products,'opening-ho':[m for m in opening if m['locationId']=='HO'],'opening-stores':[m for m in opening if m['locationId']!='HO'],'ho-additions':[m for m in movements if m['locationId']=='HO' and m['quantity']>0],'ho-reductions':[m for m in movements if m['locationId']=='HO' and m['quantity']<0],'ecommerce-sales':[s for s in sales if s['channel']=='Ecommerce'],'store-sales':[s for s in sales if s['channel']=='Store'],'influencer-activity':influencers,'event-calendar':events,'bin-data':bins,'store-transit':transfers}
(ROOT/'data/inputs').mkdir(exist_ok=True)
for name,rows in inputs.items():(ROOT/'data/inputs'/f'{name}.json').write_text(json.dumps(rows,separators=(',',':')))
print(f"Generated {len(products)} products, {len(variants)} variants, {len(sales)} sales, {len(movements)} movements; balances reconcile.")
