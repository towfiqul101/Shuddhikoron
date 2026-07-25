import { callGemini, REWRITE_PROMPT, REWRITE_SCHEMA } from "../gemini.js";

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text || text.trim().length === 0) {
      return Response.json(
        {
          rewritten: "",
          english: "",
          changes: ["কোনো টেক্সট পাঠানো হয়নি।"],
        },
        { status: 200 }
      );
    }

    const result = await callGemini(
      REWRITE_PROMPT,
      `এই সংবাদটি পুনর্লিখন করো এবং ইংরেজিতে অনুবাদ করো:\n\n${text}`,
      REWRITE_SCHEMA
    );

    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error("সংবাদ পুনর্লিখন ত্রুটি:", error);
    return Response.json(
      { error: error.message || "সংবাদ পুনর্লিখন ব্যর্থ হয়েছে।" },
      { status: 500 }
    );
  }
}
