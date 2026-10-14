# Deployment

## Steps

### D-S01: 验证 packaged CLI

从 npm pack 产物运行 page/search，覆盖三种 bundled Objectives 与两种语言，
并比较查询前后的隔离安装文件哈希以证明只读。

### D-S02: 发布 Reference 导航说明

核对公开 Reference 导航说明中的命令、ID 形式、404、无结果和内部链接行为，
并从隔离 device runtime 执行文档示例。

## Acceptance criteria

### D-AC01: 安装产物可查询

[`evidence.md`](./evidence.md) 记录的隔离安装 corpus 证明 packaged resources
完整，三种 Objective 的双语 page/search 可查询且查询保持只读。

### D-AC02: 文档示例可执行

[`evidence.md`](./evidence.md) 记录公开 page/search、problem 详情、check 说明、
无结果与搜索后导航示例的执行结果，以及 release-grade 文档验证。
