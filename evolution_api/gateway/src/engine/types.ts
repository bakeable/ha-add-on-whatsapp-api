/**
 * YAML Rule Schema and Types
 * Defines the structure of automation rules
 */

export interface RuleMatch {
  chat?: {
    type?: 'direct' | 'group' | 'any';
    ids?: string[];
  };
  sender?: {
    ids?: string[];
  };
  text?: {
    contains?: string[];
    starts_with?: string;
    regex?: string;
  };
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
                },
              },
              text: {
                type: 'object',
                properties: {
                  contains: { type: 'array', items: { type: 'string' } },
                  starts_with: { type: 'string' },
                  regex: { type: 'string' },
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
