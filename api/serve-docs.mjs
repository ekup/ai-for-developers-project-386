// Мини-сервер для локального просмотра OpenAPI-документации (make api-docs).
// Раздаёт каталог api/openapi без внешних зависимостей и открывает браузер.
import { exec } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), 'openapi')
const port = Number(process.env.PORT ?? 8090)

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.yml': 'application/yaml; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', `http://localhost:${port}`)
  const filePath = join(dir, pathname === '/' ? 'index.html' : pathname)

  if (!filePath.startsWith(dir)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  try {
    const body = await readFile(filePath)
    const type = contentTypes[extname(filePath)] ?? 'application/octet-stream'
    res.writeHead(200, { 'content-type': type })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  }
})

server.listen(port, () => {
  const url = `http://localhost:${port}/`
  console.log(`Документация API: ${url}`)
  console.log('Остановить: Ctrl+C')

  if (process.env.NO_OPEN) return

  const opener =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  exec(`${opener} ${url}`)
})
