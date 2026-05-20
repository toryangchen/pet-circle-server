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
  it('uses POST for every server controller route', () => {
    const controllerFiles = listControllerFiles(join(__dirname, 'modules'));

    const violations = controllerFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const matches = source.match(/@(Get|Patch|Delete)\(/g) ?? [];
      return matches.map((match) => `${file}: ${match}`);
    });

    expect(violations).toEqual([]);
  });
});
