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