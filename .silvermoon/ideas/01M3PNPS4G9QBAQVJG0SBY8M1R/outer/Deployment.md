# Deployment

## Steps

### D-S01: 核验 GitHub 主分支 README

在配置的 primary 上读取已发布的完整 commit，通过 GitHub 托管页面检查英文和
中文 README 的项目 logo 与 mascot 均已渲染。对页面解析出的四个图片地址执行
外部 HTTP 请求，确认状态为成功且内容类型为图片，并将响应字节与该 primary
commit 中对应的 `assets/` 文件比较。完成后在 ledger 记录 commit、页面和图片
地址、HTTP 状态与内容类型。此部署只验证 GitHub 展示，不创建 npm release tag，
也不执行 npm 发布。

## Acceptance criteria

### D-AC01: 两种语言 README 的项目图片在线可用

GitHub primary 上的英文和中文 README 页面均成功响应并渲染项目 logo 与
mascot；页面解析出的四个图片地址均返回成功状态和图片内容，且响应字节分别
匹配同一 primary commit 中的对应资源。通过记录页面与图片 URL、HTTP 状态、
内容类型、primary commit，以及与该 commit 资源内容的比较结果证明。
