const sass = require('sass');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const fs = require('fs');
const path = require('path');

const scssPath = path.join(__dirname, '../src/renderer/scss/main.scss');
const outPath = path.join(__dirname, '../src/renderer/css/style.css');

async function build() {
  const startTime = Date.now();
  try {
    // 1. SCSS 内存编译
    const sassResult = sass.compile(scssPath, { style: 'expanded' });

    // 2. PostCSS + TailwindCSS 处理
    const result = await postcss([tailwindcss, autoprefixer]).process(sassResult.css, {
      from: scssPath,
      to: outPath
    });

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, result.css);
    console.log(`✓ [SCSS + Tailwind] 编译完成: ${path.relative(process.cwd(), outPath)} (${(result.css.length / 1024).toFixed(1)} KB, ${Date.now() - startTime}ms)`);
  } catch (err) {
    console.error('✗ [SCSS + Tailwind] 编译失败:', err);
  }
}

// 立即编译一次
build();

// 若传入 --watch 参数，开启监听
if (process.argv.includes('--watch')) {
  console.log('👀 正在监听 SCSS 和模板文件变动...');
  const scssDir = path.dirname(scssPath);
  const rendererDir = path.join(__dirname, '../src/renderer');

  let debounceTimer = null;
  const triggerRebuild = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      build();
    }, 150);
  };

  fs.watch(scssDir, { recursive: true }, triggerRebuild);
  fs.watch(rendererDir, { recursive: false }, triggerRebuild);
}
