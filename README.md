# 薪有数 · 个人收入与个税规划

[![GitHub Pages](https://github.com/yanxinrui27/xinyoushu-tax-planner/actions/workflows/pages.yml/badge.svg)](https://github.com/yanxinrui27/xinyoushu-tax-planner/actions/workflows/pages.yml)

一个面向中国内地居民个人的纯前端收入与个税测算工具。它可以核对每月税后到手、社保公积金和累计扣缴，汇总年度收入，并通过引导问答发现可能遗漏的专项附加扣除。

**在线使用：** [https://yanxinrui27.github.io/xinyoushu-tax-planner/](https://yanxinrui27.github.io/xinyoushu-tax-planner/)

![月度精算测试案例展示](docs/screenshots/monthly-demo.png)

## 主要能力

- **政策找人：** 通过生活情况问答发现可能适用的七项专项附加扣除，说明命中原因、待确认条件和预计影响，再由用户确认是否写入申报台账。
- **月度精算：** 区分已发生、预测和未填写月份，计算工资、社保、公积金、工资个税、奖金税、当月到手及累计扣缴去向。
- **年度快算：** 可以汇总到当前月份，也可以直接填写年度总额；两种取数方式互不覆盖。
- **专项扣除申报台账：** 按项目、对象、月份、个人金额和使用环节记录，并检查额度、重复与住房互斥等冲突。
- **方案比较：** 比较奖金计税方式、已确认新增扣除和预算内个人养老金组合，同时展示最终税款与可支配现金。
- **公开直达：** 获得链接即可打开，不需要登录 GPT、GitHub 或注册任何账号。
- **本机数据：** 工资记录保存在当前浏览器，支持 JSON 完整备份及 CSV 明细导出。

## 五分钟开始使用

1. 打开[在线版本](https://yanxinrui27.github.io/xinyoushu-tax-planner/)，直接进入工作台。
2. 如果不确定自己可申报哪些项目，先进入“政策找人”完成四步问答。
3. 进入“月度精算”逐月录入，或进入“年度快算”直接填写年度金额。
4. 核对专项扣除申报台账，然后进入“个税筹划”比较可用方案。
5. 在“设置与备份”中导出 JSON 备份并妥善保存。

完整操作说明见 [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md)。

## 快速体验测试案例

仓库内置 4 组虚构测试案例，覆盖阶段汇总、完整年度奖金与筹划、年度自行填写和缺失月份阻断校验。

1. 打开在线版本，进入“设置与备份”。
2. 点击“导入备份”。
3. 选择 [`test-data`](test-data) 中的 JSON 文件。

推荐先导入 `01-月度汇总-截至10月.json`。它会显示 1—9 月“已发生”、10 月“预测”、11—12 月“未填写”，并生成截至 10 月的阶段汇总。测试金额均为虚构数据，详细预期见 [`test-data/README.md`](test-data/README.md)。

## 在本地运行

项目没有第三方运行依赖，也不需要构建。在仓库根目录执行：

```powershell
python -m http.server 8765 --directory dist
```

然后打开 [http://localhost:8765](http://localhost:8765)。页面使用 ES 模块，因此不能直接双击 `index.html`。

## 运行验证

```powershell
node test.mjs
node test-p01.mjs
node test-storage.mjs
node test-policy-finder.mjs
node test-public-access.mjs
```

当前共有 60 项自动检查，覆盖税率边界、累计预扣、奖金计税、扣除冲突、数据迁移、缺失月份、政策问答和公开直达。推送到 `main` 后，GitHub Actions 会先运行全部检查和浏览器模块语法检查，通过后才发布 GitHub Pages。

## 访问与数据边界

- 公开链接不要求登录 GPT、GitHub 或其他账号。
- 没有服务器数据库，工资和扣除数据不会上传。
- 记录只保存在当前网址对应的浏览器本地存储中，数据本身没有加密。
- 不支持跨设备自动同步，请定期导出备份。
- 更换域名、浏览器或设备前，必须先在旧环境导出备份，再到新环境导入。

安全模型和报告方式见 [`SECURITY.md`](SECURITY.md)。

## 适用范围

支持 2026、2027 年度，中国内地居民从年初在同一单位取得普通工资薪金，以及符合条件的全年一次性奖金场景。

暂不支持换工作、多单位、劳务报酬、境外所得、经营所得、减免税、特殊预扣、回款或销售提成优化。工具不能自动核验真实资格，结果需要与个人所得税 APP、凭证和税务机关口径核对。

## 项目结构

```text
dist/                       可直接发布的静态网页
  app.mjs                   页面状态与交互编排
  engine.mjs                个税和现金计算
  deductions.mjs            专项扣除台账规则
  policy-finder.mjs         主动式扣除发现规则
  storage.mjs               本机数据保存与迁移
  ui.mjs                    页面模板
  style.css                 响应式样式
.github/workflows/pages.yml 自动测试与 GitHub Pages 发布
test-*.mjs                  功能回归测试
test-data/                  虚构演示数据
docs/                       用户与架构文档
```

模块关系和核心不变量见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 文档

- [用户使用指南](docs/USER-GUIDE.md)
- [架构与数据流](docs/ARCHITECTURE.md)
- [部署和迁移](DEPLOYMENT.md)
- [安全与隐私](SECURITY.md)
- [参与开发](CONTRIBUTING.md)
- [P0/P1 验收范围](SPEC-P01.md)
- [政策找人功能规格](SPEC-POLICY-FINDER.md)
- [V3 流程与扣除录入](SPEC-V3.md)
- [V4 月份状态与年度取数](SPEC-V4.md)

## 参与开发

欢迎通过 Issue 提交可复现的问题或明确的改进建议。涉及税法规则的修改需要附上国家税务总局或其他主管机关的公开依据。提交代码前请阅读 [`CONTRIBUTING.md`](CONTRIBUTING.md) 并运行全部检查。
