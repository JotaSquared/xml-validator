export type FindingSeverity = 'error' | 'warning' | 'info';

export type FindingCategory =
  | 'SYNTAX'
  | 'STRUCTURE'
  | 'ATTRIBUTE'
  | 'NAMESPACE'
  | 'DECLARATION'
  | 'COMPARISON'
  | 'SYSTEM';

export interface ValidationFinding {
  id: string;
  severity: FindingSeverity;
  code: string;
  category: FindingCategory;
  title: string;
  message: string;
  path?: string | null;
  line?: number | null;
  column?: number | null;
  snippet?: string | null;
  suggestion: string;
  technicalDetails?: string | null;
}

export interface XMLAttributeNode {
  name: string;
  localName: string;
  prefix: string | null;
  value: string;
}

export interface XMLNeutralNode {
  id: string;
  name: string;
  localName: string;
  prefix: string | null;
  namespaceURI: string | null;
  path: string;
  attributes: XMLAttributeNode[];
  text: string;
  children: XMLNeutralNode[];
  childCount: number;
  depth: number;
  isDuplicateSibling: boolean;
  siblingIndex: number;
  lineNumber?: number | null;
}

export interface XMLStatistics {
  totalElements: number;
  totalAttributes: number;
  maxDepth: number;
  uniqueElementNames: number;
  repeatedElementCount: number;
  namespaceCount: number;
  namespaces: { prefix: string; uri: string }[];
  totalErrors: number;
  totalWarnings: number;
  totalInfos: number;
  characterCount: number;
  lineCount: number;
}

export type GlobalValidationStatus = 'VALID' | 'REVIEW_REQUIRED' | 'INVALID' | 'EMPTY';

export interface ValidationContext {
  rawXml: string;
  xmlDoc: Document | null;
  neutralTree: XMLNeutralNode | null;
  statistics: Partial<XMLStatistics>;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: FindingCategory;
  enabled: boolean;
  validate: (context: ValidationContext) => ValidationFinding[];
}

export interface StructuralDiffItem {
  type: 'MISSING_ELEMENT' | 'EXTRA_ELEMENT' | 'ATTRIBUTE_MISMATCH' | 'HIERARCHY_DIFF' | 'VALUE_DIFF';
  severity: FindingSeverity;
  path: string;
  elementName: string;
  description: string;
  templateValue?: string;
  actualValue?: string;
}

export interface ReferenceTemplate {
  id: string;
  name: string;
  category: string;
  scenarioFamily?: string;
  subscenario?: string;
  description: string;
  content: string;
  publisher?: string;
  sourceType?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  retrievedDate?: string;
  comparisonMode?: string;
  documentIntegrity?: {
    modifiedFromOfficialSample: boolean;
    modificationType: string;
    modificationDescription: string;
    modifiedDate: string;
  };
  documentNote?: string;
}

export interface XMLDeclarationInfo {
  version?: string;
  encoding?: string;
  standalone?: string;
  raw?: string;
}

export interface ValidationResult {
  status: GlobalValidationStatus;
  executionTimeMs: number;
  findings: ValidationFinding[];
  neutralTree: XMLNeutralNode | null;
  statistics: XMLStatistics;
  declaration?: {
    version?: string;
    encoding?: string;
    standalone?: string;
  } | null;
  diffs?: StructuralDiffItem[];
}
