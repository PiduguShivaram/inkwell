import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { DockerEnvironmentInfo } from './types';

const execAsync = promisify(exec);

/**
 * Programmatically and genuinely probes the Docker environment.
 * Never mocks or fakes availability.
 */
export async function detectDockerEnvironment(): Promise<DockerEnvironmentInfo> {
  // 1. Check Docker CLI installation
  let clientVersion: string | undefined;
  try {
    const { stdout } = await execAsync('docker --version', { timeout: 3000 });
    clientVersion = stdout.trim();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      isInstalled: false,
      isDaemonRunning: false,
      error: 'Docker CLI executable not found in PATH.',
      guidance: 'Install Docker Desktop or the Docker CLI to enable container orchestration.',
      rawOutput: errorMsg,
    };
  }

  // 2. Check Docker daemon connection via `docker info`
  try {
    const { stdout } = await execAsync(
      'docker info --format "{{.ServerVersion}}|{{.OperatingSystem}}|{{.Name}}"',
      { timeout: 3500 }
    );
    const parts = stdout.trim().split('|');
    return {
      isInstalled: true,
      isDaemonRunning: true,
      clientVersion,
      serverVersion: parts[0] || 'Unknown',
      context: parts[1] || 'default',
      rawOutput: stdout.trim(),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    let guidance = 'Docker CLI is installed, but the Docker daemon is unreachable.';
    if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
      guidance =
        'Docker Desktop is running, but the container engine failed to start because the Windows "Virtual Machine Platform" feature is not enabled. Run "enable-docker-prerequisites.bat" as Administrator (or "dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart") and restart your computer.';
    } else if (errorMsg.includes('dockerDesktopLinuxEngine') || errorMsg.includes('pipe') || errorMsg.includes('daemon is running')) {
      guidance = 'Docker Desktop is installed but not running. Launch Docker Desktop to start the container engine.';
    } else if (errorMsg.includes('permission denied')) {
      guidance = 'Permission denied connecting to Docker socket. Check your user permissions.';
    }

    return {
      isInstalled: true,
      isDaemonRunning: false,
      clientVersion,
      error: 'Docker daemon is not running or unreachable.',
      guidance,
      rawOutput: errorMsg,
    };
  }
}
