import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MovPrompt"
const SITE_URL = "https://movprompt.com"

interface WelcomeProps {
  name?: string
}

const WelcomeEmail = ({ name }: WelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — your AI Director of Photography</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={`${SITE_URL}/logo-wordmark-white.png`} alt={SITE_NAME} width="200" height="100" style={logoImg} />
        </Section>

        <Heading style={h1}>
          {name ? `Welcome aboard, ${name}!` : 'Welcome aboard!'}
        </Heading>

        <Text style={text}>
          You've just joined <strong>{SITE_NAME}</strong> — the AI-powered Director of
          Photography that turns your still frames into cinematic video prompts.
        </Text>

        <Text style={text}>
          Upload any frame, pick a workflow, and get production-ready prompts
          tuned for top AI video models. It's that simple.
        </Text>

        <Section style={ctaSection}>
          <Button style={button} href={SITE_URL}>
            Start Creating
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={text}>
          🎬 We're just getting started — new tools and features are on the way.
          Keep your eyes on us, and thank you for the support. Your early
          feedback means everything.
        </Text>

        <Text style={footer}>
          — The {SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: `Welcome to ${SITE_NAME} 🎬`,
  displayName: 'Welcome email',
  previewData: { name: 'Alex' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '520px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '24px' }
const logoImg = { display: 'block', margin: '0 auto', maxWidth: '200px', height: 'auto' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#444444', lineHeight: '1.6', margin: '0 0 16px' }
const ctaSection = { textAlign: 'center' as const, margin: '24px 0' }
const button = {
  backgroundColor: '#0cbfe0',
  color: '#0a0a0f',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e5e5e5', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#999999', margin: '24px 0 0' }
