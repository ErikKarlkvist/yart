import { describe, expect, it } from 'vitest';
import { languageOf, summarizeLanguages } from './languages';

describe('summarizeLanguages', () => {
  it('räknar per språk och sorterar störst först', () => {
    const result = summarizeLanguages([
      'src/a.ts',
      'src/b.tsx',
      'src/c.py',
      'README.md',
      'Makefile',
      '.gitignore',
    ]);
    expect(result).toEqual([
      { name: 'TypeScript', files: 2 },
      { name: 'Markdown', files: 1 },
      { name: 'Python', files: 1 },
    ]);
  });

  it('begränsar antalet språk', () => {
    const paths = ['a.ts', 'b.py', 'c.go', 'd.rs', 'e.java', 'f.rb'];
    expect(summarizeLanguages(paths, 2)).toHaveLength(2);
  });
});

describe('languageOf', () => {
  it('ignorerar dolda filer utan ändelse', () => {
    expect(languageOf('.env')).toBeNull();
    expect(languageOf('dir/.hidden')).toBeNull();
  });

  it('är okänslig för versaler i ändelsen', () => {
    expect(languageOf('Foo.TS')).toBe('TypeScript');
  });
});
