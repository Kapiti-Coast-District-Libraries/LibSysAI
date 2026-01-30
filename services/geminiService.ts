import { SYSTEM_INSTRUCTION } from "../constants";

const SUPABASE_GEMINI_URL =
  "https://ytztmtcdfqpamhityaqz.supabase.co/functions/v1/gemini_proxy_func";

export const inkRequestTool = {
  name: "send_ink_request",
  parameters: {
    type: "object",
    description: "Triggers the automatic email request for printer ink to Max.",
    properties: {
      color: {
        type: "string",
        description: "The color of the ink/toner cartridge requested."
      },
      location: {
        type: "string",
        description: "The library or printer location."
      }
    },
    required: ["color", "location"]
  }
};

export const chatHistoryTool = {
  name: "send_chat_history",
  parameters: {
    type: "object",
    description: "Triggers an email containing the full conversation history.",
    properties: {}
  }
};

export const sendMessageToGemini = async (
  message: string,
  history: { role: "user" | "model"; content: string }[],
  sopContext = ""
) => {
  const fullInstructions = sopContext
    ? `${SYSTEM_INSTRUCTION}\n\n### SUPPLEMENTAL BUSINESS SOPs:\n${sopContext}`
    : SYSTEM_INSTRUCTION;

  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0enRtdGNkZnFwYW1oaXR5YXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MjE3ODEsImV4cCI6MjA4NTI5Nzc4MX0.abhbWGpaAEZZgS_IJ6MaoU5e-enZ11dX3sSkKBem8k8"; // safe to put in GitHub

const res = await fetch(SUPABASE_GEMINI_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  },
  body: JSON.stringify({
    message,
    history,
    instructions: fullInstructions,
    tools: [
      { functionDeclarations: [inkRequestTool, chatHistoryTool] }
    ]
  })
});


  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
};
