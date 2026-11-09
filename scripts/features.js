/* Injected inside the original TableCraft closure by apply_upgrade.py. */
function normalizeProject(input) {
  if (!input || !Array.isArray(input.rows) || !Array.isArray(input.columns)) throw new Error('缺少 rows 或 columns');
  if (!input.rows.length || input.rows.length > 2000 || !input.columns.length || input.columns.length > 50) throw new Error('限 1–2000 列、1–50 欄');
  const p = createDemoProject(), v = input.style || {}, exp = input.exportConfig || {};
  const pick = (v, a, d) => a.includes(v) ? v : d;
  const num = (v, a, b, d) => Number.isFinite(Number(v)) ? Math.max(a,Math.min(b,Number(v))) : d;
  const text = (v, n=10000) => String(v ?? '').slice(0,n);
  p.id = /^proj_[a-z0-9_-]+$/i.test(input.id || '') ? input.id : 'proj_'+generateStableId('import');
  p.tableUid = /^wmt-tc-[a-z0-9]+$/.test(input.tableUid || '') ? input.tableUid : generateStableId('wmt-tc');
  p.name = text(input.name || '匯入專案',80);
  p.headerMode = pick(input.headerMode,['firstRow','none'],'firstRow');
  p.rowHeaderScope = input.rowHeaderScope === true;
  p.columns = input.columns.map((c,i) => {
    c = c || {};
    return createDefaultColumnMeta(i,{
      type:pick(c.type,['text','number','currency','percent','date','url','email','status'],'text'),
      align:pick(c.align,['auto','left','center','right'],'auto'),
      currency:pick(c.currency,['NT$','$','€','¥',''],'NT$'),
      decimals:Math.round(num(c.decimals,0,20,0)),
      dateFormat:pick(c.dateFormat,['YYYY-MM-DD','YYYY/MM/DD','TW'],'YYYY-MM-DD'),
      rwdPriority:pick(c.rwdPriority,['primary','secondary'],'primary'),
      specialRole:pick(c.specialRole,['none','featured','price','highlight'],'none'),
      badgeText:text(c.badgeText || '重點',80)
    });
  });
  if(p.columns.every(c=>c.rwdPriority==='secondary')) p.columns[0].rwdPriority='primary';
  p.rows = input.rows.map(r=>{
    if(!Array.isArray(r)) throw new Error('資料列必須為陣列');
    return p.columns.map((_,i)=>text(r[i]));
  });
  for(const k of ['headerBg','headerText','bodyBg','bodyText','stripeBg','hoverBg','borderColor','accentColor']) {
    if(/^#[a-f0-9]{6}$/i.test(v[k] || '')) p.style[k]=v[k];
  }
  for(const k of ['zebra','hover','verticalBorder','firstColBold','statusSvgIcon']) if(typeof v[k]==='boolean') p.style[k]=v[k];
  for(const [k,a,b] of [['fontSize',12,24],['borderWidth',0,4],['borderRadius',0,20],['rwdBreakpoint',360,1024],['rwdMinWidth',320,1600]]) p.style[k]=num(v[k],a,b,p.style[k]);
  const enums={preset:Object.keys(STYLE_PRESETS),fontFamily:['sans','noto','arial','serif'],lineHeight:['1.4','1.6','1.8'],textWrap:['wrap','nowrap','ellipsis'],tableWidth:['100%','auto'],cellPadding:['8px 10px','12px 16px','16px 20px'],rwdMode:['scroll','stack','priority'],emptyCellMode:['blank','dash','na','custom']};
  for(const k in enums) p.style[k]=pick(String(v[k]),enums[k],p.style[k]);
  for(const k of ['caption','summary','footnote','emptyCellCustom']) p.style[k]=text(v[k] ?? p.style[k],2000);
  p.exportConfig.mode=pick(exp.mode,['wp','inline','standalone','interactive'],'wp');
  for(const k of ['csvFormulaSafe','interSearch','interSort','interPage']) p.exportConfig[k]=exp[k] !== false;
  p.exportConfig.interPageSize=pick(Number(exp.interPageSize),[5,10,25,50],10);
  return p;
}
function bindUpgradeFeatures() {
  const header=document.querySelector('.app-header');
  const measure=()=>document.documentElement.style.setProperty('--header-h',header.getBoundingClientRect().height+'px');
  if(window.ResizeObserver) new ResizeObserver(measure).observe(header);
  window.addEventListener('resize',measure);measure();
  const bar=document.createElement('div');bar.className='form-row';
  document.getElementById('exportCardSection').appendChild(bar);
  function button(label,handler) {
    const b=document.createElement('button');b.type='button';b.className='btn-secondary btn-sm';b.textContent=label;b.addEventListener('click',handler);bar.appendChild(b);
  }
  function download(content,ext,type) {
    const p=getActiveProject(),a=document.createElement('a');
    const url=URL.createObjectURL(new Blob([content],{type}));
    a.href=url;a.download=(p.name || 'tablecraft').replace(/[\\/:*?"<>|]/g,'_')+'.'+ext;
    document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},1000);
  }
  button('下載 Markdown',()=>{
    const p=getActiveProject();
    const escape=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>');
    const rows=p.rows.map(r=>r.map(escape));
    if(p.headerMode==='none') rows.unshift(p.columns.map((_,i)=>'欄位 '+(i+1)));
    rows.splice(1,0,p.columns.map(()=> '---'));
    download(rows.map(r=>'| '+r.join(' | ')+' |').join('\n'),'md','text/markdown;charset=utf-8');
  });
  button('下載純資料 JSON',()=>{
    const p=getActiveProject();
    download(JSON.stringify({headers:p.headerMode==='firstRow'?p.rows[0]:null,rows:p.headerMode==='firstRow'?p.rows.slice(1):p.rows},null,2),'json','application/json');
  });
  function clean(transform,label) {
    const p=getActiveProject(),offset=p.headerMode==='firstRow'?1:0;
    p.rows=p.rows.slice(0,offset).concat(transform(p.rows.slice(offset)));
    if(!p.rows.length) p.rows=[p.columns.map(()=> '')];
    App.gridPage=0;pushHistory();renderAll();showToast(label,'success');
  }
  button('移除空白列',()=>clean(rows=>rows.filter(r=>r.some(v=>String(v).trim()!=='')),'已移除空白列'));
  button('移除重複列',()=>clean(rows=>{const seen=new Set();return rows.filter(r=>{const key=JSON.stringify(r);if(seen.has(key))return false;seen.add(key);return true;});},'已移除重複列'));
  button('清除前後空白',()=>{
    const p=getActiveProject();p.rows=p.rows.map(r=>r.map(v=>String(v).trim()));pushHistory();renderAll();showToast('已清除前後空白','success');
  });
  button('檢查表格可讀性',()=>{
    const p=getActiveProject(),messages=[];
    if(!p.style.caption.trim()) messages.push('缺少表格 caption 標題');
    if(p.headerMode!=='firstRow') messages.push('未設定欄位標題列');
    const lum=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[0.2126,0.7152,0.0722][i],0);
    for(const [label,a,b] of [['表頭',p.style.headerBg,p.style.headerText],['內容',p.style.bodyBg,p.style.bodyText],['交錯列',p.style.stripeBg,p.style.bodyText]]) {
      if(!/^#[a-f0-9]{6}$/i.test(a)||!/^#[a-f0-9]{6}$/i.test(b)) continue;
      const x=lum(a),y=lum(b),ratio=(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
      if(ratio<4.5) messages.push(label+'文字對比 '+ratio.toFixed(2)+':1，低於一般文字 4.5:1');
    }
    alert(messages.length?messages.join('\n'):'基礎檢查通過；不代表完整無障礙認證。');
  });
  const modal=document.getElementById('importModal');
  document.addEventListener('keydown',e=>{
    if(!modal.classList.contains('open'))return;
    if(e.key==='Escape'){modal.classList.remove('open');document.getElementById('btnOpenImportModal').focus();}
    if(e.key==='Tab'){
      const f=[...modal.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.getClientRects().length),first=f[0],last=f[f.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
}
