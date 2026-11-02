import { renderMarkdown, toggleTask, markdownToPlainText } from './scratchpadMarkdown';

describe('renderMarkdown', () => {
  test('renders GFM: headings, bold, tables', () => {
    const html = renderMarkdown('# Lead\n**bold**\n\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<h1>Lead</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<table>');
  });

  test('keeps single newlines as line breaks', () => {
    expect(renderMarkdown('one\ntwo')).toContain('<br>');
  });

  test('task checkboxes are numbered and clickable (not disabled)', () => {
    const html = renderMarkdown('- [ ] a\n- [x] b');
    expect(html).toContain('data-task-index="0"');
    expect(html).toContain('data-task-index="1"');
    expect(html).not.toContain('disabled');
  });

  test('strips scripts and event handlers', () => {
    const html = renderMarkdown('<script>alert(1)</script><a href="x" onclick="evil()">x</a>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
  });

  test('never loads remote resources: images become links, style is dropped', () => {
    const html = renderMarkdown('![pixel](https://evil.example/t.gif)\n\n<img src="https://evil.example/x.png"><p style="background:url(https://evil.example/y)">p</p>');
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toContain('style=');
    expect(html).toContain('href="https://evil.example/t.gif"');
  });

  test('links open in a new tab without a referrer', () => {
    const html = renderMarkdown('[site](https://example.com)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('noreferrer');
  });

  test('javascript: links are neutralised', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('javascript:');
  });
});

describe('toggleTask', () => {
  test('toggles the n-th task only', () => {
    const src = '- [ ] one\n- [x] two\n- [ ] three';
    expect(toggleTask(src, 0)).toBe('- [x] one\n- [x] two\n- [ ] three');
    expect(toggleTask(src, 1)).toBe('- [ ] one\n- [ ] two\n- [ ] three');
    expect(toggleTask(src, 2)).toBe('- [ ] one\n- [x] two\n- [x] three');
  });

  test('handles ordered and nested lists', () => {
    expect(toggleTask('1. [ ] a\n   * [ ] b', 1)).toBe('1. [ ] a\n   * [x] b');
  });

  test('ignores task markers inside code fences', () => {
    const src = '```\n- [ ] not a task\n```\n- [ ] real';
    expect(toggleTask(src, 0)).toBe('```\n- [ ] not a task\n```\n- [x] real');
  });

  test('out-of-range index leaves source unchanged', () => {
    expect(toggleTask('- [ ] a', 5)).toBe('- [ ] a');
  });

  test('indexes line up with rendered checkboxes', () => {
    const src = 'text\n- [ ] a\n\n```\n- [ ] code\n```\n1. [x] b';
    const rendered = (renderMarkdown(src).match(/data-task-index/g) || []).length;
    expect(rendered).toBe(2);
    expect(toggleTask(src, 1)).toContain('1. [ ] b');
  });
});

describe('markdownToPlainText', () => {
  test('drops markdown syntax but keeps task state', () => {
    const text = markdownToPlainText('## Title\n- [x] done\n- [ ] todo\n\n**bold**');
    expect(text).toContain('Title');
    expect(text).toContain('[x] done');
    expect(text).toContain('[ ] todo');
    expect(text).not.toContain('**');
    expect(text).not.toContain('##');
  });
});
