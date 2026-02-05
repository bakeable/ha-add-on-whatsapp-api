/**
 * WhatsApp API Routes
 * Handles instance creation, QR connection, status, and chat listing
 */

import type Database from 'better-sqlite3';
import { Request, Response, Router } from 'express';
import { Chat, EvolutionClient } from '../clients/evolution';
import { loadConfig } from '../config';

export function createWaRoutes(evolutionClient: EvolutionClient, db: Database.Database): Router {
  const router = Router();
  const config = loadConfig();
  
  /**
   * POST /api/wa/instances
   * Create or ensure an instance exists
   */
  router.post('/instances', async (req: Request, res: Response) => {
    try {
      const instanceName = req.body.instance_name || config.instanceName;
      const result = await evolutionClient.createInstance(instanceName);
      res.json(result);
    } catch (error: any) {
      console.error('[WA] Create instance error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/wa/instances/:instance/connect
   * Request QR code for connection
   */
  router.post('/instances/:instance/connect', async (req: Request, res: Response) => {
    try {
      const { instance } = req.params;
      const qrData = await evolutionClient.connectInstance(instance);
      res.json({
        qr: qrData.qr,
        qr_type: qrData.qrType,
        expires_in: qrData.expiresIn,
      });
    } catch (error: any) {
      console.error('[WA] Connect instance error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/wa/instances/:instance/status
   * Get connection status
   */
  router.get('/instances/:instance/status', async (req: Request, res: Response) => {
    try {
      const { instance } = req.params;
      const status = await evolutionClient.getInstanceStatus(instance);
      res.json({
        status: status.status,
        phone: status.phone,
        last_update: status.lastUpdate,
      });
    } catch (error: any) {
      console.error('[WA] Get status error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/wa/instances/:instance/disconnect
   * Disconnect instance
   */
  router.post('/instances/:instance/disconnect', async (req: Request, res: Response) => {
    try {
      const { instance } = req.params;
      await evolutionClient.disconnectInstance(instance);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[WA] Disconnect error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/wa/chats
   * List all chats (from DB, synced from Evolution)
   */
  router.get('/chats', async (req: Request, res: Response) => {
    try {
      const typeFilter = req.query.type as string;
      const enabledFilter = req.query.enabled as string;
      
      let sql = 'SELECT * FROM wa_chat WHERE 1=1';
      const params: any[] = [];
      
      if (typeFilter && typeFilter !== 'all') {
        sql += ' AND type = ?';
        params.push(typeFilter);
      }
      
      if (enabledFilter !== undefined) {
        sql += ' AND enabled = ?';
        params.push(enabledFilter === 'true' ? 1 : 0);
      }
      
      sql += ' ORDER BY name';
      
      const chats = db.prepare(sql).all(...params);
      
      res.json(chats.map((c: any) => ({
        chat_id: c.id,
        type: c.type,
        name: c.name,
        enabled: c.enabled === 1,
        last_message_at: c.last_message_at,
      })));
    } catch (error: any) {
      console.error('[WA] List chats error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/wa/chats/refresh
   * Refresh chat list from Evolution API (async background job)
   */
  router.post('/chats/refresh', async (req: Request, res: Response) => {
    try {
      const instanceName = req.body.instance_name || config.instanceName;
      
      // Return immediately and process in background
      res.json({
        success: true,
        status: 'started',
        message: 'Chat sync started in background',
      });
      
      // Process asynchronously in background
      (async () => {
        try {
          console.log('[WA] Starting chat refresh for', instanceName);
          
          // Fetch groups and contacts in parallel to speed things up
          const [groups, contacts] = await Promise.all([
            evolutionClient.listGroups(instanceName).catch(err => {
              console.warn('[WA] Failed to fetch groups:', err.message);
              return [];
            }),
            evolutionClient.listContacts(instanceName).catch(err => {
              console.warn('[WA] Failed to fetch contacts:', err.message);
              return [];
            }),
          ]);
          
          console.log(`[WA] Fetched ${groups.length} groups and ${contacts.length} contacts`);
          
          // Merge and upsert into database
          const allChats: Chat[] = [...groups, ...contacts];
          
          const upsert = db.prepare(`
            INSERT INTO wa_chat (id, type, name, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              updated_at = CURRENT_TIMESTAMP
          `);
          
          const insertMany = db.transaction((chats: Chat[]) => {
            for (const chat of chats) {
              upsert.run(chat.id, chat.type, chat.name);
            }
          });
          
          insertMany(allChats);
          
          console.log(`[WA] Chat refresh complete: ${allChats.length} total chats`);
        } catch (error: any) {
          console.error('[WA] Background refresh error:', error);
        }
      })();
      
    } catch (error: any) {
      console.error('[WA] Refresh chats error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * PATCH /api/wa/chats/:chatId
   * Update chat settings (e.g., enabled/disabled)
   */
  router.patch('/chats/:chatId', async (req: Request, res: Response) => {
    try {
      const { chatId } = req.params;
      const { enabled } = req.body;
      
      if (enabled !== undefined) {
        db.prepare('UPDATE wa_chat SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(enabled ? 1 : 0, chatId);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[WA] Update chat error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/wa/send
   * Send a test message
   */
  router.post('/send', async (req: Request, res: Response) => {
    try {
      const { to, text, instance_name } = req.body;
      const instanceName = instance_name || config.instanceName;
      
      const result = await evolutionClient.sendTextMessage(instanceName, to, text);
      res.json({ success: true, message_id: result.key.id });
    } catch (error: any) {
      console.error('[WA] Send message error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/wa/status
   * Get overall connection status
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const instanceName = req.query.instance as string || config.instanceName;
      const status = await evolutionClient.getInstanceStatus(instanceName);
      
      res.json({
        instance_name: instanceName,
        evolution_status: status.status,
        evolution_connected: status.status === 'connected',
      });
    } catch (error: any) {
      res.json({
        instance_name: config.instanceName,
        evolution_status: 'error',
        evolution_connected: false,
        error: error.message,
      });
    }
  });
  
  return router;
}
