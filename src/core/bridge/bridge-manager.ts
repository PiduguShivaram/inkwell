import os from 'node:os';
import { detectDockerEnvironment } from '@/core/runtime/docker-detector';
import { BridgeEnvironmentStatus, HandoffRecord } from './types';

// In-memory record of handoffs during process lifetime
let lastHandoffRecord: HandoffRecord | null = null;
const handoffHistory: HandoffRecord[] = [];

export class BridgeManager {
  constructor() {}

  public recordHandoff(record: HandoffRecord): void {
    lastHandoffRecord = record;
    handoffHistory.unshift(record);
    if (handoffHistory.length > 20) {
      handoffHistory.pop();
    }
  }

  public getLastHandoff(): HandoffRecord | null {
    return lastHandoffRecord;
  }

  public getHistory(): HandoffRecord[] {
    return [...handoffHistory];
  }

  public async getEnvironmentStatus(): Promise<BridgeEnvironmentStatus> {
    const dockerInfo = await detectDockerEnvironment();

    // Determine LAN IP for direct network bridge
    let lanIp: string | undefined;
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      const addrs = ifaces[name];
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          lanIp = addr.address;
          break;
        }
      }
      if (lanIp) break;
    }

    return {
      officeKitSupported: true,
      capabilities: {
        superClipboard: true,
        easyShareFileDrop: true,
        screenMirroring: true,
      },
      networkEndpoints: {
        localhost: 'http://localhost:3005',
        lanIp: lanIp ? `http://${lanIp}:3005` : undefined,
        adbReverseTunnel: true,
      },
      lastHandoff: lastHandoffRecord,
      dockerAvailable: dockerInfo.isDaemonRunning,
    };
  }
}

export const bridgeManager = new BridgeManager();
