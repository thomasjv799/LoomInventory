"""Generate the implemented HTTP adapter contract; native Convex validators remain authoritative."""
import json
from pathlib import Path
S={'type':'string'}
ID={'type':'string','description':'Opaque Convex document ID. externalId is the source/business identifier.'}
DATE={'type':'string','format':'date'}
Q={'type':'integer','minimum':1,'maximum':9007199254740991}
M={'type':['integer','null'],'minimum':0,'maximum':9007199254740991}

def obj(props,optional=()):
 return {'type':'object','properties':props,'required':[k for k in props if k not in optional],'additionalProperties':False}
schemas={
 'Image':obj({'url':{'type':'string','format':'uri'},'sourceProductUrl':{'type':'string','format':'uri'},'alt':S,'width':Q,'height':Q}),
 'ProductInput':obj({**{k:S for k in ['sku','name','category','color','fabric','craft','style','collection','season']},'kurtaLength':{'type':'number'},'launchDate':DATE,'costMinor':{**Q,'minimum':0},'suggestedMrpMinor':{**Q,'minimum':0},'sizes':{'type':'array','minItems':1,'maxItems':12,'uniqueItems':True,'items':{'type':'string','enum':['XS','S','M','L','XL','XXL','3XL','Free size']}},'images':{'type':'array','maxItems':4,'items':{'$ref':'#/components/schemas/Image'}}}),
 'Settings':obj({**{k:{'type':'number'} for k in ['cover','peakCover','minimum','deadDays','spike','drop','fast','slow','hit','average','freshDays']},'peak':{'type':'boolean'},'coreSizes':{'type':'array','items':S}}),
 'Filters':obj({**{k:S for k in ['location','q','category','size','fabric','color','craft','status']},'channel':{'type':'string','enum':['Ecommerce','Store']},'from':DATE,'to':DATE},['location','q','category','size','fabric','color','craft','status','channel','from','to']),
 'Error':obj({'error':obj({'code':S,'message':S,'requestId':S},['requestId'])}),
 'Envelope':obj({'data':{},'meta':obj({'requestId':S,'currency':{'const':'INR'},'timezone':{'const':'Asia/Kolkata'}})}),
}
paths={}
errors={'401':'Authentication required','403':'Membership or capability denied','404':'Resource not found','409':'Conflict, stale version or insufficient stock','422':'Invalid input','500':'Internal error'}
def route(path,method,summary,body=None,query=None,description=''):
 operation={'operationId':method+'_'+path.strip('/').replace('/','_').replace('{','').replace('}',''),'summary':summary,'description':description,'responses':{'200':{'description':'Success. Report states may be pending, ready, failed or stale.','content':{'application/json':{'schema':{'$ref':'#/components/schemas/Envelope'}}}},**{n:{'description':d,'content':{'application/json':{'schema':{'$ref':'#/components/schemas/Error'}}}} for n,d in errors.items()}}}
 parameters=[]
 for item in path.split('/'):
  if item.startswith('{'):parameters.append({'name':item[1:-1],'in':'path','required':True,'schema':ID})
 for k,v in (query or {}).items():parameters.append({'name':k,'in':'query','required':k in ['organizationId','locationId','variantId','runId'],'schema':v})
 if parameters:operation['parameters']=parameters
 if body:operation['requestBody']={'required':True,'content':{'application/json':{'schema':body}}}
 paths.setdefault(path,{})[method]=operation
org={'organizationId':ID};key={'idempotencyKey':{'type':'string','minLength':1,'maxLength':128}}
paging={**org,'cursor':S,'limit':{'type':'integer','minimum':1,'maximum':100,'default':25}}
for endpoint in ['me','organizations']:route('/'+endpoint,'get','Read signed-in identity and active memberships')
route('/locations','get','List permitted locations',query=org)
route('/products','get','Paginate catalogue; costs are capability-redacted',query=paging)
route('/products/{productId}','get','Read attributes, images and scoped stock',query=org)
route('/products','post','Create a style and variants with zero stock',obj({**org,'input':{'$ref':'#/components/schemas/ProductInput'},**key}))
route('/products/{productId}','patch','Update attributes and images with optimistic version',obj({**org,'input':{'$ref':'#/components/schemas/ProductInput'},'expectedVersion':{'type':'integer','minimum':1},**key}))
route('/products/{productId}/archive','post','Archive a style; retain historical stock and sales',obj({**org,'expectedVersion':{'type':'integer','minimum':1},**key}))
route('/inventory','get','Paginate bin balances at a permitted location',query={**paging,'locationId':ID})
route('/movements','get','Paginate immutable movement history',query={**paging,'locationId':ID,'variantId':ID,'from':DATE,'to':DATE})
route('/settings','get','Read persisted thresholds and version',query=org)
route('/settings','post','Save administrator settings',obj({**org,'values':{'$ref':'#/components/schemas/Settings'},'expectedVersion':{'type':'integer','minimum':0},**key}))
route('/reports/{reportName}','post','Prepare an authorized report snapshot',obj({**org,'filters':{'$ref':'#/components/schemas/Filters'},'sort':S,'direction':{'enum':['asc','desc']},'layout':{'enum':['table','matrix']}},['sort','direction','layout']),description='Names: overview, inventory, stores, rotation, sales, replenishment, ho-shortages, slow-stock, size-packs, forecasts, events, dupatta. Network reports require networkRead and all location grants. Store filters use external location IDs. History is capped at 50,000 rows; projections are precomputed demo values.')
route('/reports/{runId}','get','Read one page from a ready snapshot',query=paging,description='Never mix cursors across run IDs. Changed data/settings returns stale. Narrowed grants/revoked membership deny access.')
route('/exports','get','Read an authorized CSV continuation chunk',query={**org,'runId':ID,'cursor':S},description='JSON data contains csv, nextCursor and requestId. Concatenate chunks from the same run; only the first chunk has a BOM/header. Maximum 100 report rows per chunk. Formula cells are escaped.')
route('/memberships','post','Administer explicit role and store grants',obj({**org,'authUserId':S,'role':{'enum':['viewer','merchandiser','operator','administrator']},'allowedLocationIds':{'type':'array','items':ID},'active':{'type':'boolean'},'costRead':{'type':'boolean'},'networkRead':{'type':'boolean'},**key}))
base={**org,'variantId':ID,'locationId':ID,'binId':ID,'date':DATE,'quantity':Q,**key}
for endpoint,title in [('receipts','Receive production stock'),('returns','Receive a quarantined return'),('qc-release','Release quarantine after inspection')]:route('/stock/'+endpoint,'post',title,obj(base))
route('/stock/sales','post','Record financial line and deduct stock once',obj({**base,'transactionMrpMinor':M,'netValueMinor':M,'channel':{'enum':['Ecommerce','Store']}}),description='transactionMrpMinor is per unit; netValueMinor is the entire line actual net value. Both may be null. Suggested MRP is never substituted.')
route('/stock/dispatch','post','Dispatch centrally owned stock to a permitted destination',obj({**base,'destinationId':ID,'eta':DATE}))
route('/stock/transfer-receipts','post','Receive part or all of a transfer',obj({**org,'transferId':ID,'binId':ID,'date':DATE,'quantity':Q,**key}))
route('/stock/bin-moves','post','Move physical stock between bins at one location',obj({**base,'destinationBinId':ID,'condition':{'enum':['sellable','quarantine']}}))
route('/imports','post','Stage a complete normalized snapshot',obj({**org,'sourceHash':S,'asOf':DATE,'cutoff':DATE,'expectedCounts':{'type':'object','additionalProperties':{'type':'integer','minimum':0}},'inputTypes':{'type':'array','items':S},**key}),description='All eleven logical input types are declared. Transport is the normalized JSONL contract, not arbitrary spreadsheet files. Opening cutoff required. Complete package and references validated before publication.')
route('/imports/{batchId}/chunks','post','Stage an idempotent normalized chunk',obj({**org,'table':S,'chunkKey':S,'rows':{'type':'string','description':'JSON-encoded array, maximum 100 rows / 256 KiB'}}))
for endpoint in ['validate','commit']:route('/imports/{batchId}/'+endpoint,'post',endpoint.capitalize()+' asynchronously',obj(org))
route('/imports/{batchId}','get','Read batch progress and rejection summary',query=org)
route('/imports/{batchId}/rejects','get','Paginate rejected chunk diagnostics',query={**org,'cursor':S})
contract={'openapi':'3.1.0','info':{'title':'Inventory Studio implemented Convex HTTP API','version':'0.1.0','description':'Prototype API. All demo business data is synthetic. Native Convex validators are the runtime authority. Document IDs scope API records; source external IDs remain preserved. No public bootstrap or seed endpoint.'},'servers':[{'url':'/api/v1','description':'Same-origin Next.js session proxy'}, {'url':'https://YOUR-DEPLOYMENT.convex.site/api/v1','description':'Configured Convex HTTP actions; valid bearer token required'}],'security':[{'bearerAuth':[]},{'sessionCookie':[]}],'paths':paths,'components':{'securitySchemes':{'bearerAuth':{'type':'http','scheme':'bearer'},'sessionCookie':{'type':'apiKey','in':'cookie','name':'better-auth.session_token','description':'Official Better Auth cookie; secure cookie prefix may apply. Next.js exchanges session for caller token.'}},'schemas':schemas}}
Path('docs/api/convex-openapi.json').write_text(json.dumps(contract,indent=2)+'\n')
print(f'Wrote {len(paths)} implemented API paths')
