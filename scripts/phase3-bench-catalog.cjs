/**
 * B-01 目录分页性能基准（合成数据，不读取真实用户库）
 *
 * 用法：node scripts/phase3-bench-catalog.cjs [movies] [shows] [episodesPerShow]
 * 默认：17000 电影 + 500 剧 × 8 集。
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MOVIES = Number(process.argv[2] ?? 17000);
const SHOWS = Number(process.argv[3] ?? 500);
const EPISODES = Number(process.argv[4] ?? 8);

const ROOT = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fntv-catalog-bench-'));
const dbDir = path.join(tmp, 'library');
fs.mkdirSync(dbDir, { recursive: true });

const { createLibraryStore } = require(path.join(ROOT, 'dest', 'modules', 'library', 'store.js'));
const { buildCatalog } = require(path.join(ROOT, 'dest', 'modules', 'library', 'catalog.js'));

const store = createLibraryStore(dbDir);
const movieSource = store.addSource({
    type: 'local',
    name: 'Bench Movies',
    config: { rootPath: 'E:\\bench', category: 'movie' },
});
for (let i = 0; i < MOVIES; i += 1) {
    store.upsertItem({
        sourceId: movieSource.id,
        kind: 'movie',
        title: `Bench Movie ${String(i).padStart(5, '0')}`,
        year: 1990 + (i % 35),
        filePath: `E:\\bench\\movies\\m${i}.mp4`,
        fileSize: 1024,
        resolution: '1080p',
    });
}
const tvSource = store.addSource({
    type: 'local',
    name: 'Bench TV',
    config: { rootPath: 'E:\\bench-tv', category: 'tv' },
});
for (let s = 0; s < SHOWS; s += 1) {
    const { show } = store.upsertShow({
        sourceId: tvSource.id,
        groupKey: `bench-show-${s}`,
        title: `Bench Show ${String(s).padStart(4, '0')}`,
        year: 2000 + (s % 25),
    });
    for (let e = 1; e <= EPISODES; e += 1) {
        store.upsertItem({
            sourceId: tvSource.id,
            kind: 'episode',
            showId: show.id,
            title: `Bench Show ${s}`,
            season: 1,
            episode: e,
            filePath: `E:\\bench-tv\\s${s}\\e${e}.mkv`,
            fileSize: 1024,
            resolution: '1080p',
        });
    }
}

function bench(label, query, runs = 3) {
    const samples = [];
    let entries = 0;
    for (let i = 0; i < runs; i += 1) {
        const start = process.hrtime.bigint();
        entries = buildCatalog(store, query).length;
        samples.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    samples.sort((a, b) => a - b);
    return {
        label,
        entries,
        minMs: Number(samples[0].toFixed(1)),
        medianMs: Number(samples[Math.floor(samples.length / 2)].toFixed(1)),
        maxMs: Number(samples[samples.length - 1].toFixed(1)),
    };
}

const results = [
    bench('movies limit=600 added', { category: 'movie', limit: 600 }),
    bench('tv limit=600 added', { category: 'tv', limit: 600 }),
    bench('all limit=600 added', { limit: 600 }),
    bench('all no limit', {}, 1),
];

console.log(
    JSON.stringify(
        {
            fixture: { movies: MOVIES, shows: SHOWS, episodesPerShow: EPISODES, items: store.countItems() },
            results,
        },
        null,
        2
    )
);

store.close?.();
fs.rmSync(tmp, { recursive: true, force: true });
