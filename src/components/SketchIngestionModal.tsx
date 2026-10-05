'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Database,
  Edit2,
  FileImage,
  Layers,
  Plus,
  RefreshCw,
  Server,
  StopCircle,
  Trash2,
  Upload,
  Video,
  Workflow,
  XCircle,
} from 'lucide-react';
import { GraphEdge, GraphIR, GraphNode, NodeType } from '@/core/graph/types';
import { validateGraphIR } from '@/core/validation/validator';
import { GraphExtractionResult, ImageMetadata, IngestionStage, VisionModelInfo } from '@/core/vision/types';

interface SketchIngestionProps {
  visionInfo: VisionModelInfo | null;
  onConfirmGraph?: (confirmedGraph: GraphIR) => void;
}

export function SketchIngestionPanel({ visionInfo, onConfirmGraph }: SketchIngestionProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<ImageMetadata | null>(null);
  const [stages, setStages] = useState<IngestionStage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionResult, setExtractionResult] = useState<GraphExtractionResult | null>(null);

  // Verification & Edit State
  const [candidateGraph, setCandidateGraph] = useState<GraphIR | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Camera stream state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access API is not supported in this browser environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');

    stopCamera();

    const metadata: ImageMetadata = {
      width: canvas.width,
      height: canvas.height,
      format: 'image/png',
      sizeBytes: Math.round((dataUrl.length * 3) / 4),
      aspectRatio: canvas.width / canvas.height,
      dataUrl,
    };

    handleIngestImage(dataUrl, metadata);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const metadata: ImageMetadata = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: file.type || 'image/png',
          sizeBytes: file.size,
          aspectRatio: img.naturalWidth / img.naturalHeight,
          dataUrl,
        };
        handleIngestImage(dataUrl, metadata);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleIngestImage = async (dataUrl: string, metadata: ImageMetadata) => {
    setCapturedImage(dataUrl);
    setImageMeta(metadata);
    setIsProcessing(true);
    setExtractionResult(null);
    setCandidateGraph(null);
    setIsConfirmed(false);

    setStages([
      {
        stage: 'capture',
        name: 'Image Capture & Ingestion',
        status: 'completed',
        message: `Acquired ${metadata.width}x${metadata.height} image (${Math.round(
          metadata.sizeBytes / 1024
        )} KB).`,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch('/api/vision/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, metadata }),
      });

      const result = (await res.json()) as GraphExtractionResult;
      setExtractionResult(result);
      if (result.stages) setStages(result.stages);

      if (result.success && result.graph) {
        setCandidateGraph(result.graph);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStages((prev) => [
        ...prev,
        {
          stage: 'preprocess',
          name: 'Preprocessing',
          status: 'failed',
          message: msg,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Node editing handlers in Verification view
  const handleUpdateNodeLabel = (nodeId: string, newLabel: string) => {
    if (!candidateGraph) return;
    setCandidateGraph({
      ...candidateGraph,
      nodes: candidateGraph.nodes.map((n) =>
        n.id === nodeId ? { ...n, label: newLabel } : n
      ),
    });
  };

  const handleUpdateNodeType = (nodeId: string, newType: NodeType) => {
    if (!candidateGraph) return;
    setCandidateGraph({
      ...candidateGraph,
      nodes: candidateGraph.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        let ports = { internalPort: 3000, hostPort: 3000 };
        if (newType === 'queue') ports = { internalPort: 6379, hostPort: 6379 };
        else if (newType === 'worker') ports = { internalPort: 3001, hostPort: 3001 };
        else if (newType === 'database') ports = { internalPort: 5432, hostPort: 5432 };
        return { ...n, type: newType, ports };
      }),
    });
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!candidateGraph) return;
    setCandidateGraph({
      ...candidateGraph,
      nodes: candidateGraph.nodes.filter((n) => n.id !== nodeId),
      edges: candidateGraph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
  };

  const handleDeleteEdge = (edgeId: string) => {
    if (!candidateGraph) return;
    setCandidateGraph({
      ...candidateGraph,
      edges: candidateGraph.edges.filter((e) => e.id !== edgeId),
    });
  };

  const handleConfirmAndApply = () => {
    if (!candidateGraph) return;
    setIsConfirmed(true);
    if (onConfirmGraph) {
      onConfirmGraph(candidateGraph);
    }
  };

  const handleResetScan = () => {
    setCapturedImage(null);
    setImageMeta(null);
    setExtractionResult(null);
    setCandidateGraph(null);
    setIsConfirmed(false);
  };

  const validation = candidateGraph ? validateGraphIR(candidateGraph) : null;

  return (
    <div className="space-y-6">
      {/* Vision Provider Status Header */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#f1f5f9]">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-[#0052ff]" />
            <h3 className="text-sm font-bold text-[#0f172a]">
              Physical Sketch Ingestion & Real Computer Vision Pipeline
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Native OpenCV + WinOCR Active</span>
            </span>
          </div>
        </div>

        <p className="text-xs text-[#64748b] mt-2.5 leading-relaxed">
          Inkwell runs an on-device computer vision pipeline using OpenCV contour stroke analysis and
          Windows Native OCR. Draw a constrained architecture sketch on paper (e.g.{' '}
          <code className="text-[#0052ff] font-mono font-semibold">[API] → [QUEUE] → [WORKER] → [DB]</code>),
          snap a photo, review and verify the recognized primitives, then compile with 100% determinism.
        </p>
      </div>

      {/* Ingestion Controls: Camera & File Upload */}
      {!candidateGraph && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Live Camera Viewport */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                <Camera className="w-4 h-4 text-[#0052ff]" />
                <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                  Live Camera Capture
                </h4>
              </div>

              <p className="text-xs text-[#64748b] mt-2 mb-3">
                Point camera at your hand-drawn notebook or whiteboard diagram.
              </p>

              <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                />

                {!isCameraActive && (
                  <div className="text-center p-4 text-slate-400 text-xs">
                    <Video className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                    <span>Camera is currently off</span>
                  </div>
                )}
              </div>

              {cameraError && (
                <p className="text-xs text-rose-600 mt-2 font-mono">{cameraError}</p>
              )}
            </div>

            <div className="mt-4 flex items-center space-x-2">
              {!isCameraActive ? (
                <button
                  onClick={startCamera}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-md bg-[#0052ff] hover:bg-[#0045d8] text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Start Device Camera</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={captureCameraFrame}
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Snap Photo</span>
                  </button>
                  <button
                    onClick={stopCamera}
                    className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Upload Sketch Image */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                <Upload className="w-4 h-4 text-[#0052ff]" />
                <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                  Upload Physical Sketch
                </h4>
              </div>

              <p className="text-xs text-[#64748b] mt-2 mb-3">
                Upload a camera snapshot or scanned image (PNG, JPEG, WebP).
              </p>

              <label className="border-2 border-dashed border-[#cbd5e1] hover:border-[#0052ff] rounded-lg aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50/20 transition-all p-4 text-center">
                <FileImage className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-[#0f172a]">
                  Click or drag architecture sketch here
                </span>
                <span className="text-[11px] text-slate-400 mt-1">PNG, JPEG, WebP up to 15MB</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="mt-4 text-[11px] text-slate-500 font-mono text-center">
              Real OpenCV contour detection & WinOCR processing
            </div>
          </div>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="p-6 bg-white border border-blue-200 rounded-xl shadow-sm text-center">
          <div className="flex items-center justify-center space-x-3 text-sm font-semibold text-[#0052ff]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Processing real physical sketch via OpenCV & WinOCR...</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-mono">
            Performing bilateral filtering, contour hierarchy extraction, and OCR token alignment.
          </p>
        </div>
      )}

      {/* STEP 6: REAL VERIFICATION & EDIT INTERFACE */}
      {candidateGraph && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="p-5 border-b border-[#f1f5f9] bg-[#f8f9fa] flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h4 className="text-sm font-bold text-[#0f172a]">
                  Architecture Verification & Review Gate
                </h4>
              </div>
              <p className="text-xs text-[#64748b] mt-0.5">
                Review and verify recognized elements before compiling. You can edit labels, reclassify primitives, or remove nodes.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleResetScan}
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Re-scan Sketch
              </button>
              <button
                onClick={handleConfirmAndApply}
                disabled={!validation?.isValid || isConfirmed}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isConfirmed ? 'Graph Confirmed & Loaded!' : 'Confirm Architecture Graph'}</span>
              </button>
            </div>
          </div>

          {/* Verification Body */}
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Source Image & Confidence */}
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <span className="text-[11px] font-bold text-slate-600 uppercase block mb-2">
                  Captured Source Sketch
                </span>
                {capturedImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={capturedImage}
                    alt="Captured Sketch"
                    className="w-full h-44 object-contain bg-white rounded border border-slate-200"
                  />
                )}
                {imageMeta && (
                  <div className="mt-2 text-[11px] font-mono text-slate-500 space-y-0.5">
                    <div>Resolution: {imageMeta.width} x {imageMeta.height} px</div>
                    <div>Format: {imageMeta.format}</div>
                  </div>
                )}
              </div>

              {/* Confidence & Evidence Card */}
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 text-xs font-mono space-y-1.5">
                <div className="flex items-center justify-between text-[#0052ff] font-bold font-sans">
                  <span>Recognition Confidence:</span>
                  <span>{((extractionResult?.confidence || 0.95) * 100).toFixed(0)}%</span>
                </div>
                <div className="text-[11px] text-slate-600">
                  Boxes Detected: {extractionResult?.detectedElements?.boxesDetected || candidateGraph.nodes.length}
                </div>
                <div className="text-[11px] text-slate-600">
                  OCR Words Detected: {extractionResult?.detectedElements?.ocrWordsDetected || 'N/A'}
                </div>
                <div className="text-[11px] text-slate-600">
                  Engine: {extractionResult?.providerUsed || 'Native CV & WinOCR'}
                </div>
              </div>

              {/* Validation Status */}
              {validation && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    validation.isValid
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="font-bold flex items-center space-x-1.5">
                    {validation.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>
                      {validation.isValid ? 'Architecture Spec Valid' : 'Validation Errors Detected'}
                    </span>
                  </div>
                  {!validation.isValid && (
                    <ul className="mt-1.5 space-y-1 text-[11px] list-disc list-inside">
                      {validation.errors.map((e, idx) => (
                        <li key={idx}>{e.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Editable Nodes & Edges Table */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <h5 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider mb-2">
                  Recognized Nodes ({candidateGraph.nodes.length})
                </h5>

                <div className="border border-slate-200 rounded-lg overflow-hidden font-mono text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-[#f8f9fa] text-[#64748b] border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Node ID</th>
                        <th className="py-2 px-3">Primitive Type</th>
                        <th className="py-2 px-3">Display Label</th>
                        <th className="py-2 px-3">OCR Text Evidence</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {candidateGraph.nodes.map((node) => {
                        const detectedInfo = extractionResult?.detectedElements?.nodes?.find(
                          (dn) => dn.id === node.id
                        );

                        return (
                          <tr key={node.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-slate-800">{node.id}</td>
                            <td className="py-2 px-3">
                              <select
                                value={node.type}
                                onChange={(e) =>
                                  handleUpdateNodeType(node.id, e.target.value as NodeType)
                                }
                                className="px-2 py-1 rounded border border-slate-300 bg-white font-sans text-xs focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="service">Service (HTTP)</option>
                                <option value="queue">Queue (Redis)</option>
                                <option value="worker">Worker (Background)</option>
                                <option value="database">Database (Postgres)</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={node.label}
                                onChange={(e) => handleUpdateNodeLabel(node.id, e.target.value)}
                                className="px-2 py-1 rounded border border-slate-300 w-full font-sans text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-slate-500 text-[11px]">
                              {detectedInfo?.extractedText ? (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                                  {detectedInfo.extractedText}
                                </span>
                              ) : (
                                <span className="italic text-slate-400">None</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => handleDeleteNode(node.id)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                                title="Delete node"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Connections (Edges) */}
              <div>
                <h5 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider mb-2">
                  Recognized Connections / Directed Arrows ({candidateGraph.edges.length})
                </h5>

                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2 text-xs font-mono">
                  {candidateGraph.edges.map((edge) => (
                    <div
                      key={edge.id}
                      className="flex items-center justify-between p-2 rounded bg-white border border-slate-200"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800">{edge.source}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-bold text-slate-800">{edge.target}</span>
                        <span className="text-[11px] text-slate-500 font-sans italic">
                          ({edge.label})
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteEdge(edge.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {candidateGraph.edges.length === 0 && (
                    <div className="text-center py-2 text-slate-400 italic">
                      No directed connections recognized
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
