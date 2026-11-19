# Su-Komari-Theme-SAO

<p align="center">
  <strong>面向 Komari 的模块化服务器监控主题</strong>
</p>

Su-Komari-Theme-SAO 由 **suyi-92（苏忆）** 持续开发维护，源自 WAOR 的 [Komari-Theme-SAO](https://github.com/WAOR/Komari-Theme-SAO)。Komari 安装标识为 `Su-SAO`。

[下载安装包](https://github.com/suyi-92/Su-Komari-Theme-SAO/releases) · [提交反馈](https://github.com/suyi-92/Su-Komari-Theme-SAO/issues)

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen" alt="Node Version">
  <img src="https://img.shields.io/badge/TypeScript-Strict-blue" alt="TypeScript">
</p>

<p align="center">
  <img src="./preview.png" alt="Theme Preview" width="100%">
</p>


## v2.1 更新

- 首页分组与地区标签按现有顺序左对齐，使用实际可用宽度。标签溢出时可向左右滑动或拖动滚动条，地区标签保持静止。
- 首页延迟光柱和实时数值可按中国大陆到节点地区的往返时延分档。自定义颜色继续应用，已调整的旧版门槛自动进入「自定义统一门槛」模式。
- Komari 中的主题安装标识更新为 `Su-SAO`。已有安装可按下文复制主题设置。

### 🎨  2.0 特性
* **全新透白磨砂与通透质感**：2.0 版本确立了高通透半透明磨砂毛玻璃主题基调，彻底告别单薄生硬的平面表现，深浅模式卡片均极具立体感；
* **Su-Komari-Theme-SAO 双层底座服务器卡片**：节点卡片引入全新立体双层底座形态，与LuminaPlus 经典卡片样式自由切换，信息聚合层次分明；
* **指标数据图形化呈现**：总览指标小卡全面接入高精度数据微图（实时带宽波浪双曲线、今日流量 7h 出入站柱状图、平均 CPU 频谱律动柱等），支持指标卡片微图动/静态模式切换；
* **三网丢包指标卡片**：电信、联通、移动分线透视，直观掌握骨干网丢包波动，右上角内嵌专属弹窗支持自由挑选参评节点；
* **资产多币种汇率换算**：支持选择 CNY、USD、EUR 等结算货币并自动计算剩余价值；
* **稳定评分卡片**：基于丢包+抖动偏离+晚高峰突增算法的线路稳定性评分卡片，客观呈现过去24小时的服务器线路稳定性评分并进行排名。


---

### 🎨  1.0 特性
* **首页流光幻彩用户昵称**：问候语搭载动态渐变流光昵称，Komari 端自动同步后端账户，CFSM 与 Monitor 端支持登录后点击直接快速编辑；
* **中性碳黑与护眼浅灰**：纯正中性深色底色；浅色模式降低视觉眩光；
* **资产数据一键防窥**：敏感节点费用与资产总值默认隐藏，支持顶栏快捷键一键安全截图分享；
* **iOS 灵动岛全景融入**：安全区色彩自然漫延至状态栏与灵动岛背后，彻底消除顶部色彩断层。
---

### 🎮 集群状态双形态自由切换
支持在主题管理中根据集群规模与偏好自由切换集群状态呈现方案：

#### 〰️ 「Su-Komari-Theme-SAO 趋势大盘」
专为小集群打磨的集群状态呈现方案：
* **分段式在线健康指示格**：单机一格映射存活状态，全站在线率一目了然；
* **SVG 实时吞吐波形**：轻量贝塞尔实时曲线，内置自适应标尺算法，流畅呈现瞬带宽状态；

#### 🔲 「Su-Komari-Theme-SAO 方格矩阵」
专为大规模集群打造的高密度俯瞰热力看板：
* **整屏机架热力**：突破趋势大盘的单行在线绿限制，单屏容纳上百台机器，溢出无缝垂直滚动；
* **实时吞吐动态梯级**：单机方格根据对应服务器的实时吞吐呈现动态色彩梯级变幻；
* **联动主题配色方案**：方块色彩联动主题配色方案，更多个性化配色将随版本持续扩充；
* **微型点阵画板与开场预设**：配备 20×5 微型像素 DIY 画板，内置多种点阵图案、文字等常用预设，支持一键载入、支持用户自定义绘制开场图案跨设备漫游同步；
* **开屏激光扫光动效**：主题内置多款开屏动效设计并将持续更新，动效结束呼吸聚能后平滑切入实时集群数据；
* **闲置机位灵动呼吸填充**：可选开启闲置插槽模拟数据，周期性随机变幻速率，保持整屏矩阵饱满生动。

---

### 🏷️ 节点高级彩色标签定制 (Radix Colors)
各探针原生支持的色彩非常有限。Su-Komari-Theme-SAO 在前端层面全量引入并支持了完整的 [Radix UI Colors](https://www.radix-ui.com/themes/docs/theme/color) 调色板，可在后台为线路或节点自由指定丰富的高定专属色彩：

* **🌸 Komari 端指定语法**：在后台节点标签中填写 `标签名<颜色>`，多标签用分号 `;` 分隔：
  ```text
  CN2GIA<Blue>;9929<Tomato>;CMIN2<Grass>;精品网<Amber>
  ```
* **☁️ CFSM 端指定语法**：在后台节点备注中填写 `标签名-颜色`，多标签用英文逗号 `,` 分隔：
  ```text
  CN2GIA-Blue,9929-Tomato,CMIN2-Grass,精品网-Amber
  ```
* **⚡ 极简探针端说明**：因当前极简探针官方服务端尚未提供节点标签（Tags）字段，该功能暂处于冻结等待期，待服务端后续开放后主题将第一时间跟进适配。
* **支持的色彩池**：全量支持 Radix UI 规范色彩名（不区分大小写）：
  > `Tomato` · `Red` · `Ruby` · `Crimson` · `Pink` · `Plum` · `Purple` · `Violet` · `Iris` · `Indigo` · `Blue` · `Cyan` · `Teal` · `Jade` · `Green` · `Grass` · `Lime` · `Mint` · `Sky` · `Amber` · `Yellow` · `Orange` · `Gold` · `Bronze` 等。

---

## 📸 视觉效果预览

### 🎬 动态效果实录 (Video Demo)

https://github.com/user-attachments/assets/0540209f-442d-4977-b872-ff04821e0843

---

### 🖥️ 桌面端集群全景 (Desktop Overview)

#### 1. 深色极客体系 (Dark Mode)
| EVA 初号机配色 · 方格矩阵 | 命运石之门配色 · 方格矩阵 |
| :---: | :---: |
| <img src="./docs/images/dark+EVA配色+方格矩阵.png" alt="深色模式 EVA 初号机配色 方格矩阵" width="100%" /> | <img src="./docs/images/dark+命运石之门配色+方格矩阵.png" alt="深色模式 命运石之门配色 方格矩阵" width="100%" /> |

#### 2. 浅色典雅体系 (Light Mode)
| 经典标准配色 · 方格矩阵 | 命运石之门配色 · 方格矩阵 |
| :---: | :---: |
| <img src="./docs/images/light+经典标准配色+方格矩阵.png" alt="浅色模式 经典标准配色 方格矩阵" width="100%" /> | <img src="./docs/images/light+命运石之门配色+方格矩阵.png" alt="浅色模式 命运石之门配色 方格矩阵" width="100%" /> |

| 经典标准配色 · 趋势大盘 | EVA 初号机配色 · 趋势大盘 |
| :---: | :---: |
| <img src="./docs/images/light+经典标准配色+趋势大盘.png" alt="浅色模式 经典标准配色 趋势大盘" width="100%" /> | <img src="./docs/images/light+EVA配色+趋势大盘.png" alt="浅色模式 EVA 初号机配色 趋势大盘" width="100%" /> |

---

### ⚙️ 主题设置与 DIY 高级定制 (Customization & Layouts)

| 指标卡池（自由点选与拖拽重排） | 方格机架矩阵与开屏动效设定 |
| :---: | :---: |
| <img src="./docs/images/SAO指标卡池.png" alt="指标卡池" width="100%" /> | <img src="./docs/images/SAO%20方格矩阵.png" alt="方格矩阵" width="100%" /> |

| 实时带宽评级徽章自定义 (DIY) |
| :---: |
| <img src="./docs/images/带宽评级徽章DIY.png" alt="带宽评级徽章 DIY" width="100%" /> |

---

### 📱 移动端精细响应式适配 (Mobile Experience)

| 移动端全息方块矩阵呈现 (EVA 配色) | 移动端多功能主题设置抽屉 |
| :---: | :---: |
| <img src="./docs/images/移动端+EVA配色+方块矩阵%20呈现效果.png" alt="移动端 EVA 配色方块矩阵" width="100%" /> | <img src="./docs/images/移动端%20主题设置.png" alt="移动端 主题设置" width="100%" /> |

---

## 🧩 Su-Komari-Theme-SAO 与上游系列的其他平台

| 核心特性 / 维度               |                         🌸 Komari 端                          |                      ⚡ 极简探针端                       |                  ☁️ CFSM 端                   |
| :---------------------- | :----------------------------------------------------------: | :------------------------------------------------: | :------------------------------------------: |
| **方格矩阵**                |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **趋势大盘**                |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **磨砂玻璃卡片**              |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **带宽评级徽章自定义**           |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **双层底座服务器卡片**           |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **指标卡专属动态微图**           |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **微图动/静态模式切换**          |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **首页流光幻彩昵称**            |                           🤖 自动读取                            |                     ✏️ 点击编辑保存                      |                  ✏️ 点击编辑保存                   |
| **三网丢包指标卡片**            |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **资产多币种汇率换算**           |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **稳定评分指标卡片 & 天梯榜**      |                           🏆 独占支持                            |                      ❌ 受限暂未支持                      |                   ❌ 受限暂未支持                   |
| **指标小卡数量**              |                          ✅ 14 张指标卡片                          |                     ✅ 13 张指标卡片                     |                  ✅ 12 张指标卡片                  |
| **主题配色方案**              |                           ✅ 持续更新中                            |                      ✅  持续更新中                      |                   ✅  持续更新中                   |
| **开屏动效 & 点阵画板**         |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **主题更新感知提示**            |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **地区标签超宽滚动**            |                   ✅ 手动横向滚动                   |                    ✅ 循环滚动                    |                  ✅ 循环滚动                  |
| **光柱色彩 & 延迟丢包阈值自定义**    |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **主题设置随改随存**            |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **资产隐蔽保护**              |                             ✅ 支持                             |                        ✅ 支持                        |                     ✅ 支持                     |
| **节点标签自定义色彩**           |                     🏷️ 指定色彩 (`标签<颜色>`)                      |                     ⏳ 待后端开放接口                      |              🏷️ 指定色彩 (`标签-颜色`)              |
| **部署方式**                |                     上传发布页的 ZIP                      |                 填入仓库地址一键安装 / 上传压缩包                 |             主题商店搜索一键启用 / 仓库地址安装              |
| **项目地址**                | [Su-Komari-Theme-SAO](https://github.com/suyi-92/Su-Komari-Theme-SAO) | [Monitor-SAO](https://github.com/WAOR/Monitor-SAO) | [CFSM-SAO](https://github.com/WAOR/CFSM-SAO) |

---

## 延迟光柱分档

「主题设置 → 服务器 → 延迟光柱」可预览各地区门槛并修改颜色。各列为对应档位的上限，超过「偏高」上限进入「极高」。首页显示的毫秒数仍为原始探测值。

| 节点地区 | 极好（ms） | 良好（ms） | 中等（ms） | 偏高（ms） |
| --- | ---: | ---: | ---: | ---: |
| 中国大陆 | 25 | 50 | 80 | 120 |
| 香港、澳门 | 45 | 65 | 90 | 130 |
| 日本、韩国、台湾 | 65 | 90 | 120 | 165 |
| 东南亚 | 70 | 100 | 135 | 185 |
| 美国西部 | 145 | 175 | 205 | 250 |
| 美国（海岸未知） | 175 | 210 | 245 | 290 |
| 美国东部 | 200 | 230 | 265 | 310 |
| 欧洲 | 150 | 190 | 235 | 285 |
| 澳大利亚、新西兰 | 150 | 200 | 250 | 310 |
| 未知或未覆盖地区 | 60 | 100 | 160 | 200 |

美国节点可使用 `US-West`、`US-East` 等明确地区标签。地区为 `US` 或美国旗帜时，也可在节点名称、公开备注或标签中填写 `Los Angeles`、`New York` 等城市名称。缺少明确海岸信息时使用美国通用分档。

分档参考公开往返时延实测，考虑常见线路与跨网波动。运营商、探测端位置与高峰时段会影响结果。探测来源不同或需要统一绝对门槛时，可以切换为「自定义统一门槛」。

- 香港的优化线路三网实测均值约 39–53 ms，另一组样本约 46–76 ms。[香港样本 1](https://www.zjcp.cc/ask/17772.html) · [香港样本 2](https://www.jtti.cc/supports/4360.html)
- 东京三网测得约 76–93 ms。新加坡面向大陆及港澳台共 335 个探测点的测试，平均约 90 ms。[东京样本](https://github.com/pehmz442/japan-vps-latency-review) · [新加坡样本](https://www.zrblog.net/33957.html)
- 洛杉矶优化线路公开实测均值约 160 ms。美国东部线路的常见参考区间约 210–260 ms。[美国西部实测](https://www.idcoffer.com/archives/14842) · [美国东西部对比](https://1vps.top/archives/us-vps-location-and-datacenter-guide)
- 法兰克福到北京、上海有约 148 ms、181 ms 的样本。悉尼到上海电信约 272 ms，奥克兰有经澳大利亚、日本绕行约 280–293 ms 的样本。[法兰克福样本](https://www.daniao.org/26760.html) · [悉尼样本](https://www.vultrcn.com/85.html) · [奥克兰样本](https://vpsxb.net/8283)

## 🚀 安装与部署

### Komari 安装 Su-Komari-Theme-SAO

在 [发布页](https://github.com/suyi-92/Su-Komari-Theme-SAO/releases) 下载对应版本的主题 ZIP。v2.1.0 的文件为 `Su-SAO-v2.1.0.zip`。在 Komari 管理后台的「主题管理」上传后启用主题。已保存的 `Su-SAO` 配置会随安装标识继续使用。

### 从 SAO 迁移主题设置

旧版主题的安装标识是 `SAO`，设置按标识单独保存。已有自定义设置时，在启用 `Su-SAO` 前完成以下迁移。

1. 登录 Komari 管理后台，保持 `SAO` 为当前主题，上传 `Su-SAO` 的发布 ZIP。
2. 在同一 Komari 站点的后台页面打开浏览器开发者工具，确认 `Su-SAO` 下没有需要保留的配置，再在控制台执行以下命令。它读取当前 `SAO` 的配置并写入 `Su-SAO`。
3. 保存成功后在「主题管理」启用 `Su-SAO`，核对首页和主题设置。需要回退时可重新启用 `SAO`。

```javascript
(async () => {
  const response = await fetch("/api/public", { cache: "no-store" });
  if (!response.ok) throw new Error(`读取主题设置失败（HTTP ${response.status}）`);
  const { data } = await response.json();
  if (data?.theme !== "SAO") throw new Error("请先启用 SAO 再复制设置");
  const settings = data.theme_settings;
  if (settings == null) {
    console.info("SAO 没有已保存的自定义设置，可以直接启用 Su-SAO");
    return;
  }
  if (typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("主题设置格式异常");
  }
  const result = await fetch("/api/admin/theme/settings?theme=Su-SAO", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!result.ok) throw new Error(`保存主题设置失败（HTTP ${result.status}）`);
  console.info("设置已复制，可以启用 Su-SAO");
})();
```

### 上游系列的其他平台

### ⚡ 极简探针端 (Monitor-Probe)
* **方式一：仓库地址一键安装（推荐）**  
  在极简探针管理后台「主题设置」页面，复制填入极简探针主题仓库地址 `https://github.com/WAOR/Monitor-SAO` 即可一键拉取安装。
* **方式二：手动上传安装包**  
  前往 [Monitor-SAO Releases](https://github.com/WAOR/Monitor-SAO/releases) 下载最新打包产物 `theme.tar.gz`，在后台主题设置页面上传启用。

### ☁️ CFSM 端 (CF-Server-Monitor)
* **方式一：主题商店一键启用（推荐）**  
  登录 CFSM 后台前往「主题商店」，搜索 **SAO** 主题点击启用即可。
* **方式二：手动添加仓库地址（锁定特定版本）**  
  在「主题商店」中填入自定义地址安装：
  - 追踪最新发布版：`https://github.com/WAOR/CFSM-SAO/tree/dist`
  - 锁定特定 Commit：`https://github.com/WAOR/CFSM-SAO/tree/<40位CommitSHA>`

---

## 💖 致谢

感谢以下优秀开源项目与社区贡献者的付出：

* **[WAOR/Komari-Theme-SAO](https://github.com/WAOR/Komari-Theme-SAO)**：Su-Komari-Theme-SAO 的上游项目。
* **[stqfdyr/komari-theme-Lumina](https://github.com/stqfdyr/komari-theme-Lumina)**：初代优雅主题开创者。
* **[shanyang242/Komari-Theme-LuminaPlus](https://github.com/shanyang242/Komari-Theme-LuminaPlus)**：出色的功能增强分支与架构设计。
* **[volcano-1025/CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus)**：CFSM 平台的早期移植探索。
* **[guboysky/LuminaPlus](https://github.com/guboysky/LuminaPlus)**：Monitor 探针平台的移植尝试。
* **[Montia37/komari-theme-purcarte](https://github.com/Montia37/komari-theme-purcarte)**：动态背景视频的设计与参考素材。
* **[komari-monitor/komari](https://github.com/komari-monitor/komari)**、**[huilang-me/CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor/)** 与 **[monitor-probe/monitor](https://github.com/monitor-probe/monitor)**：探针监控服务端的作者及社区维护者。

---

## 📄 开源许可证

Su-Komari-Theme-SAO 以 [MIT License](LICENSE) 开源发布，保留上游版权与许可证。
