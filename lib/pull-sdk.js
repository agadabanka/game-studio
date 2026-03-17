/**
 * game-studio pull-sdk — Pull latest @engine SDK from Game Factory.
 *
 * Downloads all engine modules and the ECS runtime into the local
 * engine/ directory. These are used by the bundler to resolve
 * @engine/* imports.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export default async function pullSdk({ cwd, factoryUrl }) {
  console.log(`Pulling SDK from ${factoryUrl}...`);

  const resp = await fetch(`${factoryUrl}/api/sdk`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch SDK: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  const engineDir = join(cwd, 'engine');
  mkdirSync(engineDir, { recursive: true });

  let count = 0;
  for (const [filename, source] of Object.entries(data.modules)) {
    const filePath = join(engineDir, filename);
    // Handle nested paths like ecs/index.js
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, source);
    count++;
    console.log(`  ${filename} (${source.length} bytes)`);
  }

  console.log(`\nPulled ${count} modules (SDK v${data.version})`);
}
