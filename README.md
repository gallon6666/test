# 星轨收集者

一个从 0 到 1 的纯前端小游戏：移动飞船接住金色星尘，避开红色陨石。项目只需要 HTML、CSS、JavaScript，已重新打磨成街机夜航风格，适合第一次部署到 GitHub Pages。

## 第 1 步：本地运行

直接打开 `index.html` 就能玩。如果你想用本地服务器预览，也可以在这个文件夹里运行：

```bash
python3 -m http.server 8080
```

然后访问：

```text
http://localhost:8080
```

## 第 2 步：保存到 Git

```bash
git init
git add index.html styles.css game.js README.md .gitignore
git commit -m "Build star collector game"
```

## 第 3 步：推送到 GitHub

先在 GitHub 新建一个空仓库，比如 `star-collector-game`。不要勾选自动生成 README，因为本地已经有了。

然后把下面的地址换成你的仓库地址：

```bash
git branch -M main
git remote add origin https://github.com/你的用户名/star-collector-game.git
git push -u origin main
```

## 第 4 步：开启 GitHub Pages

进入仓库页面：

```text
Settings -> Pages -> Build and deployment -> Source
```

选择：

```text
Deploy from a branch
Branch: main
Folder: / (root)
```

保存后等待 1 到 2 分钟，GitHub 会给你一个公开访问地址。

## 可以继续改哪里

- `game.js`：改分数、速度、生命值、关卡难度。
- `styles.css`：改颜色、布局、按钮样式。
- `index.html`：改标题、按钮文字、页面结构。
