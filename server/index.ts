import Fastify from 'fastify';
import { watch } from 'fs';
import { readFile } from 'fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'path';
import { createPluginRuntime } from 'every-plugin/runtime';
import cors from '@fastify/cors';

const fastify = Fastify({ 
  logger: true 
});

await fastify.register(cors);

// Plugin state
let runtime: any = null;
let pluginClients = new Map();
let pluginConfigs: any = {};
let allowlist: string[] = [];
let requireChecksum = false;

type PluginStatusType = { status: 'loaded' | 'failed' | 'skipped'; reason?: string; checkedAt: number }

const pluginStatus = new Map<string,PluginStatusType>();

const pluginsPath = resolve(process.cwd(), 'plugins.json');

// Load plugins from JSON
async function loadPluginConfig() {
  try {
    const content = await readFile(pluginsPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load plugins.json:', error);
    return {};
  }
}

// Initialize/reload plugins
async function reloadPlugins() {
  console.log('Loading plugins...');
  
  pluginConfigs = await loadPluginConfig();
  allowlist = Array.isArray(pluginConfigs.allowlist) ? pluginConfigs.allowlist : [];
  requireChecksum = Boolean(pluginConfigs.requireChecksum);
  
  // Filter enabled plugins
  const enabledPlugins = Object.entries(pluginConfigs)
    .filter(([id]) => id !== 'allowlist' && id !== 'requireChecksum')
    .filter(([_, config]: any) => config.enabled);
  
  // Clear old clients
  pluginClients.clear();
  
  // Shutdown old runtime
  if (runtime) {
    await runtime.shutdown();
  }
  
  // Build registry
  const registry: any = {};
  const secrets: any = {};
  
  for (const [id, config] of enabledPlugins) {
    const remote = (config as any).remote;
    if (!remote) {
      pluginStatus.set(id, { status: 'skipped', reason: 'missing remote', checkedAt: Date.now() });
      continue;
    }

    const remoteHost = (() => {
      try {
        return new URL(remote).host;
      } catch {
        return null;
      }
    })();

    if (allowlist.length && remoteHost && !allowlist.includes(remoteHost)) {
      pluginStatus.set(id, { status: 'skipped', reason: `host not in allowlist: ${remoteHost}`, checkedAt: Date.now() });
      continue;
    }

    const checksum = (config as any).checksum;
    if (requireChecksum && !checksum) {
      pluginStatus.set(id, { status: 'skipped', reason: 'checksum required', checkedAt: Date.now() });
      continue;
    }

    if (checksum) {
      try {
        const response = await fetch(remote);
        if (!response.ok) {
          pluginStatus.set(id, { status: 'failed', reason: `checksum fetch failed: ${response.status}`, checkedAt: Date.now() });
          continue;
        }
        const content = await response.text();
        const digest = createHash('sha256').update(content).digest('hex');
        if (digest !== checksum) {
          pluginStatus.set(id, { status: 'failed', reason: 'checksum mismatch', checkedAt: Date.now() });
          continue;
        }
      } catch (error: any) {
        pluginStatus.set(id, { status: 'failed', reason: `checksum error: ${error?.message ?? error}`, checkedAt: Date.now() });
        continue;
      }
    }

    registry[id] = { remote };
    
    // Collect secrets
    for (const [key, value] of Object.entries((config as any).secrets || {})) {
      secrets[`${id.toUpperCase()}_${key}`] = value;
    }

    pluginStatus.set(id, { status: 'loaded', checkedAt: Date.now() });
  }
  
  // Create new runtime
  runtime = createPluginRuntime({ registry, secrets });
  
  console.log(`Loaded ${enabledPlugins.length} plugins:`, Object.keys(registry));
}

// Get or create plugin client
async function getPluginClient(chain: string) {
  if (!pluginClients.has(chain)) {
    const config = pluginConfigs[chain];
    
    if (!config || !config.enabled) {
      throw new Error(`Plugin ${chain} not found or disabled`);
    }
    
    // Build secrets mapping
    const secretsMap: any = {};
    for (const [key, _] of Object.entries(config.secrets || {})) {
      secretsMap[key.toLowerCase()] = `{{${chain.toUpperCase()}_${key}}}`;
    }
    
    const { createClient } = await runtime.usePlugin(chain, {
      secrets: secretsMap,
      variables: config.variables || {}
    });
    
    const client = createClient();
    pluginClients.set(chain, client);
    
    console.log(`Initialized plugin: ${chain}`);
  }
  
  return pluginClients.get(chain);
}

// Watch for changes (debounced)
let reloadTimer: NodeJS.Timeout | null = null; // the ref that setTimeOut woould return to be used for clearing the scheduled task
const scheduleReload = () => {
  if (reloadTimer) {
    clearTimeout(reloadTimer);
  }
  reloadTimer = setTimeout(async () => {
    console.log('plugins.json changed, reloading...');
    try {
      await reloadPlugins();
    } catch (error) {
      console.error('Failed to reload plugins:', error);
    }
  }, 200);
};

watch(pluginsPath, { persistent: true }, (eventType) => {
  if (eventType === 'change' || eventType === 'rename') {
    scheduleReload();
  }
});

// Routes
fastify.get('/health', async () => {
  return {
    status: 'ok',
    plugins: Object.keys(pluginConfigs).filter((id) => id !== 'allowlist' && id !== 'requireChecksum').length,
    allowlist,
    requireChecksum,
    statuses: Object.fromEntries(pluginStatus.entries()) // converts the Map objects to normal objects.
  };
});

// Get available chains
fastify.get('/api/chains', async () => {
  const chains = Object.entries(pluginConfigs)
    .filter(([_, config]: any) => config.enabled)
    .map(([id, config]: any) => ({
      id,
      name: config.name,
      symbol: config.symbol,
      explorer: config.explorer
    }));
  
  return { chains };
});

// Get transactions for any chain
fastify.get('/api/:chain/transactions/:address', async (request, reply) => {
  const { chain, address } = request.params as { chain: string; address: string };
  const { limit, offset } = request.query as { limit?: string; offset?: string };
  
  try {
    const client = await getPluginClient(chain);
    
    const result = await client.getTransactions({
      address,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0
    });
    
    return result;
  } catch (error: any) {
    fastify.log.error(error);
    reply.code(error.message.includes('not found') ? 404 : 500);
    return { error: error.message };
  }
});

// Get chain info
fastify.get('/api/:chain/info', async (request, reply) => {
  const { chain } = request.params as { chain: string };
  
  try {
    const client = await getPluginClient(chain);
    const info = await client.getChainInfo({});
    return info;
  } catch (error: any) {
    reply.code(500);
    return { error: error.message };
  }
});

// Export transactions to CSV
fastify.get('/api/:chain/export/:address', async (request, reply) => {
  const { chain, address } = request.params as { chain: string; address: string };
  
  try {
    const client = await getPluginClient(chain);
    const result = await client.getTransactions({ address, limit: 10000 });
    
    // Convert to CSV (Awakens format)
    const csv = [
      'Date,Type,Base Currency,Base Amount,Quote Currency,Quote Amount,Fee Currency,Fee Amount,From,To,Blockchain,ID,Description',
      ...result.transactions.map((tx: any) => 
        `${new Date(tx.timestamp * 1000).toISOString()},transfer,${pluginConfigs[chain].symbol},${tx.value},USD,0,${pluginConfigs[chain].symbol},${tx.fee},${tx.from},${tx.to},${chain},${tx.hash},Transaction on ${chain}`
      )
    ].join('\n');
    
    reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="${chain}-${address}.csv"`)
      .send(csv);
  } catch (error: any) {
    reply.code(500);
    return { error: error.message };
  }
});

// Initial load
await reloadPlugins();

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server running at http://localhost:3000');
    console.log('Available chains:', Object.keys(pluginConfigs).filter(k => pluginConfigs[k].enabled));
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

const shutdown = async () => {
  try {
    if (runtime) {
      await runtime.shutdown();
    }
  } finally {
    process.exit(0);
  }
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

start();
// seems like reloadPlugins and getPlugins are contradicting
// how would the secrets really be managed? should I make it so that consumers manage their own api keys