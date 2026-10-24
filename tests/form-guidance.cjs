const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function fixture(language='en',mode='signup'){
const nodes={},observers=[];let focused='',next=0;const button={classList:{add(){next++},remove(){}},focus(){focused='button'}};
const message={textContent:'',dataset:{},setAttribute(){}};nodes.authMessage=message;
const fields=['name','email','password'].map(name=>({name,value:'',type:name==='email'?'email':name==='password'?'password':'text',autocomplete:name==='password'&&mode==='signup'?'new-password':'current-password',required:true,attrs:{},listeners:{},parentElement:{append(n){nodes[n.id]=n}},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(k,fn){this.listeners[k]=fn},focus(){focused=this.name},get validity(){return {valid:this.name!=='email'||/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.value)}}}));
const form={dataset:{},elements:{namedItem(n){return fields.find(f=>f.name===n)}},listeners:{},querySelectorAll(s){if(s==='input,select')return fields;if(s==='[aria-invalid]')return fields.filter(f=>f.attrs['aria-invalid']);if(s==='.fieldIssue')return Object.values(nodes).filter(n=>n.className==='fieldIssue');return []},querySelector(s){if(s.startsWith('#issue-'))return nodes[s.slice(1)];return button},addEventListener(k,fn){this.listeners[k]=fn}};nodes.authForm=form;
const doc={documentElement:{lang:language},getElementById(k){return nodes[k]},createElement(){return {hidden:true,classList:{add(){},remove(){}}}},dispatchEvent(){},};
const context={document:doc,window:{RP_I18N:{rows:[]}},MutationObserver:class{constructor(cb){this.cb=cb}observe(target){if(target===message)observers.push(this.cb)}},Event:class{},TextEncoder,queueMicrotask:fn=>fn()};vm.runInNewContext(fs.readFileSync('portal/public/auth-guidance.js','utf8'),context);
return {fields,form,message,nodes,get focused(){return focused},get next(){return next},submit(){let prevented=false;form.listeners.submit({preventDefault(){prevented=true},stopImmediatePropagation(){}});return prevented},server(text){message.textContent=text;delete message.dataset.guidance;observers[0]()}};
}
let f=fixture();assert.equal(f.submit(),true);assert.equal(f.focused,'name');assert.equal(f.fields.filter(x=>x.attrs['aria-invalid']).length,3);
f=fixture();f.fields[0].value='Test';f.fields[1].value='invalid';f.fields[2].value='12-characters-plus';assert.equal(f.submit(),true);assert.equal(f.focused,'email');assert.match(f.nodes['issue-email'].textContent,/valid email/);
f=fixture();f.fields[0].value='Test';f.fields[1].value='test@example.com';f.fields[2].value='short';assert.equal(f.submit(),true);assert.equal(f.focused,'password');
f.fields[2].value='long-enough-test-password';assert.equal(f.submit(),false);assert.equal(f.message.textContent,'');f.server('This email is already registered.');assert.equal(f.focused,'email');assert.ok(f.next>0);assert.match(f.message.textContent,/already/);
f=fixture('bn');f.submit();assert.match(f.message.textContent,/লাল/);f.fields[0].listeners.input();assert.equal(f.fields[0].attrs['aria-invalid'],undefined);
f=fixture('ar');f.submit();assert.match(f.message.textContent,/الحقول/);
f=fixture('en','login');f.server('Email or password is incorrect.');assert.equal(f.fields[1].attrs['aria-invalid'],'true');assert.equal(f.fields[2].attrs['aria-invalid'],'true');assert.match(f.message.textContent,/both fields/);
console.log('8 guidance scenarios passed: missing fields, malformed email, short password, valid retry, existing email, Bengali, Arabic, ambiguous login error.');

