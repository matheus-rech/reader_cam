import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Ensure process.env.API_KEY is available in your environment.
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY environment variable not set for Gemini.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "MISSING_API_KEY" }); 

const TEXT_MODEL = 'gemini-2.5-flash-preview-04-17';

/**
 * Identifies text in a given base64 encoded image.
 * @param base64ImageData The base64 encoded image data (without the 'data:image/...;base64,' prefix).
 * @param customPrompt Optional custom instructions to append to the default prompt.
 * @returns A promise that resolves to the identified text, or an empty string if no text is found.
 */
export const identifyTextInImage = async (base64ImageData: string, customPrompt?: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured. Please set the API_KEY environment variable.");
  }
  try {
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg', 
        data: base64ImageData,
      },
    };

    let promptText = "Analyze this image and extract any visible text. Present the extracted text as a single string. If multiple distinct text blocks are found, concatenate them with a space in between. If no text is found, return an empty string.";
    if (customPrompt && customPrompt.trim() !== "") {
      promptText += `\n\nAdditional user instructions: ${customPrompt.trim()}`;
    }

    const textPart = {
      text: promptText,
    };
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: { parts: [imagePart, textPart] },
      config: {
        thinkingConfig: { thinkingBudget: 0 },
      }
    });

    const identifiedText = response.text;
    return identifiedText.trim();

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    if (error instanceof Error) {
        if (error.message.includes("API key not valid")) {
             throw new Error("Invalid Gemini API Key. Please check your API_KEY environment variable.");
        }
        throw new Error(`Gemini API error: ${error.message}`);
    }
    throw new Error('An unknown error occurred while communicating with the Gemini API.');
  }
};