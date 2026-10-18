import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
export const URL='https://token-plan.maas.qwencloudapi.com/compatible-mode/v1/chat/completions';
export async function chat(model,messages,{temperature=0.3,max_tokens=16000,thinking=false,timeout=900000}={}){
  const body={model,temperature,max_tokens,messages,stream:true};
  if(model.startsWith('qwen'))body.enable_thinking=thinking;
  for(let a=0;a<3;a++){
    try{
      const r=await fetch(URL,{method:'POST',headers:{Authorization:`Bearer ${process.env.QWENCLOUD_TOKEN_PLAN_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
      if(!r.ok){const t=await r.text();console.error('HTTP',r.status,t.slice(0,200));continue;}
      const dec=new TextDecoder();let buf='',text='',model_='';
      for await(const chunk of r.body){buf+=dec.decode(chunk,{stream:true});let i;
        while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).trim();buf=buf.slice(i+1);
          if(!line.startsWith('data:'))continue;const d=line.slice(5).trim();if(d==='[DONE]')continue;
          try{const j=JSON.parse(d);model_=j.model||model_;text+=j.choices?.[0]?.delta?.content||'';}catch{}}}
      if(text.trim())return {text,model:model_};
      console.error('empty response, retry');
    }catch(e){console.error('err',String(e).slice(0,200));}
  }
  throw new Error('chat failed');
}
export function extractJs(text){const m=text.match(/```(?:js|javascript)\n([\s\S]*?)```/);return m?m[1]:text;}
