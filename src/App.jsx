import { useState, useCallback, useRef } from "react";

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
      headers: {
        "Content-Type": "application/json",
        "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
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
  // media upload
  uploadZone: { border: `2px dashed ${BORDER}`, borderRadius: 12, padding: "20px", textAlign: "center", cursor: "pointer", background: SURFACE, marginTop: 14, transition: "border-color 0.2s" },
  uploadZoneActive: { borderColor: GOLD },
  uploadThumbnail: { width: 56, height: 56, borderRadius: 8, objectFit: "cover", background: CARD },
  mediaBadge: { display: "inline-flex", alignItems: "center", gap: 8, background: CARD, border: `1px solid ${BORDER}`, padding: "6px 12px", borderRadius: 8, marginTop: 8 },
  
  // toggle buttons
  toggleBar: { display: "flex", background: SURFACE, padding: 3, borderRadius: 8, border: `1px solid ${BORDER}` },
  toggleBtn: { background: "transparent", border: "none", color: MUTED, padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" },
  toggleBtnActive: { background: CARD, color: TEXT, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" },

  // mockup styles
  mockWrap: { background: "#000", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, fontFamily: "system-ui, -apple-system, sans-serif" },
  mockHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  mockAvatar: { width: 40, height: 40, borderRadius: "50%", border: `1px solid ${BORDER}`, objectFit: "cover" },
  mockName: { fontWeight: 600, fontSize: 14, color: "#FFF" },
  mockMeta: { fontSize: 11, color: "#8E8E93" },
  mockBody: { fontSize: 14, color: "#E5E5EA", lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: 12 },
  mockMedia: { width: "100%", borderRadius: 8, border: `1px solid ${BORDER}`, marginTop: 8, maxHeight: 360, objectFit: "contain", background: SURFACE },
  mockFooter: { display: "flex", justifyContent: "space-between", borderTop: "1px solid #1C1C1E", paddingTop: 10, marginTop: 10, color: "#8E8E93", fontSize: 13 },
  mockFooterIcon: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer" },

  // twitter specific
  tweetItem: { borderBottom: "1px solid #1C1C1E", paddingBottom: 16, marginBottom: 16, position: "relative" },
  tweetThreadLine: { position: "absolute", left: 19, top: 44, bottom: -16, width: 2, background: "#1C1C1E" },

  // instagram specific
  igMock: { maxWidth: 450, margin: "0 auto", border: `1px solid ${BORDER}`, borderRadius: 12, background: "#000", overflow: "hidden" },
  igHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottom: "1px solid #1C1C1E" },
  igBody: { padding: "12px 16px" },
  igCaption: { fontSize: 13, color: "#E5E5EA", lineHeight: 1.5 },
  igHashtags: { color: "#0095F6", fontSize: 13 },

  // youtube specific
  ytMock: { border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE, overflow: "hidden" },
  ytPlayer: { width: "100%", aspectRatio: "16/9", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer" },
  ytPlayBtn: { width: 64, height: 64, borderRadius: "50%", background: "rgba(230,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontSize: 24 },
  ytTitle: { fontSize: 16, fontWeight: 700, color: "#FFF", padding: "12px 16px 4px" },
  ytMeta: { fontSize: 12, color: MUTED, padding: "0 16px 12px" },
  ytDesc: { background: CARD, margin: "0 16px 16px", padding: 12, borderRadius: 8, fontSize: 13, color: "#E5E5EA", whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto" },

  // publish modal
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 },
  modalCard: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, width: "100%", maxWidth: 580, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" },
  modalHeader: { padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" },
  modalBody: { padding: 24, overflowY: "auto", flex: 1 },
  modalFooter: { padding: "16px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "flex-end", gap: 12, background: SURFACE },
  platformSelectRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 8 },
  logContainer: { background: "#000", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14, fontFamily: "monospace", fontSize: 12, color: "#A1A1AA", maxHeight: 200, overflowY: "auto", marginTop: 12 },
  progressBarWrap: { background: SURFACE, height: 6, borderRadius: 3, overflow: "hidden", width: "100%", marginTop: 12 },
  progressBar: { background: GOLD, height: "100%", transition: "width 0.2s ease" },
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

const MOCK_DATA = {
  zepto: {
    research: `CORE INSIGHT: Zepto's success is not just delivery speed; it's hyper-local real estate efficiency and proprietary dark store picking algorithms.
KEY FACTS:
1. $1.4B valuation achieved in under 2 years.
2. Dark stores optimized to retrieve items in under 60 seconds.
3. Average delivery radius restricted to 1.8km.
4. Over 70% repeat user rate in cohort studies.
5. Average picking time reduced to 45 seconds using automated layout routing.
ANGLES:
- The logistics breakthrough (how dark stores route items).
- The founder's gamble (Stanford dropouts competing with giants).
- The unit economics (how high density makes quick commerce profitable).
CONTRARIAN TAKE: Quick commerce isn't about speed; it's a real estate play. He who owns the micro-warehouses closest to high-density apartments wins.
INDIA CONTEXT: India's dense urban centers and low delivery labor costs make it the perfect (and perhaps only) breeding ground for sustainable 10-minute delivery.
SOURCES TO MENTION: Zepto's pitch decks, Redseer reports on Q-commerce.`,
    hooks: [
      { hook: "Zepto is now valued at $1.4B. But their biggest secret has nothing to do with fast delivery.", type: "bold claim" },
      { hook: "Two 19-year-olds dropped out of Stanford to build a business that everyone said would fail. Here's how they did it.", type: "specific scenario" },
      { hook: "Why 10-minute delivery is actually a real estate business in disguise.", type: "counterintuitive" },
      { hook: "Inside the algorithm that picks your groceries in 45 seconds.", type: "surprising stat" },
      { hook: "How Zepto proved every quick commerce skeptic in India wrong.", type: "direct challenge" }
    ],
    script: `HOOK (0:00-0:20)
You think Zepto is a delivery company. You're wrong. In the next 7 minutes, I'm going to show you why Zepto is actually a real-estate juggernaut that cracked the code of Indian quick commerce.

CONTEXT (0:20-1:00)
In 2021, quick commerce was declared dead. Delivery costs were soaring, and customers were returning to local shops. Yet, Aadit and Kaivalya dropped out of Stanford, raised millions, and built a $1.4 Billion empire.

BREAKDOWN (1:00-7:00)
1. The Micro-Warehouse Matrix: Zepto doesn't use massive warehouses. They lease tiny 2,000 sq ft dark stores in the most expensive pockets of Mumbai and Bangalore.
2. The 45-Second Pick: Once you hit order, a Picker's tablet shows the optimized path. Items are arranged by purchase frequency.
3. The Density Dividend: 10-minute delivery only works if you have 100 orders per square kilometer.

THE INSIGHT (7:00-8:30)
Most startups fail because they scale demand before they master unit economics. Zepto did the opposite.

CTA (8:30-end)
Subscribe for more deep dives into business models. Check the newsletter link below.`,
    linkedin: `Zepto is now valued at $1.4B. 

But their success has nothing to do with "speed." It's about hyper-local density.

Here is the breakdown:
1. Average delivery radius is capped at 1.8km.
2. Pickers retrieve items in under 45 seconds due to algorithmic dark-store layouts.
3. High repeat cohort rates (70%+) drive down acquisition costs.

Quick commerce isn't a logistics play. It's a real estate monopoly.

Agree? Let's discuss in the comments. #startups #business #india`,
    instagram: `Zepto's secret $1.4B playbook. Hint: it's not about how fast the bike rides. It's about dark store layouts and city density. Save this if you found it useful. #zepto #quickcommerce #startupindia #unicorns #businessmodels`,
    reel: `[0-3s] HOOK: Zepto is a $1.4B real estate giant, not a delivery app. Here's why.
[3-20s] SETUP: Two Stanford dropouts built Zepto when everyone said Q-commerce is a cash-burn disaster.
[20-45s] PAYOFF: Their secret? Dark store pickers retrieve orders in 45s because items are arranged by buy frequency, and they never deliver beyond 1.8km.
[45-60s] CTA: Subscribe for more unfiltered business stories.`,
    twitter: `Zepto is valued at $1.4B. Here's the logistics playbook most people miss: (1/5)
---
Dark stores are restricted to a 1.8km radius. Any further, and the unit economics collapse. (2/5)
---
Picking is optimized using heatmaps. Popular items are placed closest to the packing table. (3/5)
---
Q-commerce is a density game. You need high population per sq km to make the delivery route profitable. (4/5)
---
Follow @omvatsa for more breakdown of Indian startup business models! (5/5)`
  },
  generic: {
    research: `CORE INSIGHT: The most successful creators build distribution first, product second.
KEY FACTS:
1. Product-led growth is shifting to audience-led growth.
2. Cost of customer acquisition (CAC) has increased by 60% across SaaS.
3. Creator-led brands have 4x higher margins due to $0 organic CAC.
4. Audience trust yields higher LTV (Lifetime Value).
ANGLES:
- Audience-first development.
- CAC optimization models.
- Building in public.
CONTRARIAN TAKE: Don't build a product. Build a distribution channel first. The product is easy; the attention is hard.
INDIA CONTEXT: India's massive digital population makes digital distribution the ultimate leverage.
SOURCES TO MENTION: Paul Graham essays, Lenny's Newsletter.`,
    hooks: [
      { hook: "Stop building products. Build distribution first.", type: "direct challenge" },
      { hook: "Why the cost of launching a startup just went up by 60%, and how to beat it.", type: "surprising stat" },
      { hook: "Attention is the new code. Here's why media companies are winning SaaS.", type: "bold claim" },
      { hook: "How to validate a business idea in 24 hours without writing a line of code.", type: "specific scenario" },
      { hook: "Why customer acquisition is about to break your business model.", type: "counterintuitive" }
    ],
    script: `HOOK (0:00-0:20)
If you are building a product in 2026, you're doing it wrong. Let me explain why distribution is the only moat that matters anymore.

CONTEXT (0:20-1:00)
CAC is up 60%. Paid ads don't work like they used to. The founders winning today aren't engineers; they're media companies.

BREAKDOWN (1:00-7:00)
1. The Attention Economy: Product is a commodity.
2. The Built-In Beta: Your audience tests your MVP.
3. Zero-Dollar Marketing: The leverage of organic distribution.

THE INSIGHT (7:00-8:30)
Build an audience, understand their pain points, and then sell them the solution.

CTA (8:30-end)
Subscribe for more business thinking. Link in bio.`,
    linkedin: `Stop building products in search of an audience.

Build the audience first. 

With CAC rising by 60% across channels, launching without distribution is a suicide mission.

Build in public. Gather feedback. Launch when you have 10,000 fans waiting.

Do you agree? Let's chat below. #marketing #business #creator`,
    instagram: `Why distribution is your only real moat. Stop building in secret. Save this if you found it useful. #marketingstrategy #distribution #buildinginpublic #startups #indiehackers`,
    reel: `[0-3s] HOOK: Stop building products. Build distribution first.
[3-20s] SETUP: Launching a product today is easier than ever, but customer acquisition costs are up 60%.
[20-45s] PAYOFF: The founders winning today build their audience first, get feedback, and launch to an eager waitlist.
[45-60s] CTA: Follow @omvatsa for daily business strategies.`,
    twitter: `Distribution is the ultimate leverage for 2026 founders. (1/4)
---
CAC is up 60%. Paid advertising is no longer viable for early-stage MVPs. (2/4)
---
If you build in public, you create a direct feedback loop and a zero-CAC launch channel. (3/4)
---
Follow @omvatsa for more insights on modern startups! (4/4)`
  }
};

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

  // --- Media upload state ---
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaUrl, setMediaUrl] = useState(null);
  const fileInputRef = useRef(null);

  // --- View Mode state ('raw' vs 'preview') ---
  const [viewMode, setViewMode] = useState("raw");

  // --- Publish wizard modal state ---
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishPlatforms, setPublishPlatforms] = useState({ linkedin: true, instagram: true, twitter: true, youtube: true });
  const [publishStep, setPublishStep] = useState(0); // 0: ready, 1: publishing, 2: success
  const [publishLogs, setPublishLogs] = useState([]);
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishUrls, setPublishUrls] = useState({});
  const [useMockData, setUseMockData] = useState(true);

  const handleMediaUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      setMediaFile(file);
      setMediaUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveMedia = () => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setMediaFile(null);
    setMediaUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadPlatformFile = (platform, text) => {
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${platform}_post.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const startPublishing = async () => {
    setPublishStep(1);
    setPublishProgress(0);
    setPublishLogs([]);
    
    const addLog = (msg) => {
      setPublishLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const selectedPlatforms = Object.keys(publishPlatforms).filter(p => publishPlatforms[p]);
    if (selectedPlatforms.length === 0) {
      addLog("Error: No platforms selected for publishing.");
      setPublishStep(0);
      return;
    }

    addLog("🚀 Starting multi-platform publishing engine...");
    await delay(600);
    setPublishProgress(10);

    if (mediaFile) {
      addLog(`📁 Preparing media: "${mediaFile.name}" (${(mediaFile.size / 1024 / 1024).toFixed(2)} MB)...`);
      await delay(800);
      setPublishProgress(25);
      addLog("☁️ Uploading media file to CDN servers...");
      await delay(1200);
      setPublishProgress(40);
      addLog("✓ Media asset uploaded and cached successfully.");
    } else {
      addLog("ℹ️ No media attached. Proceeding with text-only publication.");
      setPublishProgress(30);
      await delay(600);
    }

    const totalSteps = selectedPlatforms.length;
    let stepCount = 0;

    const urls = {};

    for (const p of selectedPlatforms) {
      const platformName = p.charAt(0).toUpperCase() + p.slice(1);
      addLog(`🔐 [${platformName}] Authenticating API credentials...`);
      await delay(600);
      addLog(`📤 [${platformName}] Sending payload to queue...`);
      await delay(800);
      addLog(`✨ [${platformName}] Creating live publication...`);
      await delay(700);
      addLog(`✓ [${platformName}] Post published successfully!`);
      
      stepCount++;
      setPublishProgress(40 + Math.floor((stepCount / totalSteps) * 60));

      if (p === "linkedin") urls.linkedin = "https://www.linkedin.com/feed/update/urn:li:share:" + Math.floor(Math.random() * 10000000000);
      if (p === "twitter") urls.twitter = "https://twitter.com/omvatsa/status/" + Math.floor(Math.random() * 10000000000);
      if (p === "instagram") urls.instagram = "https://www.instagram.com/p/C" + Math.random().toString(36).substring(2, 10);
      if (p === "youtube") urls.youtube = "https://youtu.be/" + Math.random().toString(36).substring(2, 13);
    }

    addLog("🎉 All tasks completed. Wrapping up publication transaction...");
    await delay(500);
    setPublishUrls(urls);
    setPublishStep(2);
  };

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
      if (useMockData) {
        const isZepto = topic.toLowerCase().includes("zepto") || topic.toLowerCase().includes("₹1b") || topic.toLowerCase().includes("1b");
        const mock = isZepto ? MOCK_DATA.zepto : MOCK_DATA.generic;

        // 1. RESEARCH
        updateStep("research", "active");
        await sleep(1200);
        updateStep("research", "done");
        setContent(c => ({ ...c, research: mock.research }));

        // 2. HOOKS
        updateStep("hooks", "active");
        await sleep(1200);
        updateStep("hooks", "done");
        setContent(c => ({ ...c, hooks: mock.hooks }));

        // 3. SCRIPT
        updateStep("script", "active");
        await sleep(1200);
        updateStep("script", "done");
        setContent(c => ({ ...c, script: mock.script }));

        // 4. ALL POSTS
        updateStep("posts", "active");
        await sleep(1200);
        updateStep("posts", "done");
        setContent(c => ({
          ...c,
          linkedin:  mock.linkedin,
          instagram: mock.instagram,
          reel:      mock.reel,
          twitter:   mock.twitter,
        }));

        updateStep("done", "done");
        await sleep(400);
        setPhase("done");
        return;
      }

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
      if (useMockData) {
        const isZepto = topic.toLowerCase().includes("zepto") || topic.toLowerCase().includes("₹1b") || topic.toLowerCase().includes("1b");
        const mock = isZepto ? MOCK_DATA.zepto : MOCK_DATA.generic;
        await sleep(800);
        if (section === "hooks") {
          setContent(c => ({ ...c, hooks: mock.hooks }));
        } else if (section === "script") {
          setContent(c => ({ ...c, script: mock.script }));
        } else if (section === "posts") {
          setContent(c => ({
            ...c,
            linkedin:  mock.linkedin,
            instagram: mock.instagram,
            reel:      mock.reel,
            twitter:   mock.twitter,
          }));
        }
        return;
      }

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

            {/* Media Upload Zone */}
            <div 
              style={{
                ...s.uploadZone,
                ...(mediaFile ? s.uploadZoneActive : {})
              }}
              onClick={() => fileInputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
                  setMediaFile(file);
                  setMediaUrl(URL.createObjectURL(file));
                }
              }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleMediaUpload} 
                accept="image/*,video/*" 
                style={{ display: "none" }} 
              />
              
              {!mediaFile ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 20 }}>🖼️</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>Drag & drop or click to upload media</span>
                  <span style={{ fontSize: 11, color: MUTED }}>Supports images (PNG, JPG, WebP) and videos (MP4, MOV)</span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                    {mediaFile.type.startsWith("image/") ? (
                      <img src={mediaUrl} style={s.uploadThumbnail} alt="Upload Preview" />
                    ) : (
                      <div style={{ ...s.uploadThumbnail, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎥</div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: TEXT, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {mediaFile.name}
                      </div>
                      <div style={{ fontSize: 11, color: MUTED }}>
                        {(mediaFile.size / 1024 / 1024).toFixed(2)} MB · {mediaFile.type.split("/")[0].toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRemoveMedia(); }}
                    style={{
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#EF4444",
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div style={s.inputFooter}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <select style={s.select} value={tone} onChange={e => setTone(e.target.value)}>
                  <option value="sharp analytical">🔍 Sharp & Analytical</option>
                  <option value="contrarian bold">⚡ Contrarian & Bold</option>
                  <option value="personal story">📖 Personal Story</option>
                  <option value="educational clear">📚 Educational & Clear</option>
                  <option value="conversational">💬 Conversational</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED, cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={useMockData} 
                    onChange={(e) => setUseMockData(e.target.checked)} 
                    style={{ accentColor: GOLD, cursor: "pointer" }} 
                  />
                  Mock Offline Mode
                </label>
              </div>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={s.toggleBar}>
                      <button 
                        style={{ ...s.toggleBtn, ...(viewMode === "raw" ? s.toggleBtnActive : {}) }}
                        onClick={() => setViewMode("raw")}
                      >
                        Raw Text
                      </button>
                      <button 
                        style={{ ...s.toggleBtn, ...(viewMode === "preview" ? s.toggleBtnActive : {}) }}
                        onClick={() => setViewMode("preview")}
                      >
                        Mock Preview
                      </button>
                    </div>
                    <CopyBtn text={content.script} />
                  </div>
                </div>
                {viewMode === "raw" ? (
                  <div style={s.outCardBody}>{content.script}</div>
                ) : (
                  <div style={{ padding: 18, background: "#0D0D0E" }}>
                    <div style={s.ytMock}>
                      <div style={s.ytPlayer}>
                        {mediaUrl ? (
                          mediaFile.type.startsWith("image/") ? (
                            <img src={mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="YouTube Thumbnail" />
                          ) : (
                            <video src={mediaUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          )
                        ) : (
                          <div style={{ width: "100%", height: "100%", background: "#18181B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ textAlign: "center", color: MUTED }}>
                              <span style={{ fontSize: 48 }}>🎬</span>
                              <div style={{ fontSize: 14, marginTop: 10, color: TEXT }}>Thumbnail Preview</div>
                            </div>
                          </div>
                        )}
                        <div style={{ position: "absolute", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", background: "rgba(0,0,0,0.3)" }}>
                          <div style={s.ytPlayBtn}>▶</div>
                        </div>
                      </div>
                      
                      <div style={s.ytTitle}>{topic || "How I built my AI Content Agent"}</div>
                      <div style={s.ytMeta}>12,430 views • Jul 7, 2026 • #coding #startups</div>
                      
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 16px", borderBottom: `1px solid ${BORDER}`, marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <img src="/src/assets/omvatsa_avatar.png" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} alt="Om Vatsa" />
                          <div>
                            <div style={{ fontWeight: 600, color: TEXT, fontSize: 14 }}>Om Vatsa</div>
                            <div style={{ fontSize: 11, color: MUTED }}>242K subscribers</div>
                          </div>
                        </div>
                        <button style={{ background: "#FAFAFA", color: "#000", border: "none", padding: "8px 16px", borderRadius: 20, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                          Subscribe
                        </button>
                      </div>

                      <div style={{ padding: "0 16px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }}>📝 SCRIPT & DESCRIPTION</div>
                      </div>
                      <div style={s.ytDesc}>{content.script}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LINKEDIN */}
            {activeTab === "linkedin" && (
              <div style={s.outCard}>
                <div style={s.outCardHead}>
                  <div style={s.outCardTitle}>💼 LinkedIn Post</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={s.toggleBar}>
                      <button 
                        style={{ ...s.toggleBtn, ...(viewMode === "raw" ? s.toggleBtnActive : {}) }}
                        onClick={() => setViewMode("raw")}
                      >
                        Raw Text
                      </button>
                      <button 
                        style={{ ...s.toggleBtn, ...(viewMode === "preview" ? s.toggleBtnActive : {}) }}
                        onClick={() => setViewMode("preview")}
                      >
                        Mock Preview
                      </button>
                    </div>
                    <CopyBtn text={content.linkedin} />
                  </div>
                </div>
                {viewMode === "raw" ? (
                  <div style={s.outCardBody}>{content.linkedin}</div>
                ) : (
                  <div style={{ padding: 18, background: "#0D0D0E" }}>
                    <div style={s.mockWrap}>
                      <div style={s.mockHeader}>
                        <img src="/src/assets/omvatsa_avatar.png" style={s.mockAvatar} alt="Om Vatsa" />
                        <div>
                          <div style={s.mockName}>Om Vatsa</div>
                          <div style={s.mockMeta}>Former SWE • Business Content Creator</div>
                          <div style={{ ...s.mockMeta, fontSize: 10, marginTop: 1 }}>1h • Edited • 🌐</div>
                        </div>
                      </div>
                      <div style={s.mockBody}>
                        {content.linkedin}
                      </div>
                      {mediaUrl && (
                        mediaFile.type.startsWith("image/") ? (
                          <img src={mediaUrl} style={s.mockMedia} alt="Post Attachment" />
                        ) : (
                          <video src={mediaUrl} controls style={s.mockMedia} />
                        )
                      )}
                      <div style={s.mockFooter}>
                        <div style={s.mockFooterIcon}>👍 <span>Like</span></div>
                        <div style={s.mockFooterIcon}>💬 <span>Comment</span></div>
                        <div style={s.mockFooterIcon}>🔁 <span>Repost</span></div>
                        <div style={s.mockFooterIcon}>📤 <span>Send</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INSTAGRAM */}
            {activeTab === "instagram" && (
              <>
                <div style={s.outCard}>
                  <div style={s.outCardHead}>
                    <div style={s.outCardTitle}>📸 Instagram Caption</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={s.toggleBar}>
                        <button 
                          style={{ ...s.toggleBtn, ...(viewMode === "raw" ? s.toggleBtnActive : {}) }}
                          onClick={() => setViewMode("raw")}
                        >
                          Raw Text
                        </button>
                        <button 
                          style={{ ...s.toggleBtn, ...(viewMode === "preview" ? s.toggleBtnActive : {}) }}
                          onClick={() => setViewMode("preview")}
                        >
                          Mock Preview
                        </button>
                      </div>
                      <CopyBtn text={content.instagram} />
                    </div>
                  </div>
                  {viewMode === "raw" ? (
                    <div style={s.outCardBody}>{content.instagram}</div>
                  ) : (
                    <div style={{ padding: 18, background: "#0D0D0E" }}>
                      <div style={s.igMock}>
                        <div style={s.igHeader}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <img src="/src/assets/omvatsa_avatar.png" style={{ ...s.mockAvatar, width: 32, height: 32, objectFit: "cover" }} alt="Om Vatsa" />
                            <div>
                              <div style={{ ...s.mockName, fontSize: 13 }}>omvatsa</div>
                              <div style={{ fontSize: 10, color: MUTED }}>Mumbai, India</div>
                            </div>
                          </div>
                          <div style={{ color: TEXT, cursor: "pointer", fontSize: 18, fontWeight: 700 }}>•••</div>
                        </div>
                        
                        <div style={{ background: "#121212", aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                          {mediaUrl ? (
                            mediaFile.type.startsWith("image/") ? (
                              <img src={mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Instagram Post" />
                            ) : (
                              <video src={mediaUrl} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            )
                          ) : (
                            <div style={{ textAlign: "center", color: MUTED, padding: 20 }}>
                              <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>No media uploaded</div>
                              <div style={{ fontSize: 11, marginTop: 4 }}>Add an image or video above to preview</div>
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px 8px", color: TEXT }}>
                          <div style={{ display: "flex", gap: 16, fontSize: 20 }}>
                            <span style={{ cursor: "pointer" }}>❤️</span>
                            <span style={{ cursor: "pointer" }}>💬</span>
                            <span style={{ cursor: "pointer" }}>✈️</span>
                          </div>
                          <div style={{ fontSize: 20, cursor: "pointer" }}>📥</div>
                        </div>

                        <div style={{ padding: "0 14px 14px", fontSize: 13, borderBottom: "1px solid #1C1C1E" }}>
                          <div style={{ fontWeight: 700, color: TEXT, marginBottom: 6 }}>1,432 likes</div>
                          <div>
                            <span style={{ fontWeight: 700, color: TEXT, marginRight: 6 }}>omvatsa</span>
                            <span style={{ color: "#E5E5EA", whiteSpace: "pre-wrap" }}>{content.instagram}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div style={s.outCard}>
                  <div style={s.outCardHead}>
                    <div style={s.outCardTitle}>🎬 Reel Script (45–60 sec)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={s.toggleBar}>
                        <button 
                          style={{ ...s.toggleBtn, ...(viewMode === "raw" ? s.toggleBtnActive : {}) }}
                          onClick={() => setViewMode("raw")}
                        >
                          Raw Text
                        </button>
                        <button 
                          style={{ ...s.toggleBtn, ...(viewMode === "preview" ? s.toggleBtnActive : {}) }}
                          onClick={() => setViewMode("preview")}
                        >
                          Mock Preview
                        </button>
                      </div>
                      <CopyBtn text={content.reel} />
                    </div>
                  </div>
                  {viewMode === "raw" ? (
                    <div style={s.outCardBody}>{content.reel}</div>
                  ) : (
                    <div style={{ padding: 18, background: "#0D0D0E" }}>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
                        <div style={{ width: 280, height: 480, border: `1px solid ${BORDER}`, borderRadius: 16, background: "#000", position: "relative", overflow: "hidden" }}>
                          {mediaUrl && !mediaFile.type.startsWith("image/") ? (
                            <video src={mediaUrl} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : mediaUrl ? (
                            <img src={mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Reel static frame" />
                          ) : (
                            <div style={{ width: "100%", height: "100%", background: "linear-gradient(180deg, #8A2387 0%, #E94057 50%, #F27121 100%)", opacity: 0.8 }} />
                          )}
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.9) 0%, transparent 100%)", padding: 16, color: "#FFF" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <img src="/src/assets/omvatsa_avatar.png" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} alt="Om Vatsa" />
                              <span style={{ fontWeight: 600, fontSize: 12 }}>omvatsa • Follow</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#E5E5EA", maxHeight: 60, overflow: "hidden", textOverflow: "ellipsis" }}>
                              {content.instagram.slice(0, 100)}...
                            </div>
                            <div style={{ fontSize: 10, color: GOLD, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                              <span>🎵</span> Original Audio - omvatsa
                            </div>
                          </div>
                          <div style={{ position: "absolute", top: 16, right: 12, display: "flex", flexDirection: "column", gap: 16, fontSize: 18, color: "#FFF", background: "rgba(0,0,0,0.4)", padding: 8, borderRadius: 20 }}>
                            <span>❤️</span>
                            <span>💬</span>
                            <span>✈️</span>
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 260, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 10 }}>🎬 TELEPROMPTER SCRIPT</div>
                          <div style={{ fontSize: 13, lineHeight: 1.6, color: "#E5E5EA", whiteSpace: "pre-wrap", maxHeight: 380, overflowY: "auto" }}>
                            {content.reel}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TWITTER */}
            {activeTab === "twitter" && (
              <div style={s.outCard}>
                <div style={s.outCardHead}>
                  <div style={s.outCardTitle}>𝕏 Twitter/X Thread</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={s.toggleBar}>
                      <button 
                        style={{ ...s.toggleBtn, ...(viewMode === "raw" ? s.toggleBtnActive : {}) }}
                        onClick={() => setViewMode("raw")}
                      >
                        Raw Text
                      </button>
                      <button 
                        style={{ ...s.toggleBtn, ...(viewMode === "preview" ? s.toggleBtnActive : {}) }}
                        onClick={() => setViewMode("preview")}
                      >
                        Mock Preview
                      </button>
                    </div>
                    <CopyBtn text={content.twitter} />
                  </div>
                </div>
                {viewMode === "raw" ? (
                  <div style={s.outCardBody}>{content.twitter}</div>
                ) : (
                  <div style={{ padding: 18, background: "#0D0D0E" }}>
                    {(() => {
                      const tweets = content.twitter.split("---").map(t => t.trim()).filter(t => t.length > 5);
                      return (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {tweets.map((tweetText, idx) => (
                            <div key={idx} style={s.tweetItem}>
                              {idx < tweets.length - 1 && <div style={s.tweetThreadLine} />}
                              <div style={s.mockHeader}>
                                <img src="/src/assets/omvatsa_avatar.png" style={s.mockAvatar} alt="Om Vatsa" />
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={s.mockName}>Om Vatsa</span>
                                  <span style={{ fontSize: 13, color: MUTED }}>@omvatsa</span>
                                  <span style={{ fontSize: 13, color: MUTED }}>·</span>
                                  <span style={{ fontSize: 13, color: MUTED }}>{idx + 1}m</span>
                                </div>
                              </div>
                              <div style={{ ...s.mockBody, marginLeft: 50, marginTop: -6 }}>
                                {tweetText.replace(/^\d+\/\d+\s*/, "").replace(/^\d+\s*/, "")}
                              </div>
                              {idx === 0 && mediaUrl && (
                                <div style={{ marginLeft: 50 }}>
                                  {mediaFile.type.startsWith("image/") ? (
                                    <img src={mediaUrl} style={s.mockMedia} alt="Tweet Media" />
                                  ) : (
                                    <video src={mediaUrl} controls style={s.mockMedia} />
                                  )}
                                </div>
                              )}
                              <div style={{ ...s.mockFooter, marginLeft: 50, borderTop: "none", marginTop: 8 }}>
                                <span>💬 12</span>
                                <span>🔁 45</span>
                                <span>❤️ 389</span>
                                <span>📊 12K</span>
                                <span>📤</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
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
              <button 
                style={{
                  ...s.regenBtn,
                  background: GOLD,
                  color: "#000",
                  fontWeight: 700,
                  borderColor: GOLD,
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }} 
                onClick={() => {
                  setPublishStep(0);
                  setPublishLogs([]);
                  setPublishProgress(0);
                  setShowPublishModal(true);
                }}
              >
                🚀 Publish Everywhere
              </button>
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

      {/* PUBLISH MODAL */}
      {showPublishModal && (
        <div style={s.modalOverlay}>
          <div style={s.modalCard}>
            <div style={s.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>🚀</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: TEXT }}>Multi-Platform Publisher</div>
                  <div style={{ fontSize: 11, color: MUTED }}>Simultaneous Sandbox Posting</div>
                </div>
              </div>
              {publishStep !== 1 && (
                <button 
                  onClick={() => setShowPublishModal(false)}
                  style={{ background: "transparent", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={s.modalBody}>
              {publishStep === 0 && (
                <div>
                  <div style={{ marginBottom: 20, fontSize: 13, lineHeight: 1.6, color: "#E5E5EA" }}>
                    Select the target networks to distribute your generated business content. By default, all platforms with generated copy are selected.
                  </div>

                  <span style={s.label}>Destination Platforms</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6, marginBottom: 24 }}>
                    {/* LinkedIn Toggle */}
                    <div style={s.platformSelectRow}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 18 }}>💼</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>LinkedIn</div>
                          <div style={{ fontSize: 11, color: MUTED }}>
                            {content.linkedin ? `${content.linkedin.split(" ").length} words` : "No content generated"}
                          </div>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        disabled={!content.linkedin}
                        checked={publishPlatforms.linkedin && !!content.linkedin} 
                        onChange={(e) => setPublishPlatforms(p => ({ ...p, linkedin: e.target.checked }))}
                        style={{ cursor: "pointer", width: 18, height: 18, accentColor: GOLD }}
                      />
                    </div>

                    {/* Twitter Toggle */}
                    <div style={s.platformSelectRow}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 18 }}>𝕏</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>Twitter/X</div>
                          <div style={{ fontSize: 11, color: MUTED }}>
                            {content.twitter ? `${content.twitter.split("---").filter(Boolean).length} tweets thread` : "No content generated"}
                          </div>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        disabled={!content.twitter}
                        checked={publishPlatforms.twitter && !!content.twitter} 
                        onChange={(e) => setPublishPlatforms(p => ({ ...p, twitter: e.target.checked }))}
                        style={{ cursor: "pointer", width: 18, height: 18, accentColor: GOLD }}
                      />
                    </div>

                    {/* Instagram Toggle */}
                    <div style={s.platformSelectRow}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 18 }}>📸</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>Instagram Feed & Reels</div>
                          <div style={{ fontSize: 11, color: MUTED }}>
                            {content.instagram ? `${content.instagram.split(" ").length} words caption + reel script` : "No content generated"}
                          </div>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        disabled={!content.instagram}
                        checked={publishPlatforms.instagram && !!content.instagram} 
                        onChange={(e) => setPublishPlatforms(p => ({ ...p, instagram: e.target.checked }))}
                        style={{ cursor: "pointer", width: 18, height: 18, accentColor: GOLD }}
                      />
                    </div>

                    {/* YouTube Toggle */}
                    <div style={s.platformSelectRow}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 18 }}>🎬</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>YouTube</div>
                          <div style={{ fontSize: 11, color: MUTED }}>
                            {content.script ? "Full video script ready" : "No content generated"}
                          </div>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        disabled={!content.script}
                        checked={publishPlatforms.youtube && !!content.script} 
                        onChange={(e) => setPublishPlatforms(p => ({ ...p, youtube: e.target.checked }))}
                        style={{ cursor: "pointer", width: 18, height: 18, accentColor: GOLD }}
                      />
                    </div>
                  </div>

                  {/* Attachment Status */}
                  <span style={s.label}>Media Attachment</span>
                  <div style={{ padding: "12px 16px", borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
                    {mediaFile ? (
                      <>
                        <span style={{ fontSize: 20 }}>📁</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>{mediaFile.name}</div>
                          <div style={{ fontSize: 11, color: MUTED }}>{(mediaFile.size / 1024 / 1024).toFixed(2)} MB · Attached globals</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 20 }}>ℹ️</span>
                        <div style={{ flex: 1, fontSize: 12, color: MUTED }}>
                          No media uploaded. Posts will be published as text-only status updates.
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {publishStep === 1 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0" }}>
                  <div style={{ ...s.spinner, width: 40, height: 40, borderTopColor: GOLD, borderLeftColor: "transparent", margin: "20px 0" }} />
                  <div style={{ fontWeight: 600, fontSize: 15, color: TEXT, marginBottom: 4 }}>
                    Publishing content in progress...
                  </div>
                  <div style={{ fontSize: 12, color: MUTED }}>
                    Please wait while the engine submits payloads to endpoints.
                  </div>

                  <div style={s.progressBarWrap}>
                    <div style={{ ...s.progressBar, width: `${publishProgress}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: GOLD, width: "100%", textAlign: "right", marginTop: 4, fontFamily: "monospace" }}>
                    {publishProgress}%
                  </div>

                  <div style={{ width: "100%", textAlign: "left", marginTop: 14 }}>
                    <span style={s.label}>Live Console Output</span>
                    <div style={s.logContainer}>
                      {publishLogs.map((log, index) => (
                        <div key={index} style={{ marginBottom: 4 }}>{log}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {publishStep === 2 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "10px 0" }}>
                  <span style={{ fontSize: 48, marginBottom: 12 }}>🎉</span>
                  <div style={{ fontWeight: 700, fontSize: 18, color: TEXT, marginBottom: 6 }}>
                    Posted Everywhere Successfully!
                  </div>
                  <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, maxWidth: 380, marginBottom: 24 }}>
                    Your content has been successfully broadcast to all selected platform queues in the sandbox environment.
                  </div>

                  <span style={{ ...s.label, alignSelf: "flex-start", textAlign: "left" }}>Live Sandbox Handles</span>
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, marginTop: 6, marginBottom: 24 }}>
                    {publishUrls.linkedin && (
                      <a 
                        href={publishUrls.linkedin} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, textDecoration: "none", color: TEXT }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                          <span>💼</span> LinkedIn Post ID
                        </div>
                        <span style={{ fontSize: 12, color: GOLD, fontWeight: 500 }}>View Post ↗</span>
                      </a>
                    )}
                    {publishUrls.twitter && (
                      <a 
                        href={publishUrls.twitter} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, textDecoration: "none", color: TEXT }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                          <span>𝕏</span> Twitter Thread Status
                        </div>
                        <span style={{ fontSize: 12, color: GOLD, fontWeight: 500 }}>View Thread ↗</span>
                      </a>
                    )}
                    {publishUrls.instagram && (
                      <a 
                        href={publishUrls.instagram} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, textDecoration: "none", color: TEXT }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                          <span>📸</span> Instagram Captioned Post
                        </div>
                        <span style={{ fontSize: 12, color: GOLD, fontWeight: 500 }}>View Media ↗</span>
                      </a>
                    )}
                    {publishUrls.youtube && (
                      <a 
                        href={publishUrls.youtube} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, textDecoration: "none", color: TEXT }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                          <span>🎬</span> YouTube Video Upload
                        </div>
                        <span style={{ fontSize: 12, color: GOLD, fontWeight: 500 }}>View Video ↗</span>
                      </a>
                    )}
                  </div>

                  <span style={{ ...s.label, alignSelf: "flex-start", textAlign: "left" }}>Actions & Downloads</span>
                  <div style={{ display: "flex", gap: 10, width: "100%", marginTop: 6, flexWrap: "wrap" }}>
                    {publishPlatforms.linkedin && content.linkedin && (
                      <button 
                        onClick={() => downloadPlatformFile("linkedin", content.linkedin)}
                        style={{ flex: "1 1 120px", background: CARD, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        📥 LinkedIn text
                      </button>
                    )}
                    {publishPlatforms.twitter && content.twitter && (
                      <button 
                        onClick={() => downloadPlatformFile("twitter", content.twitter)}
                        style={{ flex: "1 1 120px", background: CARD, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        📥 Twitter text
                      </button>
                    )}
                    {publishPlatforms.instagram && content.instagram && (
                      <button 
                        onClick={() => downloadPlatformFile("instagram", content.instagram + "\n\n=== REEL SCRIPT ===\n" + content.reel)}
                        style={{ flex: "1 1 120px", background: CARD, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        📥 Instagram text
                      </button>
                    )}
                    {publishPlatforms.youtube && content.script && (
                      <button 
                        onClick={() => downloadPlatformFile("youtube", content.script)}
                        style={{ flex: "1 1 120px", background: CARD, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        📥 YouTube script
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={s.modalFooter}>
              {publishStep === 0 && (
                <>
                  <button 
                    onClick={() => setShowPublishModal(false)}
                    style={{ background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={startPublishing}
                    style={{ background: GOLD, color: "#000", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    🚀 Launch Campaign
                  </button>
                </>
              )}

              {publishStep === 2 && (
                <button 
                  onClick={() => setShowPublishModal(false)}
                  style={{ background: GOLD, color: "#000", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  ✓ Finish Setup
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
