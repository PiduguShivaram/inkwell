import { NodeType } from '../graph/types';

export interface ServiceFile {
  path: string; // relative to service directory or project root
  content: string;
}

export interface CompiledServiceSpec {
  nodeId: string;
  serviceName: string;
  type: NodeType;
  dirName: string;
  hostPort: number;
  internalPort: number;
  healthEndpoint: string;
  healthProbeUrl: string;
  image?: string;
  build?: {
    context: string;
    dockerfile: string;
  };
  environment: Record<string, string>;
  dependsOn: string[];
  files: ServiceFile[];
}

export interface CompiledProject {
  projectName: string;
  composeYaml: string;
  services: CompiledServiceSpec[];
  rootFiles: ServiceFile[];
  generatedAt: string;
}
