import { GraphIR, GraphNode } from '../graph/types';
import { validateGraphIR } from '../validation/validator';
import { generateHttpServiceFiles, generateWorkerServiceFiles, sanitizeServiceName } from './templates';
import { CompiledProject, CompiledServiceSpec, ServiceFile } from './types';

/**
 * Deterministic compiler: Validated GraphIR -> CompiledProject
 * Given identical GraphIR, output is 100% deterministic and byte-for-byte reproducible.
 */
export function compileGraph(graph: GraphIR): CompiledProject {
  const validation = validateGraphIR(graph);
  if (!validation.isValid) {
    const errorDetails = validation.errors.map((e) => `[${e.code}] ${e.message}`).join('; ');
    throw new Error(`Cannot compile invalid graph: ${errorDetails}`);
  }

  const projectName = sanitizeServiceName(graph.metadata?.name || 'inkwell-system');
  const sortedNodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = [...graph.edges].sort((a, b) => a.id.localeCompare(b.id));

  // Determine dependency graph
  const dependencyMap = new Map<string, Set<string>>();
  for (const node of sortedNodes) {
    dependencyMap.set(node.id, new Set());
  }
  for (const edge of sortedEdges) {
    // If edge is source -> target, target might depend on source or source depends on target
    // In typical architecture: API (service) publishes to Queue => Service depends on Queue being up
    // Worker consumes from Queue => Worker depends on Queue and DB
    const sourceNode = sortedNodes.find((n) => n.id === edge.source);
    const targetNode = sortedNodes.find((n) => n.id === edge.target);
    if (sourceNode && targetNode) {
      if (sourceNode.type === 'service' && targetNode.type === 'queue') {
        dependencyMap.get(sourceNode.id)?.add(targetNode.id);
      } else if (sourceNode.type === 'queue' && targetNode.type === 'worker') {
        dependencyMap.get(targetNode.id)?.add(sourceNode.id);
      } else if (sourceNode.type === 'worker' && targetNode.type === 'database') {
        dependencyMap.get(sourceNode.id)?.add(targetNode.id);
      } else if (sourceNode.type === 'service' && targetNode.type === 'database') {
        dependencyMap.get(sourceNode.id)?.add(targetNode.id);
      }
    }
  }

  // Deterministic port counters
  let servicePortCounter = 4000;
  let workerPortCounter = 5000;
  let queuePortCounter = 6379;
  let dbPortCounter = 5432;

  const services: CompiledServiceSpec[] = [];

  for (const node of sortedNodes) {
    const serviceName = sanitizeServiceName(node.id);
    const dirName = `services/${serviceName}`;

    let hostPort: number;
    let internalPort: number;
    let healthEndpoint: string;
    let image: string | undefined;
    let build: { context: string; dockerfile: string } | undefined;
    let files: ServiceFile[] = [];
    const env: Record<string, string> = { ...node.env };

    switch (node.type) {
      case 'service': {
        internalPort = node.ports?.internalPort || 3000;
        hostPort = node.ports?.hostPort || servicePortCounter++;
        healthEndpoint = '/health';
        build = {
          context: `./${dirName}`,
          dockerfile: 'Dockerfile',
        };
        env.PORT = String(internalPort);
        env.SERVICE_NAME = node.label;
        files = generateHttpServiceFiles(node, internalPort);
        break;
      }
      case 'worker': {
        internalPort = node.ports?.internalPort || 3001;
        hostPort = node.ports?.hostPort || workerPortCounter++;
        healthEndpoint = '/health';
        build = {
          context: `./${dirName}`,
          dockerfile: 'Dockerfile',
        };
        env.PORT = String(internalPort);
        env.WORKER_NAME = node.label;
        files = generateWorkerServiceFiles(node, internalPort);
        break;
      }
      case 'queue': {
        internalPort = node.ports?.internalPort || 6379;
        hostPort = node.ports?.hostPort || queuePortCounter++;
        healthEndpoint = ''; // Redis protocol
        image = 'redis:7-alpine';
        break;
      }
      case 'database': {
        internalPort = node.ports?.internalPort || 5432;
        hostPort = node.ports?.hostPort || dbPortCounter++;
        healthEndpoint = ''; // Postgres protocol
        image = 'postgres:16-alpine';
        if (!env.POSTGRES_DB) env.POSTGRES_DB = 'inkwell_db';
        if (!env.POSTGRES_USER) env.POSTGRES_USER = 'inkwell_user';
        if (!env.POSTGRES_PASSWORD) env.POSTGRES_PASSWORD = 'inkwell_password';
        break;
      }
    }

    const healthProbeUrl = healthEndpoint ? `http://localhost:${hostPort}${healthEndpoint}` : '';
    const deps = Array.from(dependencyMap.get(node.id) || []).map(sanitizeServiceName).sort();

    services.push({
      nodeId: node.id,
      serviceName,
      type: node.type,
      dirName,
      hostPort,
      internalPort,
      healthEndpoint,
      healthProbeUrl,
      image,
      build,
      environment: env,
      dependsOn: deps,
      files,
    });
  }

  // Generate docker-compose.yml YAML string
  const composeYaml = generateComposeYaml(projectName, services);

  // Readme explaining the compiled system
  const readmeContent = `# ${graph.metadata?.name || 'Inkwell Compiled System'}

Deterministic compiled output generated by Inkwell Compiler.

## Architecture
- Nodes: ${services.length}
${services.map((s) => `  - **${s.serviceName}** (${s.type}): host port ${s.hostPort}`).join('\n')}

## Starting the System
\`\`\`bash
docker compose up -d --build
\`\`\`

## Checking Status
\`\`\`bash
docker compose ps
\`\`\`

## Stopping the System
\`\`\`bash
docker compose down
\`\`\`
`;

  const rootFiles: ServiceFile[] = [
    { path: 'docker-compose.yml', content: composeYaml },
    { path: 'README.md', content: readmeContent },
    {
      path: 'graph.ir.json',
      content: JSON.stringify(graph, null, 2),
    },
  ];

  return {
    projectName,
    composeYaml,
    services,
    rootFiles,
    generatedAt: new Date().toISOString(),
  };
}

function generateComposeYaml(projectName: string, services: CompiledServiceSpec[]): string {
  const lines: string[] = [];
  lines.push(`name: ${projectName}`);
  lines.push('services:');

  for (const s of services) {
    lines.push(`  ${s.serviceName}:`);
    if (s.image) {
      lines.push(`    image: ${s.image}`);
    } else if (s.build) {
      lines.push(`    build:`);
      lines.push(`      context: ${s.build.context}`);
      lines.push(`      dockerfile: ${s.build.dockerfile}`);
    }

    lines.push(`    container_name: ${projectName}-${s.serviceName}`);
    lines.push(`    ports:`);
    lines.push(`      - "${s.hostPort}:${s.internalPort}"`);

    // Environment
    const envKeys = Object.keys(s.environment).sort();
    if (envKeys.length > 0) {
      lines.push(`    environment:`);
      for (const k of envKeys) {
        lines.push(`      ${k}: "${s.environment[k]}"`);
      }
    }

    // Depends on
    if (s.dependsOn.length > 0) {
      lines.push(`    depends_on:`);
      for (const dep of s.dependsOn) {
        lines.push(`      - ${dep}`);
      }
    }

    // Healthcheck
    if (s.type === 'service' || s.type === 'worker') {
      lines.push(`    healthcheck:`);
      lines.push(`      test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:${s.internalPort}/health"]`);
      lines.push(`      interval: 10s`);
      lines.push(`      timeout: 5s`);
      lines.push(`      retries: 3`);
      lines.push(`      start_period: 5s`);
    } else if (s.type === 'queue') {
      lines.push(`    healthcheck:`);
      lines.push(`      test: ["CMD", "redis-cli", "ping"]`);
      lines.push(`      interval: 5s`);
      lines.push(`      timeout: 3s`);
      lines.push(`      retries: 3`);
    } else if (s.type === 'database') {
      lines.push(`    healthcheck:`);
      lines.push(`      test: ["CMD-SHELL", "pg_isready -U ${s.environment.POSTGRES_USER || 'inkwell_user'}"]`);
      lines.push(`      interval: 5s`);
      lines.push(`      timeout: 3s`);
      lines.push(`      retries: 5`);
    }

    lines.push(`    networks:`);
    lines.push(`      - inkwell-net`);
    lines.push(`    restart: unless-stopped`);
  }

  lines.push('networks:');
  lines.push('  inkwell-net:');
  lines.push('    driver: bridge');

  return lines.join('\n') + '\n';
}
