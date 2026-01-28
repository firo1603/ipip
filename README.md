# IPIP 浏览器扩展

适配 Manifest V3，查询当前访问网站的 IP 地理位置、国旗、ASN、端口开放情况等信息。

## 功能
- 自动捕获当前标签页主域的 IP，动态替换工具栏图标为对应国家旗帜并更新悬停标题。
- 弹窗展示：浏览器侧解析 IP、服务器侧解析列表（含 IPv6 自适应布局）、地理位置（国/省/市）、ISP、ASN、开放端口。
- 页面资源域名统计：扫描 `img`/`a`/`script`/`link` 外链域名并计数，支持一键复制域名列表。
- 一键跳转 ipip.net 查看完整详情，底部显示本机出口 IP 与位置信息。
- 右键菜单支持对选中 IP 直接在 ipip.net 查询。
- 会话级缓存标签页的 IP/DNS/域名统计，减少重复请求并在标签切换时快速展示。

## 安装与使用
1. 在 Chrome/Edge 打开“扩展程序”→开启开发者模式→“加载已解压的扩展程序”，选择本项目根目录。
2. 访问任意站点，工具栏图标变为对应国家旗帜；点击图标打开弹窗查看当前站点 IP 详情。
3. 弹窗左侧可在不同解析 IP 之间切换；点击“Domains Copy”复制检测到的域名列表。
4. 选中页面中的 IP，右键菜单选择“使用IPIP.NET搜索”将新开标签页展示查询结果。
5. 底部“More...”可直接跳转 ipip.net 详情页；弹窗底部会显示本机出口 IP。

## 权限说明
- `contextMenus`/`tabs`/`webRequest`/`scripting`/`storage`：用于监听主框架请求、动态渲染图标/标题、执行页面脚本及会话存储。
- `host_permissions`：允许访问 http/https 站点及 `clientapi.ipip.net`、`www.ipip.net`，以便获取 IP 数据。

## 数据来源
- `https://clientapi.ipip.net/browser/chrome?ip=<IP>&l=<lang>&domain=<domain>`：获取当前站点的 IP 信息（位置、ISP、ASN、端口、DNS）。
- `https://clientapi.ipip.net/browser/myip`：获取本机出口 IP 与位置。

## 其他
- UI 根据浏览器语言自动显示中/英文。
- 仅使用会话存储，关闭标签时清理对应缓存，不写入持久存储。


