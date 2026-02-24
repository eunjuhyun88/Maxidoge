export type AgentChatRow = {
  id: string;
  user_id: string;
  channel: string;
  sender_kind: string;
  sender_id: string | null;
  sender_name: string;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: any;
  created_at: string;
};

export type ChatMessageRecord = {
  id: string;
  userId: string;
  channel: string;
  senderKind: string;
  senderId: string | null;
  senderName: string;
  message: string;
  meta: Record<string, unknown>;
  createdAt: number;
};

export type ScanRunContextRow = {
  id: string;
  pair: string;
  timeframe: string;
  consensus: 'long' | 'short' | 'neutral';
  avg_confidence: number | string;
  summary: string;
  created_at: string;
};

export type ScanSignalContextRow = {
  agent_id: string;
  agent_name: string;
  vote: 'long' | 'short' | 'neutral';
  confidence: number | string;
  analysis_text: string;
  data_source: string;
  entry_price: number | string;
  tp_price: number | string;
  sl_price: number | string;
};

export type ScanContext = {
  scanId: string | null;
  pair: string;
  timeframe: string;
  consensus: 'long' | 'short' | 'neutral' | null;
  avgConfidence: number | null;
  summary: string | null;
  signals: ScanSignalContextRow[];
};

export type AgentReply = {
  agentId: string;
  text: string;
  source: 'scan_context' | 'fallback';
  scanId: string | null;
};

