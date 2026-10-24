/* Browser-contained application window. Never closes the user's browser tab. */
(() => {
 const shell=document.getElementById('desktopWindow'),bar=document.getElementById('windowTitlebar'),normalButton=document.getElementById('windowNormal'),maxButton=document.getElementById('windowMax'),closeButton=document.getElementById('windowClose'),reopen=document.getElementById('windowReopen'),closed=document.getElementById('windowClosed');
 const sizeLabel=document.createElement('span');sizeLabel.className='windowSize';sizeLabel.setAttribute('aria-label','Window size in pixels');bar.insertBefore(sizeLabel,bar.querySelector('.windowControls'));new ResizeObserver(()=>{const r=shell.getBoundingClientRect();sizeLabel.textContent=Math.round(r.width)+' × '+Math.round(r.height);sizeLabel.title='Width × height (px)'}).observe(shell);
 let normalBounds=null,maximized=false,gesture=null;
 const viewport=()=>({w:document.documentElement.clientWidth,h:window.innerHeight});
 const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));
 function minimum(){const {w,h}=viewport();return {w:Math.min(860,w),h:Math.min(540,h)}}
 function draw(bounds){const {w,h}=viewport(),min=minimum();const width=clamp(bounds.width,min.w,w),height=clamp(bounds.height,min.h,h);const rect={left:clamp(bounds.left,0,w-width),top:clamp(bounds.top,0,h-height),width,height};Object.assign(shell.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});shell.dataset.compact=rect.width<1250?'true':'false';shell.dataset.mobile=rect.width<760?'true':'false';return rect}
 function centered(){const {w,h}=viewport();if(w<=1024)return {width:w,height:h,left:0,top:0};const width=Math.min(1150,Math.max(Math.min(860,w),w-64)),height=Math.min(700,Math.max(Math.min(540,h),h-64));return {width,height,left:(w-width)/2,top:(h-height)/2}}
 function normal(){maximized=false;shell.dataset.maximized='false';normalBounds=centered();draw(normalBounds);maxButton.setAttribute('aria-pressed','false');normalButton.setAttribute('aria-pressed','true')}
 function maximize(){if(!maximized){const r=shell.getBoundingClientRect();normalBounds={left:r.left,top:r.top,width:r.width,height:r.height}}maximized=true;shell.dataset.maximized='true';const {w,h}=viewport();draw({left:0,top:0,width:w,height:h});maxButton.setAttribute('aria-pressed','true');normalButton.setAttribute('aria-pressed','false')}
 function restore(){maximized=false;shell.dataset.maximized='false';draw(normalBounds||centered());maxButton.setAttribute('aria-pressed','false');normalButton.setAttribute('aria-pressed','true')}
 normalButton.onclick=normal;maxButton.onclick=()=>maximized?restore():maximize();bar.ondblclick=e=>{if(!e.target.closest('button'))maximized?restore():maximize()};
 closeButton.onclick=()=>{shell.hidden=true;closed.hidden=false;reopen.focus()};reopen.onclick=()=>{closed.hidden=true;shell.hidden=false;normal();normalButton.focus()};
 function start(e,edge='move'){
  if(e.button!==0||e.target.closest('button')||shell.hidden)return;
  if(viewport().w<=1024||maximized)return;
  const r=shell.getBoundingClientRect();gesture={pointer:e.pointerId,x:e.clientX,y:e.clientY,edge,left:r.left,top:r.top,width:r.width,height:r.height,target:e.currentTarget};
  e.currentTarget.setPointerCapture(e.pointerId);shell.classList.add('windowAdjusting');e.preventDefault();
 }
 function move(e){if(!gesture||e.pointerId!==gesture.pointer)return;const g=gesture,dx=e.clientX-g.x,dy=e.clientY-g.y,{w,h}=viewport(),min=minimum();let b={left:g.left,top:g.top,width:g.width,height:g.height};if(g.edge==='move'){b.left+=dx;b.top+=dy}else{if(g.edge.includes('e'))b.width=clamp(g.width+dx,min.w,w-g.left);if(g.edge.includes('s'))b.height=clamp(g.height+dy,min.h,h-g.top);if(g.edge.includes('w')){b.left=clamp(g.left+dx,0,g.left+g.width-min.w);b.width=g.left+g.width-b.left}if(g.edge.includes('n')){b.top=clamp(g.top+dy,0,g.top+g.height-min.h);b.height=g.top+g.height-b.top}}normalBounds=draw(b)}
 function end(e){if(!gesture||e.pointerId!==gesture.pointer)return;const target=gesture.target;gesture=null;shell.classList.remove('windowAdjusting');if(target.hasPointerCapture(e.pointerId))target.releasePointerCapture(e.pointerId)}
 bar.addEventListener('pointerdown',e=>start(e));document.querySelectorAll('[data-resize]').forEach(handle=>{handle.addEventListener('pointerdown',e=>start(e,handle.dataset.resize));handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end)});bar.addEventListener('pointermove',move);bar.addEventListener('pointerup',end);bar.addEventListener('pointercancel',end);
 window.addEventListener('resize',()=>{if(viewport().w<=1024)draw(centered());else if(maximized)maximize();else draw(normalBounds||centered())});
 const labels={en:['Normal size','Maximize / restore','Close app','RecycleProof is closed','Open RecycleProof'],bn:['স্বাভাবিক সাইজ','বড় করুন / আগের সাইজ','অ্যাপ বন্ধ করুন','RecycleProof বন্ধ আছে','RecycleProof খুলুন'],ar:['الحجم العادي','تكبير / استعادة','إغلاق التطبيق','RecycleProof مغلق','فتح RecycleProof'],nl:['Normale grootte','Maximaliseren / herstellen','App sluiten','RecycleProof is gesloten','RecycleProof openen'],de:['Normale Größe','Maximieren / wiederherstellen','App schließen','RecycleProof ist geschlossen','RecycleProof öffnen']};
 function translate(){const text=labels[document.documentElement.lang]||labels.en;[normalButton,maxButton,closeButton].forEach((button,i)=>{button.title=text[i];button.setAttribute('aria-label',text[i])});document.getElementById('windowClosedHeading').textContent=text[3];reopen.textContent=text[4]}
 new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});translate();normal();
})();

