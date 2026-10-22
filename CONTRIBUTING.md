# 参与开发

## 开始之前

本项目是原生 HTML、CSS 和 ES 模块应用，没有包管理器或构建步骤。需要 Python 3 用于本地静态服务，需要支持 Web Crypto 的现代浏览器和 Node.js 20 或更高版本用于测试。

```powershell
git clone https://github.com/yanxinrui27/xinyoushu-tax-planner.git
cd xinyoushu-tax-planner
python -m http.server 8765 --directory dist
```

打开 [http://localhost:8765](http://localhost:8765) 开始检查。

## 修改原则

- 金额在计算层统一使用整数“分”，不要引入浮点金额运算。
- 不要把未填写数据转换为 0。
- 新增扣除规则必须保留资格确认、政策依据、适用月份和个人金额边界。
- 主动提示只能输出候选与核对事项，不能直接认定用户具备税务资格。
- 不要把真实工资、备份、CSV 或身份资料提交到仓库。
- 不要增加外部统计、广告或网络请求，除非相应隐私设计已经明确评审。

## 税务规则修改

涉及税率、扣除标准、政策有效期或资格条件的改动，需要：

1. 引用国家税务总局、财政部、国务院或其他主管机关的公开文件；
2. 记录适用年度和政策核对日期；
3. 增加边界值及不适用场景测试；
4. 更新相关规格和用户说明。

## 提交前验证

```powershell
node test.mjs
node test-p01.mjs
node test-storage.mjs
node test-policy-finder.mjs
node test-public-access.mjs
node --check dist/app.mjs
node --check dist/ui.mjs
```

还应在桌面和窄屏下检查：

- 公开链接无需账号即可进入工作台；
- 月度与年度两步流程；
- 页面确认框；
- JSON 备份导出与导入；
- 未填写月份的阻断提示；
- 键盘焦点、标签和按钮文案。

## Pull Request 内容

请说明：

- 解决的具体问题；
- 用户可观察到的变化；
- 税务或安全依据；
- 已运行的测试；
- 数据迁移或兼容性影响。

一个 Pull Request 尽量只解决一类问题。涉及计算规则和视觉调整时，应让计算改动可以独立审查。
