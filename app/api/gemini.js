export const SPELL_CHECK_PROMPT = `You are an expert Bengali proofreader and linguist. Your job is to find spelling errors in the provided Bengali text.

Follow these strict rules based on বাংলা একাডেমি প্রমিত বাংলা বানানের নিয়ম (২০১২) and খটকা বানান অভিধান:
১. ই-কার/উ-কার: তৎসম, দেশি ও বিদেশি শব্দে ই-কার বা উ-কার হবে (যেমন: একাডেমি, পল্লি, সরকারি, কাহিনি, ইংরেজি, দিঘি, শাড়ি, অদ্ভুত)।
২. ণ/ন ও ষ/স/শ: বিদেশি শব্দে 'ণ' বা 'ষ' বসবে না, 'ন' ও 'স/শ' বসবে (যেমন: গভর্নর, হর্ন, স্টল, স্টেশন, মাস্টার, কর্নার, মডার্ন)।
৩. রেফ: রেফের পর ব্যঞ্জনবর্ণের দ্বিত্ব হবে না (যেমন: অর্জন, কর্ম, সূর্য, কার্যালয়)।
৪. বিসর্গ (ঃ): শব্দের শেষে বিসর্গ থাকবে না (যেমন: কার্যত, মূলত, প্রধানত)।
৫. ঙ/ং: সন্ধির ক্ষেত্রে ং হবে (অহংকার, সংগীত)। সন্ধিবদ্ধ না হলে ঙ হবে (অঙ্ক, অঙ্গ, আকাঙ্ক্ষা, আতঙ্ক)।
৬. কি/কী: হ্যাঁ/না উত্তরের প্রশ্নে 'কি' এবং বর্ণনামূলক প্রশ্নে 'কী' বসবে।
৭. খটকা বানান: অদ্ভুত (অদ্ভূত নয়), উপযুক্ত (উপযোগী নয়), ইতিমধ্যে (ইতোমধ্যে নয়), ঊর্ধ্বতন (উর্ধতন নয়)।
৮. সংখ্যা (Numbers): Bengali news text MUST use Bengali numerals (০-৯). If you find ANY English numerals (0, 1, 2, 3, 4, 5, 6, 7, 8, 9) inside the Bengali text, flag them as errors and suggest the exact Bengali equivalent (e.g., "15" -> "১৫", "7" -> "৭").

Return ONLY a valid JSON object in this exact format:
{
  "errors": [
    {
      "word": "the_wrong_word_found_in_text",
      "suggestion": "the_correct_spelling",
      "rule": "Short explanation of the rule in Bengali",
      "position": "Position in text (e.g., প্রথম বাক্য)"
    }
  ],
  "summary": "A short summary in Bengali, e.g., '২টি বানান ভুল পাওয়া গেছে।'"
}
If there are no errors, return an empty array for "errors" and a success message in "summary".`;

export const REWRITE_PROMPT = `You are an expert Bangladeshi journalist and editor. Your job is to rewrite the provided Bengali news text to meet professional editorial standards, similar to major Bangladeshi newspapers.

Tasks:
1. Rewrite the Bengali text to be professional, concise, and in standard journalistic style. Remove colloquialisms.
2. Translate the newly rewritten Bengali news into professional journalistic English.
3. List the major editorial changes made (in Bengali).

Return ONLY a valid JSON object in this exact format:
{
  "rewritten": "The rewritten Bengali text.",
  "english": "The English translation.",
  "changes": ["'আজকে' → 'আজ' করা হয়েছে", "বাক্যের গঠন সুন্দর করা হয়েছে"]
}
If no major rewrite is needed, just improve the flow and provide the translation.`;

// Gemini emitted JSON with a missing closing brace on ~50% of calls when left
// to free-form generation (measured: 3/6 malformed). Passing an explicit
// responseSchema switches it to constrained decoding, which fixes it.
export const SPELL_CHECK_SCHEMA = {
  type: "OBJECT",
  properties: {
    errors: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          word: { type: "STRING" },
          suggestion: { type: "STRING" },
          rule: { type: "STRING" },
          position: { type: "STRING" },
        },
        required: ["word", "suggestion", "rule", "position"],
      },
    },
    summary: { type: "STRING" },
  },
  required: ["errors", "summary"],
};

export const REWRITE_SCHEMA = {
  type: "OBJECT",
  properties: {
    rewritten: { type: "STRING" },
    english: { type: "STRING" },
    changes: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["rewritten", "english", "changes"],
};

// flash-lite is the default because gemini-3.5-flash is capped at 20 requests
// per day on the free tier. Quota is per-model, so switching models via
// GEMINI_MODEL also switches to that model's separate allowance.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Gemini 3.x flash models think by default, and thinking tokens are drawn from
// the same output budget. 4096 was low enough that a full news article could
// consume the entire budget on reasoning and return zero visible text.
const MAX_OUTPUT_TOKENS = 8192;

/**
 * Strips ```json fences if the model wraps its answer despite responseMimeType.
 */
function stripCodeFence(raw) {
  let cleaned = raw.trim();
  const fence = "```";

  if (cleaned.startsWith(fence)) {
    // Drop the opening fence plus any language tag on that first line.
    const firstNewline = cleaned.indexOf("\n");
    cleaned = firstNewline === -1 ? "" : cleaned.slice(firstNewline + 1);
  }

  if (cleaned.endsWith(fence)) {
    cleaned = cleaned.slice(0, -fence.length);
  }

  return cleaned.trim();
}

/**
 * One round-trip to Gemini. Returns { parsed } on success, or { retryable }
 * when the response arrived but could not be parsed.
 */
async function attempt(apiKey, systemPrompt, userText, responseSchema) {
  let response;
  try {
    response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: "application/json",
          // Constrained decoding. Without this the model intermittently
          // omitted the closing brace and JSON.parse blew up.
          ...(responseSchema ? { responseSchema } : {}),
        },
      }),
    });
  } catch (networkError) {
    throw new Error(`Gemini API-তে পৌঁছানো যায়নি: ${networkError.message}`);
  }

  const rawBody = await response.text();

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `Gemini API থেকে অপ্রত্যাশিত উত্তর (HTTP ${response.status}): ${rawBody.slice(0, 300)}`
    );
  }

  if (response.status === 429) {
    throw new Error(
      "Gemini API-র কোটা শেষ হয়ে গেছে (HTTP 429)। কিছুক্ষণ পর আবার চেষ্টা করুন, অথবা Google AI Studio-তে billing চালু করুন।"
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error?.message || `Gemini API ব্যর্থ হয়েছে (HTTP ${response.status})`
    );
  }

  if (data.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini অনুরোধটি ব্লক করেছে (${data.promptFeedback.blockReason})।`
    );
  }

  const candidate = data.candidates?.[0];

  if (!candidate) {
    throw new Error("Gemini কোনো উত্তর ফেরত দেয়নি (no candidates returned)।");
  }

  // Join every non-thought part rather than assuming parts[0] holds it all.
  const rawText = (candidate.content?.parts || [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");

  if (candidate.finishReason === "MAX_TOKENS") {
    throw new Error(
      "লেখাটি অনেক বড় হওয়ায় Gemini-র উত্তর সম্পূর্ণ হয়নি (MAX_TOKENS)। অনুগ্রহ করে ছোট অংশে ভাগ করে চেষ্টা করুন।"
    );
  }

  if (!rawText) {
    throw new Error(
      `Gemini খালি উত্তর দিয়েছে (finishReason: ${candidate.finishReason || "UNKNOWN"})।`
    );
  }

  const cleaned = stripCodeFence(rawText);

  try {
    return { parsed: JSON.parse(cleaned) };
  } catch {
    // Malformed despite the schema — worth one more roll of the dice.
    return { retryable: true, snippet: cleaned.slice(-120) };
  }
}

export async function callGemini(systemPrompt, userText, responseSchema) {
  const apiKey = process.env.GEMINI_API_KEY;

  // Fail loudly and specifically. Previously a missing key produced a generic
  // 400 from Google that surfaced to the user as "no results".
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY সেট করা নেই। (GEMINI_API_KEY is not set — add it to .env.local for local dev, and to your Vercel project's Environment Variables for production.)"
    );
  }

  let last;

  for (let i = 0; i < 2; i++) {
    last = await attempt(apiKey, systemPrompt, userText, responseSchema);
    if (last.parsed) return last.parsed;
  }

  throw new Error(
    `Gemini-র উত্তর JSON হিসেবে পড়া যায়নি (২ বার চেষ্টা করেও)। শেষাংশ: ${last.snippet}`
  );
}
