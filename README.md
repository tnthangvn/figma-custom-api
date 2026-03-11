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

## 3) Setup MCP cho Antigravity

File config cua Antigravity:
- `/home/thangtn/.gemini/antigravity/mcp_config.json`

### 3.1) Cach khuyen nghi (HTTP MCP qua PM2)

1. Chay server bang PM2:

```bash
cd /var/www/free-time/mcp/figma-mcp
pnpm build
npm run pm2:start
```

2. Kiem tra health:

```bash
curl -sS http://127.0.0.1:3006/health
```

3. Copy config nay vao `mcp_config.json`:

```json
{
  "mcpServers": {
    "figma-custom-api": {
      "transport": "streamable_http",
      "url": "http://127.0.0.1:3006/mcp"
    }
  }
}
```

Neu Antigravity chay o may khac, thay `127.0.0.1` bang IP/domain cua server.

### 3.2) Fallback (stdio)

Dung cach nay neu ban muon Antigravity tu spawn process:

```json
{
  "mcpServers": {
    "figma-custom-api": {
      "command": "node",
      "args": ["/var/www/free-time/mcp/figma-mcp/dist/index.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "API_BASE_URL": "https://api.figma.com/",
        "API_KEY": "figma_personal_access_token"
      }
    }
  }
}
```

### 3.3) Reload Antigravity

- Tat/bat lai MCP connector trong UI hoac restart Antigravity sau khi sua config.
- Neu da connect thanh cong, ban se thay danh sach tools tu server.

## 4) Danh sach tool se hien trong Antigravity

- `api_get`
- `api_post`
- `figma_get_file`
- `figma_get_file_nodes`
- `figma_get_images`
- `figma_get_comments`
- `figma_post_comment`
- `figma_get_versions`
- `figma_get_team_projects`
- `figma_get_project_files`

## 5) Vi du dung tool

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

## 6) Troubleshoot nhanh

- Khong thay tool moi:
  - Chay lai `pnpm build && npm run pm2:restart`
  - Reload Antigravity
- Loi ket noi MCP:
  - Kiem tra `curl http://127.0.0.1:3006/health`
  - Kiem tra log `npm run pm2:logs`
- Loi auth Figma 401:
  - Kiem tra `API_KEY` trong `.env`
  - Dam bao token co quyen doc file/team/project can truy cap

## 7) Cài đặt Filesystem MCP Server

Để cho phép AI Agent thao tác với file hệ thống thông qua MCP, bạn cần cài đặt thêm `filesystem` MCP server. Dưới đây là hướng dẫn chi tiết:

**Bước 1: Clone Model Context Protocol servers**

Tải bộ mã nguồn chứa các MCP server tham khảo từ repository chính thức:

```bash
git clone https://github.com/modelcontextprotocol/servers.git
cd servers/src/filesystem
```

**Bước 2: Cài đặt thư viện và Build**

Bạn có thể sử dụng `pnpm`, `npm`, hoặc `yarn` tùy ý. Tại thư mục `servers/src/filesystem/`, chạy lệnh sau:

```bash
# Thêm zod và tiến hành cài đặt, build dự án
pnpm add zod && pnpm install && pnpm build
```

Sau khi build thành công, file thực thi sẽ được sinh ra tại: `servers/dist/filesystem/dist/index.js`.

**Bước 3: Cấu hình MCP Client**

Thêm cấu hình `filesystem` server vào file thiết lập MCP của bạn (ví dụ: `mcp_config.json` hoặc file config của client AI đang dùng). Dưới đây là ví dụ cấu hình tham khảo cho môi trường macOS:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "/Users/nt/.nvm/versions/node/v22.14.0/bin/node",
      "args": [
        "[đường_dẫn_tuyệt_đối_đến_repo]/servers/dist/filesystem/dist/index.js",
        "[đường_dẫn_tới_thư_mục_workspace]"
      ],
      "env": {
        "PATH": "/Users/nt/.nvm/versions/node/v22.14.0/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
      }
    }
  }
}
```

_Một số lưu ý khi cấu hình:_

- **command**: Đường dẫn tuyệt đối tới file thực thi Node.js trên máy bạn (có thể kiểm tra bằng lệnh `which node`).
- **args[0]**: Thay `[đường_dẫn_tuyệt_đối_đến_repo]` bằng đường dẫn gốc nơi bạn đã clone thư mục `servers`.
- **args[1]**: Thay `[đường_dẫn_tới_thư_mục_workspace]` bằng đường dẫn tới dự án/thư mục mà bạn cho phép AI được quyền làm việc và thao tác file.
- **env.PATH**: Sao chép nguyên giá trị biến môi trường `PATH` (hoặc kiểm tra bằng lệnh `echo $PATH`) để đảm bảo quá trình chạy trong Node.js shell nhận diện đúng các lệnh cơ bản trên hệ điều hành macOS.
