# 时之界（FocusGuardian）

时之界是一款面向 Windows 的开源桌面时间管理工具。它通过识别当前前台应用、累计真实使用时长并执行每日额度，帮助用户减少娱乐软件带来的注意力消耗。

## 主要功能

- 从当前运行的 Windows 应用中创建限制规则
- 按工作日、自定义时段和每日额度执行限制
- 支持跨午夜时段，例如 `22:00—02:00`
- 实际前台使用时间统计与 7 天、30 天趋势
- 标准模式到时关闭应用，温和模式允许每天一次 5 分钟延长
- Windows 系统通知、空闲暂停、系统时间异常检测和后台托盘运行
- SQLite 本地持久化、旧版数据自动迁移与 CSV 导出

## 技术栈

- Electron 41
- Expo SDK 48
- React 18
- React Native / React Native Web
- Node.js 内置 SQLite

项目不依赖 Expo 云构建或 EAS 账号。Expo 仅用于前端构建工具链。

## 本地开发

环境要求：

- Windows 10 或 Windows 11
- Node.js 20+
- npm

安装依赖并启动 Web 开发环境：

```bash
npm install
npm run web
```

启动 Electron 桌面端：

```bash
npm run build:web
npm run desktop
```

生成 Windows 安装包和便携版：

```bash
npm run pack:win
```

构建结果位于本地 `release/` 目录，该目录不会提交到 Git。

## 数据与隐私

- 应用规则、设置和使用记录默认只保存在本机。
- SQLite 数据库位于 `%APPDATA%\ShiZhiJie\data.sqlite`。
- 正常卸载或升级不会主动删除数据库。
- 项目不会上传应用列表、使用记录或数据库内容。
- 仓库不应提交 `.env`、Expo/EAS 凭据、签名证书、数据库、日志或安装包。

如需彻底删除个人数据，请退出应用后手动删除 `%APPDATA%\ShiZhiJie`。

## 项目结构

```text
electron/       Electron 主进程、Windows 进程监控与 SQLite 持久化
src/            React Native Web 页面和组件
assets/         应用图标等静态资源
scripts/        本地验证脚本
web/            Web 入口与启动加载页面
App.js          应用界面入口与状态协调
```

## 安全说明

应用需要读取本机进程信息，并在标准限制模式下结束达到额度的目标进程。请在创建规则时核对应用名称和可执行文件路径，不要对系统关键进程设置限制。

如果发现安全问题，请不要在公开 Issue 中提交令牌、数据库、日志或其他个人信息。

## 参与贡献

欢迎提交 Issue 和 Pull Request。提交前请确保：

1. 没有包含个人数据、访问令牌或本机绝对路径。
2. `npm run build:web` 可以成功完成。
3. 与 Windows 进程管理相关的改动经过隔离测试。

## 许可证

本项目采用 [MIT License](./LICENSE)。
