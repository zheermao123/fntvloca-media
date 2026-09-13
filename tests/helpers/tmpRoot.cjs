// 测试临时目录统一放在项目路径内的 tmp/tests（遵循"临时文件不出项目路径"约束）
const fs = require('node:fs');
const path = require('node:path');

const TMP_ROOT = path.join(__dirname, '..', '..', 'tmp', 'tests');

function makeTmpDir(prefix) {
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    return fs.mkdtempSync(path.join(TMP_ROOT, prefix));
}

module.exports = { TMP_ROOT, makeTmpDir };
