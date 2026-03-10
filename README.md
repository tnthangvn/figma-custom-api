# Custom MCP + API

MCP server nay cung cap 2 tools:
- `api_get`: goi GET den API ngoai
- `api_post`: goi POST den API ngoai

Figma tools:
- `figma_get_file`
- `figma_get_file_nodes`
- `figma_get_images`
- `figma_get_comments`
- `figma_post_comment`
- `figma_get_versions`
- `figma_get_team_projects`
- `figma_get_project_files`

## 1) Cai dat

```bash
npm install
cp .env.example .env
```

Cap nhat `.env` (Figma):

```env
API_BASE_URL=https://api.figma.com/
API_KEY=figma_personal_access_token
MCP_TRANSPORT=http
PORT=3006
```

## 2) Chay server

```bash
npm start
```

Mac dinh server chay MCP HTTP tai:
- `http://localhost:3006/mcp`
- health check: `http://localhost:3006/health`

Neu can chay local `stdio`:

```bash
npm run start:stdio
```

## 2.1) Build production

```bash
npm run build
npm run start:dist
```

## 2.2) Dung PM2 quan ly

```bash
# cai pm2 neu chua co
npm i -g pm2

# build truoc khi start pm2
npm run build
npm run pm2:start

# xem log
npm run pm2:logs

# restart khi doi env/code
npm run pm2:restart

# stop
npm run pm2:stop
```

PM2 da set san:
- `MCP_TRANSPORT=http`
- `PORT=3006`

## 3) Cau hinh MCP client

Vi du file cau hinh MCP (dang JSON):

```json
{
  "mcpServers": {
    "custom-api": {
      "command": "node",
      "args": ["/var/www/free-time/mcp/figma-mcp/src/index.js"],
      "env": {
        "API_BASE_URL": "https://api.figma.com/",
        "API_KEY": "figma_personal_access_token"
      }
    }
  }
}
```

Neu client da nap server thanh cong, ban co the goi:
- `api_get` voi `path` + `query`
- `api_post` voi `path` + `payload`

## 4) Vi du dung tool

`api_get` (lay thong tin file Figma)

```json
{
  "path": "/v1/files/<FIGMA_FILE_KEY>"
}
```

`api_post`

```json
{
  "path": "/messages",
  "payload": {
    "title": "Hello",
    "content": "From MCP"
  }
}
```
