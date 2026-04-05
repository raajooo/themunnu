import { GoogleGenAI } from "@google/genai";

// Access API key from environment variables
const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey: apiKey || "" });

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

export async function getChatResponse(message: string, history: { role: "user" | "model"; parts: { text: string }[] }[]) {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const model = "gemini-3-flash-preview";
  
  const chat = genAI.chats.create({
    model: model,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
    history: history,
  });

  const result = await chat.sendMessage({ message });
  return result.text;
}
