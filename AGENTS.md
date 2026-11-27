# Su-Komari-Theme-SAO 协作说明

## 普通修改与版本发布

修改、拟提交信息、提交或推送源码均不自动升版或发布。只有用户明确要求发布版本时才执行下列流程。提交信息按本机 `su-git-commit-push/SKILL.md`，无技能时用分支末段大写的中文前缀。父仓提交和 gitlink 更新另按 Server 的授权办理。

1. **固定候选。** 确认目标源码分支、版本号及发布提交。新版本同步 `package.json`、`package-lock.json`、`komari-theme.json` 和 `.github/release-notes/v<版本号>.md`，保留 Komari 安装标识 `Su-SAO`。重试沿用原候选和版本，先查远端同名标签。异 SHA 立即停止，同 SHA 且源码分支已包含候选时直接续查原发布，禁止回退分支。

2. **校验候选与 ZIP。** 在同一发布提交上执行 `npm run lint`、`npm test`、`npm run release`。核对 `Su-Komari-Theme-SAO-v<版本号>.zip` 可解压，根目录含 `komari-theme.json`、`LICENSE`、`preview.png`，且有 `dist/index.html`。确认包内版本和安装标识，记录候选 SHA 与 ZIP 身份。
3. **先推源码。** 正常推送目标源码分支，读取远端分支实际 SHA，确认与候选一致后才进入标签步骤。推送或核对失败则停在此处，禁止先推标签或公开 Release。

4. **核对并推标签。** 对 `v<版本号>` 核对远端标签最终指向的提交 SHA（含附注标签的解引用）。标签不存在时在已核验候选上创建并普通推送。已有同名同 SHA 时续查既有工作流与 Release。已有同名异 SHA 时停止并报告，禁止移动、覆盖或强推标签。
5. **核实发布。** 标签由 `.github/workflows/build-package.yml` 发布。已排队或运行中的工作流等待完成。已有 Release 时核对状态及附件哈希，多余或不匹配则停止。仅在没有在途发布且确需补发时，才从已核实标签用 GitHub CLI 补发缺失的 ZIP。

6. **核对结果。** 公开 Release 的唯一上传附件为该主题 ZIP，供 Komari 按首个附件导入。同版本续跑先核对已上传内容，避免重复附件。报告源码分支、标签解析出的提交和发布版本。
