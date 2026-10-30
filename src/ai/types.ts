import type { CapabilityId } from './capabilities';

export type ProviderId =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'mistral'
  | 'xai'
  | 'groq'
  | 'together'
  | 'fireworks'
  | 'cohere'
  | 'perplexity'
  | 'huggingface'
  | 'cerebras'
  | 'sambanova'
  | 'nvidia'
  | 'bedrock'
  | 'azure'
  | 'github'
  | 'replicate';

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  /** Short description shown on the provider card. */
  desc: string;
  descAr: string;
  /** Brand colour used for the logo tile — taken from the vendor identity. */
  color: string;
  /** Simple Icons slug (official brand marks served as SVG). */
  icon: string;
  website: string;
  docs: string;
  /** How credentials are accepted. */
  auth: 'apiKey' | 'oauth' | 'none';
  /** Capability of the gateway adapter (not of any single model). */
  features: {
    streaming: boolean;
    tools: boolean;
    vision: boolean;
    imageGeneration: boolean;
    webSearch: boolean;
    reasoning: boolean;
    jsonMode: boolean;
  };
  /** Human label of the credential name expected by the gateway. */
  keyLabel: string;
}

/**
 * The AI Provider layer. The UI only ever talks to this registry and to the
 * gateway — never to a vendor endpoint directly.
 */
export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    desc: 'One API for hundreds of models from many vendors, with automatic failover.',
    descAr: 'واجهة واحدة لمئات النماذج من عدة مزودين مع تبديل تلقائي عند التعطل.',
    color: '#2E2E2E',
    icon: 'openrouter',
    website: 'https://openrouter.ai',
    docs: 'https://openrouter.ai/docs',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: false, webSearch: true, reasoning: true, jsonMode: true },
    keyLabel: 'OpenRouter API Key',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    desc: 'GPT family, DALL·E image generation, audio and realtime APIs.',
    descAr: 'عائلة GPT وتوليد الصور DALL·E والصوت والواجهات اللحظية.',
    color: '#10A37F',
    icon: 'openai',
    website: 'https://openai.com',
    docs: 'https://platform.openai.com/docs',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: true, webSearch: false, reasoning: true, jsonMode: true },
    keyLabel: 'OpenAI API Key',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    desc: 'Claude models with strong writing, coding and long-context reasoning.',
    descAr: 'نماذج Claude المتميزة في الكتابة والبرمجة والاستدلال طويل السياق.',
    color: '#D97757',
    icon: 'anthropic',
    website: 'https://anthropic.com',
    docs: 'https://docs.anthropic.com',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: false, webSearch: false, reasoning: true, jsonMode: true },
    keyLabel: 'Anthropic API Key',
  },
  {
    id: 'google',
    name: 'Google AI / Gemini',
    desc: 'Gemini models with multimodal input, long context and Google Search grounding.',
    descAr: 'نماذج Gemini متعددة الوسائط مع سياق طويل وأساس البحث في جوجل.',
    color: '#4285F4',
    icon: 'google',
    website: 'https://ai.google.dev',
    docs: 'https://ai.google.dev/docs',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: true, webSearch: true, reasoning: true, jsonMode: true },
    keyLabel: 'Google AI API Key',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    desc: 'Cost-efficient reasoning and chat models with strong code performance.',
    descAr: 'نماذج استدلال ومحادثة اقتصادية بأداء قوي في البرمجة.',
    color: '#4D6BFE',
    icon: 'deepseek',
    website: 'https://deepseek.com',
    docs: 'https://api-docs.deepseek.com',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: false, imageGeneration: false, webSearch: false, reasoning: true, jsonMode: true },
    keyLabel: 'DeepSeek API Key',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    desc: 'European open and commercial models, embeddings and code assistance.',
    descAr: 'نماذج أوروبية مفتوحة وتجارية للتضمين والبرمجة.',
    color: '#FA500F',
    icon: 'mistralai',
    website: 'https://mistral.ai',
    docs: 'https://docs.mistral.ai',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: true, webSearch: false, reasoning: true, jsonMode: true },
    keyLabel: 'Mistral API Key',
  },
  {
    id: 'xai',
    name: 'xAI',
    desc: 'Grok models with real-time search and reasoning modes.',
    descAr: 'نماذج Grok مع بحث لحظي وأنماط استدلال.',
    color: '#111111',
    icon: 'x',
    website: 'https://x.ai',
    docs: 'https://docs.x.ai',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: false, webSearch: true, reasoning: true, jsonMode: true },
    keyLabel: 'xAI API Key',
  },
  {
    id: 'groq',
    name: 'Groq',
    desc: 'Very fast inference for open models on custom LPU hardware.',
    descAr: 'استدلال فائق السرعة للنماذج المفتوحة عبر عتاد LPU.',
    color: '#F55036',
    icon: 'groq',
    website: 'https://groq.com',
    docs: 'https://console.groq.com/docs',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: false, webSearch: false, reasoning: true, jsonMode: true },
    keyLabel: 'Groq API Key',
  },
  {
    id: 'together',
    name: 'Together AI',
    desc: 'Open-source model hosting, fine-tuning and serverless inference.',
    descAr: 'استضافة النماذج مفتوحة المصدر ودقتها واستدلالها.',
    color: '#097969',
    icon: 'togetherai',
    website: 'https://together.ai',
    docs: 'https://docs.together.ai',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: true, webSearch: false, reasoning: false, jsonMode: true },
    keyLabel: 'Together API Key',
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    desc: 'Fast serverless inference for open models with function calling.',
    descAr: 'استدلال سريع بلا خادم للنماذج المفتوحة مع استدعاء الدوال.',
    color: '#F0522C',
    icon: 'firefox',
    website: 'https://fireworks.ai',
    docs: 'https://docs.fireworks.ai',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: true, webSearch: false, reasoning: false, jsonMode: true },
    keyLabel: 'Fireworks API Key',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    desc: 'Command models, reranking and enterprise search embeddings.',
    descAr: 'نماذج Command وإعادة الترتيب وتجهيز البحث المؤسسي.',
    color: '#39594D',
    icon: 'cohere',
    website: 'https://cohere.com',
    docs: 'https://docs.cohere.com',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: false, imageGeneration: false, webSearch: true, reasoning: false, jsonMode: true },
    keyLabel: 'Cohere API Key',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    desc: 'Answer engines with live web search and citations built in.',
    descAr: 'محركات إجابات مع بحث ويب حيّ ومصادر مدرجة.',
    color: '#20808D',
    icon: 'perplexity',
    website: 'https://perplexity.ai',
    docs: 'https://docs.perplexity.ai',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: false, webSearch: true, reasoning: true, jsonMode: true },
    keyLabel: 'Perplexity API Key',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    desc: 'Inference providers for thousands of open models and datasets.',
    descAr: 'مزودو استدلال لآلاف النماذج مفتوحة المصدر والبيانات.',
    color: '#FFD21E',
    icon: 'huggingface',
    website: 'https://huggingface.co',
    docs: 'https://huggingface.co/docs/api-inference',
    auth: 'apiKey',
    features: { streaming: true, tools: false, vision: true, imageGeneration: true, webSearch: false, reasoning: false, jsonMode: false },
    keyLabel: 'Hugging Face Token',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    desc: 'Wafer-scale inference delivering extreme token throughput.',
    descAr: 'استدلال بمقياس الرقاقة يحقق أعلى معدل للرموز.',
    color: '#00CBE6',
    icon: 'cerebras',
    website: 'https://cerebras.ai',
    docs: 'https://docs.cerebras.ai',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: false, imageGeneration: false, webSearch: false, reasoning: true, jsonMode: true },
    keyLabel: 'Cerebras API Key',
  },
  {
    id: 'sambanova',
    name: 'SambaNova',
    desc: 'High-throughput hosted open models for production workloads.',
    descAr: 'استضافة عالية الإنتاجية للنماذج المفتوحة في بيئات الإنتاج.',
    color: '#00A8E8',
    icon: 'samsung',
    website: 'https://sambanova.ai',
    docs: 'https://docs.sambanova.ai',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: false, imageGeneration: false, webSearch: false, reasoning: false, jsonMode: true },
    keyLabel: 'SambaNova API Key',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    desc: 'Self-hosted and cloud microservices for NVIDIA-optimized models.',
    descAr: 'خدمات دقيقة محسّنة من NVIDIA محلياً وسحابياً.',
    color: '#76B900',
    icon: 'nvidia',
    website: 'https://nvidia.com',
    docs: 'https://docs.nvidia.com/nim',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: true, webSearch: false, reasoning: false, jsonMode: true },
    keyLabel: 'NVIDIA API Key',
  },
  {
    id: 'bedrock',
    name: 'Amazon Bedrock',
    desc: 'AWS managed access to Claude, Llama, Mistral and Titan models.',
    descAr: 'وصول مُدار عبر AWS إلى Claude وLlama وMistral وTitan.',
    color: '#FF9900',
    icon: 'amazonwebservices',
    website: 'https://aws.amazon.com/bedrock',
    docs: 'https://docs.aws.amazon.com/bedrock',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: true, webSearch: false, reasoning: true, jsonMode: true },
    keyLabel: 'AWS Access Key + Secret (region:useAccess:secret)',
  },
  {
    id: 'azure',
    name: 'Azure AI',
    desc: 'Azure OpenAI deployments with enterprise networking and quotas.',
    descAr: 'نشر Azure OpenAI مع الشبكات المؤسسية والحصص.',
    color: '#0078D4',
    icon: 'microsoftazure',
    website: 'https://azure.microsoft.com/ai-services',
    docs: 'https://learn.microsoft.com/azure/ai-services',
    auth: 'apiKey',
    features: { streaming: true, tools: true, vision: true, imageGeneration: true, webSearch: false, reasoning: true, jsonMode: true },
    keyLabel: 'Endpoint + API Key (endpoint:key)',
  },
  {
    id: 'github',
    name: 'GitHub Models',
    desc: 'Free preview access to popular models directly from GitHub.',
    descAr: 'وصول تجريبي مجاني لأشهر النماذج مباشرة من GitHub.',
    color: '#181717',
    icon: 'github',
    website: 'https://github.com/marketplace/models',
    docs: 'https://docs.github.com/en/github-models',
    auth: 'oauth',
    features: { streaming: true, tools: true, vision: true, imageGeneration: false, webSearch: false, reasoning: true, jsonMode: true },
    keyLabel: 'GitHub PAT (models:read)',
  },
  {
    id: 'replicate',
    name: 'Replicate',
    desc: 'Run thousands of community models with a single HTTP API.',
    descAr: 'تشغيل آلاف نماذج المجتمع عبر واجهة HTTP واحدة.',
    color: '#000000',
    icon: 'replicate',
    website: 'https://replicate.com',
    docs: 'https://replicate.com/docs',
    auth: 'apiKey',
    features: { streaming: true, tools: false, vision: true, imageGeneration: true, webSearch: false, reasoning: false, jsonMode: false },
    keyLabel: 'Replicate API Token',
  },
];

export const PROVIDER_MAP: Record<string, ProviderMeta> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p]),
);

/** Capability of the provider adapter — used to gate UI features honestly. */
export function providerSupports(id: string, feature: keyof ProviderMeta['features']): boolean {
  return Boolean(PROVIDER_MAP[id]?.features[feature]);
}

// ---------------------------------------------------------------------------
// Model shape returned by the gateway (fetched dynamically, never hard-coded)
// ---------------------------------------------------------------------------

export interface ModelPricing {
  input?: number | null;
  output?: number | null;
  currency?: 'USD';
  free?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderId;
  description?: string;
  descriptionAr?: string;
  company?: string;
  contextWindow?: number;
  maxOutput?: number;
  releasedAt?: string;
  updated_at?: string;
  pricing?: ModelPricing;
  capabilities: CapabilityId[];
  /** Parameters the model accepts — drives the advanced settings form. */
  parameters: string[];
  /** true when the gateway verified the model against the live vendor API. */
  verified?: boolean;
  available?: boolean;
}

export interface ProviderConnection {
  provider: ProviderId;
  connected: boolean;
  /** Never the key itself — only metadata. */
  keyHint?: string;
  models?: number;
  lastTest?: { ok: boolean; at: number; message?: string };
  verified?: boolean;
}

export type ReasoningLevel = 'fast' | 'balanced' | 'advanced';

export interface ChatMessageContent {
  type: 'text' | 'image' | 'file';
  text?: string;
  /** data URL or gateway file URL */
  url?: string;
  mimeType?: string;
  name?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: ChatMessageContent[] | string;
  createdAt: number;
  model?: string;
  provider?: ProviderId;
  sources?: SourceItem[];
  error?: string;
  rating?: 1 | -1;
  attachments?: AttachmentMeta[];
  /**
   * Text extracted from file attachments (PDF/DOCX/XLSX/plain text). Kept out
   * of `content` so the bubble stays readable, but sent to the model so it can
   * actually read the files the user attached.
   */
  extracted?: string;
}

export interface AttachmentMeta {
  id: string;
  name: string;
  size: number;
  mime: string;
  kind: 'image' | 'pdf' | 'doc' | 'sheet' | 'text' | 'code' | 'other';
}

export interface SourceItem {
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: string;
  site?: string;
}

export interface StreamDelta {
  type: 'text' | 'source' | 'reasoning' | 'tool' | 'done' | 'error';
  text?: string;
  source?: SourceItem;
  code?: string;
  message?: string;
}
