# Web 发布与代码存放方案

## 推荐结构

本项目是无后端、无构建步骤的静态 Web 应用。仓库保存源码和测试，发布平台只托管 `dist/`：

```text
dist/                       可直接发布的网页
  index.html
  app.mjs
  engine.mjs
  deductions.mjs
  storage.mjs
  ui.mjs
  style.css
.github/workflows/pages.yml GitHub Pages 自动发布
test*.mjs                   计算与存储测试
SPEC-P01.md                 功能边界和验收条件
README.md                   项目说明
```

工资、扣除和测算结果不写入 GitHub，也不上传到托管平台。它们只保存在访问者当前浏览器的 `localStorage` 中。用户应定期导出 JSON 备份；公开仓库中不要提交任何个人备份、CSV、工资表或真实身份信息。

`.openai/hosting.json` 只用于当前 Sites 发布项目。建立独立 GitHub 仓库时，请先复制项目到一个新目录，并在副本中删除 `.openai/` 后再初始化 Git 仓库；不要从当前 Sites 项目中删除它。GitHub Pages、Cloudflare Pages 和 Vercel 都不需要这个文件。

## 更换网址前的数据迁移

浏览器本地记录按网站域名隔离。当前网址里的记录不会自动出现在新的 `github.io`、`pages.dev`、`vercel.app` 或自定义域名中，不同浏览器和不同设备之间也不会自动同步。更换正式网址前，应在旧网址导出完整 JSON 备份，再到新网址导入；确认数据无误后再把新网址作为日常入口。

## 方案一：公开 GitHub 仓库 + GitHub Pages

适合开源、演示或个人作品。仓库免费公开，网页地址通常为：

```text
https://<GitHub用户名>.github.io/<仓库名>/
```

1. 在 GitHub 新建空仓库，把本项目根目录推送到 `main` 分支。
2. 打开仓库 `Settings → Pages`。
3. 在 `Build and deployment` 中选择 `GitHub Actions`。
4. 推送 `main` 后，`.github/workflows/pages.yml` 会自动发布 `dist/`。
5. 在 Actions 中确认 `Deploy web app to GitHub Pages` 成功，再打开 Pages 给出的地址。

GitHub Pages 站点本身对互联网公开，即使付费计划允许从私有仓库发布，也不能把网页访问权限理解为私有。请始终只发布程序文件，不发布用户数据。

## 方案二：私有 GitHub 仓库 + Cloudflare Pages（推荐正式使用）

适合保留源码私有，同时提供任何浏览器都能打开的公开网址。

1. 把本项目放入私有 GitHub 仓库。
2. 在 Cloudflare Pages 连接该仓库，生产分支选 `main`。
3. 构建命令留空或使用 `exit 0`，输出目录填写 `dist`。
4. 首次部署后得到 `https://<项目名>.pages.dev`。
5. 需要品牌网址时，再绑定自己的域名并开启 HTTPS。

Cloudflare 会在每次推送后自动发布，并可为分支或 Pull Request 提供预览地址。

## 方案三：私有 GitHub 仓库 + Vercel

同样支持 GitHub 自动部署和预览地址。导入仓库时选择静态项目，输出目录填写 `dist`，无需安装依赖或执行构建。适合以后增加前端框架或服务端能力，但当前纯静态项目使用 Cloudflare Pages 更直接。

## 自定义域名

可以购买一个域名，例如 `tax.example.com`，绑定到 GitHub Pages、Cloudflare Pages 或 Vercel。域名只负责访问入口，不应改变本工具的本地数据存储方式。配置后应强制 HTTPS，并同时测试首页、模块加载、备份导出和手机布局。

## 发布前检查

```powershell
node test.mjs
node test-p01.mjs
node test-storage.mjs
```

检查通过后再推送 `main`。如果未来增加账号、多设备同步或团队共享，需要单独设计身份认证、数据库、加密、备份与隐私策略；不要使用 GitHub 仓库或静态站点保存个人工资数据。
