import { rewriteNewsWithGemini } from "../gemini";

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text || text.trim().length === 0) {
      return Response.json(
        { error: "কোনো টেক্সট দেওয়া হয়নি।" },
        { status: 400 }
      );
    }

    const result = await rewriteNewsWithGemini(text);
    return Response.json(result);
  } catch (error) {
    console.error("Rewrite error:", error);
    return Response.json(
      { error: "সংবাদ পুনর্লিখনে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
