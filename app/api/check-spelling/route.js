import { callGemini, SPELL_CHECK_PROMPT, SPELL_CHECK_SCHEMA } from "../gemini.js";

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text || text.trim().length === 0) {
      return Response.json(
        { errors: [], summary: "কোনো টেক্সট পাঠানো হয়নি।" },
        { status: 200 }
      );
    }

    const result = await callGemini(
      SPELL_CHECK_PROMPT,
      `এই বাংলা পাঠটি বানান পরীক্ষা করো:\n\n${text}`,
      SPELL_CHECK_SCHEMA
    );

    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error("বানান পরীক্ষা ত্রুটি:", error);
    return Response.json(
      { error: error.message || "বানান পরীক্ষা ব্যর্থ হয়েছে।" },
      { status: 500 }
    );
  }
}
