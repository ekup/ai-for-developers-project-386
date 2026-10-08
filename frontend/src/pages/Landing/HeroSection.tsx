import { Box, Button, Container, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'

// Мягкий градиент «тёплый оранжевый → зелёный», работающий в светлой и тёмной схемах.
const heroGradient =
  'linear-gradient(135deg, color-mix(in srgb, var(--mantine-color-orange-4) 22%, transparent), color-mix(in srgb, var(--mantine-color-green-4) 22%, transparent))'

/**
 * Первый экран лендинга: посыл сервиса и кнопка записи.
 */
export function HeroSection() {
  return (
    <Box component="section" py={{ base: 'xl', sm: 80 }} style={{ backgroundImage: heroGradient }}>
      <Container size="lg">
        <Stack align="flex-start" gap="md" maw={640}>
          <Title order={1}>Запись на звонок</Title>
          <Text size="lg" c="dimmed">
            Выберите удобный слот и назначьте звонок за пару кликов
          </Text>
          <Button component={Link} to="/book" size="md">
            Записаться
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}
