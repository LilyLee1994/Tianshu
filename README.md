# 天枢

短租运营中台。员工网页 + 清洁/维修手机网页（H5），数据库在 Supabase（悉尼）。

## 目录
- `supabase/migrations/` 建表和权限的 SQL，按编号顺序在 Supabase SQL Editor 运行
- `web/` 前端（Vite + React + TypeScript）
- `server/` 后端函数（创建账号、重置密码、Hostaway 同步等，后续添加）

## 本地运行
```
cd web
npm install
npm run dev      # 打开 http://localhost:5173
```
登录用账号 + 密码。账号在 Supabase 里对应 `账号@tianshu.local`，并在 `profiles` 表有一行。

## 构建
```
cd web && npm run build   # 产物在 web/dist
```

## 密钥
`web/.env` 里只放公开的 URL 和 publishable key，可以提交。
**service_role / secret key 绝不提交**，放服务器环境变量。

## 部署（Vercel）
- Root Directory 选 `web`
- 环境变量（Settings → Environment Variables）：
  - `SUPABASE_SERVICE_ROLE_KEY`：Supabase → Project Settings → API Keys 里的 secret / service_role key（**只放这里，不要提交**）
- `web/api/` 下的文件是服务端函数（创建账号、重置密码、师傅提交等）
