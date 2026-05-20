import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function listControllerFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return listControllerFiles(fullPath);
    }

    return entry.endsWith('.controller.ts') ? [fullPath] : [];
  });
}

describe('HTTP method policy', () => {
  it('uses POST for every server controller route except public health checks', () => {
    const controllerFiles = listControllerFiles(join(__dirname, 'modules'));

    const violations = controllerFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const matches = source.match(/@(Get|Patch|Delete)\(/g) ?? [];
      if (file.endsWith('modules/health/health.controller.ts')) {
        return matches.filter((match) => match !== '@Get(').map((match) => `${file}: ${match}`);
      }
      return matches.map((match) => `${file}: ${match}`);
    });

    expect(violations).toEqual([]);
  });

  it('checks health with GET in the deployment workflow', () => {
    const workflow = readFileSync(join(__dirname, '..', '.github/workflows/deploy.yml'), 'utf8');

    expect(workflow).toContain('curl -fsS "${HEALTH_URL}"');
    expect(workflow).not.toContain('curl -fsS -X POST "${HEALTH_URL}"');
  });
});
