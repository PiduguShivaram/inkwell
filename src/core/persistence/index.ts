import fs from 'node:fs';
import path from 'node:path';
import { GraphIR } from '../graph/types';
import { validateGraphIR } from '../validation/validator';

export interface ArchitectureSummary {
  name: string;
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
  isValid: boolean;
  filePath: string;
}

export interface SavedArchitectureRecord {
  name: string;
  description?: string;
  graph: GraphIR;
  savedAt: string;
}

const DEFAULT_ARCHITECTURES_DIR = path.resolve(process.cwd(), '.inkwell', 'architectures');

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeArchitectureName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

/**
 * Saves a Graph IR architecture to local disk.
 */
export async function saveArchitecture(
  name: string,
  graph: GraphIR,
  description?: string,
  baseDir = DEFAULT_ARCHITECTURES_DIR
): Promise<{ success: boolean; filePath: string; name: string }> {
  if (!name || name.trim() === '') {
    throw new Error('Architecture name cannot be empty.');
  }

  const safeName = sanitizeArchitectureName(name);
  if (!safeName) {
    throw new Error('Invalid architecture name.');
  }

  ensureDirectory(baseDir);
  const filePath = path.join(baseDir, `${safeName}.json`);

  const record: SavedArchitectureRecord = {
    name: safeName,
    description: description || graph.metadata?.name || safeName,
    graph: {
      ...graph,
      metadata: {
        ...graph.metadata,
        name: safeName,
        updatedAt: new Date().toISOString(),
      },
    },
    savedAt: new Date().toISOString(),
  };

  await fs.promises.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
  return { success: true, filePath, name: safeName };
}

/**
 * Loads a saved architecture from local disk.
 */
export async function loadArchitecture(
  name: string,
  baseDir = DEFAULT_ARCHITECTURES_DIR
): Promise<{ success: boolean; record?: SavedArchitectureRecord; error?: string }> {
  const safeName = sanitizeArchitectureName(name);
  const filePath = path.join(baseDir, `${safeName}.json`);

  if (!fs.existsSync(filePath)) {
    return { success: false, error: `Architecture "${safeName}" not found.` };
  }

  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const record = JSON.parse(raw) as SavedArchitectureRecord;
    return { success: true, record };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to read architecture file: ${msg}` };
  }
}

/**
 * Lists all saved architectures on local disk.
 */
export async function listArchitectures(
  baseDir = DEFAULT_ARCHITECTURES_DIR
): Promise<ArchitectureSummary[]> {
  ensureDirectory(baseDir);
  const entries = await fs.promises.readdir(baseDir);
  const summaries: ArchitectureSummary[] = [];

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const filePath = path.join(baseDir, entry);
    try {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      const record = JSON.parse(raw) as SavedArchitectureRecord;
      const validation = validateGraphIR(record.graph);

      summaries.push({
        name: record.name,
        nodeCount: record.graph?.nodes?.length || 0,
        edgeCount: record.graph?.edges?.length || 0,
        updatedAt: record.savedAt || record.graph?.metadata?.updatedAt || '',
        isValid: validation.isValid,
        filePath,
      });
    } catch {
      // Skip malformed files
    }
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Deletes a saved architecture file.
 */
export async function deleteArchitecture(
  name: string,
  baseDir = DEFAULT_ARCHITECTURES_DIR
): Promise<{ success: boolean }> {
  const safeName = sanitizeArchitectureName(name);
  const filePath = path.join(baseDir, `${safeName}.json`);

  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
    return { success: true };
  }

  return { success: false };
}
