import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeHtml, sanitizeObject } from './sanitize';

describe('sanitizeText', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(sanitizeText('John Doe')).toBe('John Doe');
  });

  it('strips script tags', () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('');
  });

  it('strips all HTML tags and returns text content', () => {
    expect(sanitizeText('<b>Bold</b> text')).toBe('Bold text');
  });

  it('strips event handler attributes', () => {
    expect(sanitizeText('<img onerror="alert(1)" src="x">')).toBe('');
  });

  it('strips nested malicious content', () => {
    expect(sanitizeText('<div><script>evil()</script>Safe</div>')).toBe('Safe');
  });

  it('preserves ampersands in plain text', () => {
    expect(sanitizeText('O\'Brien & Sons')).toBe("O'Brien & Sons");
  });

  it('strips angle-bracket content treated as HTML tags', () => {
    // <family> is treated as an unknown HTML tag and stripped
    expect(sanitizeText('O\'Brien <family>')).toBe("O'Brien");
  });

  it('preserves apostrophes and quotes', () => {
    expect(sanitizeText("O'Brien")).toBe("O'Brien");
  });

  it('trims whitespace from result', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('handles null-like falsy values gracefully', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('strips iframe tags', () => {
    expect(sanitizeText('<iframe src="evil.com"></iframe>')).toBe('');
  });

  it('strips javascript: protocol in links', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    expect(sanitizeText(input)).toBe('click');
  });
});

describe('sanitizeHtml', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('preserves allowed formatting tags', () => {
    expect(sanitizeHtml('<b>Bold</b> and <em>italic</em>')).toBe(
      '<b>Bold</b> and <em>italic</em>'
    );
  });

  it('preserves paragraph and line break tags', () => {
    expect(sanitizeHtml('<p>Paragraph</p><br>')).toBe('<p>Paragraph</p><br>');
  });

  it('preserves list tags', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('preserves anchor tags with href', () => {
    expect(sanitizeHtml('<a href="https://example.com">Link</a>')).toBe(
      '<a href="https://example.com">Link</a>'
    );
  });

  it('strips disallowed attributes from allowed tags', () => {
    const result = sanitizeHtml('<a href="https://example.com" onclick="evil()">Link</a>');
    expect(result).toBe('<a href="https://example.com">Link</a>');
  });

  it('strips script tags', () => {
    expect(sanitizeHtml('<p>Hello</p><script>alert("xss")</script>')).toBe(
      '<p>Hello</p>'
    );
  });

  it('strips disallowed tags but keeps content', () => {
    expect(sanitizeHtml('<div>Content in div</div>')).toBe('Content in div');
  });

  it('strips style tags', () => {
    expect(sanitizeHtml('<style>body{display:none}</style><p>Text</p>')).toBe(
      '<p>Text</p>'
    );
  });

  it('strips data attributes', () => {
    const result = sanitizeHtml('<p data-evil="payload">Text</p>');
    expect(result).toBe('<p>Text</p>');
  });

  it('strips javascript: protocol in href', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain('javascript:');
  });
});

describe('sanitizeObject', () => {
  it('sanitizes string values in a flat object', () => {
    const input = {
      name: '<script>alert("xss")</script>John',
      age: 30,
    };
    const result = sanitizeObject(input);
    expect(result.name).toBe('John');
    expect(result.age).toBe(30);
  });

  it('recursively sanitizes nested objects', () => {
    const input = {
      person: {
        firstName: '<b>Jane</b>',
        location: {
          city: '<script>hack</script>Kathmandu',
        },
      },
    };
    const result = sanitizeObject(input);
    expect(result.person.firstName).toBe('Jane');
    expect(result.person.location.city).toBe('Kathmandu');
  });

  it('sanitizes string values in arrays', () => {
    const input = {
      tags: ['<script>evil</script>safe', 'normal'],
    };
    const result = sanitizeObject(input);
    expect(result.tags).toEqual(['safe', 'normal']);
  });

  it('handles objects in arrays', () => {
    const input = {
      items: [{ name: '<img onerror="alert(1)">Test' }],
    };
    const result = sanitizeObject(input);
    expect(result.items[0].name).toBe('Test');
  });

  it('preserves null values', () => {
    const input = { name: 'John', middleName: null };
    const result = sanitizeObject(input);
    expect(result.middleName).toBeNull();
  });

  it('preserves boolean values', () => {
    const input = { name: 'John', active: true };
    const result = sanitizeObject(input);
    expect(result.active).toBe(true);
  });

  it('preserves number values', () => {
    const input = { name: 'John', count: 42 };
    const result = sanitizeObject(input);
    expect(result.count).toBe(42);
  });

  it('handles empty objects', () => {
    const result = sanitizeObject({});
    expect(result).toEqual({});
  });
});
