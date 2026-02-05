/**
 * Rule Engine
 * Parses YAML rules, validates, matches incoming Evolution API events, and executes actions.
 * 
 * Key concepts:
 *  - Rules subscribe to one or more Evolution API events (default: MESSAGES_UPSERT).
 *  - Matching filters: chat type/IDs, sender numbers, text mode (contains/starts_with/regex).
 *  - Text "contains" matching normalises both sides (lowercase, trim, collapse whitespace).
 *  - Every rule fire and its action results are logged to the database.
 */

import Ajv from 'ajv';
import yaml from 'js-yaml';
import { EvolutionClient } from '../clients/evolution';
import { HAClient } from '../clients/ha';
import { loadConfig } from '../config';
import { DatabasePool } from '../db/init';
import {
    EvolutionEventType,
    ExecutionResult,
    Rule,
    RULE_SCHEMA,
    RuleSet,
    TestResult,
    ValidationError,
    ValidationResult
} from './types';

export interface IncomingMessage {
  chatId: string;
  chatType: 'group' | 'direct';
  senderId: string;
  senderName?: string;
  text: string;
  messageId?: string;
  /** The Evolution API event that generated this message */
  event?: EvolutionEventType;
}

/**
 * Normalise text for comparison: lowercase, trim, collapse whitespace.
 * This makes "contains" matching resilient to extra spaces, casing, etc.
 */
export function normaliseText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Extract the bare phone number from a JID or phone string.
 * "31612345678@s.whatsapp.net" → "31612345678"
 */
export function extractPhoneNumber(jidOrPhone: string): string {
  return jidOrPhone.split('@')[0].replace(/[^0-9]/g, '');
}

export class RuleEngine {
  private db: DatabasePool;
  private haClient: HAClient;
  private evolutionClient: EvolutionClient;
  private config = loadConfig();
  private rulesCache: RuleSet | null = null;
  private ajv: Ajv;
  
  constructor(db: DatabasePool, haClient: HAClient, evolutionClient: EvolutionClient) {
    this.db = db;
    this.haClient = haClient;
    this.evolutionClient = evolutionClient;
    this.ajv = new Ajv({ allErrors: true, verbose: true });
  }
  
  // ──────────────────────────── Lifecycle ────────────────────────────
  
  async init(): Promise<void> {
    await this.reloadRules();
  }
  
  async reloadRules(): Promise<void> {
    const row = await this.db.getOne<any>('SELECT parsed_json FROM wa_ruleset WHERE id = 1');
    if (row?.parsed_json) {
      try {
        const parsed = typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json;
        this.rulesCache = parsed;
        console.log(`[RuleEngine] Loaded ${this.rulesCache?.rules?.length || 0} rules`);
      } catch (e) {
        console.error('[RuleEngine] Failed to parse cached rules:', e);
        this.rulesCache = { version: 1, rules: [] };
      }
    } else {
      this.rulesCache = { version: 1, rules: [] };
    }
  }
  
  // ──────────────────────────── Validation ────────────────────────────
  
  validateYaml(yamlText: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    let parsed: any;
    try {
      parsed = yaml.load(yamlText, { schema: yaml.DEFAULT_SCHEMA });
    } catch (e: any) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: `YAML syntax error: ${e.message}`,
          line: e.mark?.line ? e.mark.line + 1 : undefined,
        }],
        ruleCount: 0,
      };
    }
    
    const validate = this.ajv.compile(RULE_SCHEMA);
    const valid = validate(parsed);
    
    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        errors.push({
          path: error.instancePath || '/',
          message: error.message || 'Validation error',
        });
      }
    }
    
    // Additional semantic validation
    if (parsed?.rules) {
      const ids = new Set<string>();
      for (let i = 0; i < parsed.rules.length; i++) {
        const rule = parsed.rules[i];
        
        // Duplicate ID check
        if (ids.has(rule.id)) {
          errors.push({ path: `rules[${i}].id`, message: `Duplicate rule ID: ${rule.id}` });
        }
        ids.add(rule.id);
        
        // Action-specific checks
        if (rule.actions) {
          for (let j = 0; j < rule.actions.length; j++) {
            const action = rule.actions[j];
            if (action.type === 'ha_service' && !action.service) {
              errors.push({ path: `rules[${i}].actions[${j}].service`, message: 'ha_service action requires a service field' });
            }
            if (action.type === 'reply_whatsapp' && !action.text) {
              errors.push({ path: `rules[${i}].actions[${j}].text`, message: 'reply_whatsapp action requires a text field' });
            }
          }
        }
        
        // Validate regex patterns are valid
        if (rule.match?.text?.mode === 'regex' && rule.match.text.patterns) {
          for (const pattern of rule.match.text.patterns) {
            try {
              new RegExp(pattern, 'i');
            } catch (e: any) {
              errors.push({ path: `rules[${i}].match.text.patterns`, message: `Invalid regex: ${e.message}` });
            }
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      ruleCount: parsed?.rules?.length || 0,
      normalizedYaml: errors.length === 0 ? yaml.dump(parsed, { indent: 2 }) : undefined,
    };
  }
  
  // ──────────────────────────── Persistence ────────────────────────────
  
  async saveRules(yamlText: string): Promise<ValidationResult> {
    const validation = this.validateYaml(yamlText);
    if (!validation.valid) return validation;
    
    const parsed = yaml.load(yamlText) as RuleSet;
    const parsedJson = JSON.stringify(parsed);
    
    await this.db.run(`
      UPDATE wa_ruleset 
      SET yaml_text = ?, parsed_json = ?, version = version + 1, updated_at = NOW()
      WHERE id = 1
    `, [yamlText, parsedJson]);
    
    this.rulesCache = parsed;
    console.log(`[RuleEngine] Saved ${parsed.rules.length} rules`);
    return validation;
  }
  
  async getRulesYaml(): Promise<string> {
    const row = await this.db.getOne<any>('SELECT yaml_text FROM wa_ruleset WHERE id = 1');
    return row?.yaml_text || 'version: 1\nrules: []';
  }
  
  // ──────────────────────────── Testing ────────────────────────────
  
  testMessage(message: IncomingMessage): TestResult {
    const matched: TestResult['matchedRules'] = [];
    const actions: TestResult['actionsPreview'] = [];
    
    if (!this.rulesCache?.rules) {
      return { matchedRules: [], actionsPreview: [] };
    }
    
    const sortedRules = [...this.rulesCache.rules]
      .filter(r => r.enabled)
      .sort((a, b) => (a.priority || 100) - (b.priority || 100));
    
    for (const rule of sortedRules) {
      const matchResult = this.matchRule(rule, message);
      if (matchResult.matches) {
        matched.push({ id: rule.id, name: rule.name, reason: matchResult.reason });
        for (const action of rule.actions) {
          actions.push({ ruleId: rule.id, type: action.type, details: this.describeAction(action) });
        }
        if (rule.stop_on_match !== false) break;
      }
    }
    
    return { matchedRules: matched, actionsPreview: actions };
  }
  
  // ──────────────────────────── Processing ────────────────────────────
  
  async processMessage(message: IncomingMessage, dbMessageId?: number): Promise<ExecutionResult> {
    const result: ExecutionResult = { evaluatedRules: [], executedActions: [], logs: [] };
    const log = (msg: string) => {
      console.log(msg);
      result.logs.push(msg);
    };

    if (!this.rulesCache?.rules) {
      log('[RuleEngine] No rules loaded – skipping');
      return result;
    }
    
    const sortedRules = [...this.rulesCache.rules]
      .filter(r => r.enabled)
      .sort((a, b) => (a.priority || 100) - (b.priority || 100));
    
    log(`[RuleEngine] ▶ Processing message: event=${message.event || 'MESSAGES_UPSERT'}, chat=${message.chatId}, sender=${message.senderId}, text="${message.text.substring(0, 80)}"`);
    log(`[RuleEngine]   Evaluating ${sortedRules.length} enabled rules (${this.rulesCache.rules.length} total)`);

    for (const rule of sortedRules) {
      const onCooldown = await this.isOnCooldown(rule.id, message.chatId);
      if (onCooldown) {
        log(`[RuleEngine]   ⏳ Rule "${rule.id}" (${rule.name}) – skipped (cooldown active for ${message.chatId})`);
        result.evaluatedRules.push({
          id: rule.id, name: rule.name, matched: false, reason: 'on cooldown', skippedCooldown: true,
        });
        continue;
      }
      
      const matchResult = this.matchRule(rule, message);
      
      if (matchResult.matches) {
        log(`[RuleEngine]   ✅ Rule "${rule.id}" (${rule.name}) MATCHED: ${matchResult.reason}`);
        
        const actionResults = await this.executeActions(rule, message, log);
        await this.logRuleFire(rule, message, dbMessageId, actionResults);
        
        const stoppedChain = rule.stop_on_match !== false;
        result.evaluatedRules.push({
          id: rule.id, name: rule.name, matched: true, reason: matchResult.reason, stoppedChain,
        });

        for (const ar of actionResults) {
          result.executedActions.push({
            ruleId: rule.id,
            ruleName: rule.name,
            type: ar.type,
            details: ar.details || '',
            success: ar.success,
            error: ar.error,
            durationMs: ar.durationMs || 0,
          });
        }
        
        if (rule.cooldown_seconds && rule.cooldown_seconds > 0) {
          await this.setCooldown(rule.id, message.chatId, rule.cooldown_seconds);
          log(`[RuleEngine]   ⏱ Cooldown set: ${rule.cooldown_seconds}s for ${message.chatId}`);
        }
        
        if (stoppedChain) {
          log(`[RuleEngine]   🛑 stop_on_match – no more rules evaluated`);
          break;
        }
      } else {
        log(`[RuleEngine]   ❌ Rule "${rule.id}" (${rule.name}) – no match`);
        result.evaluatedRules.push({
          id: rule.id, name: rule.name, matched: false, reason: matchResult.reason || 'no match',
        });
      }
    }

    log(`[RuleEngine] ◀ Done. ${result.executedActions.length} action(s) executed across ${result.evaluatedRules.filter(r => r.matched).length} matched rule(s)`);
    return result;
  }
  
  // ──────────────────────────── Matching ────────────────────────────
  
  /**
   * Match a single rule against an incoming message.
   * All specified conditions must pass (AND logic).
   */
  matchRule(rule: Rule, message: IncomingMessage, verbose = false): { matches: boolean; reason: string } {
    const reasons: string[] = [];
    const vlog = verbose ? (msg: string) => console.log(msg) : (_: string) => {};
    
    vlog(`[RuleEngine]     Checking rule "${rule.id}"…`);

    // 1. Match event type
    const ruleEvents = rule.match.events ?? ['MESSAGES_UPSERT'];
    const incomingEvent = message.event ?? 'MESSAGES_UPSERT';
    if (!ruleEvents.includes(incomingEvent)) {
      vlog(`[RuleEngine]       ✗ event ${incomingEvent} not in [${ruleEvents.join(', ')}]`);
      return { matches: false, reason: `event ${incomingEvent} not in [${ruleEvents.join(', ')}]` };
    }
    reasons.push(`event=${incomingEvent}`);
    
    // 2. Match chat type
    if (rule.match.chat?.type && rule.match.chat.type !== 'any') {
      if (rule.match.chat.type !== message.chatType) {
        vlog(`[RuleEngine]       ✗ chatType ${message.chatType} ≠ ${rule.match.chat.type}`);
        return { matches: false, reason: `chatType ${message.chatType} ≠ ${rule.match.chat.type}` };
      }
      reasons.push(`chatType=${message.chatType}`);
    }
    
    // 3. Match chat IDs
    if (rule.match.chat?.ids && rule.match.chat.ids.length > 0) {
      if (!rule.match.chat.ids.includes(message.chatId)) {
        vlog(`[RuleEngine]       ✗ chatId ${message.chatId} not in [${rule.match.chat.ids.join(', ')}]`);
        return { matches: false, reason: `chatId ${message.chatId} not in allowed list` };
      }
      reasons.push('chatId matched');
    }
    
    // 4a. Match sender IDs (exact JID match)
    if (rule.match.sender?.ids && rule.match.sender.ids.length > 0) {
      if (!rule.match.sender.ids.includes(message.senderId)) {
        vlog(`[RuleEngine]       ✗ senderId ${message.senderId} not in [${rule.match.sender.ids.join(', ')}]`);
        return { matches: false, reason: `senderId ${message.senderId} not in allowed list` };
      }
      reasons.push('senderId matched');
    }
    
    // 4b. Match sender phone numbers (extracted number match)
    if (rule.match.sender?.numbers && rule.match.sender.numbers.length > 0) {
      const senderPhone = extractPhoneNumber(message.senderId);
      const matched = rule.match.sender.numbers.some(n => {
        const filterPhone = extractPhoneNumber(n);
        return filterPhone === senderPhone;
      });
      if (!matched) {
        vlog(`[RuleEngine]       ✗ senderPhone ${senderPhone} not in [${rule.match.sender.numbers.join(', ')}]`);
        return { matches: false, reason: `senderPhone ${senderPhone} not in allowed list` };
      }
      reasons.push('senderNumber matched');
    }
    
    // 5. Match text filter
    if (rule.match.text && rule.match.text.patterns && rule.match.text.patterns.length > 0) {
      const mode = rule.match.text.mode || 'contains';
      const normalisedMessage = normaliseText(message.text);
      let textMatched = false;
      
      switch (mode) {
        case 'contains':
          textMatched = rule.match.text.patterns.some(p => 
            normalisedMessage.includes(normaliseText(p))
          );
          break;
        case 'starts_with':
          textMatched = rule.match.text.patterns.some(p =>
            normalisedMessage.startsWith(normaliseText(p))
          );
          break;
        case 'regex':
          textMatched = rule.match.text.patterns.some(p => {
            try {
              return new RegExp(p, 'i').test(message.text);
            } catch {
              return false;
            }
          });
          break;
      }
      
      if (!textMatched) {
        vlog(`[RuleEngine]       ✗ text "${message.text.substring(0, 60)}" did not match ${mode} [${rule.match.text.patterns.join(', ')}]`);
        return { matches: false, reason: `text did not match ${mode} patterns` };
      }
      reasons.push(`text ${mode} matched`);
    }
    
    vlog(`[RuleEngine]       ✓ all conditions passed: ${reasons.join(', ')}`);
    // If the rule has at least one matching criterion beyond the event type check,
    // or if it deliberately has no filters (catch-all), it matches.
    return {
      matches: true,
      reason: reasons.join(', '),
    };
  }
  
  // ──────────────────────────── Action Execution ────────────────────────────
  
  private async executeActions(
    rule: Rule,
    message: IncomingMessage,
    log: (msg: string) => void = console.log,
  ): Promise<Array<{ type: string; success: boolean; error?: string; details?: string; durationMs?: number }>> {
    const results: Array<{ type: string; success: boolean; error?: string; details?: string; durationMs?: number }> = [];
    
    for (const action of rule.actions) {
      const start = Date.now();
      try {
        if (action.type === 'ha_service' && action.service) {
          const details = this.describeAction(action);
          log(`[RuleEngine]     → Calling HA service: ${action.service} (target: ${JSON.stringify(action.target)}, data: ${JSON.stringify(action.data)})`);
          const result = await this.haClient.callService(
            action.service,
            action.target,
            action.data,
            this.config.allowedServices
          );
          const durationMs = Date.now() - start;
          log(`[RuleEngine]     ← HA service result: success=${result.success}${result.error ? ', error=' + result.error : ''} (${durationMs}ms)`);
          results.push({ type: 'ha_service', success: result.success, error: result.error, details, durationMs });
        } else if (action.type === 'reply_whatsapp' && action.text) {
          const details = this.describeAction(action);
          log(`[RuleEngine]     → Sending WhatsApp reply to ${message.chatId}: "${action.text.substring(0, 120)}"`);
          const sendResult = await this.evolutionClient.sendTextMessage(
            this.config.instanceName,
            message.chatId,
            action.text
          );
          const durationMs = Date.now() - start;
          log(`[RuleEngine]     ← WhatsApp reply sent: id=${sendResult?.key?.id} (${durationMs}ms)`);
          results.push({ type: 'reply_whatsapp', success: true, details, durationMs });
        }
      } catch (e: any) {
        const durationMs = Date.now() - start;
        log(`[RuleEngine]     ✖ Action ${action.type} FAILED after ${durationMs}ms: ${e.message}`);
        results.push({ type: action.type, success: false, error: e.message, details: this.describeAction(action), durationMs });
      }
    }
    
    return results;
  }
  
  // ──────────────────────────── Cooldown ────────────────────────────
  
  private async isOnCooldown(ruleId: string, scopeKey: string): Promise<boolean> {
    await this.db.run('DELETE FROM wa_cooldown WHERE expires_at < NOW()');
    const row = await this.db.getOne<any>(`
      SELECT 1 FROM wa_cooldown 
      WHERE rule_id = ? AND scope_key = ? AND expires_at > NOW()
    `, [ruleId, scopeKey]);
    return !!row;
  }
  
  private async setCooldown(ruleId: string, scopeKey: string, seconds: number): Promise<void> {
    await this.db.run(`
      INSERT INTO wa_cooldown (rule_id, scope_key, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
      ON DUPLICATE KEY UPDATE expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
    `, [ruleId, scopeKey, seconds, seconds]);
  }
  
  // ──────────────────────────── Logging ────────────────────────────
  
  private async logRuleFire(
    rule: Rule,
    message: IncomingMessage,
    dbMessageId: number | undefined,
    results: Array<{ type: string; success: boolean; error?: string }>
  ): Promise<void> {
    const allSuccess = results.every(r => r.success);
    const errors = results.filter(r => !r.success).map(r => r.error).join('; ');
    
    await this.db.run(`
      INSERT INTO wa_rule_fire (
        rule_id, rule_name, message_id, chat_id, sender_id, matched_text,
        actions_executed, success, error_message, event_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      rule.id,
      rule.name,
      dbMessageId || null,
      message.chatId,
      message.senderId,
      message.text.substring(0, 500),
      JSON.stringify(results),
      allSuccess ? 1 : 0,
      errors || null,
      message.event || 'MESSAGES_UPSERT',
    ]);
  }
  
  // ──────────────────────────── Helpers ────────────────────────────
  
  private describeAction(action: Rule['actions'][0]): string {
    if (action.type === 'ha_service') {
      const target = action.target?.entity_id || 'no target';
      return `Call ${action.service} on ${target}`;
    } else if (action.type === 'reply_whatsapp') {
      return `Reply: "${action.text?.substring(0, 50)}${(action.text?.length || 0) > 50 ? '...' : ''}"`;
    }
    return action.type;
  }
}
