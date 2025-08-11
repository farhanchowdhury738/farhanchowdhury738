// streak.js — builds streak.svg from your GitHub contributions using GraphQL
const fs = require("fs");
const https = require("https");

const USER = process.env.USERNAME || "farhanchowdhury738";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) { console.error("GITHUB_TOKEN is missing"); process.exit(1); }

const now = new Date();
const to = now.toISOString();
const from = new Date(now); from.setFullYear(from.getFullYear() - 1);
const fromISO = from.toISOString();

const query = `
query ($login:String!, $from:DateTime!, $to:DateTime!) {
  user(login:$login){
    contributionsCollection(from:$from, to:$to){
      contributionCalendar{
        weeks{ contributionDays{ date contributionCount } }
      }
    }
  }
}`;

function graphql(q, vars) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: q, variables: vars });
    const req = https.request({
      hostname: "api.github.com",
      path: "/graphql",
      method: "POST",
      headers: {
        "User-Agent": "streak-card",
        Authorization: `bearer ${TOKEN}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    }, (res) => {
      let body = ""; res.on("data", c => body += c);
      res.on("end", () => {
        try { const j = JSON.parse(body); if (j.errors) return reject(j.errors); resolve(j.data); }
        catch(e){ reject(e); }
      });
    });
    req.on("error", reject); req.write(data); req.end();
  });
}

function computeStreak(days) {
  let longest = 0, current = 0, run = 0;
  for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; if (run > longest) longest = run; }
  for (let i = days.length - 1; i >= 0; i--) { if (days[i].contributionCount > 0) current++; else break; }
  return { current, longest };
}

function renderSVG({ current, longest }) {
  const w = 420, h = 120;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub Streak">
  <rect x="0" y="0" rx="12" ry="12" width="${w}" height="${h}" fill="#0d1117" stroke="#30363d"/>
  <g font-family="Inter,Segoe UI,Arial" fill="#e6edf3">
    <text x="20" y="36" font-size="20" font-weight="600">GitHub Streak</text>
    <text x="20" y="66" font-size="16" fill="#58a6ff">Current: ${current} day${current===1?"":"s"}</text>
    <text x="220" y="66" font-size="16" fill="#a5d6ff">Longest: ${longest} day${longest===1?"":"s"}</text>
    <text x="20" y="94" font-size="12" fill="#8b949e">Updated: ${new Date().toISOString().slice(0,10)}</text>
  </g>
</svg>`;
}

(async () => {
  const data = await graphql(query, { login: USER, from: fromISO, to });
  const weeks = data.user.contributionsCollection.contributionCalendar.weeks;
  const days = weeks.flatMap(w => w.contributionDays)
                    .sort((a,b)=> new Date(a.date) - new Date(b.date));
  const res = computeStreak(days);
  fs.writeFileSync("streak.svg", renderSVG(res));
  console.log(`streak.svg -> current=${res.current}, longest=${res.longest}`);
})();
