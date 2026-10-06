import { exec } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { CompiledProject } from '../compiler/types';
import { detectDockerEnvironment } from './docker-detector';
import { ContainerState, RuntimeExecutionResult } from './types';

const execAsync = promisify(exec);

export class DockerRuntime {
  /**
   * Generates and writes the compiled project files to the specified filesystem target directory.
   */
  async exportProjectToDisk(project: CompiledProject, targetDir: string): Promise<string> {
    const resolvedTarget = path.resolve(targetDir);
    await fs.mkdir(resolvedTarget, { recursive: true });

    // Write root files (docker-compose.yml, README.md, graph.ir.json)
    for (const rootFile of project.rootFiles) {
      const filePath = path.join(resolvedTarget, rootFile.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, rootFile.content, 'utf-8');
    }

    // Write service files (Dockerfile, server.js / worker.js)
    for (const service of project.services) {
      for (const sFile of service.files) {
        const filePath = path.join(resolvedTarget, service.dirName, sFile.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, sFile.content, 'utf-8');
      }
    }

    return resolvedTarget;
  }

  /**
   * Starts containers using `docker compose up -d --build`.
   */
  async startProject(projectDir: string): Promise<RuntimeExecutionResult> {
    const dockerEnv = await detectDockerEnvironment();
    if (!dockerEnv.isDaemonRunning) {
      return {
        success: false,
        command: 'docker compose up -d --build',
        stdout: '',
        stderr: dockerEnv.error || 'Docker daemon is not running.',
        exitCode: 1,
        error: `${dockerEnv.error} ${dockerEnv.guidance || ''}`.trim(),
      };
    }

    try {
      const { stdout, stderr } = await execAsync('docker compose up -d --build --remove-orphans', {
        cwd: projectDir,
      });
      return {
        success: true,
        command: 'docker compose up -d --build --remove-orphans',
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        success: false,
        command: 'docker compose up -d --build',
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || String(err),
        exitCode: error.code || 1,
        error: error.message || String(err),
      };
    }
  }

  /**
   * Stops containers using `docker compose down`.
   */
  async stopProject(projectDir: string): Promise<RuntimeExecutionResult> {
    const dockerEnv = await detectDockerEnvironment();
    if (!dockerEnv.isDaemonRunning) {
      return {
        success: false,
        command: 'docker compose down',
        stdout: '',
        stderr: dockerEnv.error || 'Docker daemon is not running.',
        exitCode: 1,
        error: `${dockerEnv.error} ${dockerEnv.guidance || ''}`.trim(),
      };
    }

    try {
      const { stdout, stderr } = await execAsync('docker compose down', {
        cwd: projectDir,
      });
      return {
        success: true,
        command: 'docker compose down',
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        success: false,
        command: 'docker compose down',
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || String(err),
        exitCode: error.code || 1,
        error: error.message || String(err),
      };
    }
  }

  /**
   * Restarts containers using `docker compose restart`.
   */
  async restartProject(projectDir: string): Promise<RuntimeExecutionResult> {
    const dockerEnv = await detectDockerEnvironment();
    if (!dockerEnv.isDaemonRunning) {
      return {
        success: false,
        command: 'docker compose restart',
        stdout: '',
        stderr: dockerEnv.error || 'Docker daemon is not running.',
        exitCode: 1,
        error: `${dockerEnv.error} ${dockerEnv.guidance || ''}`.trim(),
      };
    }

    try {
      const { stdout, stderr } = await execAsync('docker compose restart', {
        cwd: projectDir,
      });
      return {
        success: true,
        command: 'docker compose restart',
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        success: false,
        command: 'docker compose restart',
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || String(err),
        exitCode: error.code || 1,
        error: error.message || String(err),
      };
    }
  }

  /**
   * Starts a specific service in the project compose configuration.
   */
  async startService(projectDir: string, serviceName: string): Promise<RuntimeExecutionResult> {
    const safeService = serviceName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeService) {
      return {
        success: false,
        command: 'docker compose start',
        stdout: '',
        stderr: 'Invalid service name provided.',
        exitCode: 1,
        error: 'Invalid service name provided.',
      };
    }

    const dockerEnv = await detectDockerEnvironment();
    if (!dockerEnv.isDaemonRunning) {
      return {
        success: false,
        command: `docker compose start ${safeService}`,
        stdout: '',
        stderr: dockerEnv.error || 'Docker daemon is not running.',
        exitCode: 1,
        error: `${dockerEnv.error} ${dockerEnv.guidance || ''}`.trim(),
      };
    }

    try {
      const { stdout, stderr } = await execAsync(`docker compose start ${safeService}`, {
        cwd: projectDir,
      });
      return {
        success: true,
        command: `docker compose start ${safeService}`,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        success: false,
        command: `docker compose start ${safeService}`,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || String(err),
        exitCode: error.code || 1,
        error: error.message || String(err),
      };
    }
  }

  /**
   * Stops a specific service in the project compose configuration.
   */
  async stopService(projectDir: string, serviceName: string): Promise<RuntimeExecutionResult> {
    const safeService = serviceName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeService) {
      return {
        success: false,
        command: 'docker compose stop',
        stdout: '',
        stderr: 'Invalid service name provided.',
        exitCode: 1,
        error: 'Invalid service name provided.',
      };
    }

    const dockerEnv = await detectDockerEnvironment();
    if (!dockerEnv.isDaemonRunning) {
      return {
        success: false,
        command: `docker compose stop ${safeService}`,
        stdout: '',
        stderr: dockerEnv.error || 'Docker daemon is not running.',
        exitCode: 1,
        error: `${dockerEnv.error} ${dockerEnv.guidance || ''}`.trim(),
      };
    }

    try {
      const { stdout, stderr } = await execAsync(`docker compose stop ${safeService}`, {
        cwd: projectDir,
      });
      return {
        success: true,
        command: `docker compose stop ${safeService}`,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        success: false,
        command: `docker compose stop ${safeService}`,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || String(err),
        exitCode: error.code || 1,
        error: error.message || String(err),
      };
    }
  }

  /**
   * Restarts a specific service in the project compose configuration.
   */
  async restartService(projectDir: string, serviceName: string): Promise<RuntimeExecutionResult> {
    const safeService = serviceName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeService) {
      return {
        success: false,
        command: 'docker compose restart',
        stdout: '',
        stderr: 'Invalid service name provided.',
        exitCode: 1,
        error: 'Invalid service name provided.',
      };
    }

    const dockerEnv = await detectDockerEnvironment();
    if (!dockerEnv.isDaemonRunning) {
      return {
        success: false,
        command: `docker compose restart ${safeService}`,
        stdout: '',
        stderr: dockerEnv.error || 'Docker daemon is not running.',
        exitCode: 1,
        error: `${dockerEnv.error} ${dockerEnv.guidance || ''}`.trim(),
      };
    }

    try {
      const { stdout, stderr } = await execAsync(`docker compose restart ${safeService}`, {
        cwd: projectDir,
      });
      return {
        success: true,
        command: `docker compose restart ${safeService}`,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        success: false,
        command: `docker compose restart ${safeService}`,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || String(err),
        exitCode: error.code || 1,
        error: error.message || String(err),
      };
    }
  }

  /**
   * Retrieves bounded real logs for a service from `docker compose logs`.
   */
  async getServiceLogs(
    projectDir: string,
    serviceName: string,
    tailLines = 100
  ): Promise<{ success: boolean; logs: string; error?: string }> {
    const safeService = serviceName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeService) {
      return {
        success: false,
        logs: '',
        error: 'Invalid service name provided.',
      };
    }

    const dockerEnv = await detectDockerEnvironment();
    if (!dockerEnv.isDaemonRunning) {
      return {
        success: false,
        logs: '',
        error: dockerEnv.error || 'Docker daemon is not running.',
      };
    }
    const boundedTail = Math.min(500, Math.max(10, Math.floor(tailLines)));

    try {
      const { stdout, stderr } = await execAsync(
        `docker compose logs --tail=${boundedTail} --no-color ${safeService}`,
        { cwd: projectDir }
      );
      const combined = (stdout || stderr || '').trim();
      return {
        success: true,
        logs: combined.length > 0 ? combined : `(No log output available for ${safeService})`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        logs: '',
        error: errorMsg,
      };
    }
  }
  async getContainerStatuses(projectDir: string): Promise<ContainerState[]> {
    const dockerEnv = await detectDockerEnvironment();
    if (!dockerEnv.isDaemonRunning) {
      return [];
    }

    try {
      const { stdout } = await execAsync('docker compose ps --format json', {
        cwd: projectDir,
      });

      if (!stdout.trim()) {
        return [];
      }

      // Docker Compose may output a single JSON array or NDJSON (newline-delimited JSON objects)
      const cleaned = stdout.trim();
      let rawContainers: Record<string, unknown>[] = [];

      if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
        rawContainers = JSON.parse(cleaned);
      } else {
        const lines = cleaned.split('\n').filter((l) => l.trim().length > 0);
        rawContainers = lines.map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return {};
          }
        });
      }

      return rawContainers.map((c) => {
        const id = String(c.ID || c.Name || '');
        const name = String(c.Name || '');
        const service = String(c.Service || '');
        const state = String(c.State || 'unknown').toLowerCase();
        const status = String(c.Status || '');
        const healthRaw = String(c.Health || '').toLowerCase();

        let health: 'healthy' | 'unhealthy' | 'starting' | 'none' = 'none';
        if (healthRaw.includes('healthy')) health = 'healthy';
        else if (healthRaw.includes('unhealthy')) health = 'unhealthy';
        else if (healthRaw.includes('starting')) health = 'starting';

        return {
          id,
          name,
          service,
          state,
          status,
          health,
          ports: String(c.Publishers || c.Ports || ''),
        };
      });
    } catch {
      return [];
    }
  }
}
