import * as fs from 'node:fs/promises';
import * as path from 'node:path';

async function testMobileIngestion() {
  const imagePath = path.resolve('tests/fixtures/real_sketch_api_queue_worker_db.png');
  const buffer = await fs.readFile(imagePath);
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;

  console.log('Sending real captured sketch image to /api/vision/ingest...');
  const res = await fetch('http://localhost:3005/api/vision/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: dataUrl,
      metadata: {
        width: 1200,
        height: 500,
        format: 'image/png',
        sizeBytes: buffer.length,
        aspectRatio: 1200 / 500
      }
    })
  });

  const data = await res.json();
  console.log('HTTP Status:', res.status);
  console.log('Success:', data.success);
  console.log('Confidence:', data.confidence);
  console.log('Detected Elements:', JSON.stringify(data.detectedElements, null, 2));
  console.log('Recognized Graph:', JSON.stringify(data.graph, null, 2));

  if (!data.success || !data.graph) {
    throw new Error('Vision extraction failed: ' + (data.error || 'No graph returned'));
  }

  // Now simulate mobile user confirmation & submission to /api/compile:
  console.log('\n--- Simulating User Verification & Confirmation -> /api/compile ---');
  const compileRes = await fetch('http://localhost:3005/api/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data.graph)
  });

  const compileData = await compileRes.json();
  console.log('Compilation HTTP Status:', compileRes.status);
  console.log('Compilation Success:', compileData.success);
  console.log('Compilation Project Name:', compileData.project?.projectName);
  console.log('Exported Disk Path:', compileData.diskPath);
}

testMobileIngestion().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
