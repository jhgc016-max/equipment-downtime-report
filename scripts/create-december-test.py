import zipfile,copy,re
from pathlib import Path
from xml.etree import ElementTree as E
from datetime import date
N='http://schemas.openxmlformats.org/spreadsheetml/2006/main';E.register_namespace('',N)
t=lambda s:'{'+N+'}'+s
source=Path('public/templates/equipment-operation-template.xlsx')
with zipfile.ZipFile(source) as z:files={n:z.read(n) for n in z.namelist()}
ss=E.fromstring(files['xl/sharedStrings.xml']);strings=[''.join(e.itertext()) for e in ss]
for e in ss.iter(t('t')):
 if e.text:e.text=e.text.replace('11월','12월')
files['xl/sharedStrings.xml']=E.tostring(ss,encoding='utf-8',xml_declaration=True)
for sn in (1,2):
 name=f'xl/worksheets/sheet{sn}.xml';root=E.fromstring(files[name]);rows={int(r.get('r')):r for r in root.iter(t('row'))}
 def label(r):
  c=next((c for c in r if c.get('r')=='B'+r.get('r')),None)
  if c is None:return ''
  v=c.find(t('v'));return strings[int(v.text)].strip() if c.get('t')=='s' and v is not None else ''
 def put(r,col,value,string=False):
  ref=col+str(r);row=rows[r];c=next((c for c in row if c.get('r')==ref),None)
  if c is None:
   c=E.SubElement(row,t('c'),{'r':ref})
   sibling=next((c for c in row if c.get('r')=='AF'+str(r)),None)
   if sibling is not None and sibling.get('s'):c.set('s',sibling.get('s'))
  for child in list(c):c.remove(child)
  c.attrib.pop('t',None)
  if string:c.set('t','inlineStr');E.SubElement(E.SubElement(c,t('is')),t('t')).text=str(value)
  else:E.SubElement(c,t('v')).text=str(value)
 headers=[]
 for rn,row in rows.items():
  c=next((c for c in row if c.get('r')=='C'+str(rn)),None)
  if c is not None and c.find(t('v')) is not None and c.get('t') not in ('s','str'):
   try:
    if 40000<float(c.find(t('v')).text)<80000:headers.append(rn)
   except ValueError:pass
 headers=[rn for rn in rows if (rn==4 or rn>=16 and (rn-16)%11==0) and label(rows[rn]) and rn+8 in rows]
 count=len(headers)-1
 for rn in headers:
  factor=count if '종합' in label(rows[rn]) else 1
  for day in range(1,32):
   idx=day+2;col=''
   while idx:idx,rem=divmod(idx-1,26);col=chr(65+rem)+col
   put(rn,col,(date(2026,12,day)-date(1899,12,30)).days)
   for off in range(1,9):
    rr=rn+off;lab=label(rows[rr]).replace(' ','')
    if '계획' in lab and ('잔업' in lab):put(rr,col,'주간',True)
    elif lab in ('계획시간','총보유시간') or lab.startswith('주간') or lab=='가동시간':put(rr,col,480*factor)
    elif lab.startswith('야간') or '비가동시간' in lab:put(rr,col,0)
    elif '가동률' in lab:put(rr,col,1)
 for f in root.iter(t('f')):
  if f.text:f.text=re.sub(r'\bAF(?=\d)', 'AG',f.text)
 files[name]=E.tostring(root,encoding='utf-8',xml_declaration=True)
out=Path('public/templates/december-test-operation.xlsx')
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for n,b in files.items():z.writestr(n,b)
print('Created December 1-31 test workbook: 8 hours per equipment per day, zero downtime')
