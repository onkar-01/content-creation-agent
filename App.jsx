import { useState, useCallback } from "react";

const GOLD = "#D4A847";
const BG = "#09090B";
const CARD = "#18181C";
const SURFACE = "#111115";
const BORDER = "#27272A";
const MUTED = "#71717A";
const TEXT = "#FAFAFA";
const GREEN = "#22C55E";

const IDEA_CHIPS = [
  "How Zepto built a ₹1B business in 2 years",
  "Why passion is bad business advice",
  "I quit my SWE job — month 1 honest review",
  "How to read a P&L statement in 5 minutes",
  "Why Indian startups undercharge",
  "Unit economics explained simply",
  "How CRED makes money (they barely do)",
];

const STEPS = [
  { id: "research", label: "Researching topic & pulling key facts..." },
  { id: "hooks",    label: "Writing 5 viral hooks..." },
  { id: "script",   label: "Writing YouTube script..." },
  { id: "posts",    label: "Crafting all platform posts..." },
  { id: "done",     label: "Content ready!" },
];

const TABS = [
  { id: "hooks",     label: "🎣 Hooks" },
  { id: "script",    label: "🎬 YouTube Script" },
  { id: "linkedin",  label: "💼 LinkedIn" },
  { id: "instagram", label: "📸 Instagram" },
  { id: "twitter",   label: "𝕏 Twitter/X" },
  { id: "research",  label: "🔬 Research" },
];

// ── sleep helper ──
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Claude call via claude.ai built-in proxy ──
async function callClaude(systemPrompt, userPrompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (res.status === 429) {
      const wait = attempt * 8000;
      if (attempt < retries) { await sleep(wait); continue; }
      throw new Error("Rate limited. Please wait 30 seconds and try again.");
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`API error ${res.status}. ${txt.slice(0, 100)}`);
    }
    const data = await res.json();
    return data.content[0].text;
  }
}

function extractSection(raw, marker, nextMarker) {
  const start = raw.indexOf(marker);
  if (start === -1) return "(Section not found — try regenerating)";
  const from = start + marker.length;
  const end = nextMarker ? raw.indexOf(nextMarker, from) : raw.length;
  return raw.slice(from, end === -1 ? raw.length : end).trim();
}

function parseHooks(raw) {
  try {
    const cleaned = raw.trim().replace(/^```json\s*/,"").replace(/\s*```$/,"").replace(/^```\s*/,"");
    return JSON.parse(cleaned);
  } catch {
    // fallback: split by newlines and wrap
    return raw.split("\n").filter(l => l.trim().length > 10).slice(0, 5).map((h, i) => ({
      hook: h.replace(/^\d+[\.\)]\s*/, "").trim(),
      type: ["bold claim","surprising stat","counterintuitive","direct challenge","specific scenario"][i] || "hook"
    }));
  }
}

// ── Styles ──
const s = {
  wrap: { background: BG, minHeight: "100vh", color: TEXT, fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14 },
  header: { borderBottom: `1px solid ${BORDER}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(9,9,11,0.97)", position: "sticky", top: 0, zIndex: 50 },
  logoMark: { width: 32, height: 32, background: GOLD, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#000", flexShrink: 0 },
  badge: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED, background: SURFACE, border: `1px solid ${BORDER}`, padding: "5px 12px", borderRadius: 100, fontFamily: "monospace" },
  dot: { width: 6, height: 6, borderRadius: "50%", background: GREEN },
  main: { maxWidth: 860, margin: "0 auto", padding: "36px 20px 80px" },
  label: { fontFamily: "monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: GOLD, marginBottom: 10, display: "block" },
  inputWrap: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 },
  textarea: { width: "100%", background: "transparent", border: "none", outline: "none", color: TEXT, fontFamily: "inherit", fontSize: 15, fontWeight: 500, resize: "none", lineHeight: 1.6, minHeight: 64 },
  inputFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}`, gap: 10, flexWrap: "wrap" },
  select: { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "7px 10px", color: TEXT, fontFamily: "inherit", fontSize: 13, outline: "none", cursor: "pointer" },
  genBtn: { background: GOLD, color: "#000", border: "none", borderRadius: 8, padding: "10px 22px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 },
  genBtnOff: { opacity: 0.5, cursor: "not-allowed" },
  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 },
  chip: { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 100, padding: "5px 13px", fontSize: 12, color: MUTED, cursor: "pointer" },
  // progress
  progWrap: { marginBottom: 28 },
  progStep: { display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: MUTED, marginBottom: 8, transition: "all .2s" },
  progStepActive: { borderColor: "#8B6E2A", color: TEXT },
  progStepDone: { borderColor: "#166534", color: GREEN },
  // tabs
  tabs: { display: "flex", gap: 4, marginBottom: 18, overflowX: "auto", paddingBottom: 2 },
  tab: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 500, color: MUTED, cursor: "pointer", whiteSpace: "nowrap" },
  tabActive: { background: GOLD, color: "#000", borderColor: GOLD },
  // output card
  outCard: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 },
  outCardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, background: SURFACE },
  outCardTitle: { fontSize: 12, fontWeight: 600, color: MUTED, display: "flex", alignItems: "center", gap: 8 },
  outCardBody: { padding: "16px 18px", whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.78, color: "#D4D4D8", maxHeight: 480, overflowY: "auto" },
  copyBtn: { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 11px", fontSize: 11, color: MUTED, cursor: "pointer" },
  copyBtnOk: { borderColor: GREEN, color: GREEN },
  // hooks
  hookItem: { display: "flex", alignItems: "flex-start", gap: 12, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10 },
  hookNum: { fontFamily: "monospace", fontSize: 10, color: GOLD, background: "rgba(212,168,71,0.1)", border: "1px solid rgba(212,168,71,0.2)", borderRadius: 4, padding: "2px 7px", flexShrink: 0, marginTop: 2 },
  hookText: { fontSize: 14, color: "#D4D4D8", lineHeight: 1.6, flex: 1 },
  // regen
  regenRow: { display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" },
  regenBtn: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 14px", fontSize: 12, color: MUTED, cursor: "pointer" },
  // empty
  empty: { textAlign: "center", padding: "72px 32px", color: MUTED },
  // error
  errBox: { background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 8, padding: "13px 16px", color: "#F87171", fontSize: 13, marginBottom: 18 },
  spinner: { width: 14, height: 14, border: "2px solid rgba(0,0,0,.25)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite", flexShrink: 0 },
};

// ── CopyButton ──
function CopyBtn({ text, label = "📋 Copy" }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 2000); });
  };
  return (
    <button onClick={copy} style={{ ...s.copyBtn, ...(done ? s.copyBtnOk : {}) }}>
      {done ? "✓ Copied!" : label}
    </button>
  );
}

// ── Main App ──
export default function App() {
  const [topic, setTopic]       = useState("");
  const [tone, setTone]         = useState("sharp analytical");
  const [phase, setPhase]       = useState("idle"); // idle | running | done
  const [steps, setSteps]       = useState(STEPS.map(s => ({ ...s, status: "pending" })));
  const [activeTab, setActiveTab] = useState("hooks");
  const [error, setError]       = useState("");
  const [content, setContent]   = useState({
    hooks: [], script: "", linkedin: "", instagram: "", reel: "", twitter: "", research: ""
  });

  const updateStep = useCallback((id, status, labelOverride) => {
    setSteps(prev => prev.map(s =>
      s.id === id ? { ...s, status, ...(labelOverride ? { label: labelOverride } : {}) } : s
    ));
  }, []);

  const identity = `You are the content brain behind OM Vatsa — a former software engineer who quit his job to create business content for ambitious Indian college students and young professionals.
Tone: ${tone}.
Channel: Business thinking, no fluff. Sharp, analytically rigorous. Indian context when relevant.
Always write in first person as Om Vatsa. Punchy, direct, never motivational-poster generic.`;

  const runAgent = async () => {
    if (!topic.trim()) { setError("Please enter a topic first."); return; }
    setError("");
    setPhase("running");
    setSteps(STEPS.map(s => ({ ...s, status: "pending" })));

    try {
      // 1. RESEARCH
      updateStep("research", "active");
      const research = await callClaude(identity,
        `Research brief for: "${topic}"
Return structured note:
CORE INSIGHT: (most surprising fact)
KEY FACTS: (5-7 specific numbers/data)
ANGLES: (3 content approaches)
CONTRARIAN TAKE: (unpopular opinion)
INDIA CONTEXT: (India-specific relevance)
SOURCES TO MENTION: (credible refs/examples)
Be specific. No vague generalities.`
      );
      updateStep("research", "done");
      setContent(c => ({ ...c, research }));
      await sleep(1200);

      // 2. HOOKS
      updateStep("hooks", "active");
      const hooksRaw = await callClaude(identity,
        `Topic: "${topic}"
Context: ${research.slice(0, 400)}

Write 5 viral hooks. Rules:
- Under 2 sentences each
- Create immediate curiosity/tension
- Don't start with "I" or "Did you know"
- Use: surprising stat / bold claim / counterintuitive / direct challenge / specific scenario

Return ONLY valid JSON array, no markdown fences:
[{"hook":"...","type":"bold claim"}]`
      );
      updateStep("hooks", "done");
      setContent(c => ({ ...c, hooks: parseHooks(hooksRaw) }));
      await sleep(1200);

      // 3. SCRIPT
      updateStep("script", "active");
      const script = await callClaude(identity,
        `Topic: "${topic}"
Research: ${research.slice(0, 350)}

Write a complete YouTube script, 7-10 min video.
HOOK (0:00-0:20): Most gripping open. No intro yet.
CONTEXT (0:20-1:00): Why this matters now. One surprising stat.
BREAKDOWN (1:00-7:00): 3-4 sections with clear headers. Specific examples.
THE INSIGHT (7:00-8:30): Your unique take. What most people miss.
CTA (8:30-end): Subscribe + newsletter. Brief.
Format with timestamps. Write as Om says it on camera.`
      );
      updateStep("script", "done");
      setContent(c => ({ ...c, script }));
      await sleep(1200);

      // 4. ALL POSTS — one single call
      updateStep("posts", "active");
      const postsRaw = await callClaude(identity,
        `Topic: "${topic}"
Research: ${research.slice(0, 300)}

Write all 4 posts. Use EXACT markers:

===LINKEDIN===
150-250 words. Hook first. Line breaks every 1-2 sentences. End with a question. Max 3 hashtags.

===INSTAGRAM_CAPTION===
100-150 words. Hook line 1. Conversational. End with "Save this if you found it useful." Then 10-15 hashtags.

===REEL_SCRIPT===
45-60 second script. [0-3s] HOOK, [3-20s] SETUP, [20-45s] PAYOFF, [45-60s] CTA. Write exactly what Om says.

===TWITTER_THREAD===
6-8 tweets. Tweet 1 hook <280 chars. Tweets 2-6 one insight each <280 chars numbered (2/8 etc). Tweet 7 contrarian take. Tweet 8 CTA follow @omvatsa. Separate tweets with ---`
      );
      updateStep("posts", "done");
      setContent(c => ({
        ...c,
        linkedin:  extractSection(postsRaw, "===LINKEDIN===", "===INSTAGRAM_CAPTION==="),
        instagram: extractSection(postsRaw, "===INSTAGRAM_CAPTION===", "===REEL_SCRIPT==="),
        reel:      extractSection(postsRaw, "===REEL_SCRIPT===", "===TWITTER_THREAD==="),
        twitter:   extractSection(postsRaw, "===TWITTER_THREAD===", null),
      }));

      updateStep("done", "done");
      await sleep(400);
      setPhase("done");

    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setPhase("idle");
    }
  };

  const regenSection = async (section) => {
    if (!topic.trim()) return;
    setError("");
    setPhase("running");

    try {
      if (section === "hooks") {
        setSteps(STEPS.map(s => s.id === "hooks" ? { ...s, status: "active" } : s));
        const raw = await callClaude(identity,
          `Topic: "${topic}" — 5 NEW viral hooks, completely different angles. Return ONLY valid JSON array: [{"hook":"...","type":"..."}]`
        );
        setContent(c => ({ ...c, hooks: parseHooks(raw) }));

      } else if (section === "script") {
        setSteps(STEPS.map(s => s.id === "script" ? { ...s, status: "active" } : s));
        const s2 = await callClaude(identity,
          `Rewrite YouTube script for "${topic}" — completely different opening and structure. Full 7-10 min with timestamps.`
        );
        setContent(c => ({ ...c, script: s2 }));

      } else if (section === "posts") {
        setSteps(STEPS.map(s => s.id === "posts" ? { ...s, status: "active" } : s));
        const raw = await callClaude(identity,
          `Topic: "${topic}" — All 4 posts with DIFFERENT angles. Use exact markers:
===LINKEDIN===
New post, different hook, 150-250 words, end with question, max 3 hashtags.
===INSTAGRAM_CAPTION===
New caption, different hook, 100-150 words, end with "Save this." + hashtags.
===REEL_SCRIPT===
New 45-60s script, different hook. [0-3s],[3-20s],[20-45s],[45-60s] format.
===TWITTER_THREAD===
New 6-8 tweet thread, fresh hook. Number each tweet. Separate with ---`
        );
        setContent(c => ({
          ...c,
          linkedin:  extractSection(raw, "===LINKEDIN===", "===INSTAGRAM_CAPTION==="),
          instagram: extractSection(raw, "===INSTAGRAM_CAPTION===", "===REEL_SCRIPT==="),
          reel:      extractSection(raw, "===REEL_SCRIPT===", "===TWITTER_THREAD==="),
          twitter:   extractSection(raw, "===TWITTER_THREAD===", null),
        }));
      }
    } catch (err) {
      setError(err.message || "Regeneration failed. Wait a moment and try again.");
    } finally {
      setPhase("done");
    }
  };

  const isRunning = phase === "running";

  return (
    <div style={s.wrap}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        * { box-sizing: border-box; }
        textarea::placeholder { color: #52525B; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #27272A; border-radius: 4px; }
        button:hover { opacity: .85; }
      `}</style>

      {/* HEADER */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={s.logoMark}>OV</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>OM Vatsa · Content Agent</div>
            <div style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>AI-powered content pipeline</div>
          </div>
        </div>
        <div style={s.badge}>
          <div style={{ ...s.dot, animation: "pulse 2s infinite" }} />
          Claude AI · Ready
        </div>
      </div>

      <div style={s.main}>

        {/* INPUT */}
        <div style={{ marginBottom: 32 }}>
          <span style={s.label}>Your Topic</span>
          <div style={s.inputWrap}>
            <textarea
              style={s.textarea}
              placeholder='E.g. "How Zepto became a ₹1B company in 2 years" or "Why most founders fail in year 2"'
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runAgent(); }}
              rows={3}
            />
            <div style={s.inputFooter}>
              <select style={s.select} value={tone} onChange={e => setTone(e.target.value)}>
                <option value="sharp analytical">🔍 Sharp & Analytical</option>
                <option value="contrarian bold">⚡ Contrarian & Bold</option>
                <option value="personal story">📖 Personal Story</option>
                <option value="educational clear">📚 Educational & Clear</option>
                <option value="conversational">💬 Conversational</option>
              </select>
              <button
                style={{ ...s.genBtn, ...(isRunning ? s.genBtnOff : {}) }}
                onClick={runAgent}
                disabled={isRunning}
              >
                {isRunning
                  ? <><div style={s.spinner} /> Generating...</>
                  : <><span>⚡</span> Generate Everything</>
                }
              </button>
            </div>
          </div>

          {/* Chips */}
          <div style={s.chips}>
            {IDEA_CHIPS.map(c => (
              <button key={c} style={s.chip} onClick={() => setTopic(c)}>{c}</button>
            ))}
          </div>
        </div>

        {/* ERROR */}
        {error && <div style={s.errBox}>⚠️ {error}</div>}

        {/* PROGRESS */}
        {isRunning && (
          <div style={s.progWrap}>
            <span style={s.label}>Working on it...</span>
            {steps.map(st => (
              <div key={st.id} style={{
                ...s.progStep,
                ...(st.status === "active" ? s.progStepActive : {}),
                ...(st.status === "done"   ? s.progStepDone   : {}),
              }}>
                <div style={{ width: 20, flexShrink: 0, textAlign: "center" }}>
                  {st.status === "active" && <div style={{ ...s.spinner, borderTopColor: GOLD, borderColor: BORDER }} />}
                  {st.status === "done"   && "✓"}
                  {st.status === "pending" && "○"}
                </div>
                <span>{st.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* OUTPUT */}
        {phase === "done" && (
          <div>
            <span style={s.label}>Your Content — Ready to Use</span>

            {/* Tabs */}
            <div style={s.tabs}>
              {TABS.map(t => (
                <button
                  key={t.id}
                  style={{ ...s.tab, ...(activeTab === t.id ? s.tabActive : {}) }}
                  onClick={() => setActiveTab(t.id)}
                >{t.label}</button>
              ))}
            </div>

            {/* HOOKS */}
            {activeTab === "hooks" && (
              <div style={s.outCard}>
                <div style={s.outCardHead}>
                  <div style={s.outCardTitle}>🎣 5 Viral Hooks — use one to open every post</div>
                  <CopyBtn text={content.hooks.map((h,i) => `Hook ${i+1}: ${h.hook}`).join("\n\n")} label="📋 Copy All" />
                </div>
                <div style={{ padding: "14px 16px" }}>
                  {content.hooks.map((h, i) => (
                    <div key={i} style={s.hookItem}>
                      <span style={s.hookNum}>#{i+1} {h.type}</span>
                      <div style={s.hookText}>{h.hook}</div>
                      <CopyBtn text={h.hook} label="Copy" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SCRIPT */}
            {activeTab === "script" && (
              <div style={s.outCard}>
                <div style={s.outCardHead}>
                  <div style={s.outCardTitle}>🎬 YouTube Script</div>
                  <CopyBtn text={content.script} />
                </div>
                <div style={s.outCardBody}>{content.script}</div>
              </div>
            )}

            {/* LINKEDIN */}
            {activeTab === "linkedin" && (
              <div style={s.outCard}>
                <div style={s.outCardHead}>
                  <div style={s.outCardTitle}>💼 LinkedIn Post</div>
                  <CopyBtn text={content.linkedin} />
                </div>
                <div style={s.outCardBody}>{content.linkedin}</div>
              </div>
            )}

            {/* INSTAGRAM */}
            {activeTab === "instagram" && (
              <>
                <div style={s.outCard}>
                  <div style={s.outCardHead}>
                    <div style={s.outCardTitle}>📸 Instagram Caption</div>
                    <CopyBtn text={content.instagram} />
                  </div>
                  <div style={s.outCardBody}>{content.instagram}</div>
                </div>
                <div style={s.outCard}>
                  <div style={s.outCardHead}>
                    <div style={s.outCardTitle}>🎬 Reel Script (45–60 sec)</div>
                    <CopyBtn text={content.reel} />
                  </div>
                  <div style={s.outCardBody}>{content.reel}</div>
                </div>
              </>
            )}

            {/* TWITTER */}
            {activeTab === "twitter" && (
              <div style={s.outCard}>
                <div style={s.outCardHead}>
                  <div style={s.outCardTitle}>𝕏 Twitter/X Thread</div>
                  <CopyBtn text={content.twitter} />
                </div>
                <div style={s.outCardBody}>{content.twitter}</div>
              </div>
            )}

            {/* RESEARCH */}
            {activeTab === "research" && (
              <div style={s.outCard}>
                <div style={s.outCardHead}>
                  <div style={s.outCardTitle}>🔬 Research Brief</div>
                  <CopyBtn text={content.research} />
                </div>
                <div style={s.outCardBody}>{content.research}</div>
              </div>
            )}

            {/* Regen buttons */}
            <div style={s.regenRow}>
              <button style={s.regenBtn} onClick={runAgent}>⚡ Regenerate Everything</button>
              <button style={s.regenBtn} onClick={() => regenSection("hooks")}>🎣 New Hooks</button>
              <button style={s.regenBtn} onClick={() => regenSection("script")}>🎬 New Script</button>
              <button style={s.regenBtn} onClick={() => regenSection("posts")}>📱 New Posts</button>
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {phase === "idle" && !error && (
          <div style={s.empty}>
            <div style={{ fontSize: 48, marginBottom: 14, opacity: .5 }}>⚡</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: MUTED, marginBottom: 8 }}>Your AI content team is ready</div>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              Type a business topic above — or pick one of the idea chips.<br />
              I'll research it, write the script, craft the hooks, and generate posts<br />
              for YouTube, LinkedIn, Instagram, and X. All at once.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
