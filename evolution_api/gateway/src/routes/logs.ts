import type { Database } from 'better-sqlite3';
import { Router } from 'express';

export function createLogsRoutes(db: Database): Router {
  const router = Router();

  /**
   * GET /api/logs/messages
   * Get recent messages with pagination
   */
  router.get('/messages', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const offset = (page - 1) * limit;
      const chatId = req.query.chat_id as string;

      let query = `
        SELECT 
          m.id,
          m.chat_id,
          c.name as chat_name,
          m.sender_id,
          m.sender_name,
          m.text as content,
          m.message_type,
          m.provider_message_id,
          m.received_at,
          m.processed,
          CASE WHEN m.sender_id IS NULL OR m.sender_id = '' THEN 1 ELSE 0 END as is_from_me
        FROM wa_message m
        LEFT JOIN wa_chat c ON m.chat_id = c.id
      `;
      const params: any[] = [];

      if (chatId) {
        query += ' WHERE m.chat_id = ?';
        params.push(chatId);
      }

      query += ' ORDER BY m.received_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const messages = db.prepare(query).all(...params);
      res.json(messages);
    } catch (e: any) {
      console.error('[Logs] Error fetching messages:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/logs/rules
   * Get rule fire history with pagination
   */
  router.get('/rules', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const offset = (page - 1) * limit;
      const ruleId = req.query.rule_id as string;

      let query = `
        SELECT 
          f.id,
          f.rule_id,
          f.rule_name,
          f.message_id,
          f.chat_id,
          f.sender_id,
          f.matched_text,
          f.actions_executed,
          f.success,
          f.error_message,
          f.fired_at
        FROM wa_rule_fire f
      `;
      const params: any[] = [];

      if (ruleId) {
        query += ' WHERE f.rule_id = ?';
        params.push(ruleId);
      }

      query += ' ORDER BY f.fired_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const fires = db.prepare(query).all(...params);
      
      // Parse actions_executed and flatten for UI
      const result = fires.map((f: any) => {
        const actions = f.actions_executed ? JSON.parse(f.actions_executed) : [];
        const firstAction = actions[0] || {};
        return {
          id: f.id,
          rule_id: f.rule_id,
          rule_name: f.rule_name,
          message_id: f.message_id,
          chat_id: f.chat_id,
          action_type: firstAction.type || 'unknown',
          action_details: firstAction.service || firstAction.text || JSON.stringify(firstAction),
          success: f.success === 1,
          error_message: f.error_message,
          fired_at: f.fired_at,
        };
      });
      
      res.json(result);
    } catch (e: any) {
      console.error('[Logs] Error fetching rule fires:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/logs/stats
   * Get summary statistics
   */
  router.get('/stats', (req, res) => {
    try {
      const hours = Math.min(168, Math.max(1, parseInt(req.query.hours as string) || 24));
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const messageCount = db.prepare(`
        SELECT COUNT(*) as count FROM wa_message WHERE received_at > ?
      `).get(since) as { count: number };

      const processedCount = db.prepare(`
        SELECT COUNT(*) as count FROM wa_message WHERE received_at > ? AND processed = 1
      `).get(since) as { count: number };

      const ruleFireCount = db.prepare(`
        SELECT COUNT(*) as count FROM wa_rule_fire WHERE fired_at > ?
      `).get(since) as { count: number };

      const successCount = db.prepare(`
        SELECT COUNT(*) as count FROM wa_rule_fire WHERE fired_at > ? AND success = 1
      `).get(since) as { count: number };

      const topRules = db.prepare(`
        SELECT rule_id, rule_name, COUNT(*) as fire_count
        FROM wa_rule_fire 
        WHERE fired_at > ?
        GROUP BY rule_id
        ORDER BY fire_count DESC
        LIMIT 5
      `).all(since);

      res.json({
        period_hours: hours,
        messages: {
          total: messageCount.count,
          processed: processedCount.count,
        },
        rule_fires: {
          total: ruleFireCount.count,
          successful: successCount.count,
          failed: ruleFireCount.count - successCount.count,
        },
        top_rules: topRules,
      });
    } catch (e: any) {
      console.error('[Logs] Error fetching stats:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
