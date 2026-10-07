import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  List,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'

const features = [
  'Показывает свободные слоты для звонка',
  'Позволяет забронировать удобное время',
  'Напоминает о предстоящей встрече',
]

/**
 * Лендинг сервиса «Запись на звонок».
 */
export function App() {
  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <div>
          <Badge variant="light" color="indigo">
            Учебный проект
          </Badge>
          <Title order={1} mt="md">
            Запись на звонок
          </Title>
          <Text c="dimmed" size="lg" mt="sm">
            Привет! Это упрощённый сервис бронирования времени: выберите удобный слот и назначьте
            звонок в пару кликов.
          </Text>
        </div>

        <Card withBorder radius="md" padding="lg">
          <Title order={2} size="h4" mb="sm">
            Что умеет сервис
          </Title>
          <List
            spacing="xs"
            icon={
              <ThemeIcon color="indigo" size={20} radius="xl">
                ✓
              </ThemeIcon>
            }
          >
            {features.map((feature) => (
              <List.Item key={feature}>{feature}</List.Item>
            ))}
          </List>
        </Card>

        <Group>
          <Button color="indigo">Выбрать время</Button>
          <Button variant="default">Как это работает</Button>
        </Group>
      </Stack>
    </Container>
  )
}

export default App
