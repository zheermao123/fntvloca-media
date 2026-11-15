const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const privacy = require(path.join(__dirname, '..', 'dest', 'modules', 'library', 'privacy.js'));

test('privacy password validation enforces trimmed minimum length', () => {
    assert.equal(privacy.isValidPrivacyPassword('abcd'), true);
    assert.equal(privacy.isValidPrivacyPassword('   ab'), false);
    assert.equal(privacy.isValidPrivacyPassword('abc'), false);
    assert.equal(privacy.isValidPrivacyPassword(1234), false);
    assert.equal(privacy.PRIVACY_PASSWORD_MIN_LENGTH, 4);
});

test('scrypt hash verifies only the correct password', () => {
    const hash = privacy.hashPrivacyPassword('E2E-Pass-123');
    assert.match(hash, /^scrypt\$\d+\$[^$]+\$[^$]+$/);
    assert.equal(privacy.verifyPrivacyPassword('E2E-Pass-123', hash), true);
    assert.equal(privacy.verifyPrivacyPassword('wrong-pass', hash), false);
    assert.equal(privacy.verifyPrivacyPassword('E2E-Pass-123', null), false);
    assert.equal(privacy.verifyPrivacyPassword('E2E-Pass-123', 'broken'), false);
    assert.equal(privacy.verifyPrivacyPassword('E2E-Pass-123', 'scrypt$x$bad$bad'), false);
});

test('salt makes hashes unique and unlock state is memory-only toggle', () => {
    const a = privacy.hashPrivacyPassword('same-password');
    const b = privacy.hashPrivacyPassword('same-password');
    assert.notEqual(a, b);
    assert.equal(privacy.verifyPrivacyPassword('same-password', a), true);
    assert.equal(privacy.verifyPrivacyPassword('same-password', b), true);

    privacy.setPrivacyUnlocked(false);
    assert.equal(privacy.isPrivacyUnlocked(), false);
    privacy.setPrivacyUnlocked(true);
    assert.equal(privacy.isPrivacyUnlocked(), true);
    privacy.setPrivacyUnlocked(false);
});
