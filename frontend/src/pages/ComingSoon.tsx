import { Box, Button, Container, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'

type ComingSoonProps = {
  title: string
}

/**
 * Заглушка раздела, который ещё не реализован.
 */
export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <Box component="main" py="xl">
      <Container size="lg">
        <Stack align="flex-start" gap="md">
          <Title order={1}>{title}</Title>
          <Text c="dimmed">Скоро</Text>
          <Button component={Link} to="/" variant="default">
            На главную
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}
