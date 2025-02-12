declare module '@google/generative-ai' {
  interface GenerationConfig {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  }

  interface ModelParams {
    model: string;
    generationConfig?: GenerationConfig;
  }

  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(params: ModelParams): GenerativeModel;
  }

  interface ContentPart {
    text: string;
  }

  interface Content {
    role: string;
    parts: ContentPart[];
  }

  export interface GenerativeModel {
    generateContent(prompt: string | { contents: Content[] }): Promise<GenerateContentResult>;
  }

  export interface GenerateContentResult {
    response: {
      text(): string;
    };
  }
} 