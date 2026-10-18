import type { ExecArgs } from "@medusajs/framework/types"

import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

type SearchIndexSummary = {
  name: string
  status: "pending" | "building" | "ready" | "error"
}

async function waitForReadySearchIndex(
  searchModule: { listIndexes(): Promise<SearchIndexSummary[]> },
  indexName: string,
  timeoutMs = 120_000,
  pollIntervalMs = 1000,
) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const indexes = await searchModule.listIndexes()
    const index = indexes.find((candidate) => candidate.name === indexName)

    if (!index) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `[Search] Índice "${indexName}" no encontrado tras migración.`
      )
    }

    if (index.status === "ready") {
      return
    }

    if (index.status === "error") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `[Search] Índice "${indexName}" quedó en estado error durante la reindexación.`
      )
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `[Search] Timeout esperando a que "${indexName}" quede listo.`
  )
}

export default async function prepareSearchIndexes({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const searchModule = container.resolve(Modules.SEARCH)

  logger.info("[Search] Verificando índices activos antes del bootstrap...")

  const indexes = await searchModule.listIndexes()
  const productIndex = indexes.find((index) => index.name === "product")

  if (!productIndex) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "[Search] Índice product no encontrado; la migración debe crearlo antes del bootstrap."
    )
  }

  const existingStatus = productIndex.status
  if (existingStatus === "ready") {
    logger.info("[Search] product ya tiene un índice activo. No es necesario reindexar.")
    return
  }

  logger.info("[Search] Reindexando product para activar la versión lista antes del bootstrap...")
  const result = await searchModule.reindex({ index: "product" })
  logger.info(`[Search] Reindexación lanzada: ${JSON.stringify(result)}`)

  await waitForReadySearchIndex(searchModule, "product")
  logger.info("[Search] product quedó listo y activo para el bootstrap.")
}
