// ============================================================
// gemini.js — Shuddhikoron AI Engine v4
// Multi-key rotation: GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3
// Fallback: Groq (llama-3.3-70b)
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================
// MULTI-KEY POOL
// Vercel env vars: GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3
// ============================================================
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean);

if (GEMINI_KEYS.length === 0) {
  console.error("⚠️ কোনো Gemini API key পাওয়া যায়নি!");
}

let keyIndex = 0;
function getNextGeminiKey() {
  const key = GEMINI_KEYS[keyIndex % GEMINI_KEYS.length];
  keyIndex++;
  return key;
}

// ============================================================
// UTILITY: JSON parser — markdown fence, preamble সব handle করে
// ============================================================
function cleanAndParse(text) {
  if (!text) throw new Error("Empty response from AI");
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  cleaned = cleaned.trim();
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) startIdx = Math.min(firstBrace, firstBracket);
  else if (firstBrace !== -1) startIdx = firstBrace;
  else if (firstBracket !== -1) startIdx = firstBracket;
  if (startIdx > 0) cleaned = cleaned.slice(startIdx);
  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");
  const endIdx = Math.max(lastBrace, lastBracket);
  if (endIdx !== -1 && endIdx < cleaned.length - 1) cleaned = cleaned.slice(0, endIdx + 1);
  return JSON.parse(cleaned);
}

function isRateLimitError(error) {
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("too many requests")
  );
}

// ============================================================
// SPELL CHECK PROMPT (বাংলা একাডেমি ২০১২ + খটকা বানান)
// ============================================================
const SPELL_CHECK_PROMPT = `
তুমি বাংলা ভাষার একজন বিশেষজ্ঞ বানান পরীক্ষক। তোমার একমাত্র কাজ বাংলা একাডেমি প্রমিত বানান রীতি (২০১২) অনুযায়ী সত্যিকারের ভুল বানান চিহ্নিত করা।

⚠️ সবচেয়ে গুরুত্বপূর্ণ: শুধুমাত্র নিশ্চিত ভুল চিহ্নিত করো। সন্দেহ থাকলে ভুল ধরো না।

════════════════════════════════════════
অধ্যায় ১ — তৎসম শব্দ (নিয়ম ১.২)
════════════════════════════════════════
যেসব তৎসম শব্দে ই ঈ বা উ উ উভয় শুদ্ধ, শুধুমাত্র ই বা উ ব্যবহার হবে।
✅ সঠিক: কিংবদন্তি, খঞ্জনি, চুল্লি, তরণি, ধমনি, নাড়ি, পঞ্জি, পদবি, পল্লি, ভঙ্গি, মঞ্জরি, যুবতি, রচনাবলি, লহরি, শ্রেণি, সরণি, উর্ণা, উষা

════════════════════════════════════════
অধ্যায় ২ — অতৎসম শব্দ (নিয়ম ২.১)
════════════════════════════════════════
সকল বিদেশি/তদ্ভব/দেশি শব্দে কেবল ই এবং উ ব্যবহার হবে।

✅ এই বানানগুলো সম্পূর্ণ সঠিক — কখনো ভুল ধরবে না:
একাডেমি, জানুয়ারি, ফেব্রুয়ারি, মার্চ, এপ্রিল, মে, জুন, জুলাই, আগস্ট, সেপ্টেম্বর, অক্টোবর, নভেম্বর, ডিসেম্বর, আরবি, আসামি, ইংরেজি, ইরানি, গাড়ি, বাড়ি, শাড়ি, চাকরি, দাড়ি, দাবি, নানি, পাখি, ফারসি, বাঙালি, মাসি, সরকারি, হিন্দি, হাতি, রানি, টুপি

কী (প্রশ্নবাচক/বিস্ময়সূচক): কী বই? কী আনন্দ!
কি (হ্যাঁ/না উত্তর): তুমি কি যাবে?

════════════════════════════════════════
নিয়ম ২.৩ — ও-কার (শব্দের শেষে)
════════════════════════════════════════
✅ সঠিক: কালো, ভালো, ছোটো, বড়ো, এগারো, বারো, তেরো, করো, বলো, বসো

════════════════════════════════════════
নিয়ম ২.৪ — ং এবং ঙ
════════════════════════════════════════
✅ সঠিক (ভুল ধরবে না): অঙ্ক, অঙ্গ, আকাঙ্ক্ষা, আতঙ্ক, কঙ্কাল, গঙ্গা, বঙ্গ, শঙ্কা, শৃঙ্খলা, সঙ্গে, সঙ্গী, বাংলা, বাংলাদেশ, রঙিন, বাঙালি
❌ ভুল: অংক, অংগ

════════════════════════════════════════
নিয়ম ২.৭ — মূর্ধন্য ণ
════════════════════════════════════════
অতৎসম শব্দে ণ ব্যবহার করা যাবে না।
✅ সঠিক: গভর্নর, হর্ন, ইরান, কোরান, ঝরনা, ধরন, রানি, সোনা
❌ ভুল: গভর্ণর, হর্ণ

════════════════════════════════════════
নিয়ম ২.৮ — শ, ষ, স
════════════════════════════════════════
বিদেশি শব্দে ষ ব্যবহার করা যাবে না।
✅ সঠিক: স্টল, স্টেশন, পোস্ট, মাস্টার, হিসাব, জিনিস, বাস, ক্যাশ, টেলিভিশন, মিশন, সেশন
❌ ভুল: ষ্টল, ষ্টেশন, পোষ্ট, মাষ্টার

════════════════════════════════════════
অধ্যায় ৩ — বিবিধ
════════════════════════════════════════
নিয়ম ৩.৪: আজও, আমারও, কালও (পূর্ণ রূপ)
নিয়ম ৩.৫: আজই, এখনই (পূর্ণ রূপ)

════════════════════════════════════════
খটকা বানান — সংবাদমাধ্যমে প্রচলিত ভুল
════════════════════════════════════════
❌ অধীনস্ত → ✅ অধীনস্থ
❌ অনাকাঙ্খা → ✅ অনাকাঙ্ক্ষা
❌ ইতিমধ্যে → ✅ ইতোমধ্যে
❌ উপরোক্ত → ✅ উপরিউক্ত
❌ গভর্ণর → ✅ গভর্নর
❌ হর্ণ → ✅ হর্ন
❌ পোষ্ট → ✅ পোস্ট
❌ ষ্টল → ✅ স্টল
❌ গ্রেফতার → ✅ গ্রেপ্তার
❌ পূনরায় / পুণরায় → ✅ পুনরায়
❌ স্থগীত → ✅ স্থগিত
❌ ঊর্দ্ধে → ✅ ঊর্ধ্বে
❌ অদ্ভূত → ✅ অদ্ভুত
❌ অধোপতন → ✅ অধঃপতন

════════════════════════════════════════
সংখ্যা
════════════════════════════════════════
বাংলা পাঠ্যে ইংরেজি সংখ্যা (1, 2, 3) ভুল → বাংলা সংখ্যা (১, ২, ৩) ব্যবহার করতে হবে।

════════════════════════════════════════
⚠️ এগুলো কখনো ভুল ধরবে না
════════════════════════════════════════
জানুয়ারি, ফেব্রুয়ারি, একাডেমি, গভর্নর, আকাঙ্ক্ষা, শ্রেণি,
বাড়ি, গাড়ি, শাড়ি, স্টেশন, পোস্ট, স্টল, হর্ন,
কালো, ভালো, ছোটো, বাংলাদেশ, বাঙালি,
ব্যক্তির নাম, স্থানের নাম, ইংরেজি শব্দ

════════════════════════════════════════
OUTPUT FORMAT — শুধু এই JSON, কোনো markdown নয়
════════════════════════════════════════
{
  "errors": [
    {
      "word": "ভুল শব্দটি হুবহু",
      "suggestion": "সঠিক বানান",
      "rule": "সংক্ষিপ্ত বাংলা ব্যাখ্যা"
    }
  ],
  "summary": "মোট Xটি বানান ভুল পাওয়া গেছে।"
}

ভুল না থাকলে: {"errors": [], "summary": "কোনো বানান ভুল পাওয়া যায়নি।"}
`;

// ============================================================
// NEWS REWRITE PROMPT
// ============================================================
const REWRITE_PROMPT = `
তুমি প্রথম আলো এবং bdnews24.com-এর একজন অভিজ্ঞ সম্পাদক।

লেখার মান:
- প্রমিত বাংলা (বাংলা একাডেমি ২০১২)
- সংক্ষিপ্ত, স্পষ্ট, সক্রিয় কণ্ঠস্বর
- পাঁচ 'ক' (কে, কী, কখন, কোথায়, কেন) বজায় রাখো
- বাংলা সংখ্যা ব্যবহার করো (১, ২, ৩)

শুধুমাত্র এই JSON ফরম্যাটে উত্তর দাও, কোনো markdown নয়:
{
  "rewritten": "পুনর্লিখিত বাংলা সংবাদ",
  "english": "English translation",
  "changes": ["পরিবর্তন ১", "পরিবর্তন ২"]
}
`;

// ============================================================
// CORE: single Gemini call with one key
// ============================================================
async function callGeminiWithKey(apiKey, systemPrompt, userMessage, temperature = 0.1) {
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature,
      maxOutputTokens: 4096,
      // ⚠️ DO NOT add responseMimeType — it silently breaks systemInstruction
    },
  });
  const result = await model.generateContent(userMessage);
  return result.response.text();
}

// ============================================================
// ROTATION: rate limit হলে next key try করো
// ============================================================
async function callGeminiWithRotation(systemPrompt, userMessage, temperature = 0.1) {
  const totalKeys = GEMINI_KEYS.length;
  if (totalKeys === 0) throw new Error("কোনো Gemini API key নেই।");

  let lastError;
  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const key = getNextGeminiKey();
    try {
      return await callGeminiWithKey(key, systemPrompt, userMessage, temperature);
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error)) {
        console.warn(`Gemini key ${attempt + 1}/${totalKeys} rate limited, rotating...`);
        continue;
      }
      throw error; // rate limit ছাড়া অন্য error → immediately throw
    }
  }
  throw lastError; // সব key exhausted → Groq fallback হবে
}

// ============================================================
// SPELL CHECK — Gemini (rotation) → Groq fallback
// ============================================================
export async function checkSpellingWithGemini(text) {
  const userMsg = `নিচের বাংলা পাঠ্যের বানান পরীক্ষা করো। শুধুমাত্র নিশ্চিত ভুল চিহ্নিত করো:\n\n${text}`;
  const responseText = await callGeminiWithRotation(SPELL_CHECK_PROMPT, userMsg, 0.1);
  const parsed = cleanAndParse(responseText);
  if (!parsed.errors || !Array.isArray(parsed.errors)) {
    return { errors: [], summary: "কোনো বানান ভুল পাওয়া যায়নি।" };
  }
  return parsed;
}

export async function checkSpellingWithGroq(text) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SPELL_CHECK_PROMPT },
        {
          role: "user",
          content: `নিচের বাংলা পাঠ্যের বানান পরীক্ষা করো। শুধুমাত্র নিশ্চিত ভুল চিহ্নিত করো:\n\n${text}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });
  if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
  const data = await response.json();
  const parsed = cleanAndParse(data.choices?.[0]?.message?.content);
  if (!parsed.errors || !Array.isArray(parsed.errors)) {
    return { errors: [], summary: "কোনো বানান ভুল পাওয়া যায়নি।" };
  }
  return parsed;
}

// ============================================================
// NEWS REWRITE — Gemini (rotation) → Groq fallback
// ============================================================
export async function rewriteNewsWithGemini(text) {
  const userMsg = `নিচের সংবাদটি পেশাদার মানে পুনর্লিখন করো:\n\n${text}`;
  const responseText = await callGeminiWithRotation(REWRITE_PROMPT, userMsg, 0.4);
  const parsed = cleanAndParse(responseText);
  if (!parsed.rewritten) throw new Error("AI থেকে পুনর্লিখিত সংবাদ পাওয়া যায়নি।");
  return {
    rewritten: parsed.rewritten || "",
    english: parsed.english || "",
    changes: parsed.changes || [],
  };
}

export async function rewriteNewsWithGroq(text) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: REWRITE_PROMPT },
        {
          role: "user",
          content: `নিচের সংবাদটি পেশাদার মানে পুনর্লিখন করো:\n\n${text}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 8192,
    }),
  });
  if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
  const data = await response.json();
  const parsed = cleanAndParse(data.choices?.[0]?.message?.content);
  if (!parsed.rewritten) throw new Error("Groq থেকে পুনর্লিখিত সংবাদ পাওয়া যায়নি।");
  return {
    rewritten: parsed.rewritten || "",
    english: parsed.english || "",
    changes: parsed.changes || [],
  };
}
