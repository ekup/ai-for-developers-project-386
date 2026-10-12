import { defineConfig } from '@hey-api/openapi-ts'

// Генерация клиентского SDK из OpenAPI-спецификации TypeSpec.
// Исходник — api/openapi/openapi.yaml, результат — src/api/generated.
export default defineConfig({
  input: '../api/openapi/openapi.yaml',
  output: {
    path: 'src/api/generated',
    postProcess: ['prettier'],
  },
  plugins: ['@hey-api/client-fetch', '@hey-api/typescript', '@hey-api/sdk'],
})
