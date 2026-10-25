import type { Elements } from 'claude-code'

export const ROW_KEY = 'rich-ui-calm-spinner'

// The working row: one Raster row. The elements come in as data because the
// engine's module scan rejects a function that is handed `$`.
export function buildSpinner(elements: Elements['terminal'], columns: number, cells: string) {
  const { Box, Raster } = elements

  return (
    <Box flexDirection="column" marginTop={1}>
      <Raster key={ROW_KEY} columns={columns} rows={1} cells={cells} />
    </Box>
  )
}

export function buildTurnLine(elements: Elements['terminal'], text: string) {
  const { Text } = elements

  return <Text dimColor>{`  ${text}`}</Text>
}
