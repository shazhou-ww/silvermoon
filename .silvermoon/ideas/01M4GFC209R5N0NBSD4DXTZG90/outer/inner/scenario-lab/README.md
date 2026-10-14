# What's-next scenario lab

这个实验环境只把 review 准备材料和生成语料写入当前 idea 的
`outer/inner/scenario-lab/`。Docker image 在容器内从当前 checkout 构建并运行
`pnpm setup:dev`，把该 checkout 链接为容器设备的全局 `silvermoon` runtime，并将
canonical skill 链接到容器个人 discovery 路径。

## 运行初始语料采集

在 Windows PowerShell 中运行：

```powershell
.\.silvermoon\ideas\01M4GFC209R5N0NBSD4DXTZG90\outer\inner\scenario-lab\run.ps1
```

脚本先在空的容器用户目录内执行 `pnpm setup:dev`，完成设备 runtime 与 canonical
skill 整备后，再开始运行命令。脚本要求 Docker Desktop Linux engine 已启动。容器
将 checkout 复制到隔离的
`/workspace`，建立本地 bare primary；Git 把项目配置中的 canonical HTTPS primary
URL 定向到该 bare repository，不访问或写入真实远端。初始场景采集所选 idea 当前
状态、不带 selector 的导航、selector not found，以及设备与 repository 的首批失败
状态，各运行 `en-US`、`zh-CN`。

输出按时间写入 `corpus/<UTC timestamp>/`，包含完整 stdout、必要的 stderr 和记录
source revision/dirty 状态、runtime version、locale 与 argv 的 `manifest.json`。
同一目录的 `review.html` 将每个 scenario 分页展示，英文与中文原文并排，并提供
标题、表格、列表、引用和代码等 Markdown 组件渲染，以及 OK/有问题、冗余、缺失
和缺少提示的评审字段。修改保存在浏览器 localStorage，可导出或导入与 source
revision 绑定的 JSON。
`corpus/` 被本目录 `.gitignore` 排除；其中报告只用于本地 review，不作为 idea
contract 或提交内容。

## 状态转移扩展

`scenarios.json` 只声明待运行 case，不含任意 shell 命令。后续状态转移按
`scenario-graph.md` 为每个 check 建立具名、可验证的状态操作：确保前序通过、
构造目标失败、采集完整报告、修复并验证唯一通过出口，再推进主链。不可逆或互斥
problem 状态从最近 checkpoint 派生场景。没有为每个 case 重置设备或项目。
