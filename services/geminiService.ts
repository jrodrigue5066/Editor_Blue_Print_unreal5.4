import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AspectRatio } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const BLUEPRINT_SYSTEM_INSTRUCTION = `
You are an expert Unreal Engine 5.4 Blueprint Developer and Technical Artist.
Your goal is to assist users in designing gameplay logic using Blueprints.

GUIDELINES:
1. When a user asks for a specific functionality (e.g., "Make a double jump"), explain the logic clearly.
2. YOU MUST identifying the specific Blueprint Nodes required (e.g., "Event Jump", "Launch Character", "Branch").
3. If the user's request involves designing a system, output a JSON block at the end of your response to visualize the nodes.
   The JSON should follow this schema strictly inside a markdown code block labelled 'json':
   {
     "nodes": [
       { "name": "Node Name", "type": "function", "inputs": ["In"], "outputs": ["Out"] }
     ]
   }
   Node types: 'event', 'function', 'variable', 'macro'.
4. Use "gemini-3-pro-preview" for deep thinking and complex logic.
5. Be precise with UE5.4 terminology (e.g., "Enhanced Input" vs legacy input).
`;

export const sendMessageToGemini = async (
  prompt: string,
  history: string[],
  imageAttachment?: { data: string; mimeType: string },
  useSearch: boolean = false
): Promise<string> => {
  try {
    // Model Selection Logic
    // If searching, use Flash (fast, good tools). If standard/complex, use Pro 3 (thinking).
    const modelId = useSearch ? 'gemini-2.5-flash' : 'gemini-3-pro-preview';
    
    const config: any = {
      systemInstruction: BLUEPRINT_SYSTEM_INSTRUCTION,
    };

    // Tools & Thinking Configuration
    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    } else {
      // Enable Thinking for complex logic on Pro model
      config.thinkingConfig = { thinkingBudget: 32768 };
    }

    // Prepare content parts
    const parts: any[] = [];
    
    // Add image if present (Multimodal)
    if (imageAttachment) {
      parts.push({
        inlineData: {
          data: imageAttachment.data,
          mimeType: imageAttachment.mimeType
        }
      });
    }

    // Add text prompt
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        role: 'user',
        parts: parts
      },
      config: config
    });

    let finalText = response.text || "";
    
    // Append grounding sources if available
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      const chunks = response.candidates[0].groundingMetadata.groundingChunks;
      const links = chunks
        .map((c: any) => c.web?.uri)
        .filter((uri: string) => uri)
        .map((uri: string) => `\nSource: ${uri}`)
        .join('');
      if (links) finalText += `\n\n${links}`;
    }

    return finalText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I encountered an error processing your request. Please try again.";
  }
};

export const generateBlueprintImage = async (
  prompt: string,
  aspectRatio: AspectRatio
): Promise<string | null> => {
  try {
    // Using the required image generation model
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "1K" // Defaulting to 1K for speed/preview
        }
      }
    });

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
};
