/**
 * Home Assistant WebSocket/REST API Client
 * Connects to HA to list entities and call services
 */

import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';

export interface HAEntity {
  entity_id: string;
  name: string;
  icon?: string;
  state?: string;
  domain: string;
}

export interface ServiceCallResult {
  success: boolean;
  error?: string;
}

export interface ServiceField {
  name: string;
  description?: string;
  required?: boolean;
  example?: any;
  selector?: any;
  default?: any;
}

export interface ServiceDetails {
  domain: string;
  service: string;
  description?: string;
  fields: Record<string, ServiceField>;
}

export class HAClient {
  private restClient: AxiosInstance;
  private wsUrl: string;
  private token: string;
  private ws: WebSocket | null = null;
  private msgId = 1;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  
  constructor(haUrl: string, token: string) {
    this.token = token;
    
    // REST API client
    this.restClient = axios.create({
      baseURL: haUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    
    // WebSocket URL
    const wsProtocol = haUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = haUrl.replace(/^https?:\/\//, '');
    this.wsUrl = `${wsProtocol}://${wsHost}/api/websocket`;
  }
  
  /**
   * Get entities by domain (e.g., 'script', 'automation', 'scene')
   */
  async getEntities(domain?: string): Promise<HAEntity[]> {
    try {
      const response = await this.restClient.get('/api/states');
      let entities = response.data || [];
      
      if (domain) {
        entities = entities.filter((e: any) => e.entity_id.startsWith(`${domain}.`));
      }
      
      return entities.map((e: any) => ({
        entity_id: e.entity_id,
        name: e.attributes?.friendly_name || e.entity_id.split('.')[1],
        icon: e.attributes?.icon,
        state: e.state,
        domain: e.entity_id.split('.')[0],
      }));
    } catch (error: any) {
      console.error('[HAClient] Failed to get entities:', error.message);
      return [];
    }
  }
  
  /**
   * Get scripts
   */
  async getScripts(): Promise<HAEntity[]> {
    return this.getEntities('script');
  }
  
  /**
   * Get automations
   */
  async getAutomations(): Promise<HAEntity[]> {
    return this.getEntities('automation');
  }
  
  /**
   * Get scenes
   */
  async getScenes(): Promise<HAEntity[]> {
    return this.getEntities('scene');
  }
  
  /**
   * Call a Home Assistant service
   */
  async callService(
    service: string,
    target?: { entity_id?: string | string[] },
    data?: Record<string, any>,
    allowedServices?: string[]
  ): Promise<ServiceCallResult> {
    // Security check: validate service is allowed
    if (allowedServices && allowedServices.length > 0) {
      if (!allowedServices.includes(service)) {
        return {
          success: false,
          error: `Service '${service}' is not in the allowed list. Allowed: ${allowedServices.join(', ')}`,
        };
      }
    }
    
    try {
      const [domain, serviceName] = service.split('.');
      
      const payload: any = { ...data };
      if (target?.entity_id) {
        payload.entity_id = target.entity_id;
      }
      
      await this.restClient.post(`/api/services/${domain}/${serviceName}`, payload);
      
      return { success: true };
    } catch (error: any) {
      console.error('[HAClient] Service call failed:', error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }
  
  /**
   * Get service details including parameters/fields
   */
  async getServiceDetails(service: string): Promise<ServiceDetails | null> {
    try {
      const [domain, serviceName] = service.split('.');
      if (!domain || !serviceName) {
        return null;
      }

      const response = await this.restClient.get('/api/services');
      const services = response.data || [];
      
      const domainServices = services.find((s: any) => Object.keys(s)[0] === domain);
      if (!domainServices) {
        return null;
      }
      
      const serviceData = domainServices[domain]?.[serviceName];
      if (!serviceData) {
        return null;
      }

      return {
        domain,
        service: serviceName,
        description: serviceData.description,
        fields: serviceData.fields || {},
      };
    } catch (error: any) {
      console.error('[HAClient] Failed to get service details:', error.message);
      return null;
    }
  }

  /**
   * Check connection to Home Assistant
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.restClient.get('/api/');
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Connect via WebSocket for real-time updates (optional, for future use)
   */
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.on('open', () => {
        console.log('[HAClient] WebSocket connected');
      });
      
      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'auth_required') {
          this.ws?.send(JSON.stringify({
            type: 'auth',
            access_token: this.token,
          }));
        } else if (msg.type === 'auth_ok') {
          console.log('[HAClient] WebSocket authenticated');
          resolve();
        } else if (msg.type === 'auth_invalid') {
          reject(new Error('Invalid HA token'));
        } else if (msg.id && this.pendingRequests.has(msg.id)) {
          const { resolve } = this.pendingRequests.get(msg.id)!;
          this.pendingRequests.delete(msg.id);
          resolve(msg);
        }
      });
      
      this.ws.on('error', (error) => {
        console.error('[HAClient] WebSocket error:', error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log('[HAClient] WebSocket disconnected');
        this.ws = null;
      });
    });
  }
  
  /**
   * Send WebSocket message and wait for response
   */
  private async sendWsMessage(type: string, data: any = {}): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    const id = this.msgId++;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      this.ws!.send(JSON.stringify({
        id,
        type,
        ...data,
      }));
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('WebSocket request timeout'));
        }
      }, 10000);
    });
  }
}
