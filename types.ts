
export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  options?: string[];
  tokensUsed?: number;

}

export interface SupportContact {
  department: string;
  number: string;
  hours: string;
  priority: 'low' | 'medium' | 'high';
}

export interface QuickAction {
  label: string;
  prompt: string;
  icon: string;
}

export interface SopFile {
  name: string;
  path: string;
  content: string;
}

export interface VQD {
  id: number;
  variable_name: string;
  type: string;
  format: string | null;
  record_type: string | null;
  description: string;
  search_text: string;
}

export interface LKP {
  id: string;
  description: string;
  properties: string | null;
}

export interface LKPTable {
  table_id: string;
  table_description: string;
  table_properties: string[];
  rows: LKP[];
}


