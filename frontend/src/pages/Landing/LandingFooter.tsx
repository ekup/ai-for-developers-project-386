import { Box, Container, Text } from '@mantine/core'

/**
 * Минимальный футер лендинга.
 */
export function LandingFooter() {
  return (
    <Box
      component="footer"
      py="lg"
      style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
    >
      <Container size="lg">
        <Text size="sm" c="dimmed">
          Запись на звонок — учебный проект Хекслета
        </Text>
      </Container>
    </Box>
  )
}
