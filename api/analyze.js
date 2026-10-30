const ROLE_LANGUAGES = {
  fullstack: ["javascript","typescript","html","css","react","node","express","next.js","python","java","sql"],
  backend: ["javascript","typescript","node","express","python","java","go","rust","php","ruby","c#","sql"],
  frontend: ["javascript","typescript","html","css","react","vue","angular","next.js","tailwind"],
  "data science": ["python","jupyter notebook","r","sql","pandas","numpy","scikit-learn","tensorflow","pytorch"]
};

function clamp(n,min=0,max=100){ return Math.max(min,Math.min(max,n)); }
function scoreLabel(n){
  if(n>=85) return "Excellent profile with strong signals";
  if(n>=70) return "Good profile with a few clear improvements";
  if(n>=55) return "Decent foundation with several improvements";
  if(n>=40) return "Needs work before it looks polished";
  return "Early-stage profile with major opportunities";
}
function daysAgo(date){ return date ? Math.max(0,(Date.now()-new Date(date).getTime())/86400000) : 99999; }

async function gh(path, token){
  const r=await fetch("https://api.github.com"+path,{
    headers:{
      "Accept":"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      ...(token?{"Authorization":`Bearer ${token}`}:{})
    }
  });
  const data=await r.json().catch(()=>null);
  if(!r.ok){
    const msg=data?.message||`GitHub API error (${r.status})`;
    const err=new Error(msg); err.status=r.status; throw err;
  }
  return data;
}
async function safeGh(path,token,fallback){
  try{return await gh(path,token)}catch{return fallback;}
}

function repoActivityScore(repos){
  if(!repos.length) return 0;
  const recent90=repos.filter(r=>daysAgo(r.pushed_at)<=90).length;
  const recentYear=repos.filter(r=>daysAgo(r.pushed_at)<=365).length;
  return clamp(35 + recent90*8 + Math.min(recentYear,12)*2.5);
}
function docScore(repos){
  if(!repos.length) return 0;
  const top=repos.slice(0,Math.min(10,repos.length));
  const readme=top.filter(r=>r.readme).length;
  const desc=top.filter(r=>r.description && r.description.trim()).length;
  const setup=top.filter(r=>r.readmeLength>=500).length;
  return Math.round(clamp((readme/top.length)*45+(desc/top.length)*25+(setup/top.length)*30));
}
function qualityScore(repos){
  if(!repos.length) return 0;
  const top=repos.slice(0,10);
  const original=top.filter(r=>!r.fork).length/top.length;
  const described=top.filter(r=>r.description).length/top.length;
  const stars=top.reduce((s,r)=>s+r.stargazers_count,0);
  const pushed=top.filter(r=>daysAgo(r.pushed_at)<180).length/top.length;
  return Math.round(clamp(original*45+described*20+pushed*25+Math.min(stars,20)*0.5));
}
function skillsScore(repos,role){
  const wanted=ROLE_LANGUAGES[role]||ROLE_LANGUAGES.fullstack;
  const langs=new Set();
  repos.forEach(r=>(r.languages||[]).forEach(x=>langs.add(x.toLowerCase())));
  const matches=wanted.filter(w=>[...langs].some(l=>l===w||l.includes(w)||w.includes(l))).length;
  const variety=Math.min(langs.size,8);
  return {score:Math.round(clamp((matches/wanted.length)*75+Math.min(variety/8,1)*25)),langs:[...langs].slice(0,12),matches,wanted};
}
function communityScore(user,repos){
  const stars=repos.reduce((s,r)=>s+r.stargazers_count,0);
  const forks=repos.reduce((s,r)=>s+r.forks_count,0);
  const followers=user.followers||0;
  return Math.round(clamp(Math.min(stars,30)*1.2+Math.min(forks,15)*1.3+Math.min(followers,50)*1.05));
}
async function portfolioScore(url){
  if(!url) return {score:50,evidence:["No portfolio URL was provided; using a neutral starting score."]};
  let u=url.trim(); if(!/^https?:\/\//i.test(u)) u="https://"+u;
  const started=Date.now();
  try{
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),7000);
    const r=await fetch(u,{redirect:"follow",signal:controller.signal,headers:{"User-Agent":"PortfolioAnalyzer/1.0"}});
    clearTimeout(timeout);
    const html=await r.text();
    const ms=Date.now()-started;
    const viewport=/name=["']viewport["']/i.test(html);
    const title=/<title[^>]*>\s*[^<]{3,}\s*<\/title>/i.test(html);
    const desc=/<meta[^>]+name=["']description["'][^>]+content=/i.test(html)||/<meta[^>]+content=[^>]+name=["']description["']/i.test(html);
    const score=clamp(35+(r.ok?20:0)+(viewport?15:0)+(title?10:0)+(desc?10:0)+(ms<2000?10:ms<4000?5:0));
    return {score:Math.round(score),evidence:[`Loaded in ${(ms/1000).toFixed(1)}s`, `HTTP status: ${r.status}`, `Mobile viewport tag: ${viewport}`, `Title tag: ${title}`, `Meta description: ${desc}`]};
  }catch(e){
    return {score:25,evidence:["Portfolio could not be reached from the analyzer server.","Check that the URL is public and uses HTTPS."]};
  }
}
function roadmap(categories, repos, skillInfo, portfolio){
  const fixes=[];
  const docs=categories.find(x=>x.name==="Documentation");
  const activity=categories.find(x=>x.name==="Code Activity");
  const quality=categories.find(x=>x.name==="Project Quality");
  const skills=categories.find(x=>x.name==="Skills");
  const port=categories.find(x=>x.name==="Portfolio");
  const comm=categories.find(x=>x.name==="Community");
  if(docs.score<70) {
    const missing=repos.find(r=>!r.readme);
    fixes.push(missing?`Add a useful README to '${missing.name}' with setup steps, screenshots and the tech stack.`:"Improve your top repository READMEs with setup steps, screenshots and project explanations.");
  }
  if(quality.score<70) fixes.push("Add a clear one-line description and relevant topics to each important repository.");
  if(activity.score<70) fixes.push("Push meaningful updates consistently and keep your strongest repositories active.");
  if(skills.score<70){
    const gap=skillInfo.wanted.find(w=>!skillInfo.langs.some(l=>l===w||l.includes(w)||w.includes(l)));
    fixes.push(gap?`Build or improve one project using ${gap} to strengthen your ${categories.find(x=>x.name==="Skills").name.toLowerCase()} signal.`:"Show a broader range of relevant technologies across your best projects.");
  }
  if(port.score<70) fixes.push("Polish your portfolio with a fast mobile layout, clear title/description and links to your strongest projects.");
  if(comm.score<55) fixes.push("Make your best project easy to discover and share; useful stars, forks and followers grow from visible, useful work.");
  if(!fixes.length) fixes.push("Keep your strongest repositories updated and continue documenting what you build.");
  return fixes.slice(0,5);
}

async function anthropicReview(data, apiKey){
  if(!apiKey) return null;
  const prompt=`You are reviewing a public GitHub portfolio. Give a concise recruiter-style review based ONLY on the evidence below. Do not invent facts. Use 4 short sections: Strengths, Weaknesses, Highest-impact fixes, One-line summary. Target role: ${data.role}. Overall score: ${data.overall}/100. Categories: ${JSON.stringify(data.categories)}. Roadmap: ${JSON.stringify(data.roadmap)}. Repositories: ${JSON.stringify(data.repoSnapshot)}.`;
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-3-5-haiku-20241022",max_tokens:650,messages:[{role:"user",content:prompt}]})});
  if(!r.ok) return null;
  const j=await r.json(); return j.content?.map(x=>x.text||"").join("\n").trim()||null;
}

module.exports = async (req,res)=>{
  try{
    const q=req.query||{};
    const username=String(q.username||"").trim().replace(/^@/,"");
    const role=String(q.role||"fullstack").toLowerCase();
    const portfolio=String(q.portfolio||"").trim();
    if(!username) return res.status(400).json({detail:"Enter a GitHub username."});
    if(!/^[A-Za-z0-9-]{1,39}$/.test(username)) return res.status(400).json({detail:"That doesn't look like a valid GitHub username."});
    const token=process.env.GITHUB_TOKEN||"";
    const user=await gh(`/users/${encodeURIComponent(username)}`,token);
    const repos=await gh(`/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed&direction=desc`,token);
    const cleaned=[];
    for(const r of repos.slice(0,30)){
      const readme=await safeGh(`/repos/${username}/${r.name}/readme`,token,null);
      let readmeLength=0;
      if(readme?.content){
        try{readmeLength=Buffer.from(readme.content.replace(/\n/g,""),"base64").toString("utf8").length}catch{}
      }
      const languages=await safeGh(`/repos/${username}/${r.name}/languages`,token,{});
      cleaned.push({...r,readme:!!readme,readmeLength,languages:Object.keys(languages)});
    }
    const skillInfo=skillsScore(cleaned,role);
    const p=await portfolioScore(portfolio);
    const categories=[
      {name:"Documentation",score:docScore(cleaned),weight:20,evidence:[]},
      {name:"Code Activity",score:repoActivityScore(cleaned),weight:20,evidence:[]},
      {name:"Project Quality",score:qualityScore(cleaned),weight:20,evidence:[]},
      {name:"Skills",score:skillInfo.score,weight:15,evidence:[]},
      {name:"Portfolio",score:p.score,weight:15,evidence:p.evidence},
      {name:"Community",score:communityScore(user,cleaned),weight:10,evidence:[]}
    ];
    const top=cleaned.slice(0,10);
    const missing=top.filter(r=>!r.readme).length;
    categories[0].evidence=[`${top.filter(r=>r.readme).length}/${top.length||1} top repositories have a README`,`README length >= 500 chars: ${top.filter(r=>r.readmeLength>=500).length}/${top.length||1}`,missing?`${missing} top repositories have no README`:"Top repositories all have README files"];
    categories[1].evidence=[`${cleaned.filter(r=>daysAgo(r.pushed_at)<=90).length} repositories pushed in the last 90 days`,`Active repositories in the last year: ${cleaned.filter(r=>daysAgo(r.pushed_at)<=365).length}`];
    categories[2].evidence=[`${top.filter(r=>!r.fork).length}/${top.length||1} top repositories are original (not forks)`,`${top.filter(r=>r.description).length}/${top.length||1} top repositories have descriptions`,`Top repositories total stars: ${top.reduce((s,r)=>s+r.stargazers_count,0)}`];
    categories[3].evidence=[`Languages detected: ${skillInfo.langs.join(", ")||"none"}`,`Role match: ${skillInfo.matches}/${skillInfo.wanted.length}`];
    categories[5].evidence=[`${user.followers||0} followers`,`${top.reduce((s,r)=>s+r.stargazers_count,0)} stars across analyzed repositories`,`${top.reduce((s,r)=>s+r.forks_count,0)} forks across analyzed repositories`];
    const overall=Math.round(categories.reduce((s,c)=>s+c.score*c.weight/100,0));
    const result={username,name:user.name||user.login,avatar:user.avatar_url,role,portfolio,overall,label:scoreLabel(overall),categories,roadmap:[],ai_feedback:null};
    result.roadmap=roadmap(categories,cleaned,skillInfo,p);
    result.repoSnapshot=top.map(r=>({name:r.name,stars:r.stargazers_count,forks:r.forks_count,description:r.description,pushed_at:r.pushed_at,readme:r.readme,languages:r.languages}));
    result.ai_feedback=await anthropicReview({...result,repoSnapshot:result.repoSnapshot},process.env.ANTHROPIC_API_KEY||"");
    delete result.repoSnapshot;
    return res.status(200).json(result);
  }catch(e){
    if(e.status===404) return res.status(404).json({detail:"GitHub username not found. Check the username and try again."});
    if(e.status===403) return res.status(429).json({detail:"GitHub API rate limit reached. Add a GITHUB_TOKEN in Vercel Environment Variables to increase the limit."});
    console.error(e);
    return res.status(500).json({detail:e.message||"Server error. Please try again."});
  }
};
