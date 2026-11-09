import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
const root=path.resolve('tool-library/dist');
const server=createServer(async(req,res)=>{try{const file=path.join(root,req.url==='/'?'index.html':req.url.slice(1));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':file.endsWith('.png')?'image/png':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(8891,'127.0.0.1',resolve));
const profile=await mkdtemp(path.join(tmpdir(),'haita-qa-'));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','--remote-debugging-port=9335','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;
try{
 let pages;for(let i=0;i<60;i++){try{pages=await(await fetch('http://127.0.0.1:9335/json')).json();break;}catch{await new Promise(r=>setTimeout(r,200));}}
 if(!pages)throw Error('Chrome did not start');
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,m=>m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result));ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8891/'});
 for(let i=0;i<50;i++){if(await evaluate('document.querySelectorAll(".card").length===71'))break;await new Promise(r=>setTimeout(r,150));}
 const reload = async () => { await send('Page.reload');await new Promise(r=>setTimeout(r,700)); };
 await evaluate(`(()=>{const old=structuredClone(window.SEED_TOOLS.slice(0,34)).filter(t=>t.id!=='seed-1');old[0].favorite=true;old[0].description='My edited description';old[0].rating=3;old.push({id:'my-custom',name:'Custom resource',url:'https://example.com/custom',category:'resources',description:'My own tool',tags:['custom'],favorite:true,createdAt:1000});localStorage.setItem('haita-tools-v1',JSON.stringify(old));})()`);
 await reload();
 const upgrade=await evaluate(`(()=>{const s=JSON.parse(localStorage.getItem('haita-tools-v1'));if(s.version!==2||s.tools.length!==71||s.tools.some(t=>t.id==='seed-1')||!s.tools.some(t=>t.id==='my-custom'&&t.favorite)||!s.tools.some(t=>t.id==='seed-0'&&t.favorite&&t.description==='My edited description')||s.tools.some(t=>'rating'in t))throw Error('Legacy migration lost user data');s.tools=s.tools.filter(t=>t.id!=='seed-34');localStorage.setItem('haita-tools-v1',JSON.stringify(s));return 'Legacy upgrade preserves edits, favorites, deletions and custom tools';})()`);console.log(upgrade);
 await reload();
 await evaluate(`(()=>{const s=JSON.parse(localStorage.getItem('haita-tools-v1'));if(s.tools.length!==70||s.tools.some(t=>t.id==='seed-34'))throw Error('Deleted new seed reappeared');localStorage.removeItem('haita-tools-v1');})()`);console.log('Deleted new resources stay deleted after reload');
 await reload();
 await evaluate(`(()=>{const old=structuredClone(window.SEED_TOOLS.slice(0,68));const seen=old.map(t=>t.id);old[0].favorite=true;old[0].description='Preserved v2 edit';localStorage.setItem('haita-tools-v1',JSON.stringify({version:2,tools:old.filter(t=>t.id!=='seed-1'),seedCatalogIds:seen}));})()`);
 await reload();
 await evaluate(`(()=>{const s=JSON.parse(localStorage.getItem('haita-tools-v1'));if(s.tools.length!==70||s.tools.some(t=>t.id==='seed-1')||!s.tools.some(t=>t.id==='seed-0'&&t.favorite&&t.description==='Preserved v2 edit')||s.tools.filter(t=>Number(t.id.replace('seed-',''))>=68).length!==3)throw Error('v2 update failed');localStorage.removeItem('haita-tools-v1');})()`);console.log('Existing 68-item v2 collection receives all 3 new tools without losing edits or deletions');
 await reload();
 const result=await evaluate(`(async()=>{
 const checks=[];const check=(name,value)=>{if(!value)throw Error(name);checks.push(name);};const $=id=>document.getElementById(id);const count=()=>document.querySelectorAll('.card').length;
 check('71 initial tools',count()===71);check('18 categories',document.querySelectorAll('#categories button').length===18);
 $('search').value='Swiper';$('search').dispatchEvent(new Event('input'));check('search',count()===1&&document.querySelector('h3').textContent==='Swiper');
 $('clear').click();document.querySelector('[data-category="carousel"]').click();check('category filter',count()===5);$('all').click();
 document.querySelector('[data-action="favorite"]').click();$('favorites').click();check('favorites',count()===1);$('all').click();
 $('add').click();$('tool-name').value='QA tool';$('tool-url').value='https://example.com/';$('tool-description').value='QA description';$('tool-form').requestSubmit();check('add tool',count()===72);
 let added=JSON.parse(localStorage.getItem('haita-tools-v1')).tools.find(t=>t.name==='QA tool');check('persistent save',!!added);
 document.querySelector('[data-action="edit"][data-id="'+added.id+'"]').click();$('tool-name').value='QA updated';$('tool-form').requestSubmit();check('edit tool',JSON.parse(localStorage.getItem('haita-tools-v1')).tools.some(t=>t.name==='QA updated'));
 document.querySelector('[data-action="edit"][data-id="'+added.id+'"]').click();$('delete-tool').click();check('delete confirmation',$('confirm-dialog').open);$('confirm-ok').click();check('delete tool',count()===71);
 check('rating controls removed',!$('rated')&&!$('tool-rating')&&!document.querySelector('.rating')&&!document.querySelector('option[value=rating]'));
 check('favorite retained',JSON.parse(localStorage.getItem('haita-tools-v1')).tools.filter(t=>t.favorite).length===1);
 check('new data has no ratings',JSON.parse(localStorage.getItem('haita-tools-v1')).tools.every(t=>!('rating' in t)));
 $('sort').value='name';$('sort').dispatchEvent(new Event('change'));check('sort',document.querySelector('h3').textContent==='Adobe Color');
 $('search').value='no-matching-tool-qa';$('search').dispatchEvent(new Event('input'));check('empty state',!$('empty').hidden);$('clear').click();
 localStorage.removeItem('haita-tools-v1');location.reload();return checks;
 })()`);
 console.log(JSON.stringify(result));await new Promise(r=>setTimeout(r,600));
 const desktop=await send('Page.captureScreenshot',{format:'png'});await writeFile('tool-library-desktop.png',Buffer.from(desktop.data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const overflow=await evaluate('document.documentElement.scrollWidth>window.innerWidth');if(overflow)throw Error('Mobile horizontal overflow');
 const mobile=await send('Page.captureScreenshot',{format:'png'});await writeFile('tool-library-mobile.png',Buffer.from(mobile.data,'base64'));console.log('Desktop and mobile screenshots captured; no mobile overflow.');
}finally{ws?.close();browser.kill();server.close();}
