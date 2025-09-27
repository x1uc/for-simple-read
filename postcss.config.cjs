// PostCSS 配置：将所有 CSS 中的 rem 转换为 px
// 说明：项目使用 @tailwindcss/vite 处理 Tailwind，本文件仅额外添加 rem->px 转换。
// 插件会在 Tailwind 产物之后运行，从而把 Tailwind 生成的 rem 一并转为 px，避免受宿主页面 <body> font-size 影响。

/** @type {import('postcss').ProcessOptions & { plugins: import('postcss').AcceptedPlugin[] }} */
module.exports = {
  plugins: [
    // 可选项：设置 baseValue 与设计稿一致（默认 16）。
    // 例：若希望 1rem == 10px，则设置 { baseValue: 10 }
    require('@thedutchcoder/postcss-rem-to-px')({
      // 按需修改：默认 16
      baseValue: 16,
    }),
  ],
};
