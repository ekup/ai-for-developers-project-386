import { Box } from '@mantine/core'

import { AvailableSection } from './AvailableSection'
import { HeroSection } from './HeroSection'
import { LandingFooter } from './LandingFooter'

/**
 * Лендинг сервиса «Запись на звонок».
 */
export function LandingPage() {
  return (
    <Box component="main">
      <HeroSection />
      <AvailableSection />
      <LandingFooter />
    </Box>
  )
}
