"""Preserve the supplied workbook's XML layout; remove recorded operational inputs."""
import sys, zipfile, re
from pathlib import Path
from xml.etree import ElementTree as ET
NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
ET.register_namespace('',NS)
tag=lambda x:'{'+NS+'}'+x
source,target=map(Path,sys.argv[1:3])
with zipfile.ZipFile(source) as archive:
    files={n:archive.read(n) for n in archive.namelist()}
strings=ET.fromstring(files['xl/sharedStrings.xml'])
lookup=[''.join(n.itertext()) for n in strings]
def value(c):
    v=c.find(tag('v'))
    return lookup[int(v.text)] if c.get('t')=='s' and v is not None else ''
for number in range(1,5):
    name=f'xl/worksheets/sheet{number}.xml'
    root=ET.fromstring(files[name])
    for row in root.findall('.//'+tag('row')):
        ri=int(row.get('r'))
        cells=row.findall(tag('c'))
        label=next((value(c).strip() for c in cells if re.match(r'^B\d+$',c.get('r',''))),'')
        for c in cells:
            col=re.sub(r'\d','',c.get('r'))
            clear=False
            if number<=2:
                if ri==2: clear=True
                elif col not in ('A','B'):
                    # Keep date headers and formulas, clear shifts and daily recorded values.
                    raw=c.find(tag('v'))
                    is_date=c.get('t') not in ('s','str','e','b') and raw is not None and re.fullmatch(r'\d+(?:\.\d+)?',raw.text or '') and 40000<float(raw.text)<80000
                    clear=not is_date
            else:
                clear=ri>=5 and col!='A'
            if c.find(tag('f')) is not None:
                v=c.find(tag('v'))
                if v is not None:c.remove(v)
            elif clear:
                for child in list(c):c.remove(child)
                c.attrib.pop('t',None)
    files[name]=ET.tostring(root,encoding='utf-8',xml_declaration=True)
# Remove orphaned original shared strings, so blanking cells does not retain source data.
used={}
for name,content in list(files.items()):
    if re.match(r'xl/worksheets/sheet\d+\.xml$',name):
        root=ET.fromstring(content)
        for c in root.iter(tag('c')):
            if c.get('t')=='s':
                v=c.find(tag('v'))
                if v is not None:
                    old=int(v.text)
                    if old not in used:used[old]=len(used)
                    v.text=str(used[old])
        files[name]=ET.tostring(root,encoding='utf-8',xml_declaration=True)
new=ET.Element(tag('sst'),{'count':str(len(used)),'uniqueCount':str(len(used))})
for old in used:new.append(strings[old])
files['xl/sharedStrings.xml']=ET.tostring(new,encoding='utf-8',xml_declaration=True)
for name in list(files):
    if name.startswith('xl/comments'):
        root=ET.fromstring(files[name])
        for child in root:child.clear()
        files[name]=ET.tostring(root,encoding='utf-8',xml_declaration=True)
    if name=='docProps/core.xml':
        root=ET.fromstring(files[name])
        for child in root:
            if child.tag.split('}')[-1] in ('creator','lastModifiedBy','description','title','subject','keywords'):child.text=''
        files[name]=ET.tostring(root,encoding='utf-8',xml_declaration=True)
target.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as out:
    for name,content in files.items():out.writestr(name,content)
print('Created input template with four original worksheets')
