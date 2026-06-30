
import React, { useState, useRef, useEffect } from 'react';
import { Message, SopFile, VQD, LKP, LKPTable} from './types';
import { CONTACT_DIRECTORY, QUICK_ACTIONS, BOOLEAN_MANDATE, PRINTER_INSTRUCTION } from './constants';
import { sendMessageToGemini } from './services/geminiService';
import { supabaseClient } from "./supabase"

const MessageBubble: React.FC<{ 
  message: Message; 
  onOptionClick: (text: string) => void;
  isLatest: boolean;
}> = ({ message, onOptionClick, isLatest }) => {
  const isUser = message.role === 'user';

  const renderContent = (content: string) => {
    const textWithoutButtons = content.replace(/\[\[.*?\]\]/g, '').trim();
    const parts = textWithoutButtons.split(/(\*\*.*?\*\*)/g);

    return (
      <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={i} className={isUser ? "font-black underline decoration-blue-400" : "font-black text-slate-900"}>
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        })}
      </div>
    );
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="flex flex-col max-w-[85%] md:max-w-[75%]">
        <div 
          className={`rounded-2xl p-4 shadow-sm ${
            isUser 
              ? 'bg-blue-600 text-white rounded-tr-none' 
              : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
          }`}
        >
          {renderContent(message.content)}
          <div className={`text-[9px] mt-2 opacity-60 font-bold uppercase tracking-wider flex justify-between ${isUser ? 'text-right' : 'text-left'}`}>
            <span>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

  {!isUser && message.tokensUsed !== undefined && (
    <span className="text-slate-400">
      {message.tokensUsed.toLocaleString()} tokens
    </span>
  )}
</div>

        </div>
        
        {!isUser && message.options && message.options.length > 0 && isLatest && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onOptionClick(opt)}
                className="bg-white border-2 border-blue-500 text-blue-600 px-4 py-2 rounded-xl text-sm font-black hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm active:scale-95"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [vqdIndex, setVqdIndex] = useState<VQD[]>([]);
  const [lkpTables, setLkpTables] = useState<LKPTable[]>([]);
  const [view, setView] = useState<'chat' | 'admin'>('chat');
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sopFiles, setSopFiles] = useState<SopFile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInterruptedRef = useRef(false);
  type FlowState = "Normal" | "Ink";

  const currentFlowRef = useRef<FlowState>("Normal");

  useEffect(() => {

  const MAX_CONCURRENT_FETCHES = 50; // adjust based on your network speed

  const syncKnowledgeBase = async () => {
  let skipped = 0;
  let processed = 0;
  const newSopFiles: SopFile[] = [];
  const { data } = await supabaseClient.auth.getUser();
  setUser(data.user);
  console.log(user);
  try {
    const res = await fetch(
  "https://ytztmtcdfqpamhityaqz.supabase.co/functions/v1/SOP-Fetch",
  {
    headers: {
      Accept: "application/json",
      Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0enRtdGNkZnFwYW1oaXR5YXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MjE3ODEsImV4cCI6MjA4NTI5Nzc4MX0.abhbWGpaAEZZgS_IJ6MaoU5e-enZ11dX3sSkKBem8k8",
    },
  }
);
const files = await res.json();

    let total = files.length;
let fetched = 0;
let failed = 0;

for (const file of files) {
  try {
    const fileName = file.name;
    const contentRaw = file.content;

    fetched++;

    const isPDF = /\.(pdf)$/i.test(fileName);
    const isVQD = fileName === "vqd.json";
    const isLKP = fileName === "lkp.json";
    const isText = /\.(txt|md|html|csv|log)$/i.test(fileName);

    if (isPDF) continue;

    // ---- JSON CONFIG FILES ----
    if (isVQD || isLKP) {
      const fileObj = new File([contentRaw], fileName, {
        type: "application/json",
      });

      if (isVQD) {
        const { list } = await parseVQDFile(fileObj);
        setVqdIndex(list);
      } else {
        const { tables } = await parseLKPFile(fileObj);
        setLkpTables(tables);
      }

      processed++;
      continue;
    }

    // ---- TEXT FILES ----
    if (isText) {
      let content = contentRaw;

      if (fileName.endsWith(".html")) {
        content = stripHTML(contentRaw);
      }

      newSopFiles.push({
        name: fileName,
        path: file.path,
        content,
      });

      processed++;
      continue;
    }

    skipped++;
  } catch (err) {
    console.error(`Error processing ${file.name}:`, err);
    failed++;
  }
}

    setSopFiles((prev) => [...prev, ...newSopFiles]);

    if (fetched === total && failed === 0) {
      console.log(`Knowledge Base fully synced (${fetched}/${total})`);
    } else {
      console.log(
        `Knowledge Base incomplete: ${fetched}/${total} fetched, ${failed} failed`
      );
    }
  } catch (err) {
    console.warn("Auto-sync skipped or failed:", err);
  }
};


  // Call it once on page load
  syncKnowledgeBase();
}, []); // <- empty dependency array added here


  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const startNewChat = () => {
    if (messages.length === 0) {
      setView('chat');
      return;
    }
    if (confirm("Discard current conversation and return to the home screen?")) {
      setMessages([]);
      setInputText('');
      setIsTyping(false);
      isInterruptedRef.current = false;
      setView('chat');
    }
  };

  const stopGeneration = () => {
    isInterruptedRef.current = true;
    setIsTyping(false);
    setMessages(prev => {
      if (prev.length > 0 && prev[prev.length - 1].role === 'model' && !prev[prev.length - 1].content) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  };

  const parseOptions = (text: string): string[] => {
    const matches = text.match(/\[\[(.*?)\]\]/g);
    if (!matches) return [];
    return matches.map(m => m.slice(2, -2));
  };


  
  /**
   * RELEVANCE FILTER (Optimized for Boolean Queries and Lookups)
   * Prevents Token Overflows by enforcing a strict character budget.
   */
  const getRelevantContext = (
  query: string,
  files: SopFile[],
  vqdIndex: VQD[],
  lkpTables: LKPTable[],
  limit: number = 4,
  currentFlow: FlowState
): string => {
  if (!query) return "";
  if (files.length === 0 && (!vqdIndex || vqdIndex.length === 0)) return "";

  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\W+/).filter(t => t.length >= 3);

  const isRequestingBoolean =
    queryLower.includes(" boolean") ||
    queryLower.includes(" query") ||
    queryLower.includes(" code");

  const isRequestingInk =
    queryLower.includes(" ink") ||
    queryLower.includes(" toner") ||
    currentFlow === "Ink";

  let combinedContext = "";

  if (isRequestingInk) {
    combinedContext += PRINTER_INSTRUCTION;
    currentFlowRef.current = "Ink";
    return combinedContext;
  }

  // ===== VQD MATCHES (UNCHANGED) =====
  if (isRequestingBoolean && vqdIndex && vqdIndex.length > 0) {
    limit = 1;
    combinedContext += BOOLEAN_MANDATE;

    const vqdMatches = searchVQDDescriptions(vqdIndex, query, 70);

    if (vqdMatches.length > 0) {
      combinedContext +=
        `--- VQD MATCHES (Top Relevant Variables) ---` +
        vqdMatches
          .map(
            vqd => `ID: ${vqd.id}
Variable: ${vqd.variable_name}
Type: ${vqd.type}
Format: ${vqd.format ?? "None"}
Record: ${vqd.record_type ?? "None"}
Description: ${vqd.description}`
          )
          .join("\n");
    }
  }

  // ===== LKP MATCHES (UNCHANGED) =====
  if (isRequestingBoolean && lkpTables && lkpTables.length > 0) {
    const lkpMatches = searchLKPDescriptions(lkpTables, query, 35);

    if (lkpMatches.length > 0) {
      combinedContext +=
        `--- LKP MATCHES (Lookup Tables & Values) ---` +
        lkpMatches
          .map(
            table => `Table ID: ${table.table_id}
Table Description: ${table.table_description}
Rows:
${table.matchedRows
  .map(
    row => `  - ID: ${row.id}
    Description: ${row.description}`
  )
  .join("")}`
          )
          .join("");
    }
  }

  // ===== FILE RETRIEVAL =====
  if (files && files.length > 0) {

    const k1 = 1.5;
    const b = 0.75;

    // split files by type
    const textFiles = files.filter(
      f => f.name.endsWith(".txt") || f.name.endsWith(".html")
    );

    const jsonFiles = files.filter(f => f.name.endsWith(".json"));

    // ===== BM25 PREP FOR TEXT/HTML =====

    const docLengths = textFiles.map(f =>
      f.content.split(/\W+/).length
    );

    const avgDocLength =
      docLengths.reduce((a, b) => a + b, 0) /
      (docLengths.length || 1);

    const termDocCount: Record<string, number> = {};

    queryTerms.forEach(term => {
      termDocCount[term] = textFiles.filter(f =>
        f.content.toLowerCase().includes(term)
      ).length;
    });

    const scoredFiles: { file: SopFile; score: number }[] = [];

    // ===== BM25 SCORING =====
    textFiles.forEach((file, index) => {
      const content = file.content.toLowerCase();
      const words = content.split(/\W+/);
      const docLength = words.length;

      let score = 0;

      queryTerms.forEach(term => {
        const tf = words.filter(w => w === term).length;
        if (tf === 0) return;

        const df = termDocCount[term] || 1;
        const idf = Math.log(
          (textFiles.length - df + 0.5) / (df + 0.5) + 1
        );

        const numerator = tf * (k1 + 1);
        const denominator =
          tf +
          k1 *
            (1 - b + (b * docLength) / avgDocLength);

        score += idf * (numerator / denominator);
      });

      scoredFiles.push({ file, score });
    });

    // ===== ORIGINAL SCORING FOR JSON FILES =====
    jsonFiles.forEach(file => {
      let score = 0;

      const contentLower = file.content.toLowerCase();
      const nameLower = file.name.toLowerCase();
      const pathLower = file.path.toLowerCase();

      if (isRequestingBoolean) {
        if (
          nameLower.includes("boolean") ||
          nameLower.includes("lkp") ||
          nameLower.includes("json") ||
          nameLower.includes("vqd") ||
          nameLower.includes("queries")
        )
          score += 300;

        if (nameLower.includes("lkp")) score += 280;
        if (
          pathLower.includes("boolean") ||
          pathLower.includes("database")
        )
          score += 50;
      }

      queryTerms.forEach(term => {
        if (nameLower.includes(term)) score += 40;
        if (pathLower.includes(term)) score += 15;

        const regex = new RegExp(`\\b${term}\\b`, "gi");
        const matches = contentLower.match(regex);

        if (matches) score += matches.length * 10;

        if (contentLower.includes(term)) score += 2;
      });

      scoredFiles.push({ file, score });
    });

    // ===== SORT FILES =====
    const sortedFiles = scoredFiles
      .filter(f => f.score > 0)
      .sort((a, b) => b.score - a.score);

    // ===== INJECT FILES =====
    let filesIncluded = 0;

    for (const item of sortedFiles) {
      if (filesIncluded >= limit) break;

      const fileHeader = `--- SOURCE_FILE: ${item.file.path} ---`;

      combinedContext += fileHeader + item.file.content;

      filesIncluded++;
    }
  }

  return combinedContext;
};


function normalizePlural(word: string): string[] {
  if (word.endsWith("s")) {
    return [word, word.slice(0, -1)];
  }
  return [word];
}

function matchesWord(
  inputWord: string,
  descriptionWord: string
): boolean {
  // Helper to get the base form of a word
  function baseForm(word: string): string {
    word = word.toLowerCase();
    
    // simple plural -> singular
    if (word.endsWith("ies")) {
      return word.slice(0, -3) + "y"; // "bodies" -> "body"
    }
    if (word.endsWith("s") && word.length > 3) {
      return word.slice(0, -1); // "borrowers" -> "borrower"
    }

    // past tense -> base
    if (word.endsWith("ed") && word.length > 3) {
      return word.slice(0, -2); // "issued" -> "issue"
    }

    // present participle -> base
    if (word.endsWith("ing") && word.length > 4) {
      return word.slice(0, -3); // "borrowing" -> "borrow"
    }

    return word;
  }

  const inputForms = normalizePlural(inputWord).map(baseForm);
  const descForms = normalizePlural(descriptionWord).map(baseForm);

  for (const i of inputForms) {
    for (const d of descForms) {
      // input must not be longer than description
      if (i.length > d.length) continue;

      if (d.includes(i)) {
        return true;
      }
    }
  }

  return false;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

interface LKPSearchResult {
  table_id: string;
  table_description: string;
  matchedRows: LKP[];
}

function searchLKPDescriptions(
  tables: LKPTable[], 
  inputText: string, 
  topN: number = 250
): LKPSearchResult[] {
  // Predefined keyword lists...
  const locationKeywords = [ /* ... */ ];
  const categoryKeywords = [ /* ... */ ];
  const collectionKeywords = [ /* ... */ ];
  const itemStatusKeywords = [ /* ... */ ];

  const inputWords = tokenize(inputText).filter(word => word.length >= 4);
  const extendedInputWords = new Set<string>(inputWords);

  inputWords.forEach(word => {
    if (locationKeywords.includes(word)) locationKeywords.forEach(w => extendedInputWords.add(w));
    if (categoryKeywords.includes(word)) categoryKeywords.forEach(w => extendedInputWords.add(w));
    if (collectionKeywords.includes(word)) collectionKeywords.forEach(w => extendedInputWords.add(w));
    if (itemStatusKeywords.includes(word)) itemStatusKeywords.forEach(w => extendedInputWords.add(w));
  });

  if (extendedInputWords.size === 0) return [];

  const extendedInputArray = Array.from(extendedInputWords);

  const tableResults: LKPSearchResult[] = [];

  tables.forEach(table => {
    const matchedRows: LKP[] = [];

    for (const row of table.rows) {
      const rowWords = tokenize(row.description + " " + row.id);
      const isMatch = extendedInputArray.some(inputWord =>
        rowWords.some(word => matchesWord(inputWord, word))
      );

      if (isMatch) matchedRows.push(row);
    }

    if (matchedRows.length > 0) {
      tableResults.push({
        table_id: table.table_id,
        table_description: table.table_description,
        matchedRows
      });
    }
  });

  // Sort by number of matches per table (optional)
  const sorted = tableResults.sort((a, b) => b.matchedRows.length - a.matchedRows.length);

  return sorted.slice(0, topN);
}





function searchVQDDescriptions(
  index: VQD[],
  inputText: string,
  topN: number = 250
): VQD[] {
  // Synonym lists for VQD (can be expanded as per need)
  const borrowerKeywords = ["Borrower", "Borrowers", "Borrowed", "BRW"];
  const instKeywords = ["Kapiti", "BRWHI", "Institution", "Home"];
  const locationKeywords = ["Paraparaumu", "PARA", "Location", "Waikanae", "WAI", "Paekakariki", "PAE", "Otaki", "OTA"];

  // Function to get synonyms based on the input text
  function enrichInputText(inputText: string): string[] {
    const enrichedWords: string[] = [inputText]; // Start with the original input

    // Check if input matches any keywords and add related terms
    if (borrowerKeywords.some(word => inputText.toLowerCase().includes(word.toLowerCase()))) {
      enrichedWords.push(...borrowerKeywords);
    }
    if (instKeywords.some(word => inputText.toLowerCase().includes(word.toLowerCase()))) {
      enrichedWords.push(...instKeywords);
    }
    if (locationKeywords.some(word => inputText.toLowerCase().includes(word.toLowerCase()))) {
      enrichedWords.push(...instKeywords);
    }
    // Remove duplicates and return
    return Array.from(new Set(enrichedWords));
  }

  // Enrich the input text with synonyms before processing
  const enrichedInputWords = enrichInputText(inputText);

  // Tokenize the enriched input words
  const inputWords = enrichedInputWords
  .flatMap(word => tokenize(word))
  .filter(word => word.length >= 4);
  if (inputWords.length === 0) return [];

  // Score each VQD based on how many words match
  const scored = index.map(vqd => {
    const descWords = tokenize(vqd.description);
    let score = 0;

    for (const inputWord of inputWords) {
      if (descWords.some(descWord => matchesWord(inputWord, descWord))) {
        score += 1; // +1 for each matching word
      }
    }

    return { vqd, score };
  });

  // Filter out 0-score items, sort by score descending, take top N
  const topMatches = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(item => item.vqd);

  console.log("[VQD SEARCH RESULTS]", {
    query: inputText,
    totalMatches: scored.filter(i => i.score > 0).length,
    topMatchesCount: topMatches.length,
    topMatches
  });

  return topMatches;
}





  async function parseVQDFile(file: File): Promise<{
  list: VQD[];
  byVariable: Map<string, VQD>;
  byId: Map<number, VQD>;
}> {
  const text = await file.text();

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error("Invalid JSON in vqd.json");
  }

  if (!Array.isArray(raw)) {
    throw new Error("vqd.json must contain a JSON array");
  }

  const list: VQD[] = [];
  const byVariable = new Map<string, VQD>();
  const byId = new Map<number, VQD>();

  for (const item of raw) {
    // Basic shape validation
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as any).variable_name !== "string"
    ) {
      continue; // skip malformed rows
    }

    const vqd: VQD = {
      id: Number((item as any).id),
      variable_name: (item as any).variable_name,
      type: (item as any).type ?? "",
      format: (item as any).format ?? null,
      record_type: (item as any).record_type ?? null,
      description: (item as any).description ?? "",
      search_text: (item as any).search_text ?? "",
    };

    list.push(vqd);
    byVariable.set(vqd.variable_name.toUpperCase(), vqd);
    byId.set(vqd.id, vqd);
  }

  return { list, byVariable, byId };
}

async function parseLKPFile(file: File): Promise<{
  tables: LKPTable[];
  list: LKP[];
  byId: Map<string, LKP>;
  byDescription: Map<string, LKP>;
}> {
  const text = await file.text();

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON in lkp.json");
  }

  if (!Array.isArray(raw)) {
    throw new Error("lkp.json must contain a JSON array of tables");
  }

  const tables: LKPTable[] = [];
  const list: LKP[] = [];
  const byId = new Map<string, LKP>();
  const byDescription = new Map<string, LKP>();

  for (const table of raw) {
    if (
      typeof table !== "object" ||
      table === null ||
      !Array.isArray((table as any).rows)
    ) continue;

    const lkpTable: LKPTable = {
      table_id: (table as any).table_id,
      table_description: (table as any).table_description,
      rows: []
    };

    for (const row of (table as any).rows) {
      if (
        typeof row !== "object" ||
        row === null ||
        typeof row.id !== "string" ||
        typeof row.description !== "string"
      ) continue;

      const lkp: LKP = {
        id: row.id,
        description: row.description
            };

      lkpTable.rows.push(lkp);
      list.push(lkp);
      byId.set(lkp.id, lkp);
      byDescription.set(lkp.description, lkp);
    }

    tables.push(lkpTable);
  }

  return { tables, list, byId, byDescription };
}


 function stripHTML(html: string): string {
  // Remove scripts, styles, and tags
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')  // remove scripts
    .replace(/<style[\s\S]*?<\/style>/gi, '')    // remove styles
    .replace(/<!--[\s\S]*?-->/g, '')             // remove comments
    .replace(/<\/?[^>]+(>|$)/g, '')              // remove tags
    .replace(/\s+/g, ' ')                        // normalize whitespace
    .trim();
}



  const handleSend = async (text: string = inputText) => {
    if (!text.trim() || isTyping) return;

    isInterruptedRef.current = false;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    const modelMsgId = (Date.now() + 1).toString();
    const modelMsg: Message = {
      id: modelMsgId,
      role: 'model',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, modelMsg]);

    try {
      const dynamicSopContext = getRelevantContext(text, sopFiles, vqdIndex, lkpTables, 4, currentFlowRef.current);

// Build full prompt for logging
const fullPrompt = `
--- CHAT HISTORY ---
${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('')}

--- USER INPUT ---
${text}

--- DYNAMIC SOP / VQD CONTEXT ---
${dynamicSopContext}
`;

console.log("[FULL PROMPT SENT TO GEMINI]", fullPrompt);

const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));

const response = await sendMessageToGemini(text, chatHistory, dynamicSopContext);

if (isInterruptedRef.current) return;

// Use the text returned by the Edge function
let finalContent = response.text || "";
let options = parseOptions(finalContent);

// If Edge returned a mailto link, open it in the browser
if (response.mailto) {
  currentFlowRef.current = "Normal";
  window.location.href = response.mailto;
}

// Update the chat message with final content and options
setMessages(prev =>
  prev.map(m =>
    m.id === modelMsgId
      ? { ...m, content: finalContent, options }
      : m
  )
);

} catch (error) {
  if (isInterruptedRef.current) return;
  console.error("Chat Error:", error);
  const errorMsg = error instanceof Error && error.message.includes('exceeds the maximum number') 
    ? "The information found is too large for me to process in one go. Please try being more specific about the file name or location you need." 
    : "Sorry, I hit a snag, Please try again.";
  
  setMessages(prev => 
    prev.map(m => m.id === modelMsgId ? { ...m, content: errorMsg } : m)
  );
} finally {
  setIsTyping(false);
}
  }
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans text-sm">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-80 bg-white border-r border-slate-200">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100 text-xl font-bold">L</span>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-tight">LibSys AI</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">SMART Library Internal Support</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <nav className="space-y-1">
            <button onClick={() => setView('chat')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${view === 'chat' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
              Support Chat
            </button>
            {user?.id === "753c187c-5c83-44c1-a01b-f02d5537ab62" && (
  <button
    onClick={() => (window.location.href = "analytics.html")}
    className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${
      view === 'admin'
        ? 'bg-blue-50 text-blue-600'
        : 'text-slate-500 hover:bg-slate-50'
    }`}
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path 
  strokeLinecap="round" 
  strokeLinejoin="round" 
  strokeWidth="2" 
  d="M11.983 5.5c.39-1.49 2.644-1.49 3.034 0a1.724 1.724 0 002.573 1.06c1.313-.76 2.825.752 2.065 2.065a1.724 1.724 0 001.06 2.573c1.49.39 1.49 2.644 0 3.034a1.724 1.724 0 00-1.06 2.573c.76 1.313-.752 2.825-2.065 2.065a1.724 1.724 0 00-2.573 1.06c-.39 1.49-2.644 1.49-3.034 0a1.724 1.724 0 00-2.573-1.06c-1.313.76-2.825-.752-2.065-2.065a1.724 1.724 0 00-1.06-2.573c-1.49-.39-1.49-2.644 0-3.034a1.724 1.724 0 001.06-2.573c-.76-1.313.752-2.825 2.065-2.065a1.724 1.724 0 002.573-1.06zM13.5 15.75a3 3 0 100-6 3 3 0 000 6z" 
/>
  </svg>
    Admin Panel
  </button>
)}

          </nav>

          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Urgent Contacts (Max Unavailable)</h3>
            <div className="space-y-3">
              {CONTACT_DIRECTORY.map((contact, idx) => (
                <div key={idx} className="p-4 bg-white rounded-2xl border-2 border-slate-50 shadow-sm">
                  <div className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-tighter">{contact.department}</div>
                  <div className="text-lg font-black text-slate-800 tracking-tight">{contact.number}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-900 text-white text-[9px] text-center font-black tracking-[0.3em] opacity-90 uppercase">Property Of Kapiti Coast District Council</div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-white relative">
  <header className="flex items-center justify-between p-4 lg:px-10 bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-10">
    
    {/* Left: Status */}
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${isTyping ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
        {isTyping ? 'Thinking...' : 'Smart-Search Active'}
      </span>
    </div>

    {/* Right: Buttons */}
    <div className="flex gap-2">
      <button 
        onClick={startNewChat}
        className="flex items-center gap-2 px-4 py-2 border-2 border-slate-100 hover:border-blue-500 hover:text-blue-600 rounded-xl text-xs font-black transition-all text-slate-500 bg-white"
      >
        {messages.length === 0 ? "Home" : "New Chat"}
      </button>

      <button
        onClick={async () => {
          await supabaseClient.auth.signOut();
          window.location.href = "login.html"; 
        }}
        className="flex items-center gap-2 px-4 py-2 border-2 border-slate-100 hover:border-blue-500 hover:text-blue-600 rounded-xl text-xs font-black transition-all text-slate-500 bg-white"
      >
        Logout
      </button>
    </div>

  </header>


        <div className="flex-1 overflow-hidden">
            <div className="h-full flex flex-col">
              <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-10 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 pb-20">
                    <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2.5rem] flex items-center justify-center mb-8 text-5xl shadow-inner">📚</div>
                    <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tighter italic">Kia ora!</h2>
                    <p className="text-slate-500 max-w-sm mb-12 font-medium"> {sopFiles.length} Searchable files available. How can I help?</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                      {QUICK_ACTIONS.map((action, idx) => (
                        <button key={idx} onClick={() => handleSend(action.prompt)} className="flex items-center gap-4 p-6 text-left bg-white border-2 border-slate-100 rounded-[2rem] hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm active:scale-95 group">
                          <span className="text-4xl group-hover:scale-110 transition-transform">{action.icon}</span>
                          <div>
                            <div className="font-black text-slate-800 group-hover:text-blue-700">{action.label}</div>
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">{action.prompt}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto w-full pb-10">
                    {messages.map((m, idx) => (
                      <MessageBubble key={m.id} message={m} onOptionClick={handleSend} isLatest={idx === messages.length - 1} />
                    ))}
                    {isTyping && (
                      <div className="flex flex-col items-start mb-4">
                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-3xl rounded-tl-none text-slate-400 text-xs font-black flex items-center gap-3">
                          <span className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                          </span>
                          Searching SOP Data
                        </div>
                        <button 
                          onClick={stopGeneration}
                          className="mt-3 ml-4 flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                          Stop Generation
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 lg:p-10 bg-white border-t border-slate-100">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-end gap-3 max-w-4xl mx-auto">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Describe the issue... (e.g. 'I Dont know how to... | I Need a boolean query for...')"
                    className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] p-4 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 focus:bg-white min-h-[64px] max-h-32 resize-none transition-all outline-none text-slate-800 font-bold"
                    rows={1}
                  />
                  <button type="submit" disabled={!inputText.trim() || isTyping} className={`p-5 rounded-[1.5rem] transition-all shadow-xl active:scale-95 ${!inputText.trim() || isTyping ? 'bg-slate-100 text-slate-300' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                  </button>
                </form>
              </div>
            </div>
          )
        </div>
      </main>
    </div>
  );
};

export default App;
