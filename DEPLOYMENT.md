# 部署、发布与数据迁移

## 当前生产环境

- 代码仓库：[yanxinrui27/xinyoushu-tax-planner](https://github.com/yanxinrui27/xinyoushu-tax-planner)
- 生产地址：[https://yanxinrui27.github.io/xinyoushu-tax-planner/](https://yanxinrui27.github.io/xinyoushu-tax-planner/)
- 生产分支：`main`
- 发布目录：`dist`
- 发布方式：GitHub Actions → GitHub Pages

## 仓库存放原则

仓库只保存程序、测试、规格、虚构案例和文档。以下内容禁止提交：

- 用户导出的 JSON 备份；
- 月度或年度 CSV；
- 真实工资表；
- 身份、医疗、贷款或家庭成员资料；

工资、扣除和测算结果只保存在访问者浏览器。GitHub Pages 托管的 `dist/` 不包含用户数据。

## 自动发布流程

`.github/workflows/pages.yml` 在以下情况运行：

- 向 `main` 推送提交；
- 在 GitHub Actions 页面手动触发。

发布门禁按顺序执行：

1. 运行核心计算测试；
2. 运行 P0/P1 功能测试；
3. 运行本机存储和迁移测试；
4. 运行政策找人规则测试；
5. 运行本机账号、密码及账号数据隔离测试；
6. 检查浏览器模块语法；
7. 上传 `dist/`；
8. 发布 GitHub Pages。

任何检查失败都会阻止本次部署。

## 手动发布前检查

```powershell
node test.mjs
node test-p01.mjs
node test-storage.mjs
node test-policy-finder.mjs
node test-public-access.mjs
git status --short
```

确认通过后提交并推送：

```powershell
git add .
git commit -m "Describe the change"
git push origin main
```

进入仓库的 `Actions` 页面查看 `Deploy web app to GitHub Pages`。工作流成功后，再打开生产地址验证首页、模块资源和主要流程。

## GitHub Pages 初次配置

如果从新仓库重新部署：

1. 将项目推送到 `main`。
2. 打开 `Settings → Pages`。
3. 在 `Build and deployment` 中选择 `GitHub Actions`。
4. 手动运行或重新推送一次 Pages 工作流。
5. 确认工作流展示的公开地址。

GitHub Pages 网站对互联网公开。公开仓库和网页都不能存放真实个人工资数据。

## 数据迁移

浏览器数据按“协议 + 域名 + 端口”隔离。下面这些环境互不共享数据：

- `localhost` 与正式网址；
- `github.io` 与自定义域名；
- Chrome 与 Edge；
- 不同电脑或手机。

迁移步骤：

1. 在旧网址导出完整 JSON 备份。
2. 直接打开新网址。
3. 进入“设置与备份”导入 JSON。
4. 核对年度、月份、扣除台账和计算结果。
5. 确认完成后再把新网址设为日常入口。

## 回滚

如果最新版本出现严重问题：

1. 找到最后一个验证通过的提交；
2. 创建一个正常的回退提交恢复相关文件；
3. 推送到 `main`；
4. 等待完整测试和 Pages 重新发布；
5. 验证生产地址。

不要强制改写公开分支历史。数据结构有变化时，必须同时评估浏览器存量记录的迁移兼容性。

## 其他托管平台

### Cloudflare Pages

- 生产分支：`main`
- 构建命令：留空
- 输出目录：`dist`

### Vercel

- Framework Preset：`Other`
- 构建命令：留空
- 输出目录：`dist`

迁移到其他平台不会自动迁移浏览器数据。新网址不需要登录 GPT 或 GitHub，但仍会显示本机账号登录页；自建账号需要在新网址重新创建并导入备份。

## 自定义域名

绑定自定义域名后应启用 HTTPS，并重新测试：

- 公开链接可以在不同设备打开，默认演示账号可以正常登录并加载虚构案例；
- 新建其他本机账号后显示空白数据；
- 月度和年度计算；
- JSON 备份导出与导入；
- 手机布局；
- 旧域名到新域名的数据迁移说明。
