/**
 * Configuration loader for the WhatsApp Gateway
 * Reads from environment variables (set by run.sh from HA config)
 */

export interface Config {
  // Gateway settings
  gatewayPort: number;
  dataPath: string;
  
  // Evolution API
  evolutionUrl: string;
  apiKey: string;
  instanceName: string;
  
  // Home Assistant
  haUrl: string;
  haToken: string;
  
  // Allowed services (security allowlist)
  allowedServices: string[];
}

export function loadConfig(): Config {
  return {
    // Gateway port (separate from Evolution's 8080)
    gatewayPort: parseInt(process.env.GATEWAY_PORT || '8099', 10),
    dataPath: process.env.DATA_PATH || '/data',
    
    // Evolution API settings
    evolutionUrl: process.env.EVOLUTION_URL || 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY || process.env.AUTHENTICATION_API_KEY || '',
    instanceName: process.env.INSTANCE_NAME || 'Home',
    
    // Home Assistant settings
    haUrl: process.env.HA_URL || 'http://supervisor/core',
    haToken: process.env.HA_TOKEN || process.env.SUPERVISOR_TOKEN || '',
    
    // Security: only allow these services initially
    allowedServices: (process.env.HA_ALLOWED_SERVICES || 'script.turn_on,automation.trigger').split(',').map(s => s.trim()),
  };
}
