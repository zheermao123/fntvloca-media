const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const mapper = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'pages', 'detail', 'detail.mapper.js'));

function episode(id, season, num, extra = {}) {
    return {
        id,
        kind: 'episode',
        title: 'Show',
        year: 2020,
        posterPath: null,
        overview: null,
        rating: null,
        runtime: null,
        filePath: `E:\\media\\Show.S0${season}E0${num}.mkv`,
        fileSize: 1024 * 1024 * 700,
        resolution: '1080p',
        season,
        episode: num,
        episodeTitle: `第 ${num} 集`,
        ...extra,
    };
}

test('movie detail maps real fields, file info and play target', () => {
    const model = mapper.mapMovieDetail({
        id: 'item-1',
        kind: 'movie',
        title: 'Movie A',
        year: 2020,
        posterPath: 'a.jpg',
        overview: 'plot',
        rating: 8.5,
        runtime: 120,
        filePath: 'E:\\movies\\Movie.A.mkv',
        fileSize: 1536,
        resolution: '2160p',
        season: null,
        episode: null,
        episodeTitle: null,
    });
    assert.equal(model.kind, 'movie');
    assert.equal(model.playTargetId, 'item-1');
    assert.equal(model.playLabel, '播放');
    const labels = model.meta.map((item) => item.label);
    assert.deepEqual(labels, ['年份', '类型', '清晰度', '时长', '评分']);
    assert.equal(model.file.name, 'Movie.A.mkv');
    assert.equal(model.file.sizeLabel, '1.5 KB');
    assert.equal(model.file.resolution, '2160p');
});

test('season detail resumes the latest in-progress episode and labels continue play', () => {
    const episodes = [episode('e1', 1, 1), episode('e2', 1, 2), episode('e3', 1, 3)];
    const states = {
        e1: { watched: true, positionTs: 1000, durationTs: 1000, lastPlayedAt: 10 },
        e2: { watched: false, positionTs: 400, durationTs: 1000, lastPlayedAt: 20 },
        e3: { watched: false, positionTs: 0, durationTs: 0, lastPlayedAt: null },
    };
    const model = mapper.mapSeasonDetail({ id: 's1', title: 'Show A', year: 2020, posterPath: null, overview: null }, 1, episodes, states);
    assert.equal(model.kind, 'season');
    assert.equal(model.title, 'Show A 第 1 季');
    assert.equal(model.playTargetId, 'e2');
    assert.equal(model.playLabel, '继续播放');
    assert.ok(model.meta.some((item) => item.label === '续播进度' && item.value === '40%'));
    assert.equal(model.episodes.length, 3);
    assert.deepEqual(model.episodes[1], { id: 'e2', label: 'S01E02', title: '第 2 集', stateText: '已看 40%' });
});

test('resume falls back to first unwatched episode then first episode', () => {
    const episodes = [episode('e1', 1, 1), episode('e2', 1, 2)];
    const allWatched = {
        e1: { watched: true, positionTs: 1000, durationTs: 1000, lastPlayedAt: 1 },
        e2: { watched: true, positionTs: 1000, durationTs: 1000, lastPlayedAt: 2 },
    };
    assert.equal(mapper.pickResumeEpisode(episodes, allWatched).id, 'e1');
    assert.equal(mapper.pickResumeEpisode([], {}), null);
    const firstUnwatched = {
        e1: { watched: true, positionTs: 1000, durationTs: 1000, lastPlayedAt: 1 },
    };
    assert.equal(mapper.pickResumeEpisode(episodes, firstUnwatched).id, 'e2');
});

test('file helpers are robust', () => {
    assert.equal(mapper.formatFileSize(0), '未知大小');
    assert.equal(mapper.formatFileSize(1536), '1.5 KB');
    assert.equal(mapper.formatFileSize(1024 * 1024 * 700), '700 MB');
    assert.equal(mapper.basenameOf('E:\\a\\b\\c.mkv'), 'c.mkv');
    assert.equal(mapper.basenameOf('/mnt/a/b.mkv'), 'b.mkv');
});
