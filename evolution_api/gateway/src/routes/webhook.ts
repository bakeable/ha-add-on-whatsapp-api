/**
 * Webhook Routes
 * Handles incoming webhooks from Evolution API
 */

import type Database from 'better-sqlite3';
import { Request, Response, Router } from 'express';
import { IncomingMessage, RuleEngine } from '../engine/rule-engine';

export function createWebhookRoutes(db: Database.Database, ruleEngine: RuleEngine): Router {
  const router = Router();
  
  /**
   * POST /webhook/evolution
   * Main webhook endpoint for Evolution API events
   */
  router.post('/evolution', async (req: Request, res: Response) => {
    try {
      const event = req.body;
      
      // Log the raw event for debugging
      console.log('[Webhook] Received event:', event.event);
      
      // Handle different event types
      if (event.event === 'messages.upsert' || event.event === 'MESSAGES_UPSERT') {
        await handleMessageUpsert(db, ruleEngine, event);
      }
      
      // Always respond 200 OK to acknowledge receipt
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[Webhook] Processing error:', error);
      // Still return 200 to prevent retries
      res.status(200).json({ received: true, error: error.message });
    }
  });
  
  /**
   * GET /webhook/logs
   * Get recent webhook logs (messages received)
   */
  router.get('/logs', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const chatId = req.query.chat_id as string;
      
      let sql = 'SELECT * FROM wa_message WHERE 1=1';
      const params: any[] = [];
      
      if (chatId) {
        sql += ' AND chat_id = ?';
        params.push(chatId);
      }
      
      sql += ' ORDER BY received_at DESC LIMIT ?';
      params.push(limit);
      
      const messages = db.prepare(sql).all(...params);
      
      res.json(messages.map((m: any) => ({
        id: m.id,
        provider_message_id: m.provider_message_id,
        chat_id: m.chat_id,
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        text: m.text,
        message_type: m.message_type,
        received_at: m.received_at,
        processed: m.processed === 1,
      })));
    } catch (error: any) {
      console.error('[Webhook] Get logs error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  return router;
}

/**
 * Handle message.upsert events from Evolution API
 */
async function handleMessageUpsert(
  db: Database.Database,
  ruleEngine: RuleEngine,
  event: any
): Promise<void> {
  const data = event.data;
  
  // Skip if not a proper message
  if (!data?.key || !data?.message) {
    return;
  }
  
  // Skip messages from self (fromMe = true)
  if (data.key.fromMe) {
    console.log('[Webhook] Skipping self-sent message');
    return;
  }
  
  // Extract message details
  const chatId = data.key.remoteJid || '';
  const messageId = data.key.id || '';
  const senderId = data.key.participant || data.key.remoteJid || '';
  const senderName = data.pushName || '';
  
  // Get message text (handle different message types)
  let text = '';
  if (data.message.conversation) {
    text = data.message.conversation;
  } else if (data.message.extendedTextMessage?.text) {
    text = data.message.extendedTextMessage.text;
  } else if (data.message.imageMessage?.caption) {
    text = data.message.imageMessage.caption;
  } else if (data.message.videoMessage?.caption) {
    text = data.message.videoMessage.caption;
  }
  
  // Skip if no text content
  if (!text) {
    console.log('[Webhook] Skipping non-text message');
    return;
  }
  
  // Determine chat type
  const chatType = chatId.endsWith('@g.us') ? 'group' : 'direct';
  
  // Check for duplicate messages
  const existing = db.prepare('SELECT id FROM wa_message WHERE provider_message_id = ?').get(messageId);
  if (existing) {
    console.log('[Webhook] Skipping duplicate message:', messageId);
    return;
  }
  
  // Insert message into database
  const result = db.prepare(`
    INSERT INTO wa_message (provider_message_id, chat_id, sender_id, sender_name, text, message_type, raw_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    messageId,
    chatId,
    senderId,
    senderName,
    text,
    'text',
    JSON.stringify(data)
  );
  
  const dbMessageId = result.lastInsertRowid as number;
  
  // Update chat last message time
  db.prepare(`
    INSERT INTO wa_chat (id, type, name, last_message_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      last_message_at = CURRENT_TIMESTAMP
  `).run(chatId, chatType, senderName || chatId.split('@')[0]);
  
  console.log(`[Webhook] Message from ${senderName || senderId} in ${chatId}: "${text.substring(0, 50)}..."`);
  
  // Process message through rule engine
  const message: IncomingMessage = {
    chatId,
    chatType: chatType as 'group' | 'direct',
    senderId,
    senderName,
    text,
    messageId,
  };
  
  await ruleEngine.processMessage(message, dbMessageId);
  
  // Mark as processed
  db.prepare('UPDATE wa_message SET processed = 1 WHERE id = ?').run(dbMessageId);
}
