# 依赖评估证据

本文件服务于 Implementation 的 I-S01 至 I-S03 及 I-AC01 至 I-AC03，
不是独立契约。

## 版本与上游边界

- Commander `15.0.0` 于 2026-05-29 转为 ESM-only，并要求
  Node.js `>=22.12.0`；同时调整了正反布尔选项默认值并改进过量参数错误。
  来源为
  [v15.0.0 changelog](https://github.com/tj/commander.js/blob/v15.0.0/CHANGELOG.md)。
- 当前锁文件中的 `@jitl/opentui-react@0.4.0` 要求
  `react-devtools-core: ^7.0.1` 与 `ws: ^8.18.0`。项目直接声明
  `react-devtools-core: ^7.0.1`、`ws: ^8.22.0`，两者允许范围均为对应
  peer 范围的子集；因此不采纳脱离上游边界的 `react-devtools-core@8`。
- `string-width@8.3.0` 基于 grapheme segmentation 和 East Asian Width；
  `fast-string-width@3.0.2` 使用分类正则与快速扫描。实现来源分别为
  [string-width index.js](https://github.com/sindresorhus/string-width/blob/v8.3.0/index.js)
  和
  [fast-string-truncated-width index.ts](https://github.com/fabiospampinato/fast-string-truncated-width/blob/v3.0.2/src/index.ts)。

## 宽度语义与基准

评估日期为 2026-10-09。环境为 Windows NT 10.0.26220 x64、
Intel Core i9-10900X（20 logical CPUs）、Node.js v24.11.1、pnpm 11.22.0。
机器非独占，数据只用于判断数量级，不作为通用性能承诺。

同一进程先预热每种实现 60,000 次，然后对 12 个代表性表格值运行
9 组样本；每组 600,000 次调用，奇偶样本反转执行顺序。原始 JSON 保存在
本次会话 artifact `width-evaluation.json`。

| 实现 | 9 组耗时（ms） | 中位数 | 中位吞吐 |
| --- | --- | ---: | ---: |
| `string-width` | 3748.554; 8100.955; 4426.156; 3124.324; 3155.712; 2955.005; 2995.991; 2944.925; 2963.134 | 3124.324 ms | 192,042 ops/s |
| `fast-string-width` 默认 | 337.316; 285.988; 229.843; 217.027; 211.230; 189.579; 215.751; 205.150; 201.071 | 215.751 ms | 2,780,984 ops/s |
| `fast-string-width` 兼容选项 | 299.226; 292.323; 216.745; 221.393; 197.563; 196.627; 198.794; 187.846; 189.982 | 198.794 ms | 3,018,192 ops/s |

兼容选项将 tab/control/emoji/regular/wide 宽度设为 `0/0/2/1/2`。
即使如此，语义仍有以下差异：

| 语料 | `string-width` | fast 默认 | fast 兼容选项 |
| --- | ---: | ---: | ---: |
| `a<TAB>b` | 2 | 10 | 2 |
| 未限定 keycap `1 U+20E3` | 2 | 1 | 1 |
| Hangul jamo `U+1100 U+1161` | 2 | 4 | 4 |
| soft hyphen `U+00AD` | 0 | 1 | 1 |
| zero-width joiner `U+200D` | 0 | 1 | 1 |

## 决策

Commander 升级到 v15，并同步项目 Node.js 下限；CLI 回归锁定冲突选项、
无效值、过量参数和安装包入口。

OpenTUI peers 继续作为直接 runtime 依赖，并由契约测试证明项目范围不会
越过锁文件中的上游 peer 范围。

`fast-string-width` 的速度优势明确，但终端宽度语义不等价，而当前表格规模
不足以证明替换收益大于兼容风险，因此保留 `string-width`。单元格中的 tab
在输出前规范化为四个空格，避免把位置相关的终端 tab stop 当作固定宽度；
Unicode、ANSI、emoji、组合字符、keycap 与 Hangul jamo 纳入表格回归。

## 验证结果

以下命令均于 2026-10-09 在上述环境退出 0：

- `pnpm install --frozen-lockfile`；
- `node --test test/unit/cli-v1.test.ts test/unit/tui.test.ts
  test/contract/dependency-policy.test.ts`，16 项通过；
- `pnpm typecheck`；
- `pnpm check:sanity`；
- `pnpm check:commit`；
- `pnpm check`，包含 build、完整 contract/integration、pack、
  installed-package E2E 与 skills 检查。

最终 `package.json` 与 `pnpm-lock.yaml` 不含 `fast-string-width`；
Commander 解析为 `15.0.0`，冻结锁文件安装和完整发布级检查均通过。
