
import { GoogleGenAI, GenerateContentResponse, Type, FunctionDeclaration } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

const getAIClient = () => {
  const apiKey = import.meta.env.VITE_KEY;
  if (!apiKey) throw new Error("API Key is missing");
  return new GoogleGenAI({ apiKey });
};

const inkRequestTool: FunctionDeclaration = {
  name: 'send_ink_request',
  parameters: {
    type: Type.OBJECT,
    description: 'Triggers the automatic email request for printer ink to Max.',
    properties: {
      color: {
        type: Type.STRING,
        description: 'The color of the ink/toner cartridge requested (e.g., Cyan, Magenta, Black).'
      },
      location: {
        type: Type.STRING,
        description: 'The library location or specific printer location (e.g., Childrens Area, Workroom).'
      }
    },
    required: ['color', 'location']
  }
};

const chatHistoryTool: FunctionDeclaration = {
  name: 'send_chat_history',
  parameters: {
    type: Type.OBJECT,
    description: 'Triggers an email containing the full current conversation history to be sent to Max for investigation.',
    properties: {}
  }
};

export const sendMessageToGemini = async (
  message: string,
  history: { role: 'user' | 'model'; content: string }[],
  sopContext: string = ""
) => {
  const ai = getAIClient();
  
  // Combine base instructions with any uploaded SOP data
  const fullInstructions = sopContext 
    ? `${SYSTEM_INSTRUCTION}\n\n### SUPPLEMENTAL BUSINESS SOPs (INTERNAL KNOWLEDGE):\n${sopContext}`
    : SYSTEM_INSTRUCTION;

  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    history: history.map(h => ({
      role: h.role,
      parts: [{ text: h.content }]
    })),
    config: {
      systemInstruction: fullInstructions,
      temperature: 0.2,
      tools: [{ functionDeclarations: [inkRequestTool, chatHistoryTool] }]
    }
  });

  const response = await chat.sendMessage({ message });
  return response;
};
