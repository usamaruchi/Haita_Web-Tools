(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'haita-tools-v1';
  const categories = window.CATEGORIES;
  let seenSeedIds = window.SEED_TOOLS.map(t => t.id);
  let tools = structuredClone(window.SEED_TOOLS), category = 'all', onlyFavorites = false, toastTimer;
  const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validUrl = value => { try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; } };
  function validate(records) {
    if (!Array.isArray(records) || records.length > 5000) throw new Error('備份必須是工具陣列，且不超過 5,000 筆。');
    const ids = new Set();
    return records.map(t => {
      if (!t || typeof t.id !== 'string' || !t.id || ids.has(t.id) || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 100 || typeof t.url !== 'string' || t.url.length > 2000 || !validUrl(t.url) || !categories.some(c => c[0] === t.category) || typeof t.description !== 'string' || t.description.length > 1000 || !Array.isArray(t.tags) || t.tags.length > 20 || t.tags.some(s => typeof s !== 'string' || s.length > 100)) throw new Error('備份中有無效或重複的工具資料，未匯入任何內容。');
      ids.add(t.id);
      return {id:t.id,name:t.name.trim(),url:t.url,category:t.category,description:t.description,tags:t.tags,favorite:t.favorite === true,createdAt:Number.isFinite(t.createdAt)?t.createdAt:Date.now()};
    });
  }
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4500); }
  function snapshot(records, seen = seenSeedIds) {
    return {version:2,tools:records,seedCatalogIds:[...new Set([...seen,...window.SEED_TOOLS.map(t=>t.id)])]};
  }
  function readCollection(parsed) {
    const legacy = Array.isArray(parsed);
    if (!legacy && (!parsed || ![1,2].includes(parsed.version))) throw new Error('不支援此備份版本。');
    const records = validate(legacy ? parsed : parsed.tools);
    let seen;
    if (!legacy && parsed.version === 2) {
      if (!Array.isArray(parsed.seedCatalogIds) || parsed.seedCatalogIds.length > 10000 || parsed.seedCatalogIds.some(id=>typeof id!=='string'||id.length>200)) throw new Error('備份的收藏版本資訊無效。');
      seen = new Set(parsed.seedCatalogIds);
    } else {
      // The original 34 entries are considered delivered even when a user deleted them.
      seen = new Set(window.SEED_TOOLS.slice(0,34).map(t=>t.id));
    }
    records.forEach(t=>seen.add(t.id));
    const urlKey = value => { const u=new URL(value);u.hash='';return u.href.replace(/\/$/,''); };
    const urls = new Set(records.map(t=>urlKey(t.url)));
    const names = new Set(records.map(t=>t.name.toLocaleLowerCase()));
    for (const seed of window.SEED_TOOLS) {
      if (!seen.has(seed.id) && !urls.has(urlKey(seed.url)) && !names.has(seed.name.toLocaleLowerCase())) {
        records.push(structuredClone(seed));urls.add(urlKey(seed.url));names.add(seed.name.toLocaleLowerCase());
      }
      seen.add(seed.id);
    }
    return {tools:records,seedCatalogIds:[...seen]};
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) { const collection=readCollection(JSON.parse(saved));tools=collection.tools;seenSeedIds=collection.seedCatalogIds; }
    localStorage.setItem(KEY,JSON.stringify(snapshot(tools)));
  } catch { setTimeout(() => toast('無法讀取或儲存本機收藏，請檢查瀏覽器儲存設定或備份。'),0); }
  function commit(next, seen = seenSeedIds) {
    try { localStorage.setItem(KEY, JSON.stringify(snapshot(next,seen))); } catch { toast('儲存失敗，變更尚未套用。請允許瀏覽器儲存資料或先匯出備份。'); return false; }
    tools = next; seenSeedIds = seen; render(); return true;
  }
  function render() {
    $('total').textContent = tools.length; $('side-count').textContent = tools.length;
    $('category-total').textContent = new Set(tools.map(t => t.category)).size;
    $('nav-category-total').textContent = categories.length;
    $('favorite-count').textContent = tools.filter(t => t.favorite).length;
    $('all').classList.toggle('active',category === 'all' && !onlyFavorites);
    $('favorites').classList.toggle('active',onlyFavorites);
    $('categories').innerHTML = categories.map(c => `<button class="category ${category === c[0]?'active':''}" data-category="${c[0]}" style="--cat-color:${c[3]}"><span>${c[2]}</span>${c[1]}<b>${tools.filter(t=>t.category===c[0]).length}</b></button>`).join('');
    $('chips').innerHTML = [['all','全部'],...categories].map(c => `<button class="chip ${category===c[0]?'active':''}" aria-pressed="${category===c[0]}" data-category="${c[0]}">${c[1]}</button>`).join('');
    const q = $('search').value.trim().toLocaleLowerCase();
    let result = tools.filter(t => (category === 'all' || t.category === category) && (!onlyFavorites || t.favorite) && (!q || [t.name,t.description,t.url,...t.tags,categories.find(c=>c[0]===t.category)[1]].join(' ').toLocaleLowerCase().includes(q)));
    if ($('sort').value === 'name') result.sort((a,b)=>a.name.localeCompare(b.name,'en'));
    if ($('sort').value === 'newest') result.sort((a,b)=>b.createdAt-a.createdAt);
    $('view-title').textContent = (onlyFavorites?'我的最愛':'') + (category!=='all'?(onlyFavorites?' · ':'')+categories.find(c=>c[0]===category)[1]:onlyFavorites?'':'所有工具');
    $('result-count').textContent = `${result.length} 個工具`;
    $('empty').hidden = result.length > 0;
    $('grid').innerHTML = result.map(t => {
      const c = categories.find(c=>c[0]===t.category);
      const initials = t.name === 'Ionicons'?'◎':t.name === 'Flowbite'?'◐':t.name === 'Three.js'?'△':t.name === 'Swiper'?'S':t.name.slice(0,2);
      return `<article class="card" style="--cat-color:${c[3]};--tint:${c[3]}13"><div class="card-top"><span class="tool-icon" aria-hidden="true">${esc(initials)}</span><div class="card-title"><h3>${esc(t.name)}</h3><span class="domain">${esc(new URL(t.url).hostname.replace(/^www\./,''))}</span></div><button class="favorite ${t.favorite?'selected':''}" data-action="favorite" data-id="${esc(t.id)}" aria-label="${t.favorite?'取消最愛':'加入最愛'}：${esc(t.name)}" aria-pressed="${t.favorite}">${t.favorite?'★':'☆'}</button></div><p class="description">${esc(t.description)}</p><div class="tags"><span class="tag">${esc(c[1].split('與')[0])}</span>${t.tags.map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}</div><div class="card-bottom"><div class="card-actions"><button class="edit" data-action="edit" data-id="${esc(t.id)}">編輯</button><a class="visit" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" aria-label="開啟 ${esc(t.name)} 網站（新分頁）">開啟網站 ↗</a></div></div></article>`;
    }).join('');
  }
  function setCategory(value) { category = value; render(); }
  $('categories').addEventListener('click',e=>{ const b=e.target.closest('[data-category]');if(b)setCategory(b.dataset.category); });
  $('chips').addEventListener('click',e=>{ const b=e.target.closest('[data-category]');if(b)setCategory(b.dataset.category); });
  $('all').onclick = () => { onlyFavorites=false;category='all';render(); };
  $('favorites').onclick = () => { onlyFavorites=!onlyFavorites;category='all';render(); };
  $('search').oninput = render; $('sort').onchange = render;
  $('clear').onclick = () => { category='all';onlyFavorites=false;$('search').value='';render(); };
  $('grid').addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b)return;
    const t=tools.find(t=>t.id===b.dataset.id);if(!t)return;
    if(b.dataset.action==='favorite')commit(tools.map(x=>x.id===t.id?{...x,favorite:!x.favorite}:x));
    if(b.dataset.action==='edit')openEditor(t);
  });
  $('tool-category').innerHTML = categories.map(c=>`<option value="${c[0]}">${c[1]}</option>`).join('');
  function openEditor(t) {
    $('tool-form').reset();$('tool-id').value=t?.id||'';$('dialog-title').textContent=t?'編輯工具':'新增工具';$('delete-tool').hidden=!t;
    if(t){for(const key of ['name','url','category','description'])$('tool-'+key).value=t[key];$('tool-tags').value=t.tags.join(', ');$('tool-favorite').checked=t.favorite;}
    else if(category!=='all')$('tool-category').value=category;
    $('editor').showModal();$('tool-name').focus();
  }
  $('add').onclick=()=>openEditor();
  $('close-editor').onclick=$('cancel').onclick=()=>$('editor').close();
  $('tool-form').onsubmit=e=>{
    e.preventDefault();const url=$('tool-url').value.trim();if(!validUrl(url)){toast('請輸入有效的 http 或 https 網址。');return;}
    const name=$('tool-name').value.trim(),description=$('tool-description').value.trim();if(!name||!description){toast('請填寫名稱與功能簡介。');return;}
    const id=$('tool-id').value;const existing=tools.find(t=>t.id===id);
    const tags=$('tool-tags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean);if(tags.length>20||tags.some(t=>t.length>100)){toast('標籤最多 20 個，每個最多 100 字。');return;}
    const next={id:id||('tool-'+(globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2))),name,url,description,category:$('tool-category').value,tags,favorite:$('tool-favorite').checked,createdAt:existing?.createdAt??Date.now()};
    if(commit(existing?tools.map(t=>t.id===id?next:t):[...tools,next])){$('editor').close();toast(existing?'工具已更新':'已加入工具收藏');}
  };
  function confirmAction(title,message,action){$('confirm-title').textContent=title;$('confirm-text').textContent=message;$('confirm-ok').onclick=()=>{$('confirm-dialog').close();action();};$('confirm-dialog').showModal();}
  $('confirm-cancel').onclick=()=>$('confirm-dialog').close();
  $('delete-tool').onclick=()=>{const id=$('tool-id').value;const t=tools.find(t=>t.id===id);confirmAction('刪除工具',`確定要刪除「${t.name}」嗎？此操作無法復原。`,()=>{if(commit(tools.filter(t=>t.id!==id))){$('editor').close();toast('已刪除工具');}});};
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify({...snapshot(tools),exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`haita-tools-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已匯出收藏備份');};
  $('import').onclick=()=>$('import-file').click();
  $('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('檔案過大，請使用小於 10 MB 的 JSON 備份。');const incoming=readCollection(JSON.parse(await file.text()));confirmAction('匯入收藏備份',`匯入後共 ${incoming.tools.length} 個工具（舊備份會補上新增的預設資源），將取代目前的 ${tools.length} 個工具。建議先匯出現有收藏備份。`,()=>{if(commit(incoming.tools,incoming.seedCatalogIds)){category='all';onlyFavorites=false;$('search').value='';render();toast('收藏已匯入');}});}catch(error){toast(error instanceof SyntaxError?'無法讀取 JSON，請選擇有效的收藏備份。':error.message);}finally{e.target.value='';}};
  window.addEventListener('storage',e=>{if(e.key===KEY){try{const collection=e.newValue===null?{tools:structuredClone(window.SEED_TOOLS),seedCatalogIds:window.SEED_TOOLS.map(t=>t.id)}:readCollection(JSON.parse(e.newValue));tools=collection.tools;seenSeedIds=collection.seedCatalogIds;render();toast('已同步其他分頁的收藏變更');}catch{toast('另一個分頁的資料無效，未套用變更。');}}});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$('search').focus();}});
  render();
})();
