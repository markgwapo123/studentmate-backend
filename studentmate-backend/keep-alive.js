// Best-effort health checks while the Node process is running.
// A sleeping or suspended instance cannot execute this timer.
export function startKeepAlive({enabled=false,publicUrl='',fetchFn=globalThis.fetch,setIntervalFn=setInterval,clearIntervalFn=clearInterval,log=console}={}){
 if(!enabled)return ()=>{};
 let url;
 try{url=new URL('/health',publicUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error()}catch{log.warn('Keep-alive disabled: set a valid HTTPS KEEP_ALIVE_URL or RENDER_EXTERNAL_URL.');return ()=>{}};
 let busy=false,stopped=false,controller;
 async function ping(){
  if(stopped||busy)return;
  busy=true;controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);timeout.unref?.();
  try{const response=await fetchFn(url.href,{method:'GET',signal:controller.signal,redirect:'error',cache:'no-store'});await response.body?.cancel();if(!response.ok)log.warn('Keep-alive health check returned status '+response.status)}catch{if(!stopped)log.warn('Keep-alive health check failed; will retry at the next interval.')}finally{clearTimeout(timeout);busy=false}
 }
 const timer=setIntervalFn(ping,5*60*1000);timer.unref?.();
 log.log('Best-effort keep-alive enabled: health check every 5 minutes.');
 return ()=>{stopped=true;clearIntervalFn(timer);controller?.abort()};
}
