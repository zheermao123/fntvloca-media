const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    isMpvPlaybackEnabled,
} = require('../dest/modules/fn_config/playbackPreference.js');

test('keeps the historical MPV default while rejecting malformed values', () => {
    assert.equal(isMpvPlaybackEnabled(true), true);
    assert.equal(isMpvPlaybackEnabled(false), false);
    assert.equal(isMpvPlaybackEnabled(undefined), true);
    assert.equal(isMpvPlaybackEnabled(null), false);
    assert.equal(isMpvPlaybackEnabled('true'), false);
    assert.equal(isMpvPlaybackEnabled(1), false);
    assert.equal(isMpvPlaybackEnabled({ value: true }), false);
});

test('preload timeout and login settings default to MPV playback', () => {
    const preloadPlayback = fs.readFileSync(
        path.join(__dirname, '..', 'dest', 'preload', 'core', 'playback.js'),
        'utf8',
    );
    const loginPage = fs.readFileSync(
        path.join(__dirname, '..', 'resource', 'login', 'index.html'),
        'utf8',
    );

    assert.match(preloadPlayback, /resolve\(\{ hideOriginalPlayButton: true \}\)/);
    assert.match(loginPage, /id="hideOriginalPlayButtonSwitch" checked/);
    assert.match(loginPage, /data\.hideOriginalPlayButton !== false/);
});
