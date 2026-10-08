import { IconCalendarEvent } from '@tabler/icons-react'
import { Box, Container, Group, Text } from '@mantine/core'
import { NavLink, Outlet } from 'react-router'

const navItems = [
  { to: '/book', label: 'Записаться' },
  { to: '/events', label: 'Предстоящие события' },
]

/**
 * Общий каркас страниц: шапка с брендом и навигацией плюс содержимое маршрута.
 */
export function AppLayout() {
  return (
    <Box>
      <Box
        component="header"
        py="sm"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <Container size="lg">
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs">
              <IconCalendarEvent size={28} color="var(--mantine-color-orange-6)" aria-hidden />
              <Text fw={700} size="lg">
                Запись на звонок
              </Text>
            </Group>

            <Group gap="lg">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
                  {({ isActive }) => (
                    <Text
                      component="span"
                      size="sm"
                      fw={isActive ? 700 : 500}
                      c={isActive ? 'orange.6' : 'dimmed'}
                    >
                      {item.label}
                    </Text>
                  )}
                </NavLink>
              ))}
            </Group>
          </Group>
        </Container>
      </Box>

      <Outlet />
    </Box>
  )
}
