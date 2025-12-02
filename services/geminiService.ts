




import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION, REFINE_SYSTEM_INSTRUCTION, REACT_CONVERSION_SYSTEM_INSTRUCTION, FLUTTER_CONVERSION_SYSTEM_INSTRUCTION, REACT_NATIVE_EXPO_SYSTEM_INSTRUCTION, REACT_NATIVE_CLI_SYSTEM_INSTRUCTION, EXPLAIN_SYSTEM_INSTRUCTION } from "../constants";
import { AppSettings, AiProvider } from "../types";

// --- Helper to handle Gemini SDK Cancellation ---
// Since the SDK might not support AbortSignal natively in all methods, we wrap the promise.
const withSignal = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise;
  
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      reject(new DOMException("Aborted", "AbortError"));
      signal.removeEventListener("abort", handleAbort);
    };

    signal.addEventListener("abort", handleAbort);

    promise.then(
      (val) => {
        signal.removeEventListener("abort", handleAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener("abort", handleAbort);
        reject(err);
      }
    );
  });
};

// --- Google Gemini Helper ---
const getGeminiClient = (customApiKey?: string) => {
  const apiKey = customApiKey || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is missing and no custom key provided.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- OpenRouter Helper ---
const callOpenRouter = async (
  model: string,
  systemPrompt: string,
  userPrompt: string,
  imageBase64?: string | null,
  imageType?: string | null,
  apiKey?: string,
  temperature?: number,
  signal?: AbortSignal
): Promise<string> => {
  if (!apiKey) {
    throw new Error("OpenRouter API Key is required.");
  }

  const messages: any[] = [
    {
      role: "system",
      content: systemPrompt
    }
  ];

  if (imageBase64 && imageType) {
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: userPrompt || "Generate code based on this image."
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${imageType};base64,${imageBase64}`
          }
        }
      ]
    });
  } else {
    messages.push({
      role: "user",
      content: userPrompt
    });
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin, 
      "X-Title": "Pic2Code",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: temperature ?? 0.1,
    }),
    signal: signal
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OpenRouter Error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
};

// --- Main Service Functions ---

export const generateCode = async (
  base64Image: string | null,
  mimeType: string | null,
  userPrompt: string = "",
  settings?: AppSettings,
  signal?: AbortSignal
): Promise<string> => {
  const provider = settings?.provider || 'gemini';
  const temperature = settings?.temperature ?? 0.1;
  const isCreative = settings?.quality === 'creative';
  const model = settings?.model || (provider === 'openrouter' ? "google/gemini-2.0-flash-exp:free" : "gemini-3-pro-preview");

  const creativePrompt = isCreative 
    ? " The input is a reference. Feel free to enhance the visual design with modern shadows, gradients, better typography, and spacing while keeping the core layout structure. Make it look professional and polished."
    : " Strictly follow the provided reference. Do not improvise. The goal is precise replication.";

  const finalUserPrompt = `
    ${userPrompt ? `User Requirements: ${userPrompt}` : ''}
    ${creativePrompt}
    ${base64Image ? 'Analyze the image and generate the HTML code.' : `Create a complete, single-file HTML/Tailwind/JS web page based on this description: "${userPrompt}". Ensure it is visually stunning, responsive, and functional.`}
  `;

  try {
    if (provider === 'openrouter') {
      return await callOpenRouter(
        model,
        SYSTEM_INSTRUCTION,
        finalUserPrompt,
        base64Image,
        mimeType,
        settings?.openRouterApiKey,
        temperature,
        signal
      );
    } else {
      const ai = getGeminiClient(settings?.customApiKey);
      const parts: any[] = [];
      
      if (base64Image && mimeType) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Image,
          },
        });
      }
      
      parts.push({ text: finalUserPrompt });

      const requestPromise = ai.models.generateContent({
        model: model,
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: temperature, 
          thinkingConfig: model.includes('thinking') ? { thinkingBudget: 2048 } : undefined
        },
      });

      const response = await withSignal(requestPromise, signal);
      const text = response.text;
      if (!text) throw new Error("No response from Gemini.");
      return text;
    }

  } catch (error) {
    // Re-throw so the caller knows it was aborted or failed
    throw error;
  }
};

export const refineCode = async (
  currentCode: string,
  userInstruction: string,
  settings?: AppSettings,
  signal?: AbortSignal
): Promise<string> => {
  const provider = settings?.provider || 'gemini';
  const model = settings?.model || (provider === 'openrouter' ? "google/gemini-2.0-flash-exp:free" : "gemini-3-pro-preview");
  
  const prompt = `
    Current Code:
    \`\`\`html
    ${currentCode}
    \`\`\`

    User Instruction: ${userInstruction}
  `;

  try {
    if (provider === 'openrouter') {
      return await callOpenRouter(
        model,
        REFINE_SYSTEM_INSTRUCTION,
        prompt,
        null,
        null,
        settings?.openRouterApiKey,
        0.1,
        signal
      );
    } else {
      const ai = getGeminiClient(settings?.customApiKey);
      const requestPromise = ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          systemInstruction: REFINE_SYSTEM_INSTRUCTION,
          temperature: 0.1,
        }
      });

      const response = await withSignal(requestPromise, signal);
      const text = response.text;
      if (!text) throw new Error("No response from Gemini.");
      return text;
    }
  } catch (error) {
    throw error;
  }
};

export const convertHtmlToReact = async (htmlCode: string, settings?: AppSettings, signal?: AbortSignal): Promise<string> => {
  const provider = settings?.provider || 'gemini';
  const model = settings?.model || (provider === 'openrouter' ? "google/gemini-2.0-flash-exp:free" : "gemini-3-pro-preview");

  const prompt = `
    Convert this HTML code to React:
    \`\`\`html
    ${htmlCode}
    \`\`\`
  `;

  try {
    if (provider === 'openrouter') {
      return await callOpenRouter(
        model,
        REACT_CONVERSION_SYSTEM_INSTRUCTION,
        prompt,
        null,
        null,
        settings?.openRouterApiKey,
        0.1,
        signal
      );
    } else {
      const ai = getGeminiClient(settings?.customApiKey);
      const requestPromise = ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          systemInstruction: REACT_CONVERSION_SYSTEM_INSTRUCTION,
          temperature: 0.1,
        }
      });

      const response = await withSignal(requestPromise, signal);
      const text = response.text;
      if (!text) throw new Error("No response from Gemini.");
      return text;
    }
  } catch (error) {
    throw error;
  }
};

export const convertHtmlToFlutter = async (htmlCode: string, settings?: AppSettings, signal?: AbortSignal): Promise<string> => {
  const provider = settings?.provider || 'gemini';
  const model = settings?.model || (provider === 'openrouter' ? "google/gemini-2.0-flash-exp:free" : "gemini-3-pro-preview");

  const prompt = `
    Convert this HTML code to Flutter (Dart):
    \`\`\`html
    ${htmlCode}
    \`\`\`
  `;

  try {
    if (provider === 'openrouter') {
      return await callOpenRouter(
        model,
        FLUTTER_CONVERSION_SYSTEM_INSTRUCTION,
        prompt,
        null,
        null,
        settings?.openRouterApiKey,
        0.1,
        signal
      );
    } else {
      const ai = getGeminiClient(settings?.customApiKey);
      const requestPromise = ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          systemInstruction: FLUTTER_CONVERSION_SYSTEM_INSTRUCTION,
          temperature: 0.1,
        }
      });

      const response = await withSignal(requestPromise, signal);
      const text = response.text;
      if (!text) throw new Error("No response from Gemini.");
      return text;
    }
  } catch (error) {
    throw error;
  }
};

export const convertHtmlToReactNative = async (
  htmlCode: string, 
  settings?: AppSettings, 
  signal?: AbortSignal,
  platform: 'expo' | 'cli' = 'expo'
): Promise<string> => {
  const provider = settings?.provider || 'gemini';
  const model = settings?.model || (provider === 'openrouter' ? "google/gemini-2.0-flash-exp:free" : "gemini-3-pro-preview");
  const instruction = platform === 'expo' ? REACT_NATIVE_EXPO_SYSTEM_INSTRUCTION : REACT_NATIVE_CLI_SYSTEM_INSTRUCTION;
  const platformName = platform === 'expo' ? 'React Native (Expo)' : 'React Native (CLI)';

  const prompt = `
    Convert this HTML code to ${platformName}:
    \`\`\`html
    ${htmlCode}
    \`\`\`
  `;

  try {
    if (provider === 'openrouter') {
      return await callOpenRouter(
        model,
        instruction,
        prompt,
        null,
        null,
        settings?.openRouterApiKey,
        0.1,
        signal
      );
    } else {
      const ai = getGeminiClient(settings?.customApiKey);
      const requestPromise = ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          systemInstruction: instruction,
          temperature: 0.1,
        }
      });

      const response = await withSignal(requestPromise, signal);
      const text = response.text;
      if (!text) throw new Error("No response from Gemini.");
      return text;
    }
  } catch (error) {
    throw error;
  }
};

export interface CodeExplanation {
  summary: string;
  structure: string[];
  styling: string[];
  interactivity: string[];
}

export const explainCode = async (htmlCode: string, settings?: AppSettings, signal?: AbortSignal): Promise<CodeExplanation> => {
  const provider = settings?.provider || 'gemini';
  const model = settings?.model || (provider === 'openrouter' ? "google/gemini-2.0-flash-exp:free" : "gemini-3-pro-preview");

  const prompt = `Explain this code:\n\`\`\`html\n${htmlCode.substring(0, 15000)}\n\`\`\``;

  try {
    let text = "";
    if (provider === 'openrouter') {
      text = await callOpenRouter(
        model,
        EXPLAIN_SYSTEM_INSTRUCTION,
        prompt,
        null,
        null,
        settings?.openRouterApiKey,
        0.2,
        signal
      );
    } else {
      const ai = getGeminiClient(settings?.customApiKey);
      const requestPromise = ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          systemInstruction: EXPLAIN_SYSTEM_INSTRUCTION,
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      });
      const response = await withSignal(requestPromise, signal);
      text = response.text || "";
    }

    if (!text) throw new Error("No response.");
    
    // Ensure we parse JSON correctly, handling potential markdown wrappers
    const cleanedText = text.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
    return JSON.parse(cleanedText) as CodeExplanation;

  } catch (error) {
    throw error;
  }
};