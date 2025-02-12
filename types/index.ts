export interface QANode {
  id: string;
  question: string;
  answer?: string;
  children: QANode[];
  questionNumber?: number;
}

export interface RequirementCategory {
  title: string;
  requirements: Array<{
    id: string;
    text: string;
    source: 'user-qa' | 'knowledge-base';
    sourceDetails?: {
      questionId?: string;
      knowledgeBaseIndex?: number;
    };
    priority: 'high' | 'medium' | 'low';
    category: 'functional' | 'technical' | 'ux' | 'accessibility' | 'security' | 'performance';
    tags: string[];
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface RequirementsDocument {
  id: string;
  prompt: string;
  lastUpdated: string;
  categories: {
    basicNeeds: RequirementCategory;
    functionalRequirements: RequirementCategory;
    userExperience: RequirementCategory;
    implementation: RequirementCategory;
    refinements: RequirementCategory;
    constraints: RequirementCategory;
  };
}

export interface MockupVersion {
  id: string;
  timestamp: string;
  name?: string;
  qaTree: QANode;
  requirementsDoc: RequirementsDocument;
  mockupData: {
    code: string;
    colorScheme: {
      primary: string;
      'primary-focus': string;
      'primary-content': string;
      secondary: string;
      'secondary-focus': string;
      'secondary-content': string;
      accent: string;
      'accent-focus': string;
      'accent-content': string;
      neutral: string;
      'neutral-focus': string;
      'neutral-content': string;
      'base-100': string;
      'base-200': string;
      'base-300': string;
      'base-content': string;
      [key: string]: string;
    };
    components: string[];
    features: string[];
    nextSteps: string[];
  };
}

export interface SessionMetadata {
  id: string;
  prompt: string;
  lastUpdated: string;
  questionCount: number;
  versions: MockupVersion[];
  settings: {
    traversalMode: 'bfs' | 'dfs';
  };
  name?: string;
} 