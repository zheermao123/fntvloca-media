const test = require('node:test');
const assert = require('node:assert/strict');
const { extractItemGuidFromUrl, isItemGuid } = require('../dest/preload/core/playTarget.js');

const GUID = '0123456789abcdef0123456789abcdef';

test('extracts item guid from legacy routes', () => {
    assert.equal(extractItemGuidFromUrl(`https://nas.local/v/movie/${GUID}`), GUID);
    assert.equal(extractItemGuidFromUrl(`https://nas.local/v/tv/episode/${GUID}?tab=info`), GUID);
    assert.equal(extractItemGuidFromUrl(`https://nas.local/v/other/${GUID}/`), GUID);
});

test('extracts item guid from current generic and hash routes', () => {
    assert.equal(extractItemGuidFromUrl(`https://nas.local/v/detail/${GUID}`), GUID);
    assert.equal(extractItemGuidFromUrl(`https://nas.local/#/v/video/${GUID}`), GUID);
    assert.equal(extractItemGuidFromUrl(`https://nas.local/player?item_guid=${GUID}`), GUID);
});

test('supports prefixed and UUID identifiers without accepting unrelated pages', () => {
    const prefixed = `fv_${GUID}`;
    const uuid = '123e4567-e89b-42d3-a456-426614174000';
    assert.equal(extractItemGuidFromUrl(`https://nas.local/v/item/${prefixed}`), prefixed);
    assert.equal(extractItemGuidFromUrl(`https://nas.local/v/play/${uuid}`), uuid);
    assert.equal(extractItemGuidFromUrl('https://nas.local/v/library'), null);
    assert.equal(isItemGuid(prefixed), true);
    assert.equal(isItemGuid('library'), false);
});
