# Su-Komari-Theme-SAO 协作说明

## 默认发布流程

完成本仓库的一项修改任务后，默认先本地提交，再发布 GitHub Release，最后推送源码分支。除非用户对当次任务另有指示，这项授权适用于本子仓库。父项目的提交、推送和子模块指针更新仍按父项目的授权规则执行。

1. 按本次变动选择尚未使用的版本号，同步 `package.json`、`package-lock.json` 和 `komari-theme.json`，在 `.github/release-notes/v<版本号>.md` 记录用户可见的变化。沿用 Komari 安装标识 `Su-SAO`。按父项目要求使用 `【苏忆】` 署名，将本次修改与发布准备合入本地提交。
2. 在发布提交上运行 `npm run lint`、`npm test` 和 `npm run release`。确认生成的 `Su-Komari-Theme-SAO-v<版本号>.zip` 可解压，包含根目录的 `komari-theme.json`、`LICENSE`、`preview.png` 和 `dist/index.html`，并且包内清单的版本和安装标识正确。
3. 给该提交创建 `v<版本号>` 标签，先将标签推送到 `origin`，由 `.github/workflows/build-package.yml` 发布。若工作流未完成发布，且没有排队或运行中的发布任务，使用 GitHub CLI 从已有远端标签发布已校验的 ZIP。确认 GitHub Release 已公开发布，且唯一的上传附件为主题 ZIP。Komari 自动导入使用第一个附件。
4. 确认 Release 发布完成后，把同一提交推送到 `origin` 的目标源码分支，并核对远端分支、标签与发布版本。遇到验证或发布失败，先在本流程中排查修复，再继续推送源码分支。
