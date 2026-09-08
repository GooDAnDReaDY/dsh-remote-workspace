# @goodandready/dsh-remote-workspace

适用于 **DeepSeek Harness (DSH)** 的企业级远程工作区插件：
- 🚀 **SSH2 连接池**：基于 SSH2 的高性能连接池，支持心跳保活、自动重连与延迟（Ping）诊断。
- 📁 **SFTP 文件系统**：流式读取、原子安全写入、远程目录遍历与属性查询。
- 🔄 **三向镜像同步 (Mirror Sync)**：基于 SHA-256 状态快照的双向冲突感知同步，杜绝静默覆盖代码。
- 🌐 **SSH 端口转发**：深度集成本地与反向端口转发隧道。
- 🤖 **精简模型工具**：4 个正交的核心工具（`remote_exec`、`remote_fs`、`remote_sync`、`remote_tunnel`），避免上下文膨胀。
- 🎨 **原生 DSH UI**：符合 DSH 设计规范的设置卡片、连接测试器与远程目录选择器。
