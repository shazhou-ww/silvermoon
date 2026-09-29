# Deployment

## Steps

### D-S01: 通过受保护标签发布明确授权的版本

在实现获得验收且用户明确授权目标版本后，从刷新后的 `origin/main` 创建对应
不可变 `npm/silvermoon/v<version>` 标签。只由 GitHub Actions trusted
publishing workflow 发布，不运行本地发布命令或创建额外 release commit。

### D-S02: 核对注册表与发布产物身份

等待精确 tag 的 workflow 完成，核对其数据库 ID、提交、结论和 provenance。
从 npm 注册表读取目标版本与 dist-tag，下载已发布 tarball，并将 registry
integrity、文件清单和 README 与 workflow 记录的候选逐项比较。

### D-S03: 验证公开 README 与资产兼容性

检查 npm 包级 README 与 tarball README 的图片地址，访问 commit 固定的
jsDelivr SVG，并确认 npm 页面正确渲染。直接访问历史 raw GitHub 路径，确认
已有 README 和外部消费者仍能获取兼容内容。

## Acceptance criteria

### D-AC01: 发布来源可追溯到受保护主分支

目标 npm 版本由成功的 `Publish npm package` workflow 发布；其 tag 和
provenance 指向同一个 `origin/main` 可达提交，仓库中不存在承载该版本的
off-main release commit。通过 Git ancestry、workflow 元数据、tag 和 npm
provenance 证明。

### D-AC02: 注册表提供经过验证的同一产物

npm 目标版本和预期 dist-tag 可查询，registry integrity 与 workflow 中唯一
tarball 的记录一致；下载后的文件清单、版本、CLI 冒烟结果和 README 内容均与
发布候选一致。通过 registry metadata、tarball 检查和全新安装证明。

### D-AC03: 公开 README 使用不可变 CDN 资源

npm 包级 README 与 tarball README 均只使用包含完整发布提交的 jsDelivr
资产 URL，不含 `@main`、`HEAD` 或 raw GitHub 可移动资源地址；主视觉和头像
返回预期安全 SVG，npm 页面实际显示两张图片。通过 registry README、tarball
README、HTTP 响应和渲染检查证明。

### D-AC04: 历史资产 URL 保持可用

变更前已经公开的根级主视觉和 `docs/assets` 头像 URL 继续返回与 canonical
文件一致的内容，已发布 npm 页面不因本次布局调整断图。通过直接请求旧 URL、
比较响应字节并检查代表性历史版本页面证明。
