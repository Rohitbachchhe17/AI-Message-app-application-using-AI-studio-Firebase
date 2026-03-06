import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const AI_ASSISTANT_ID = 'gemini-ai-assistant';

export const geminiService = {
  async generateResponse(prompt: string, history: { role: 'user' | 'model', parts: { text: string }[] }[] = []) {
    try {
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: "You are a helpful and friendly AI assistant integrated into a modern chat app. Keep your responses concise and conversational. Use emojis where appropriate. You can help with answering questions, generating ideas, or just chatting.",
        },
      });

      // If history is provided, we'd need to handle it. For now, let's just use simple generateContent for simplicity or sendMessage
      const response = await chat.sendMessage({ message: prompt });
      return response.text;
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Sorry, I'm having trouble thinking right now. 🤖";
    }
  },

  async getSmartReplies(lastMessages: string[]) {
    try {
      const prompt = `Based on the following last messages in a chat, suggest 3 short, relevant, and conversational quick replies. Return them as a JSON array of strings.
      Messages:
      ${lastMessages.join('\n')}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      return JSON.parse(response.text || "[]") as string[];
    } catch (error) {
      console.error("Smart Reply Error:", error);
      return [];
    }
  },

  async summarizeChat(messages: { sender: string, text: string }[]) {
    try {
      const chatText = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
      const prompt = `Summarize the following chat conversation in 2-3 concise bullet points:
      ${chatText}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return response.text;
    } catch (error) {
      console.error("Summarization Error:", error);
      return "Could not summarize the chat.";
    }
  },

  async translateMessage(text: string, targetLang: string = 'English') {
    try {
      const prompt = `Translate the following message to ${targetLang}. Return only the translated text.
      Message: ${text}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return response.text;
    } catch (error) {
      console.error("Translation Error:", error);
      return null;
    }
  },

  async improveTone(text: string) {
    try {
      const prompt = `Improve the tone of the following message to be more professional, friendly, and clear. Return only the improved text.
      Message: ${text}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return response.text;
    } catch (error) {
      console.error("Tone Improvement Error:", error);
      return null;
    }
  },

  async generateBio(name: string) {
    try {
      const prompt = `Generate a short, creative, and catchy 1-line bio for a person named ${name}. Keep it under 100 characters. Return only the bio.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return response.text;
    } catch (error) {
      console.error("Bio Gen Error:", error);
      return null;
    }
  },

  async transcribeAudio(audioBase64: string) {
    try {
      const [mime, data] = audioBase64.split(';base64,');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: "Transcribe the following audio message exactly as spoken. Return only the transcription." },
            { inlineData: { mimeType: mime.split(':')[1], data } }
          ]
        }
      });

      return response.text;
    } catch (error) {
      console.error("Transcription Error:", error);
      return null;
    }
  },

  async generateImage(prompt: string) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }],
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (error) {
      console.error("Image Gen Error:", error);
      return null;
    }
  }
};
