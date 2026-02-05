#!/usr/bin/env node
/**
 * Simple webhook listener for testing Evolution API webhooks locally
 * Usage: node webhook-listener.js [port]
 */

const http = require('http');
const PORT = process.argv[2] || 3000;

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      const timestamp = new Date().toLocaleTimeString();
      
      console.log('\n' + '='.repeat(60));
      console.log(`📨 Webhook received at ${timestamp}`);
      console.log('='.repeat(60));
      
      try {
        const data = JSON.parse(body);
        
        // Extract key info
        const event = data.event || 'unknown';
        const instance = data.instance || 'unknown';
        
        console.log(`Event: ${event}`);
        console.log(`Instance: ${instance}`);
        
        if (data.data) {
          const msgData = data.data;
          
          // Message info
          if (msgData.key) {
            const isGroup = msgData.key.remoteJid?.endsWith('@g.us');
            console.log(`From: ${msgData.pushName || 'Unknown'}`);
            console.log(`Chat: ${msgData.key.remoteJid}`);
            console.log(`Type: ${isGroup ? '👥 Group' : '👤 Direct'}`);
            console.log(`From me: ${msgData.key.fromMe ? 'Yes' : 'No'}`);
          }
          
          // Message content
          if (msgData.message) {
            const msg = msgData.message;
            const text = msg.conversation || 
                        msg.extendedTextMessage?.text ||
                        msg.imageMessage?.caption ||
                        msg.videoMessage?.caption ||
                        '[media/other]';
            console.log(`\n💬 Message: "${text}"`);
          }
        }
        
        // Full payload (collapsed)
        console.log('\n📋 Full payload:');
        console.log(JSON.stringify(data, null, 2));
        
      } catch (e) {
        console.log('Raw body:', body);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'received' }));
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <h1>🔗 Webhook Listener</h1>
      <p>Listening for POST requests on port ${PORT}</p>
      <p>Webhook URL: <code>http://host.docker.internal:${PORT}/webhook</code></p>
    `);
  }
});

server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Webhook listener started!');
  console.log('='.repeat(60));
  console.log(`Listening on: http://localhost:${PORT}`);
  console.log(`\nFor Docker containers, use: http://host.docker.internal:${PORT}/webhook`);
  console.log('\nWaiting for webhooks...\n');
});
