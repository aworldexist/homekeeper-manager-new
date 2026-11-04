家物管家依赖清单（按用户指定文件名 requirement.tst 提供）

项目类型：React + TypeScript + Vite（Node.js 项目，不使用 pip）
运行环境：Node.js 20.19+ 或 22.12+；npm
安装命令：npm ci
版本锁定：package-lock.json；本文件为便于阅读的清单，实际以锁文件为准。

运行依赖：
lucide-react == 0.468.0
react == 19.3.1
react-dom == 19.3.1

开发、测试与构建依赖：
@types/node == 22.20.5
@types/react == 19.3.0
@types/react-dom == 19.3.0
@vitejs/plugin-react == 4.7.0
tsx == 4.23.15
typescript == 5.7.3
vite == 6.4.5

无 API Key、账号或付费服务依赖。
可选维护工具：Python 3 + openpyxl，仅重读 Excel 时需要；网页和部署无需 Python。
源码打包脚本仅使用 Python 标准库；已提供可直接下载的源码 ZIP。
