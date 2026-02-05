/**
 * YAML Rule Schema and Types
 * Defines the structure of automation rules with Evolution API event support
 */

// All Evolution API event types that can trigger rules
export const EVOLUTION_EVENTS = [
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'MESSAGES_DELETE',
  'SEND_MESSAGE',
  'CONNECTION_UPDATE',
  'CONTACTS_UPDATE',
  'CONTACTS_UPSERT',
  'GROUPS_UPSERT',
  'GROUPS_UPDATE',
  'GROUP_PARTICIPANTS_UPDATE',
  'PRESENCE_UPDATE',
  'CHATS_UPSERT',
  'CHATS_UPDATE',
  'CHATS_DELETE',
  'CALL',
  'QRCODE_UPDATED',
  'TYPEBOT_START',
  'TYPEBOT_CHANGE_STATUS',
  'LABELS_EDIT',
  'LABELS_ASSOCIATION',
] as const;

export type EvolutionEventType = typeof EVOLUTION_EVENTS[number];

/** Text matching modes */
export type TextMatchMode = 'contains' | 'starts_with' | 'regex';

export interface TextFilter {
  /** The matching mode */
  mode: TextMatchMode;
  /** The pattern(s) to match against */
  patterns: string[];
}

export interface RuleMatch {
  /** Evolution API events that trigger this rule (default: ['MESSAGES_UPSERT']) */
  events?: EvolutionEventType[];
  chat?: {
    type?: 'direct' | 'group' | 'any';
    /** Filter by specific chat IDs (WhatsApp JIDs) */
    ids?: string[];
  };
  sender?: {
    /** Filter by exact sender JIDs (e.g., 31612345678@s.whatsapp.net) */
    ids?: string[];
    /** Filter by sender phone numbers (auto-extracted, e.g., 31612345678) */
    numbers?: string[];
  };
  text?: TextFilter;
}

export interface RuleAction {
  type: 'ha_service' | 'reply_whatsapp';
  // For ha_service
  service?: string;
  target?: {
    entity_id?: string | string[];
  };
  data?: Record<string, any>;
  // For reply_whatsapp
  text?: string;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  stop_on_match: boolean;
  match: RuleMatch;
  actions: RuleAction[];
  cooldown_seconds?: number;
}

export interface RuleSet {
  version: number;
  rules: Rule[];
}

export interface ValidationError {
  path: string;
  message: string;
  line?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  ruleCount: number;
  normalizedYaml?: string;
}

export interface TestResult {
  matchedRules: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
  actionsPreview: Array<{
    ruleId: string;
    type: string;
    details: string;
  }>;
}

/** Result returned by processMessage for live test execution */
export interface ExecutionResult {
  /** Rules that were evaluated */
  evaluatedRules: Array<{
    id: string;
    name: string;
    matched: boolean;
    reason: string;
    skippedCooldown?: boolean;
    stoppedChain?: boolean;
  }>;
  /** Actions that were actually executed */
  executedActions: Array<{
    ruleId: string;
    ruleName: string;
    type: string;
    details: string;
    success: boolean;
    error?: string;
    durationMs: number;
  }>;
  /** Verbose log lines generated during execution */
  logs: string[];
}

// JSON Schema for rule validation
export const RULE_SCHEMA = {
  type: 'object',
  required: ['version', 'rules'],
  properties: {
    version: { type: 'number', const: 1 },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'enabled', 'match', 'actions'],
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          enabled: { type: 'boolean' },
          priority: { type: 'number', default: 100 },
          stop_on_match: { type: 'boolean', default: true },
          cooldown_seconds: { type: 'number', minimum: 0 },
          match: {
            type: 'object',
            properties: {
              events: {
                type: 'array',
                items: { type: 'string', enum: [...EVOLUTION_EVENTS] },
              },
              chat: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['direct', 'group', 'any'] },
                  ids: { type: 'array', items: { type: 'string' } },
                },
              },
              sender: {
                type: 'object',
                properties: {
                  ids: { type: 'array', items: { type: 'string' } },
                  numbers: { type: 'array', items: { type: 'string' } },
                },
              },
              text: {
                type: 'object',
                required: ['mode', 'patterns'],
                properties: {
                  mode: { type: 'string', enum: ['contains', 'starts_with', 'regex'] },
                  patterns: { type: 'array', items: { type: 'string' }, minItems: 1 },
                },
              },
            },
          },
          actions: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['type'],
              properties: {
                type: { type: 'string', enum: ['ha_service', 'reply_whatsapp'] },
                service: { type: 'string' },
                target: {
                  type: 'object',
                  properties: {
                    entity_id: {
                      oneOf: [
                        { type: 'string' },
                        { type: 'array', items: { type: 'string' } },
                      ],
                    },
                  },
                },
                data: { type: 'object' },
                text: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
};
