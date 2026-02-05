/**
 * Evolution API Client Wrapper
 * Provides a clean interface for interacting with Evolution API
 */

import axios, { AxiosInstance } from 'axios';

export interface InstanceStatus {
  instanceName: string;
  status: 'disconnected' | 'connecting' | 'qr' | 'connected';
  phone?: string;
  lastUpdate?: string;
}

export interface QRResponse {
  qr: string;
  qrType: 'base64' | 'text';
  expiresIn: number;
}

export interface Chat {
  id: string;
  type: 'group' | 'direct';
  name: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

export interface SendMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  status: string;
}

export class EvolutionClient {
  private client: AxiosInstance;
  
  constructor(baseUrl: string, apiKey: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      timeout: 30000,
    });
  }
  
  /**
   * Create a new WhatsApp instance
   */
  async createInstance(instanceName: string): Promise<{ instanceName: string; status: string }> {
    try {
      const response = await this.client.post('/instance/create', {
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
      });
      return {
        instanceName: response.data.instance?.instanceName || instanceName,
        status: 'created',
      };
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.response?.message?.includes('already')) {
        return { instanceName, status: 'exists' };
      }
      throw error;
    }
  }
  
  /**
   * Get connection QR code for an instance
   */
  async connectInstance(instanceName: string): Promise<QRResponse> {
    const response = await this.client.get(`/instance/connect/${instanceName}`);
    const data = response.data;
    
    // Evolution returns base64 QR image
    if (data.base64) {
      return {
        qr: data.base64,
        qrType: 'base64',
        expiresIn: 30,
      };
    }
    
    // Fallback to text QR code
    return {
      qr: data.code || '',
      qrType: 'text',
      expiresIn: 30,
    };
  }
  
  /**
   * Get instance connection status
   */
  async getInstanceStatus(instanceName: string): Promise<InstanceStatus> {
    try {
      const response = await this.client.get(`/instance/connectionState/${instanceName}`);
      const state = response.data.instance?.state || 'disconnected';
      
      // Map Evolution states to our simplified states
      let status: InstanceStatus['status'] = 'disconnected';
      if (state === 'open') status = 'connected';
      else if (state === 'connecting') status = 'connecting';
      else if (state === 'close') status = 'disconnected';
      
      return {
        instanceName,
        status,
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      return {
        instanceName,
        status: 'disconnected',
        lastUpdate: new Date().toISOString(),
      };
    }
  }
  
  /**
   * Disconnect/logout an instance
   */
  async disconnectInstance(instanceName: string): Promise<void> {
    await this.client.delete(`/instance/logout/${instanceName}`);
  }
  
  /**
   * List all instances
   */
  async listInstances(): Promise<any[]> {
    const response = await this.client.get('/instance/fetchInstances');
    return response.data || [];
  }
  
  /**
   * Get all groups for an instance
   */
  async listGroups(instanceName: string): Promise<Chat[]> {
    const response = await this.client.get(`/group/fetchAllGroups/${instanceName}`, {
      params: { getParticipants: false },
    });
    
    return (response.data || []).map((group: any) => ({
      id: group.id,
      type: 'group' as const,
      name: group.subject || group.name || 'Unknown Group',
      lastMessageAt: group.timestamp ? new Date(group.timestamp * 1000).toISOString() : undefined,
    }));
  }
  
  /**
   * Get all contacts/chats for an instance
   */
  async listContacts(instanceName: string): Promise<Chat[]> {
    try {
      const response = await this.client.get(`/chat/findContacts/${instanceName}`);
      return (response.data || []).map((contact: any) => ({
        id: contact.id || contact.remoteJid,
        type: 'direct' as const,
        name: contact.pushName || contact.name || contact.id?.split('@')[0] || 'Unknown',
        lastMessageAt: undefined,
      }));
    } catch (error) {
      // Fallback: return empty array if endpoint not available
      return [];
    }
  }
  
  /**
   * Send a text message
   */
  async sendTextMessage(instanceName: string, to: string, text: string): Promise<SendMessageResponse> {
    const response = await this.client.post(`/message/sendText/${instanceName}`, {
      number: to,
      text,
    });
    return response.data;
  }
  
  /**
   * Configure webhook for an instance
   */
  async setWebhook(instanceName: string, webhookUrl: string, events: string[] = ['MESSAGES_UPSERT']): Promise<void> {
    await this.client.post(`/webhook/set/${instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events,
      },
    });
  }
  
  /**
   * Apply instance settings
   */
  async setSettings(instanceName: string, settings: {
    rejectCall?: boolean;
    groupsIgnore?: boolean;
    alwaysOnline?: boolean;
    readMessages?: boolean;
    readStatus?: boolean;
    syncFullHistory?: boolean;
  }): Promise<void> {
    await this.client.post(`/settings/set/${instanceName}`, {
      rejectCall: settings.rejectCall ?? false,
      groupsIgnore: settings.groupsIgnore ?? false,
      alwaysOnline: settings.alwaysOnline ?? false,
      readMessages: settings.readMessages ?? false,
      readStatus: settings.readStatus ?? false,
      syncFullHistory: settings.syncFullHistory ?? true,
    });
  }
}
