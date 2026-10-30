import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { serializeForScript } from '../src/safe-json.js';
import { buildApp, extractChartData, row } from './helpers.js';

const SCRIPT_BREAKOUT = '</script><script>alert(1)</script>';
const HTML_INJECTION = '<img src=x onerror=alert(1)>';

describe('serializeForScript', () => {
  it('escapes characters that could close the script element or start markup', () => {
    const output = serializeForScript({ label: SCRIPT_BREAKOUT });

    assert.ok(!output.includes('<'));
    assert.ok(!output.includes('>'));
    assert.ok(!output.includes('</script'));
    assert.match(output, /\\u003c\/script\\u003e/);
  });

  it('escapes ampersands and the U+2028/U+2029 line separators', () => {
    const output = serializeForScript('a & b \u2028 \u2029');

    assert.equal(output, '"a \\u0026 b \\u2028 \\u2029"');
  });

  it('produces JSON that parses back to the exact original value', () => {
    const value = { label: SCRIPT_BREAKOUT, other: `${HTML_INJECTION} & "quotes" \u2028` };

    assert.deepEqual(JSON.parse(serializeForScript(value)), value);
  });
});

describe('dashboard rendering with hostile database values (regression for audit finding S1)', () => {
  const rows = [row('2021-01', 1, SCRIPT_BREAKOUT, 3), row('2021-01', 2, HTML_INJECTION, 1)];

  it('never emits the raw payloads into the page', async () => {
    const { app } = buildApp({ rows });
    const res = await request(app).get('/');

    assert.equal(res.status, 200);
    assert.ok(!res.text.includes(SCRIPT_BREAKOUT), 'raw </script> payload must not appear');
    assert.ok(!res.text.includes(HTML_INJECTION), 'raw HTML payload must not appear');
    assert.ok(!res.text.includes('<script>alert(1)'));
  });

  it('HTML-escapes database values in table cells', async () => {
    const { app } = buildApp({ rows });
    const res = await request(app).get('/');

    assert.ok(res.text.includes('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(res.text.includes('&lt;img src&#x3D;x onerror&#x3D;alert(1)&gt;'));
  });

  it('contains no inline executable scripts, only external scripts and the JSON data block', async () => {
    const { app } = buildApp({ rows });
    const res = await request(app).get('/');

    const scriptTags = res.text.match(/<script\b[^>]*>/g) ?? [];
    for (const tag of scriptTags) {
      assert.ok(/\bsrc="\/[^"]+"/.test(tag) || tag.includes('type="application/json"'), `unexpected ${tag}`);
    }
    assert.equal(scriptTags.filter((tag) => tag.includes('application/json')).length, 1);
  });

  it('round-trips hostile values through the JSON data block unchanged', async () => {
    const { app } = buildApp({ rows });
    const res = await request(app).get('/');

    const labels = extractChartData(res.text).datasets.map((dataset) => dataset.label);
    assert.deepEqual(labels.sort(), [SCRIPT_BREAKOUT, HTML_INJECTION].sort());
  });

  it('sends a Content-Security-Policy that blocks inline scripts', async () => {
    const { app } = buildApp({ rows });
    const res = await request(app).get('/');

    const csp = res.headers['content-security-policy'];
    const scriptSrc = csp.split(';').find((directive) => directive.startsWith('script-src '));
    assert.equal(scriptSrc, "script-src 'self'");
  });
});
