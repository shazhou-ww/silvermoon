# 验证分层证据

本文件服务于 Implementation 的 I-S01、I-S06 和 I-AC01/I-AC02，不是独立契约。

## 实施前基线

2026-09-30，本机 Windows、Node.js v24.11.1、pnpm 11.22.0，同一独立
worktree `silvermoon-test-validation-tiers`；源码 commit
`1435c77570080f0d497d22e0934eee90a2ad6e95`。依赖准备完成后，两个入口各预热一次，
随后顺序运行五次；不提高并发、不同时运行另一套测量。所有退出码均为 0。
本机非独占，无法排除其他会话的系统资源竞争。

墙钟由外层 Node `performance.now()` 测量（包含 pnpm 启动）；门禁耗时来自
既有 `CHECK_DURATION`。原始输出保存在会话 artifacts，以下保留全部数值，
不是仅保留中位数。

| 入口/门禁 | 预热 ms | 五次样本 ms | 中位数 ms |
| --- | --- | --- | --- |
| `check:quick` 墙钟 | 38,543 | 28,144; 19,587; 20,631; 20,816; 18,807 | 20,631 |
| `check` 墙钟 | 179,853 | 192,629; 120,542; 130,765; 139,614; 121,346 | 130,765 |
| `check` 内 lint | 3,076 | 5,578; 4,900; 3,567; 3,782; 3,286 | 3,782 |
| `check` 内 quick | 42,267 | 57,616; 39,129; 37,422; 39,110; 36,047 | 39,110 |
| `check` 内 integration | 114,714 | 156,815; 95,700; 106,097; 108,556; 95,777 | 106,097 |
| `check` 内 pack | 11,122 | 14,659; 12,398; 9,938; 11,410; 10,735 | 11,410 |
| `check` 内 E2E | 178,783 | 190,592; 119,303; 129,712; 138,498; 120,284 | 129,712 |
| `check` 内 skills | 15,608 | 26,339; 17,070; 14,213; 16,024; 14,628 | 16,024 |

`check:quick` 为 91 unit + 25 contract，共 116 项、25 个测试文件；
`check` 另外执行 120 integration（Windows 原有 2 项符号链接 skip）和
1 installed-package E2E，共 237 项、45 个测试文件。没有扩大 skip 或修改断言。

### 场景与 I/O/子进程归属

| 现有场景 | 对应入口 | I/O 与子进程 |
| --- | --- | --- |
| 日常 | `check:quick` | Node 语法检查、npm unit/contract 两套 runner、25 个测试 worker；adoption/CLI/dialogue 的真实 Git，trace 临时文件及 Windows 原生终端；无 package install |
| 提交前交付 | `check` | 六个并行门禁及其 package-manager shell/Node worker；真实 Git 仓库、临时文件、pack、npm install/exec、npx skills |
| 普通 CI | unit 矩阵、contract、integration | 本地对应成本见 full 内 quick/integration/skills；托管三平台双 Node 及排队时间不是本机墙钟 |
| 发布前 | `check` 及发布 workflow | 同上；workflow 另外做 ancestry、不可变 README/tarball、实际产物身份和安装；不在基线中触发发布 |
| 发布后 | `verify-npm-release.mjs` | 真实 registry、provenance、README/CDN；依赖具体已发布版本，不作为本地性能基线、不执行发布 |

子进程按职责及 runner 文件数盘点，不声称测得 OS 级总进程数或网络请求总数。
full 中 E2E 日志明确包含 pack、init、两次 install 和多次 exec；
skills 的 `npx skills add . --list` 可能访问外部工具缓存/网络。integration
的 Git fetch 使用隔离本地仓库；发布 helper 的网络响应使用 fixture。
这些工作不能进入 sanity；外部工具发现不能进入 commit 默认集合。

### 预先目标与并发限制

sanity 五次中位数 <= 10,315.5 ms；commit <= 65,382.5 ms，分别比对应原入口
改善至少 50%。该目标在任何验证行为变更前随 Implementation 契约发布。
确定性 guard、覆盖守恒和失败传播是独立必要条件，不能由快的样本替代。

测量后合并 primary `9fbce63cf348d079d4728afcaefba929da040b39`：
并发提交调整 README/移除兼容 avatar，更新对应 package/asset/E2E 断言，
另有其他 idea 记录和 integration 尾部空行；未改变测试数量、依赖或 runner。
后续比较明确包含该基线差异，不将这些变更或网络/cache 波动计作分层策略收益，
不为追求相同旧 revision 回退或改写并发历史。

## 实施后证据

尚未实施或验收。
