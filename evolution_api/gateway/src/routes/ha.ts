/**
 * Home Assistant API Routes
 * Provides endpoints for listing entities and calling services
 */

import { Request, Response, Router } from 'express';
import { HAClient } from '../clients/ha';
import { loadConfig } from '../config';

export function createHaRoutes(haClient: HAClient): Router {
  const router = Router();
  const config = loadConfig();
  
  /**
   * GET /api/ha/status
   * Check HA connection status
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const connected = await haClient.checkConnection();
      res.json({
        connected,
        url: config.haUrl,
      });
    } catch (error: any) {
      res.json({
        connected: false,
        error: error.message,
      });
    }
  });
  
  /**
   * GET /api/ha/entities
   * List entities, optionally filtered by domain
   */
  router.get('/entities', async (req: Request, res: Response) => {
    try {
      const domain = req.query.domain as string;
      const entities = await haClient.getEntities(domain);
      
      res.json(entities.map(e => ({
        entity_id: e.entity_id,
        name: e.name,
        icon: e.icon,
        domain: e.domain,
        state: e.state,
      })));
    } catch (error: any) {
      console.error('[HA] Get entities error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/ha/scripts
   * List all scripts
   */
  router.get('/scripts', async (req: Request, res: Response) => {
    try {
      const scripts = await haClient.getScripts();
      res.json(scripts);
    } catch (error: any) {
      console.error('[HA] Get scripts error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/ha/automations
   * List all automations
   */
  router.get('/automations', async (req: Request, res: Response) => {
    try {
      const automations = await haClient.getAutomations();
      res.json(automations);
    } catch (error: any) {
      console.error('[HA] Get automations error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/ha/scenes
   * List all scenes
   */
  router.get('/scenes', async (req: Request, res: Response) => {
    try {
      const scenes = await haClient.getScenes();
      res.json(scenes);
    } catch (error: any) {
      console.error('[HA] Get scenes error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/ha/call-service
   * Call a Home Assistant service (with allowlist enforcement)
   */
  router.post('/call-service', async (req: Request, res: Response) => {
    try {
      const { service, target, data } = req.body;
      
      if (!service) {
        return res.status(400).json({ error: 'Service is required' });
      }
      
      const result = await haClient.callService(
        service,
        target,
        data,
        config.allowedServices
      );
      
      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error('[HA] Call service error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/ha/allowed-services
   * Get the list of allowed services
   */
  router.get('/allowed-services', (req: Request, res: Response) => {
    res.json({
      services: config.allowedServices,
    });
  });
  
  return router;
}
