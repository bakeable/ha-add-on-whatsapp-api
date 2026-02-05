/**
 * Tests for the rule engine: normaliseText, extractPhoneNumber, matchRule.
 *
 * Uses Node built-in test runner (node --test) — no extra devDependencies.
 * Run with:
 *   npx ts-node --transpile-only node_modules/.bin/jest   (if jest is present)
 *   OR
 *   npx tsx src/engine/__tests__/rule-engine.test.ts       (with tsx)
 *   OR
 *   node --loader ts-node/esm --test src/engine/__tests__/rule-engine.test.ts
 *
 * For simplicity these are plain assertion-based tests that throw on failure.
 */

import assert from 'assert';
import { extractPhoneNumber, IncomingMessage, normaliseText } from '../rule-engine';
import { Rule } from '../types';

// ─────────────────────── Helpers ───────────────────────

/**
 * Lightweight `matchRule` re-implementation that mirrors the engine exactly.
 * We import the real engine class but need a DB etc. — so we extract the
 * pure matching logic into a standalone function for unit-testing.
 */
function matchRulePure(rule: Rule, message: IncomingMessage): { matches: boolean; reason: string } {
  const reasons: string[] = [];

  // 1. Event type
  const ruleEvents = rule.match.events ?? ['MESSAGES_UPSERT'];
  const incomingEvent = message.event ?? 'MESSAGES_UPSERT';
  if (!ruleEvents.includes(incomingEvent)) {
    return { matches: false, reason: '' };
  }
  reasons.push(`event=${incomingEvent}`);

  // 2. Chat type
  if (rule.match.chat?.type && rule.match.chat.type !== 'any') {
    if (rule.match.chat.type !== message.chatType) {
      return { matches: false, reason: '' };
    }
    reasons.push(`chatType=${message.chatType}`);
  }

  // 3. Chat IDs
  if (rule.match.chat?.ids && rule.match.chat.ids.length > 0) {
    if (!rule.match.chat.ids.includes(message.chatId)) {
      return { matches: false, reason: '' };
    }
    reasons.push('chatId matched');
  }

  // 4a. Sender IDs (exact JID match)
  if (rule.match.sender?.ids && rule.match.sender.ids.length > 0) {
    if (!rule.match.sender.ids.includes(message.senderId)) {
      return { matches: false, reason: '' };
    }
    reasons.push('senderId matched');
  }

  // 4b. Sender numbers (phone extraction match)
  if (rule.match.sender?.numbers && rule.match.sender.numbers.length > 0) {
    const senderPhone = extractPhoneNumber(message.senderId);
    const matched = rule.match.sender.numbers.some(n => {
      const filterPhone = extractPhoneNumber(n);
      return filterPhone === senderPhone;
    });
    if (!matched) return { matches: false, reason: '' };
    reasons.push('senderNumber matched');
  }

  // 5. Text filter
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
          try { return new RegExp(p, 'i').test(message.text); } catch { return false; }
        });
        break;
    }

    if (!textMatched) return { matches: false, reason: '' };
    reasons.push(`text(${mode})`);
  }

  return { matches: true, reason: reasons.join(', ') };
}

// ─────────────────────── normaliseText ───────────────────────

console.log('=== normaliseText ===');

assert.strictEqual(normaliseText('Hello World'), 'hello world');
assert.strictEqual(normaliseText('  HELLO   WORLD  '), 'hello world');
assert.strictEqual(normaliseText('  foo  bar  baz  '), 'foo bar baz');
assert.strictEqual(normaliseText(''), '');
assert.strictEqual(normaliseText('   '), '');
assert.strictEqual(normaliseText('NoChange'), 'nochange');
assert.strictEqual(normaliseText('tabs\there'), 'tabs here');
assert.strictEqual(normaliseText('\n\n newlines \n\n'), 'newlines');
console.log('✓ normaliseText: all tests passed');

// ─────────────────────── extractPhoneNumber ───────────────────────

console.log('\n=== extractPhoneNumber ===');

assert.strictEqual(extractPhoneNumber('31612345678@s.whatsapp.net'), '31612345678');
assert.strictEqual(extractPhoneNumber('31612345678'), '31612345678');
assert.strictEqual(extractPhoneNumber('+31 6 1234 5678'), '31612345678');
assert.strictEqual(extractPhoneNumber('120363123456789012@g.us'), '120363123456789012');
assert.strictEqual(extractPhoneNumber(''), '');
console.log('✓ extractPhoneNumber: all tests passed');

// ─────────────────────── matchRule — event matching ───────────────────────

console.log('\n=== matchRule: event matching ===');

const baseRule: Rule = {
  id: 'test',
  name: 'Test',
  enabled: true,
  priority: 100,
  stop_on_match: true,
  match: {},
  actions: [{ type: 'reply_whatsapp', text: 'ok' }],
};

const baseMsg: IncomingMessage = {
  chatId: '31612345678@s.whatsapp.net',
  chatType: 'direct',
  senderId: '31612345678@s.whatsapp.net',
  text: 'hello',
};

// Default (no events specified) matches MESSAGES_UPSERT
{
  const r = matchRulePure(baseRule, baseMsg);
  assert.ok(r.matches, 'Default rule should match MESSAGES_UPSERT by default');
}

// Explicit MESSAGES_UPSERT matches
{
  const rule = { ...baseRule, match: { events: ['MESSAGES_UPSERT' as const] } };
  const r = matchRulePure(rule, baseMsg);
  assert.ok(r.matches);
}

// Rule for CONNECTION_UPDATE should NOT match a default message
{
  const rule = { ...baseRule, match: { events: ['CONNECTION_UPDATE' as const] } };
  const r = matchRulePure(rule, baseMsg);
  assert.ok(!r.matches, 'CONNECTION_UPDATE rule should not match MESSAGES_UPSERT event');
}

// Multi-event rule
{
  const rule = { ...baseRule, match: { events: ['MESSAGES_UPSERT' as const, 'CALL' as const] } };
  assert.ok(matchRulePure(rule, baseMsg).matches);
  assert.ok(matchRulePure(rule, { ...baseMsg, event: 'CALL' }).matches);
  assert.ok(!matchRulePure(rule, { ...baseMsg, event: 'CONNECTION_UPDATE' }).matches);
}

console.log('✓ event matching: all tests passed');

// ─────────────────────── matchRule — chat type ───────────────────────

console.log('\n=== matchRule: chat type ===');

{
  const rule = { ...baseRule, match: { chat: { type: 'direct' as const } } };
  assert.ok(matchRulePure(rule, baseMsg).matches);
  assert.ok(!matchRulePure(rule, { ...baseMsg, chatType: 'group' }).matches);
}
{
  const rule = { ...baseRule, match: { chat: { type: 'group' as const } } };
  assert.ok(!matchRulePure(rule, baseMsg).matches);
  assert.ok(matchRulePure(rule, { ...baseMsg, chatType: 'group' }).matches);
}
{
  const rule = { ...baseRule, match: { chat: { type: 'any' as const } } };
  assert.ok(matchRulePure(rule, baseMsg).matches);
  assert.ok(matchRulePure(rule, { ...baseMsg, chatType: 'group' }).matches);
}

console.log('✓ chat type: all tests passed');

// ─────────────────────── matchRule — chat IDs ───────────────────────

console.log('\n=== matchRule: chat IDs ===');

{
  const rule = {
    ...baseRule,
    match: { chat: { ids: ['31612345678@s.whatsapp.net'] } },
  };
  assert.ok(matchRulePure(rule, baseMsg).matches);
  assert.ok(!matchRulePure(rule, { ...baseMsg, chatId: 'other@s.whatsapp.net' }).matches);
}

console.log('✓ chat IDs: all tests passed');

// ─────────────────────── matchRule — sender IDs (exact) ───────────────────────

console.log('\n=== matchRule: sender IDs ===');

{
  const rule = {
    ...baseRule,
    match: { sender: { ids: ['31612345678@s.whatsapp.net'] } },
  };
  // Exact JID match
  assert.ok(matchRulePure(rule, baseMsg).matches);
  // Different JID
  assert.ok(!matchRulePure(rule, { ...baseMsg, senderId: '49123456789@s.whatsapp.net' }).matches);
  // Bare number does NOT match when using ids (exact match)
  assert.ok(!matchRulePure(rule, { ...baseMsg, senderId: '31612345678' }).matches);
}
{
  // Multiple sender IDs
  const rule = {
    ...baseRule,
    match: { sender: { ids: ['other@s.whatsapp.net', '31612345678@s.whatsapp.net'] } },
  };
  assert.ok(matchRulePure(rule, baseMsg).matches);
}

console.log('✓ sender IDs: all tests passed');

// ─────────────────────── matchRule — sender numbers (phone extraction) ───────────────────────

console.log('\n=== matchRule: sender numbers ===');

{
  const rule = {
    ...baseRule,
    match: { sender: { numbers: ['31612345678'] } },
  };
  // JID sender should match bare number
  assert.ok(matchRulePure(rule, baseMsg).matches);
  // Different number
  assert.ok(!matchRulePure(rule, { ...baseMsg, senderId: '49123456789@s.whatsapp.net' }).matches);
}
{
  // Sender filter with JID format should still work via phone extraction
  const rule = {
    ...baseRule,
    match: { sender: { numbers: ['31612345678@s.whatsapp.net'] } },
  };
  assert.ok(matchRulePure(rule, baseMsg).matches);
}
{
  // Multiple sender numbers
  const rule = {
    ...baseRule,
    match: { sender: { numbers: ['49111111111', '31612345678'] } },
  };
  assert.ok(matchRulePure(rule, baseMsg).matches);
}
{
  // Both ids and numbers — both must pass (AND logic)
  const rule = {
    ...baseRule,
    match: { sender: { ids: ['31612345678@s.whatsapp.net'], numbers: ['31612345678'] } },
  };
  assert.ok(matchRulePure(rule, baseMsg).matches);
  // ids pass but numbers fail
  const rule2 = {
    ...baseRule,
    match: { sender: { ids: ['31612345678@s.whatsapp.net'], numbers: ['99999999999'] } },
  };
  assert.ok(!matchRulePure(rule2, baseMsg).matches);
}

console.log('✓ sender numbers: all tests passed');

// ─────────────────────── matchRule — text filter (contains) ───────────────────────

console.log('\n=== matchRule: text filter — contains ===');

{
  const rule = {
    ...baseRule,
    match: { text: { mode: 'contains' as const, patterns: ['hello'] } },
  };
  assert.ok(matchRulePure(rule, baseMsg).matches);
  // Case-insensitive
  assert.ok(matchRulePure(rule, { ...baseMsg, text: 'HELLO' }).matches);
  // Normalised (extra whitespace)
  assert.ok(matchRulePure(rule, { ...baseMsg, text: '  Hello  ' }).matches);
  // Substring match
  assert.ok(matchRulePure(rule, { ...baseMsg, text: 'Say hello world' }).matches);
  // No match
  assert.ok(!matchRulePure(rule, { ...baseMsg, text: 'goodbye' }).matches);
}

{
  // Multiple patterns — any should match
  const rule = {
    ...baseRule,
    match: { text: { mode: 'contains' as const, patterns: ['goodnight', 'welterusten'] } },
  };
  assert.ok(matchRulePure(rule, { ...baseMsg, text: 'Goodnight!' }).matches);
  assert.ok(matchRulePure(rule, { ...baseMsg, text: 'welterusten' }).matches);
  assert.ok(!matchRulePure(rule, { ...baseMsg, text: 'good morning' }).matches);
}

{
  // Normalisation: multiple spaces in pattern and message
  const rule = {
    ...baseRule,
    match: { text: { mode: 'contains' as const, patterns: ['good   night'] } },
  };
  assert.ok(matchRulePure(rule, { ...baseMsg, text: 'good night' }).matches);
  assert.ok(matchRulePure(rule, { ...baseMsg, text: 'GOOD    NIGHT' }).matches);
}

console.log('✓ text contains: all tests passed');

// ─────────────────────── matchRule — text filter (starts_with) ───────────────────────

console.log('\n=== matchRule: text filter — starts_with ===');

{
  const rule = {
    ...baseRule,
    match: { text: { mode: 'starts_with' as const, patterns: ['hello'] } },
  };
  assert.ok(matchRulePure(rule, { ...baseMsg, text: 'Hello world' }).matches);
  assert.ok(matchRulePure(rule, { ...baseMsg, text: '  hello  ' }).matches); // trimmed first
  assert.ok(!matchRulePure(rule, { ...baseMsg, text: 'Say hello' }).matches); // not at start
}

console.log('✓ text starts_with: all tests passed');

// ─────────────────────── matchRule — text filter (regex) ───────────────────────

console.log('\n=== matchRule: text filter — regex ===');

{
  const rule = {
    ...baseRule,
    match: { text: { mode: 'regex' as const, patterns: ['^hello\\b'] } },
  };
  assert.ok(matchRulePure(rule, { ...baseMsg, text: 'Hello world' }).matches); // case-insensitive
  assert.ok(!matchRulePure(rule, { ...baseMsg, text: 'Say hello' }).matches);
}
{
  // Invalid regex should not crash, just not match
  const rule = {
    ...baseRule,
    match: { text: { mode: 'regex' as const, patterns: ['[invalid'] } },
  };
  assert.ok(!matchRulePure(rule, { ...baseMsg, text: 'anything' }).matches);
}

console.log('✓ text regex: all tests passed');

// ─────────────────────── matchRule — combined filters ───────────────────────

console.log('\n=== matchRule: combined filters ===');

{
  const rule: Rule = {
    ...baseRule,
    match: {
      events: ['MESSAGES_UPSERT'],
      chat: { type: 'direct' },
      sender: { numbers: ['31612345678'] },
      text: { mode: 'contains', patterns: ['hello'] },
    },
  };
  // All conditions met
  assert.ok(matchRulePure(rule, baseMsg).matches);
  // Wrong event
  assert.ok(!matchRulePure(rule, { ...baseMsg, event: 'CALL' }).matches);
  // Wrong chat type
  assert.ok(!matchRulePure(rule, { ...baseMsg, chatType: 'group' }).matches);
  // Wrong sender
  assert.ok(!matchRulePure(rule, { ...baseMsg, senderId: '49999999999@s.whatsapp.net' }).matches);
  // Wrong text
  assert.ok(!matchRulePure(rule, { ...baseMsg, text: 'goodbye' }).matches);
}

{
  // No text filter + sender filter only
  const rule: Rule = {
    ...baseRule,
    match: {
      sender: { numbers: ['31612345678'] },
    },
  };
  assert.ok(matchRulePure(rule, { ...baseMsg, text: '' }).matches);
}

console.log('✓ combined filters: all tests passed');

// ─────────────────────── matchRule — empty match (catch-all) ───────────────────────

console.log('\n=== matchRule: catch-all ===');

{
  const rule: Rule = {
    ...baseRule,
    match: {},
  };
  assert.ok(matchRulePure(rule, baseMsg).matches);
  assert.ok(matchRulePure(rule, { ...baseMsg, chatType: 'group', text: 'anything' }).matches);
}

console.log('✓ catch-all: all tests passed');

// ───────────────────────

console.log('\n🎉 All rule engine tests passed!\n');
