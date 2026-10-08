import { IconCheck } from '@tabler/icons-react'
import { Box, Container, List, Stack, Text, ThemeIcon, Title } from '@mantine/core'

const features = [
  'Фиксированные слоты по 30 минут с 09:00 до 18:00',
  'Проверка конфликтов: один слот — одна запись',
  'Предстоящие записи в отдельном разделе',
]

/**
 * Блок «Что доступно»: короткий список возможностей сервиса.
 */
export function AvailableSection() {
  return (
    <Box component="section" py="xl">
      <Container size="lg">
        <Stack gap="md" maw={720}>
          <Title order={2} size="h3">
            Что доступно
          </Title>
          <List
            spacing="sm"
            icon={
              <ThemeIcon color="green" size={22} radius="xl">
                <IconCheck size={14} aria-hidden />
              </ThemeIcon>
            }
          >
            {features.map((feature) => (
              <List.Item key={feature}>
                <Text>{feature}</Text>
              </List.Item>
            ))}
          </List>
        </Stack>
      </Container>
    </Box>
  )
}
