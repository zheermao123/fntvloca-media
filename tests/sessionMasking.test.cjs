const test = require('node:test');
const assert = require('node:assert/strict');
const { maskStringByPatterns } = require('../dest/modules/logger/masking.js');

test('masks playback session capabilities in logged URLs', () => {
    const capability = 'a'.repeat(64);
    const masked = maskStringByPatterns(`http://127.0.0.1/play?session=${capability}`);
    assert.doesNotMatch(masked, new RegExp(capability));
    assert.match(masked, /session=/);
});
