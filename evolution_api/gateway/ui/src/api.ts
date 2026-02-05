/**
 * API client for the WhatsApp Gateway API backend
 * 
 * When running under HA Ingress, the UI is served in an iframe at:
 *   /api/hassio_ingress/<ingress_key>/
 * 
 * We use window.location.pathname to get this base path and append
 * API endpoints to it. This avoids CORS issues since everything stays
 * on the same origin (homeassistant.local:8123).
 */

// Get the ingress base path from the current URL
// e.g., "/api/hassio_ingress/DZ8K07Vj8vcKugJlyvU7zIFTc9SwPzxgG0oic-6-DE4/"
function getIngressBasePath(): string {
  const path = window.location.pathname;
  
  // Ensure it ends with a slash
  if (path.endsWith('/')) {
    return path;
  }
  
  // If path has segments (e.g., /api/hassio_ingress/key/some/ui/path),
  // extract just the ingress base (first 3 segments + trailing slash)
  const parts = path.split('/').filter(p => p);
  if (parts.length >= 3 && parts[0] === 'api' && parts[1] === 'hassio_ingress') {
    return `/${parts[0]}/${parts[1]}/${parts[2]}/`;
  }
  
  // Fallback: use path as-is with trailing slash
  return path + '/';
}

const INGRESS_BASE = getIngressBasePath();

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  const url = `${INGRESS_BASE}${cleanEndpoint}`;
  
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || error.message || 'API Error');
  }
  
  return response.json();
}

// WhatsApp API - uses fixed "HomeAssistant" instance
export const waApi = {
  // Get connection status (auto-creates instance if needed)
  getStatus: () => fetchApi('/api/wa/status'),
  
  // Connect to WhatsApp (get QR code)
  connect: () => fetchApi('/api/wa/connect', { method: 'POST' }),
  
  // Disconnect from WhatsApp
  disconnect: () => fetchApi('/api/wa/disconnect', { method: 'POST' }),
  
  getChats: (params?: { type?: string; enabled?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.enabled !== undefined) query.set('enabled', String(params.enabled));
    return fetchApi(`/api/wa/chats?${query}`);
  },
  
  refreshChats: () =>
    fetchApi('/api/wa/chats/refresh', { method: 'POST' }),
  
  getRefreshStatus: () =>
    fetchApi('/api/wa/chats/refresh/status'),
  
  updateChat: (chatId: string, data: { enabled?: boolean }) =>
    fetchApi(`/api/wa/chats/${encodeURIComponent(chatId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  sendMessage: (to: string, text: string) =>
    fetchApi('/api/wa/send', {
      method: 'POST',
      body: JSON.stringify({ to, text }),
    }),
  
  sendTestMessage: (to: string, text: string) =>
    fetchApi('/api/wa/send', {
      method: 'POST',
      body: JSON.stringify({ to, text }),
    }),
  
  sendTestMedia: (to: string, mediaUrl: string, mediaType: string) =>
    fetchApi('/api/wa/send-media', {
      method: 'POST',
      body: JSON.stringify({ to, media_url: mediaUrl, media_type: mediaType }),
    }),
};

// Home Assistant API
export const haApi = {
  getStatus: () => fetchApi('/api/ha/status'),
  
  getEntities: (domain?: string) =>
    fetchApi(`/api/ha/entities${domain ? `?domain=${domain}` : ''}`),
  
  getScripts: () => fetchApi('/api/ha/scripts'),
  
  getAutomations: () => fetchApi('/api/ha/automations'),
  
  getScenes: () => fetchApi('/api/ha/scenes'),
  
  getAllowedServices: () => fetchApi('/api/ha/allowed-services'),
  
  callService: (service: string, target?: { entity_id?: string }, data?: Record<string, any>) =>
    fetchApi('/api/ha/call-service', {
      method: 'POST',
      body: JSON.stringify({ service, target, data }),
    }),
};

// Rules API
export const rulesApi = {
  getRules: () => fetchApi('/api/rules'),
  
  saveRules: (yaml: string) =>
    fetchApi('/api/rules', {
      method: 'PUT',
      body: JSON.stringify({ yaml }),
    }),
  
  validate: (yaml: string) =>
    fetchApi('/api/rules/validate', {
      method: 'POST',
      body: JSON.stringify({ yaml }),
    }),
  
  test: (message: { chat_id: string; sender_id: string; text: string }) =>
    fetchApi('/api/rules/test', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  
  getRuleFires: (limit?: number, ruleId?: string) => {
    const query = new URLSearchParams();
    if (limit) query.set('limit', String(limit));
    if (ruleId) query.set('rule_id', ruleId);
    return fetchApi(`/api/rules/fires?${query}`);
  },
  
  reload: () => fetchApi('/api/rules/reload', { method: 'POST' }),
};

// Logs API
export const logsApi = {
  getMessages: (params?: { page?: number; limit?: number; chat_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.chat_id) query.set('chat_id', params.chat_id);
    return fetchApi(`/api/logs/messages?${query}`);
  },
  
  getRuleFires: (params?: { page?: number; limit?: number; rule_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.rule_id) query.set('rule_id', params.rule_id);
    return fetchApi(`/api/logs/rules?${query}`);
  },
};
