
import React, { useState, useRef, useEffect } from 'react';
import { Message, SopFile, VQD, LKP, LKPTable } from './types';
import { CONTACT_DIRECTORY, QUICK_ACTIONS, SYSTEM_INSTRUCTION, BOOLEAN_MANDATE, PRINTER_INSTRUCTION } from './constants';
import { sendMessageToGemini } from './services/geminiService';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sopFiles, setSopFiles] = useState<SopFile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInterruptedRef = useRef(false);

  useEffect(() => {
  const KNOWLEDGE_BASE_URL =
    'https://raw.githubusercontent.com/Kapiti-Coast-District-Libraries/LibSysAI/main/SOP/';

  const syncKnowledgeBase = async () => {
    let skipped = 0;
    let processed = 0;
    const newSopFiles: SopFile[] = [];  

    try {
      const manifestRes = await fetch(`${KNOWLEDGE_BASE_URL}manifest.json`);
      if (!manifestRes.ok) throw new Error("Manifest not found");

      const manifest: string[] = await manifestRes.json();

      for (const filePath of manifest) {
        const fileName = filePath.split('/').pop() ?? filePath;
        const fileUrl = `${KNOWLEDGE_BASE_URL}${filePath}`;

        const isExcel = /\.(xlsx|xls)$/i.test(fileName);
        const isText =
          /\.(txt|md|html|csv|log|pdf)$/i.test(fileName);
        const isVQD = fileName === 'vqd.json';
        const isLKP = fileName === 'lkp.json';

        try {
          // ---------------- VQD ----------------
          if (isVQD) {
            const res = await fetch(fileUrl);
            const text = await res.text();
            const file = new File([text], fileName, { type: 'application/json' });

            const { list } = await parseVQDFile(file);
            setVqdIndex(list);
            console.log("Loaded VQD entries:", list.length);
            processed++;
            continue;
          }

          // ---------------- LKP ----------------
          if (isLKP) {
            const res = await fetch(fileUrl);
            const text = await res.text();
            const file = new File([text], fileName, { type: 'application/json' });

            const { tables } = await parseLKPFile(file);
            setLkpTables(tables);
            console.log("Loaded LKP tables:", tables.length);
            processed++;
            continue;
          }

          // ---------------- Text ----------------
          if (isText) {
            const res = await fetch(fileUrl);
            let textContent = await res.text();

            if (fileName.endsWith('.html')) {
              textContent = stripHTML(textContent);
            }

            newSopFiles.push({
              name: fileName,
              path: filePath,
              content: textContent
            });

            processed++;
            continue;
          }

          skipped++;
        } catch (err) {
          console.error(`Error processing ${filePath}:`, err);
          skipped++;
        }
      }

      setSopFiles(prev => [...prev, ...newSopFiles]);

      alert(
        `Knowledge Base Synced!\n\n` +
        `- Processed: ${processed} files\n` +
        `- Skipped: ${skipped}\n` +
        `- Source: GitHub\n` +
        `- Path awareness enabled`
      );
    } catch (err) {
      console.warn("Auto-sync skipped or failed:", err);
    }
  };

  syncKnowledgeBase();
}, []);



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
  limit: number = 3
): string => {
  if (!query) return "";
  if (files.length === 0 && (!vqdIndex || vqdIndex.length === 0)) return "";

  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\W+/).filter(t => t.length > 4);
  const isRequestingBoolean =
    queryLower.includes("boolean") ||
    queryLower.includes("query") ||
    queryLower.includes("code");

  let combinedContext = SYSTEM_INSTRUCTION + BOOLEAN_MANDATE;

  // ===== VQD MATCHES (Boolean / Lookup Context) =====
  if (isRequestingBoolean && vqdIndex && vqdIndex.length > 0) {
  const vqdMatches = searchVQDDescriptions(vqdIndex, query, 100); // get top 200

  if (vqdMatches.length > 0) {
    combinedContext +=
      `\n\n--- VQD MATCHES (Top 200 Relevant Variables) ---\n` +
      vqdMatches
        .map(vqd => `ID: ${vqd.id}
Variable: ${vqd.variable_name}
Type: ${vqd.type}
Format: ${vqd.format ?? "None"}
Record: ${vqd.record_type ?? "None"}
Description: ${vqd.description}`)
        .join("\n\n");

    console.log("[VQD CONTEXT INJECTED]", vqdMatches);
  }
}

if (isRequestingBoolean && lkpTables && lkpTables.length > 0) {
  const lkpMatches = searchLKPDescriptions(lkpTables, query, 100);

  if (lkpMatches.length > 0) {
    combinedContext +=
      `\n\n--- LKP MATCHES (Lookup Tables & Values) ---\n` +
      lkpMatches
        .map(table =>
          `Table ID: ${table.table_id}
Table Description: ${table.table_description}
Properties: ${table.table_properties?.join(", ") ?? "None"}
Rows:
${table.matchedRows
  .map(
    row =>
      `  - ID: ${row.id}
    Description: ${row.description}
    Properties: ${row.properties ?? "None"}`
  )
  .join("\n")}`
        )
        .join("\n\n");

    console.log("[LKP CONTEXT INJECTED]", lkpMatches);
  }
}



  // ===== SOP FILE SCORING =====
  if (files && files.length > 0) {
    const scoredFiles = files.map((file) => {
      let score = 0;
      const contentLower = file.content.toLowerCase();
      const nameLower = file.name.toLowerCase();
      const pathLower = file.path.toLowerCase();

      if (isRequestingBoolean) {
        // Boost files with boolean/config names or paths
        if (
          nameLower.includes("boolean") ||
          nameLower.includes("lkp") ||
          nameLower.includes("json") ||
          nameLower.includes("vqd") ||
          nameLower.includes("queries")
        )
          score += 300;

        if (nameLower.includes("lkp")) score += 280;
        if (pathLower.includes("boolean") || pathLower.includes("database"))
          score += 50;
      }

      queryTerms.forEach((term) => {
        if (nameLower.includes(term)) score += 40;
        if (pathLower.includes(term)) score += 15;

        const regex = new RegExp(`\\b${term}\\b`, "gi");
        const matches = contentLower.match(regex);
        if (matches) score += matches.length * 10;

        if (contentLower.includes(term)) score += 2;
      });

      return { file, score };
    });

    const sortedFiles = scoredFiles
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score);

    let filesIncluded = 0;
    for (const item of sortedFiles) {
  if (filesIncluded >= limit) break;

  // Start with full file content
  let contentToInject = item.file.content;

  const fileHeader = `\n\n--- SOURCE_FILE: ${item.file.path} ---\n`;
  combinedContext += fileHeader + contentToInject;

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
  table_properties: string[];
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

  const inputWords = tokenize(inputText);
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
        table_properties: table.table_properties,
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
  const inputWords = enrichedInputWords.flatMap(word => tokenize(word));
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
      table_properties: (table as any).table_properties ?? [],
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
        description: row.description,
        properties: row.properties ?? null
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
      const dynamicSopContext = getRelevantContext(text, sopFiles, vqdIndex, lkpTables);

// Build full prompt for logging
const fullPrompt = `
--- CHAT HISTORY ---
${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}

--- USER INPUT ---
${text}

--- DYNAMIC SOP / VQD CONTEXT ---
${dynamicSopContext}
`;

console.log("[FULL PROMPT SENT TO GEMINI]", fullPrompt);

      const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await sendMessageToGemini(text, chatHistory, dynamicSopContext);
      
      if (isInterruptedRef.current) return;

      let finalContent = response.text || "";
      let options = parseOptions(finalContent);

      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          if (call.name === 'send_ink_request') {
            const { color, location } = call.args as { color: string, location: string };
            const subject = encodeURIComponent(`AI Support Toner Request - ${color} | ${location}`);
            const body = encodeURIComponent(`${location} library requests a ${color} 212x Toner Cartridge.`);
            window.location.href = `mailto:max.thomson@kapiticoast.govt.nz?subject=${subject}&body=${body}`;
            finalContent = `✅ **Email Client Opened**\n\nI have prepared the email for **${color}** toner for **${location}**.\n\nAnything else? [[New Issue]] [[Done]]`;
            options = parseOptions(finalContent);
          } else if (call.name === 'send_chat_history') {
            const historyText = messages.map(m => `${m.role.toUpperCase()}: ${m.content.replace(/\[\[.*?\]\]/g, '')}`).join('\n\n');
            const subject = encodeURIComponent(`LBSYS AI Log - ${new Date().toLocaleDateString()}`);
            const body = encodeURIComponent(`Chat history:\n\n${historyText}`);
            window.location.href = `mailto:max.thomson@kapiticoast.govt.nz?subject=${subject}&body=${body}`;
            finalContent = `📬 **History Exported**\n\nI've opened your email client with the full log for Max.\n\nAnything else? [[New Issue]] [[Done]]`;
            options = parseOptions(finalContent);
          }
        }
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === modelMsgId
            ? { ...m, content: finalContent, options}
            : m
        )
      );

    } catch (error) {
      if (isInterruptedRef.current) return;
      console.error("Chat Error:", error);
      const errorMsg = error instanceof Error && error.message.includes('exceeds the maximum number') 
        ? "The information found is too large for me to process in one go. Please try being more specific about the file name or location you need." : "Sorry, I hit a snag, Please try again.";
      
      setMessages(prev => 
        prev.map(m => m.id === modelMsgId ? { ...m, content: errorMsg } : m)
      );
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans text-sm">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-80 bg-white border-r border-slate-200">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100 text-xl font-bold">L</span>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-tight">LibSys AI</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">KCDC Internal Support</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <nav className="space-y-1">
            <button onClick={() => setView('chat')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${view === 'chat' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
              Support Chat
            </button>
            <button onClick={() => setView('admin')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${view === 'admin' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              Admin & SOPs
            </button>
          </nav>

          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Urgent Contacts</h3>
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

        <div className="p-4 bg-slate-900 text-white text-[9px] text-center font-black tracking-[0.3em] opacity-90 uppercase">KCDC Internal Tool</div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white relative">
        <header className="flex items-center justify-between p-4 lg:px-10 bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isTyping ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              {isTyping ? 'Thinking...' : 'Smart-Search Active'}
            </span>
          </div>
          <button 
            onClick={startNewChat}
            className="flex items-center gap-2 px-4 py-2 border-2 border-slate-100 hover:border-blue-500 hover:text-blue-600 rounded-xl text-xs font-black transition-all text-slate-500 bg-white"
          >
            {messages.length === 0 ? "Home" : "New Chat"}
          </button>
        </header>

        <div className="flex-1 overflow-hidden">
          {view === 'chat' ? (
            <div className="h-full flex flex-col">
              <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-10 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 pb-20">
                    <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2.5rem] flex items-center justify-center mb-8 text-5xl shadow-inner">📚</div>
                    <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tighter italic">Kia ora!</h2>
                    <p className="text-slate-500 max-w-sm mb-12 font-medium">Scanning {sopFiles.length} files (including LKP Lookups and Excel Tables). How can I help?</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                      {QUICK_ACTIONS.map((action, idx) => (
                        <button key={idx} onClick={() => handleSend(action.prompt)} className="flex items-center gap-4 p-6 text-left bg-white border-2 border-slate-100 rounded-[2rem] hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm active:scale-95 group">
                          <span className="text-4xl group-hover:scale-110 transition-transform">{action.icon}</span>
                          <div>
                            <div className="font-black text-slate-800 group-hover:text-blue-700">{action.label}</div>
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Start Trouble-shooting</div>
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
                          Cross-referencing Excel & Lookups...
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
                    placeholder="Describe the issue... (e.g. 'Boolean for Items at Paraparaumu')"
                    className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] p-4 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 focus:bg-white min-h-[64px] max-h-32 resize-none transition-all outline-none text-slate-800 font-bold"
                    rows={1}
                  />
                  <button type="submit" disabled={!inputText.trim() || isTyping} className={`p-5 rounded-[1.5rem] transition-all shadow-xl active:scale-95 ${!inputText.trim() || isTyping ? 'bg-slate-100 text-slate-300' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Admin View */
<div className="h-full p-6 lg:p-10 overflow-y-auto custom-scrollbar bg-slate-50/50">
  <div className="max-w-4xl mx-auto">
    <div className="mb-10">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight">
        Knowledge Base
      </h2>
      <p className="text-slate-500 mt-2 font-medium">
        SOPs are automatically synced from the central GitHub knowledge repository.
        This view is read-only in production.
      </p>
    </div>

    <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm flex flex-col">
      <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center justify-between">
        Indexed SOPs
        <span className="text-xs font-black bg-slate-100 px-3 py-1 rounded-full text-slate-500">
          {sopFiles.length} files
        </span>
      </h3>

      {sopFiles.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center opacity-50">
          <div className="text-5xl mb-4">📄</div>
          <div className="text-xs font-bold uppercase tracking-widest">
            No SOPs indexed
          </div>
          <div className="text-[10px] text-slate-400 mt-2">
            Waiting for GitHub sync
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 max-h-[28rem] pr-2">
          {sopFiles.slice(0, 200).map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"
            >
              <span className="text-xs font-bold text-slate-600 truncate mr-4">
                {file.path}
              </span>
              <span className="text-[10px] font-black text-green-500 uppercase">
                Synced
              </span>
            </div>
          ))}

          {sopFiles.length > 200 && (
            <div className="text-center text-[10px] font-bold text-slate-400 pt-3">
              + {sopFiles.length - 200} more files indexed
            </div>
          )}
        </div>
      )}

      {sopFiles.length > 0 && (
        <button
          onClick={() => setSopFiles([])}
          className="mt-6 text-red-500 text-xs font-black uppercase tracking-widest hover:underline text-center"
        >
          Clear Local Cache
        </button>
      )}
    </div>
  </div>
</div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
