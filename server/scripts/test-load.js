const assert = require('node:assert/strict');
const base = process.env.SMOKE_BASE || 'http://web';
if (process.env.BRAINBOT_TEST !== '1') throw new Error('Requires isolated test environment');
(async () => {
  const login = await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'demo_researcher',password:'Demo@123456'})});
  const {data} = await login.json(); assert(data?.token);
  let cursor = 0; const latencies = []; const errors = []; const started = Date.now();
  await Promise.all(Array.from({length:20},async()=>{
    while(cursor++ < 400) {
      const start = Date.now();
      try { const r=await fetch(base+'/api/v1/projects',{headers:{Authorization:`Bearer ${data.token}`},signal:AbortSignal.timeout(10000)}); if(!r.ok)errors.push(r.status); await r.text(); } catch(e){errors.push(e.message)}
      latencies.push(Date.now()-start);
    }
  }));
  latencies.sort((a,b)=>a-b);
  const result={requests:latencies.length,concurrency:20,errors:errors.length,p95_ms:latencies[Math.floor(latencies.length*.95)],duration_ms:Date.now()-started};
  console.log('[load]',JSON.stringify(result)); assert.equal(errors.length,0); assert(result.p95_ms<2000,'p95 exceeds 2 seconds');
})().catch(e=>{console.error(e);process.exitCode=1});
