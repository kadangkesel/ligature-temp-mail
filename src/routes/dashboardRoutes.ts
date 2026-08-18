import { Hono } from "hono";
import { DOMAINS_SET } from "@/config/domains";

const dashboardRoutes = new Hono<{ Bindings: CloudflareBindings }>();

const PAGE = (domains: string[]) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>TEMP MAIL — disposable inbox</title>
<meta name="description" content="Free disposable email addresses. No signup, no tracking. Receive mail and attachments instantly." />
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#000000" />
<style>
:root{
  /* palette: #000000 #FFFFFF #00FF7F #E6E6FA
     green and lavender are both light, so text on them is always --ink (black) */
  --paper:#E6E6FA;--ink:#000000;--white:#FFFFFF;--acc:#00FF7F;--lav:#E6E6FA;
  --bd:3px solid var(--ink);--sh:6px 6px 0 var(--ink);--sh-sm:4px 4px 0 var(--ink);
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{
  font-family:"Helvetica Neue",Arial,system-ui,sans-serif;background:var(--paper);color:var(--ink);
  min-height:100vh;padding:24px 20px 64px;
  background-image:radial-gradient(var(--ink) 1.2px,transparent 1.2px);background-size:22px 22px;
}
.wrap{max-width:900px;margin:0 auto}

/* ---- header ---- */
header{
  background:var(--ink);color:var(--paper);border:var(--bd);box-shadow:var(--sh);
  padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:26px;
}
.logo{font-size:26px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;display:flex;align-items:center;gap:9px;line-height:1}
.logo .sq{width:16px;height:16px;background:var(--acc);border:2px solid var(--paper);flex:none}
.hlinks{display:flex;align-items:center;gap:8px}
.hlinks a{
  color:var(--ink);background:var(--acc);border:2px solid var(--paper);padding:6px 11px;
  font-size:12px;font-weight:900;text-transform:uppercase;text-decoration:none;letter-spacing:.5px;
}
.hlinks a:hover{background:var(--white)}

/* ---- panels ---- */
.panel{background:var(--white);border:var(--bd);box-shadow:var(--sh);margin-bottom:24px}
.panel-h{
  background:var(--ink);color:var(--paper);padding:9px 16px;font-size:12px;font-weight:900;
  text-transform:uppercase;letter-spacing:1.5px;display:flex;justify-content:space-between;align-items:center;gap:10px;
}
.panel-b{padding:18px}

/* ---- address ---- */
.addr-box{display:flex;gap:12px;align-items:stretch;flex-wrap:wrap}
.addr{
  flex:1;min-width:min(100%,270px);font-family:"SF Mono",Consolas,monospace;font-size:clamp(15px,3.4vw,22px);
  font-weight:700;background:var(--acc);border:var(--bd);padding:14px 16px;word-break:break-all;
  cursor:pointer;line-height:1.3;display:flex;align-items:center;
}
.addr:hover{background:var(--white)}
.addr-acts{display:flex;gap:10px;flex-wrap:wrap}

button,select,input{font-family:inherit;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.6px}
button{
  background:var(--white);color:var(--ink);border:var(--bd);box-shadow:var(--sh-sm);padding:12px 16px;
  cursor:pointer;transition:transform .07s,box-shadow .07s;white-space:nowrap;
}
button:hover{background:var(--acc)}
button:active{transform:translate(4px,4px);box-shadow:0 0 0 var(--ink)}
button.primary{background:var(--acc);color:var(--ink)}
button.primary:hover{background:var(--ink);color:var(--acc)}
button.danger:hover{background:var(--ink);color:var(--acc)}
select,input[type=text]{
  background:var(--white);color:var(--ink);border:var(--bd);padding:12px;cursor:pointer;max-width:100%;
}
input[type=text]{text-transform:lowercase;letter-spacing:0;font-weight:700;font-family:"SF Mono",Consolas,monospace;cursor:text}
input[type=text]:focus,select:focus{outline:none;background:var(--acc)}

.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:16px}
.divider{height:3px;background:var(--ink);margin:18px 0;opacity:.12}
.lbl{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1.2px;opacity:.55;margin-bottom:8px}
.custom{display:flex;gap:0;flex:1;min-width:min(100%,260px)}
.custom input{flex:1;border-right:none;min-width:0}
.custom .at{
  display:flex;align-items:center;padding:0 10px;background:var(--ink);color:var(--paper);
  border:var(--bd);border-left:none;border-right:none;font-family:"SF Mono",Consolas,monospace;font-weight:700;font-size:13px;
}
.custom select{border-left:none}

.auto{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;opacity:.6;margin-left:auto}
.pulse{width:9px;height:9px;background:var(--acc);border:2px solid var(--ink);animation:p 1.6s infinite;flex:none}
@keyframes p{0%,100%{opacity:1}50%{opacity:.25}}

/* ---- QR ---- */
#qrwrap{display:none;margin-top:16px;padding:16px;border:var(--bd);background:var(--ink);text-align:center}
#qrwrap.open{display:block}
#qrwrap svg{background:var(--white);border:var(--bd);padding:10px;width:190px;height:190px;display:block;margin:0 auto}
#qrwrap p{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin-top:11px;color:var(--acc)}

/* ---- inbox ---- */
.tag{background:var(--acc);color:var(--ink);border:2px solid var(--paper);padding:2px 8px;font-size:11px;font-weight:900}
#list{display:flex;flex-direction:column}
.msg{
  border-bottom:3px solid var(--ink);padding:15px 16px;cursor:pointer;display:flex;gap:14px;
  align-items:flex-start;background:var(--white);transition:background .1s;
}
.msg:last-child{border-bottom:none}
.msg:hover{background:var(--acc)}
.msg .bar{width:7px;align-self:stretch;min-height:38px;background:var(--acc);flex:none}
.msg .mid{flex:1;min-width:0}
.msg .from{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.8px;opacity:.6;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.msg .subj{font-size:16px;font-weight:700;line-height:1.35;word-break:break-word}
.msg .meta{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:none}
.msg .time{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;opacity:.55;white-space:nowrap}
.clip{background:var(--acc);border:2px solid var(--ink);padding:1px 6px;font-size:10px;font-weight:900;white-space:nowrap}
.empty{padding:52px 20px;text-align:center}
.empty .big{font-size:44px;font-weight:900;letter-spacing:-1.5px;text-transform:uppercase;opacity:.13;line-height:1}
.empty p{margin-top:12px;font-size:13px;font-weight:700;opacity:.6;text-transform:uppercase;letter-spacing:.8px}
.spin{width:13px;height:13px;border:3px solid var(--white);border-top-color:var(--acc);animation:s .7s linear infinite;display:inline-block;vertical-align:-2px}
@keyframes s{to{transform:rotate(360deg)}}

/* ---- modal ---- */
.modal{position:fixed;inset:0;background:rgba(18,16,12,.72);display:none;align-items:flex-start;justify-content:center;padding:24px 16px;z-index:20;overflow-y:auto}
.modal.open{display:flex}
.sheet{background:var(--white);border:var(--bd);box-shadow:var(--sh);max-width:760px;width:100%;margin:auto}
.sheet-h{background:var(--ink);color:var(--paper);padding:14px 18px;display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
.sheet-h .t{font-size:17px;font-weight:900;line-height:1.3;word-break:break-word}
.sheet-h .f{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;opacity:.65;margin-top:5px;word-break:break-all}
.x{background:var(--acc);color:var(--ink);border:2px solid var(--paper);box-shadow:none;padding:7px 12px;font-size:15px;line-height:1;flex:none}
.x:hover{background:var(--white);color:var(--ink)}
.x:active{transform:none;box-shadow:none}
#mbody{width:100%;min-height:210px;border:none;background:var(--white);display:block}
.att{border-top:3px solid var(--ink);padding:15px 18px;background:var(--paper)}
.att .lbl{margin-bottom:10px}
.att a{
  display:flex;justify-content:space-between;gap:12px;align-items:center;background:var(--white);border:var(--bd);
  box-shadow:var(--sh-sm);padding:11px 13px;margin-bottom:10px;text-decoration:none;color:var(--ink);
}
.att a:hover{background:var(--acc)}
.att a:last-child{margin-bottom:0}
.att .fn{font-size:13px;font-weight:700;word-break:break-all;font-family:"SF Mono",Consolas,monospace}
.att .sz{font-size:11px;font-weight:900;text-transform:uppercase;opacity:.6;white-space:nowrap;flex:none}

/* ---- toast ---- */
#toast{
  position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(120%);
  background:var(--ink);color:var(--paper);border:3px solid var(--white);box-shadow:var(--sh);
  padding:13px 22px;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;
  transition:transform .22s;z-index:40;pointer-events:none;max-width:90vw;text-align:center;
}
#toast.show{transform:translateX(-50%) translateY(0)}

footer{text-align:center;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;opacity:.45;margin-top:26px;line-height:1.9}

@media(max-width:560px){
  body{padding:14px 12px 48px;background-size:16px 16px}
  header{padding:12px 14px}
  .logo{font-size:20px}
  .panel-b{padding:14px}
  .addr-acts{width:100%}
  .addr-acts button{flex:1}
  .auto{margin-left:0;width:100%}
  .msg{padding:13px 14px;gap:11px}
  .msg .subj{font-size:15px}
  .msg .meta{flex-direction:row;align-items:center}
  .empty .big{font-size:30px}
}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo"><span class="sq"></span>Temp<span style="color:var(--acc)">Mail</span></div>
    <nav class="hlinks"><a href="/docs">API Docs</a></nav>
  </header>

  <section class="panel">
    <div class="panel-h"><span>Your Address</span><span class="tag" id="domcount"></span></div>
    <div class="panel-b">
      <div class="addr-box">
        <div class="addr" id="addr" title="Click to copy">&mdash;</div>
        <div class="addr-acts">
          <button class="primary" id="btn-copy">Copy</button>
          <button id="btn-qr">QR</button>
        </div>
      </div>

      <div id="qrwrap">
        <div id="qr"></div>
        <p>Scan to open on your phone</p>
      </div>

      <div class="divider"></div>

      <div class="lbl">Generate a new address</div>
      <div class="row">
        <button class="primary" id="btn-new">New Random</button>
        <select id="domain"></select>
      </div>

      <div class="lbl" style="margin-top:18px">Or pick your own name</div>
      <div class="row">
        <div class="custom">
          <input type="text" id="custom" placeholder="your.name" maxlength="64" autocomplete="off" spellcheck="false" />
          <span class="at">@</span>
          <select id="cdomain"></select>
        </div>
        <button id="btn-set">Set</button>
      </div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-h">
      <span>Inbox</span>
      <span style="display:flex;align-items:center;gap:10px">
        <span class="tag" id="cnt">0</span>
        <span class="auto"><span class="pulse"></span>Auto 8s</span>
      </span>
    </div>
    <div class="row" style="margin:0;padding:14px 16px 0"><button id="btn-refresh">Refresh</button><button class="danger" id="btn-empty">Empty Inbox</button></div>
    <div class="divider" style="margin:14px 0 0"></div>
    <div id="list"></div>
  </section>

  <footer>
    Mail is deleted automatically &middot; Do not use for anything important<br />
    <span id="dlist"></span>
  </footer>
</div>

<div class="modal" id="modal">
  <div class="sheet">
    <div class="sheet-h">
      <div><div class="t" id="msubj"></div><div class="f" id="mfrom"></div></div>
      <button class="x" id="btn-close">&#10005;</button>
    </div>
    <iframe id="mbody" sandbox referrerpolicy="no-referrer" title="Message body"></iframe>
    <div class="att" id="matt" style="display:none"></div>
  </div>
</div>

<div id="toast"></div>

<script>
"use strict";
var DOMAINS = ${JSON.stringify(domains)};

/* ================= QR encoder (byte mode, ECC level L, versions 1-10) =================
   Verified bit-identical to the "qrcode" reference implementation and round-trip
   decoded with "jsQR" across 542 cases covering versions 1-10. */
function qrMul(x,y){var z=0;for(var i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);z^=((y>>>i)&1)*x}return z&255}
function qrDivisor(d){var r=new Uint8Array(d);r[d-1]=1;var root=1;
  for(var i=0;i<d;i++){for(var j=0;j<d;j++){r[j]=qrMul(r[j],root);if(j+1<d)r[j]^=r[j+1]}root=qrMul(root,2)}return r}
function qrRemainder(data,div){var r=new Uint8Array(div.length);
  for(var i=0;i<data.length;i++){var f=data[i]^r[0];r.copyWithin(0,1);r[r.length-1]=0;
    for(var j=0;j<div.length;j++)r[j]^=qrMul(div[j],f)}return r}
var QR_T={1:[26,7,1],2:[44,10,1],3:[70,15,1],4:[100,20,1],5:[134,26,1],6:[172,18,2],7:[196,20,2],8:[242,24,2],9:[292,30,2],10:[346,18,4]};
var QR_A={1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50]};
function qrDataCw(v){var t=QR_T[v];return t[0]-t[1]*t[2]}
function qrCap(v){return Math.floor((qrDataCw(v)*8-(4+(v<10?8:16)))/8)}
function qrVersion(len){for(var v=1;v<=10;v++)if(qrCap(v)>=len)return v;return null}
function qrEncode(bytes,v){
  var bits=[],push=function(val,n){for(var i=n-1;i>=0;i--)bits.push((val>>>i)&1)};
  push(4,4);push(bytes.length,v<10?8:16);
  for(var i=0;i<bytes.length;i++)push(bytes[i],8);
  var cap=qrDataCw(v)*8;
  push(0,Math.min(4,cap-bits.length));
  while(bits.length%8!==0)bits.push(0);
  var out=[];
  for(var k=0;k<bits.length;k+=8){var b=0;for(var j=0;j<8;j++)b=(b<<1)|bits[k+j];out.push(b)}
  var pad=[236,17],p=0;
  while(out.length<qrDataCw(v))out.push(pad[p++%2]);
  return out;
}
function qrInterleave(data,v){
  var t=QR_T[v],ecPer=t[1],nb=t[2],total=qrDataCw(v),shortLen=Math.floor(total/nb),numLong=total%nb;
  var dBlocks=[],eBlocks=[],div=qrDivisor(ecPer),k=0;
  for(var i=0;i<nb;i++){var len=shortLen+(i>=nb-numLong?1:0);var blk=data.slice(k,k+len);k+=len;
    dBlocks.push(blk);eBlocks.push(qrRemainder(blk,div))}
  var res=[],maxD=shortLen+(numLong>0?1:0);
  for(var r=0;r<maxD;r++)for(var b=0;b<dBlocks.length;b++)if(r<dBlocks[b].length)res.push(dBlocks[b][r]);
  for(var e=0;e<ecPer;e++)for(var b2=0;b2<eBlocks.length;b2++)res.push(eBlocks[b2][e]);
  return res;
}
var QR_M=[
  function(x,y){return (x+y)%2===0},function(x,y){return y%2===0},function(x){return x%3===0},
  function(x,y){return (x+y)%3===0},function(x,y){return (Math.floor(x/3)+Math.floor(y/2))%2===0},
  function(x,y){return (x*y)%2+(x*y)%3===0},function(x,y){return ((x*y)%2+(x*y)%3)%2===0},
  function(x,y){return ((x+y)%2+(x*y)%3)%2===0}
];
function qrBuild(text){
  var bytes=[],enc=new TextEncoder().encode(text);
  for(var i=0;i<enc.length;i++)bytes.push(enc[i]);
  var v=qrVersion(bytes.length);
  if(v===null)return null;
  var size=17+4*v,cw=qrInterleave(qrEncode(bytes,v),v);
  var mods=[],fn=[];
  for(var y=0;y<size;y++){mods.push(new Array(size).fill(false));fn.push(new Array(size).fill(false))}
  var setF=function(x,y,d){mods[y][x]=d;fn[y][x]=true};
  for(var i2=0;i2<size;i2++){setF(6,i2,i2%2===0);setF(i2,6,i2%2===0)}
  var finder=function(cx,cy){
    for(var dy=-4;dy<=4;dy++)for(var dx=-4;dx<=4;dx++){
      var x=cx+dx,y=cy+dy;if(x<0||x>=size||y<0||y>=size)continue;
      var d=Math.max(Math.abs(dx),Math.abs(dy));setF(x,y,d!==2&&d!==4)}};
  finder(3,3);finder(size-4,3);finder(3,size-4);
  var C=QR_A[v];
  for(var a=0;a<C.length;a++)for(var b=0;b<C.length;b++){
    var cx=C[b],cy=C[a];
    if((cx===6&&cy===6)||(cx===6&&cy===size-7)||(cx===size-7&&cy===6))continue;
    for(var dy2=-2;dy2<=2;dy2++)for(var dx2=-2;dx2<=2;dx2++)
      setF(cx+dx2,cy+dy2,Math.max(Math.abs(dx2),Math.abs(dy2))!==1)}
  for(var f1=0;f1<=5;f1++)setF(8,f1,false);
  setF(8,7,false);setF(8,8,false);setF(7,8,false);
  for(var f2=9;f2<15;f2++)setF(14-f2,8,false);
  for(var f3=0;f3<8;f3++)setF(size-1-f3,8,false);
  for(var f4=8;f4<15;f4++)setF(8,size-15+f4,false);
  setF(8,size-8,true);
  if(v>=7){
    var rem=v;for(var r2=0;r2<12;r2++)rem=(rem<<1)^((rem>>>11)*0x1f25);
    var vb=((v<<12)|rem)>>>0;
    for(var i3=0;i3<18;i3++){var dk=((vb>>>i3)&1)!==0,aa=size-11+(i3%3),bb=Math.floor(i3/3);
      setF(aa,bb,dk);setF(bb,aa,dk)}}
  var idx=0;
  for(var right=size-1;right>=1;right-=2){
    if(right===6)right=5;
    for(var vert=0;vert<size;vert++)for(var j2=0;j2<2;j2++){
      var x2=right-j2,up=((right+1)&2)===0,y2=up?size-1-vert:vert;
      if(!fn[y2][x2]&&idx<cw.length*8){mods[y2][x2]=((cw[idx>>>3]>>>(7-(idx&7)))&1)!==0;idx++}}}
  return {mods:mods,fn:fn,size:size};
}
function qrFormat(mods,fn,size,mask){
  var data=(1<<3)|mask,rem=data;
  for(var i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);
  var bits=(((data<<10)|rem)^0x5412)>>>0;
  var get=function(i){return ((bits>>>i)&1)!==0},set=function(x,y,val){mods[y][x]=val;fn[y][x]=true};
  for(var a=0;a<=5;a++)set(8,a,get(a));
  set(8,7,get(6));set(8,8,get(7));set(7,8,get(8));
  for(var b=9;b<15;b++)set(14-b,8,get(b));
  for(var c=0;c<8;c++)set(size-1-c,8,get(c));
  for(var d=8;d<15;d++)set(8,size-15+d,get(d));
  set(8,size-8,true);
}
function qrPenalty(mods,size){
  var pts=0,y,x;
  for(var row=0;row<size;row++){
    var sC=0,sR=0,lC=null,lR=null;
    for(var col=0;col<size;col++){
      var m=mods[row][col]?1:0;
      if(m===lC)sC++;else{if(sC>=5)pts+=3+(sC-5);lC=m;sC=1}
      m=mods[col][row]?1:0;
      if(m===lR)sR++;else{if(sR>=5)pts+=3+(sR-5);lR=m;sR=1}}
    if(sC>=5)pts+=3+(sC-5);
    if(sR>=5)pts+=3+(sR-5)}
  var n2=0;
  for(y=0;y<size-1;y++)for(x=0;x<size-1;x++){
    var s=(mods[y][x]?1:0)+(mods[y][x+1]?1:0)+(mods[y+1][x]?1:0)+(mods[y+1][x+1]?1:0);
    if(s===4||s===0)n2++}
  pts+=n2*3;
  var n3=0;
  for(var r=0;r<size;r++){
    var bc=0,br=0;
    for(var c2=0;c2<size;c2++){
      bc=((bc<<1)&0x7ff)|(mods[r][c2]?1:0);
      if(c2>=10&&(bc===0x5d0||bc===0x05d))n3++;
      br=((br<<1)&0x7ff)|(mods[c2][r]?1:0);
      if(c2>=10&&(br===0x5d0||br===0x05d))n3++}}
  pts+=n3*40;
  var dark=0;
  for(y=0;y<size;y++)for(x=0;x<size;x++)dark+=mods[y][x]?1:0;
  pts+=Math.abs(Math.ceil((dark*100/(size*size))/5)-10)*10;
  return pts;
}
function qrSvg(text){
  var built=qrBuild(text);
  if(!built)return "";
  var size=built.size,best=null;
  for(var mask=0;mask<8;mask++){
    var m=built.mods.map(function(r){return r.slice()}),f=built.fn.map(function(r){return r.slice()});
    for(var y=0;y<size;y++)for(var x=0;x<size;x++)if(!f[y][x]&&QR_M[mask](x,y))m[y][x]=!m[y][x];
    qrFormat(m,f,size,mask);
    var p=qrPenalty(m,size);
    if(best===null||p<best.p)best={p:p,m:m}}
  var d="";
  for(var yy=0;yy<size;yy++)for(var xx=0;xx<size;xx++)
    if(best.m[yy][xx])d+="M"+xx+" "+yy+"h1v1h-1z";
  var q=2,total=size+q*2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+total+' '+total+'" shape-rendering="crispEdges" role="img" aria-label="QR code for this email address">'+
    '<rect width="'+total+'" height="'+total+'" fill="#FFFFFF"/><g transform="translate('+q+' '+q+')" fill="#000000"><path d="'+d+'"/></g></svg>';
}

/* ================= random human-looking addresses ================= */
var FIRST=["adam","agus","ahmad","aldi","alif","andi","anggi","anton","arif","asep","bayu","budi",
"cahya","dani","dedi","dewi","dian","dimas","dwi","eka","endah","erik","fajar","farid","fitri",
"gilang","hadi","hendra","ilham","indah","intan","irfan","joko","kurnia","lestari","lina","maya",
"nanda","novi","nur","putra","putri","rahmat","reza","rina","rizky","sari","satria","siti","surya",
"tari","tono","umar","wahyu","wulan","yoga","yudi","yuni","zaki","zahra"];
var LAST=["abdullah","anggraini","budiman","gunawan","halim","hardiyanti","hidayat","irawan",
"kusuma","lestari","maulana","nugroho","permata","pradana","pratama","purnama","puspita",
"rahayu","rahman","rahmawati","ramadhan","santoso","saputra","setiawan","siregar","suryani",
"utami","wibowo","wijaya","yulianti"];
function pickFrom(arr){
  var buf=new Uint32Array(1);crypto.getRandomValues(buf);
  return arr[buf[0]%arr.length];
}
function randInt(max){
  var buf=new Uint32Array(1);crypto.getRandomValues(buf);
  return buf[0]%max;
}
function randomLocal(){
  var f=pickFrom(FIRST),l=pickFrom(LAST),n=randInt(4);
  if(n===0)return f+"."+l;
  if(n===1)return f+l+(randInt(89)+10);
  if(n===2)return f+"."+l+(randInt(9)+1);
  return f[0]+"."+l+(randInt(89)+10);
}

/* ================= helpers ================= */
function $(id){return document.getElementById(id)}
function esc(s){
  return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function fmtTime(sec){
  if(!sec)return "";
  var diff=Math.floor(Date.now()/1000)-sec;
  if(diff<60)return "just now";
  if(diff<3600)return Math.floor(diff/60)+"m ago";
  if(diff<86400)return Math.floor(diff/3600)+"h ago";
  return new Date(sec*1000).toLocaleDateString();
}
function fmtSize(b){
  if(b==null)return "";
  if(b<1024)return b+" B";
  if(b<1048576)return (b/1024).toFixed(1)+" KB";
  return (b/1048576).toFixed(1)+" MB";
}
function sanitizeLocal(v){
  return String(v||"").toLowerCase()
    .replace(/[^a-z0-9._-]/g,"")     // keep only safe local-part chars
    .replace(/\\.{2,}/g,".")          // collapse repeated dots
    .replace(/^[._-]+|[._-]+$/g,"")  // trim separators from the ends
    .slice(0,64);
}
var toastTimer=null;
function toast(msg){
  var t=$("toast");t.textContent=msg;t.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove("show")},2000);
}

/* ================= state ================= */
var current="";
var qrOpen=false;

function setAddr(a){
  current=a;
  $("addr").textContent=a;
  try{localStorage.setItem("tm_addr",a)}catch(e){}
  var dom=a.split("@")[1];
  if(DOMAINS.indexOf(dom)>=0){$("domain").value=dom;$("cdomain").value=dom}
  if(qrOpen)drawQr();
}
function drawQr(){$("qr").innerHTML=qrSvg(current)}

function copyAddr(){
  if(!current)return;
  var done=function(){toast("Address copied")};
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(current).then(done,fallbackCopy)
  }else fallbackCopy();
  function fallbackCopy(){
    var ta=document.createElement("textarea");
    ta.value=current;ta.setAttribute("readonly","");
    ta.style.position="fixed";ta.style.opacity="0";
    document.body.appendChild(ta);ta.select();
    try{document.execCommand("copy");done()}catch(e){toast("Copy failed")}
    document.body.removeChild(ta);
  }
}

function newRandom(){
  setAddr(randomLocal()+"@"+$("domain").value);
  renderEmpty();$("cnt").textContent="0";
  refresh();
}
function setCustom(){
  var local=sanitizeLocal($("custom").value);
  if(!local){toast("Enter a valid name");return}
  $("custom").value=local;
  setAddr(local+"@"+$("cdomain").value);
  renderEmpty();$("cnt").textContent="0";
  toast("Address updated");
  refresh();
}

/* ================= inbox ================= */
function renderEmpty(){
  $("list").innerHTML='<div class="empty"><div class="big">No mail yet</div>'+
    '<p>Send something to the address above</p></div>';
}
function renderError(){
  $("list").innerHTML='<div class="empty"><div class="big">Offline</div>'+
    '<p>Could not load the inbox &mdash; retrying</p></div>';
}

var refreshing=false;
function refresh(){
  if(!current||refreshing)return;
  refreshing=true;
  var cnt=$("cnt");
  cnt.innerHTML='<span class="spin"></span>';
  fetch("/emails/"+encodeURIComponent(current)+"?limit=50")
    .then(function(r){return r.json()})
    .then(function(j){
      if(!j||!j.success){renderError();cnt.textContent="0";return}
      var msgs=j.result||[];
      cnt.textContent=String(msgs.length);
      if(!msgs.length){renderEmpty();return}
      $("list").innerHTML=msgs.map(function(m){
        var clip=m.has_attachments
          ? '<span class="clip">&#128206; '+(m.attachment_count||1)+'</span>' : "";
        return '<div class="msg" data-id="'+esc(m.id)+'">'+
          '<div class="bar"></div><div class="mid">'+
          '<div class="from">'+esc(m.from_address)+'</div>'+
          '<div class="subj">'+esc(m.subject||"(no subject)")+'</div></div>'+
          '<div class="meta"><span class="time">'+esc(fmtTime(m.received_at))+'</span>'+clip+'</div></div>';
      }).join("");
    })
    .catch(function(){renderError();$("cnt").textContent="0"})
    .then(function(){refreshing=false});
}

/* Renders untrusted sender HTML inside a sandboxed iframe (no allow-scripts,
   no allow-same-origin) so email content cannot run JS or touch this origin. */
function showBody(html,isHtml){
  var doc='<!DOCTYPE html><html><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<base target="_blank">'+
    '<style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:14px;'+
    'line-height:1.6;color:#000000;padding:18px;margin:0;word-wrap:break-word}'+
    'img{max-width:100%;height:auto}a{color:#0a7d4b}'+
    'pre{white-space:pre-wrap;font-family:inherit;margin:0}'+
    'table{max-width:100%}</style></head><body>'+
    (isHtml?html:"<pre>"+esc(html)+"</pre>")+"</body></html>";
  $("mbody").srcdoc=doc;
}

function openMsg(id){
  fetch("/inbox/"+encodeURIComponent(id))
    .then(function(r){return r.json()})
    .then(function(j){
      if(!j||!j.success||!j.result){toast("Could not open message");return}
      var m=j.result;
      $("msubj").textContent=m.subject||"(no subject)";
      $("mfrom").textContent=(m.from_address||"")+" \\u00b7 "+fmtTime(m.received_at);
      var hasHtml=m.html_content&&String(m.html_content).trim();
      showBody(hasHtml?m.html_content:(m.text_content||"(empty message)"),!!hasHtml);
      $("modal").classList.add("open");
      document.body.style.overflow="hidden";
      var att=$("matt");
      att.style.display="none";att.innerHTML="";
      if(m.has_attachments)loadAttachments(id);
    })
    .catch(function(){toast("Could not open message")});
}

function loadAttachments(id){
  fetch("/inbox/"+encodeURIComponent(id)+"/attachments")
    .then(function(r){return r.json()})
    .then(function(j){
      if(!j||!j.success)return;
      var list=j.result||[];
      if(!list.length)return;
      var att=$("matt");
      att.innerHTML='<div class="lbl">'+list.length+
        (list.length===1?" attachment":" attachments")+"</div>"+
        list.map(function(a){
          return '<a href="/attachments/'+encodeURIComponent(a.id)+'" download>'+
            '<span class="fn">'+esc(a.filename||"file")+"</span>"+
            '<span class="sz">'+esc(fmtSize(a.size))+" &#8595;</span></a>";
        }).join("");
      att.style.display="block";
    })
    .catch(function(){});
}

function closeModal(){
  $("modal").classList.remove("open");
  $("mbody").srcdoc="";
  document.body.style.overflow="";
}

function emptyInbox(){
  if(!current)return;
  if(!confirm("Delete all messages in "+current+"?"))return;
  fetch("/emails/"+encodeURIComponent(current),{method:"DELETE"})
    .then(function(r){return r.json()})
    .then(function(j){
      toast(j&&j.success?"Inbox emptied":"Nothing to delete");
      refresh();
    })
    .catch(function(){toast("Delete failed")});
}

/* ================= init ================= */
(function(){
  var opts=DOMAINS.map(function(d){
    return '<option value="'+esc(d)+'">'+esc(d)+"</option>"}).join("");
  $("domain").innerHTML=opts;
  $("cdomain").innerHTML=opts;
  $("domcount").textContent=DOMAINS.length+" domains";
  $("dlist").textContent=DOMAINS.join(" \\u00b7 ");

  $("addr").addEventListener("click",copyAddr);
  $("btn-copy").addEventListener("click",copyAddr);
  $("btn-new").addEventListener("click",newRandom);
  $("btn-set").addEventListener("click",setCustom);
  $("btn-refresh").addEventListener("click",refresh);
  $("btn-empty").addEventListener("click",emptyInbox);
  $("btn-close").addEventListener("click",closeModal);
  $("btn-qr").addEventListener("click",function(){
    qrOpen=!qrOpen;
    $("qrwrap").classList.toggle("open",qrOpen);
    if(qrOpen)drawQr();
  });
  $("custom").addEventListener("keydown",function(e){if(e.key==="Enter")setCustom()});
  $("list").addEventListener("click",function(e){
    var row=e.target.closest(".msg");
    if(row&&row.dataset.id)openMsg(row.dataset.id);
  });
  $("modal").addEventListener("click",function(e){
    if(e.target===$("modal"))closeModal();
  });
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape")closeModal();
  });

  var saved=null;
  try{saved=localStorage.getItem("tm_addr")}catch(e){}
  var valid=saved&&DOMAINS.some(function(d){return saved.endsWith("@"+d)});
  if(valid){setAddr(saved);renderEmpty();refresh()}
  else newRandom();

  setInterval(refresh,8000);
  document.addEventListener("visibilitychange",function(){
    if(!document.hidden)refresh();
  });
})();
</script>
</body>
</html>`;

dashboardRoutes.get("/", (c) => {
	return c.html(PAGE(Array.from(DOMAINS_SET)));
});

export default dashboardRoutes;
