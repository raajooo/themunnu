import { GoogleGenAI } from "@google/genai";

// Access API key from environment variables
// Note: process.env.GEMINI_API_KEY is defined in vite.config.ts
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

const SYSTEM_INSTRUCTION = `
You are the official MUNNU Support Assistant. MUNNU is a premium sneaker destination specializing in limited drops, trending footwear, and authentic athletic style.

Your goal is to help users with:
1. Information about MUNNU: We sell 100% authentic premium sneakers.
2. Shipping: We offer free shipping on all orders.
3. Returns: We have a 7-day return policy for unused items in original packaging.
4. Tracking: Users can track their orders in the "My Orders" section of their profile.
5. Authenticity: Every pair is verified for 100% authenticity.
6. Support: You are the primary support channel now.

Tone: Professional, helpful, enthusiastic about sneaker culture, and concise.
Language: English (default), but respond in the user's language if they speak Hindi or others.

If you don't know something, suggest they check their order history or wait for an admin to review their query.
`;

export async function getChatResponse(message: string, history: any[]) {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please add GEMINI_API_KEY to your environment variables in Vercel.");
  }

  // Use gemini-3-flash-preview in AI Studio, but fallback to gemini-1.5-flash for public Vercel deployments
  const isVercel = window.location.hostname.includes('vercel.app');
  const modelName = isVercel ? "gemini-1.5-flash" : "gemini-3-flash-preview";

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        ...history.map(h => ({
          role: h.role,
          parts: [{ text: h.parts[0].text }]
        })),
        { role: "user", parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    return response.text;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // If gemini-3 fails (likely because it's not public), try falling back to 1.5-flash
    if (modelName === "gemini-3-flash-preview") {
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [
            ...history.map(h => ({
              role: h.role,
              parts: [{ text: h.parts[0].text }]
            })),
            { role: "user", parts: [{ text: message }] }
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
          },
        });
        return fallbackResponse.text;
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
    throw error;
  }
}
