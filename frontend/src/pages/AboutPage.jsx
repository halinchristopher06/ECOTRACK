import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Eye,
  Gauge,
  Heart,
  Leaf,
  Lightbulb,
  ScanSearch,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { BrandLogo } from '../components/BrandLogo.jsx'

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Usage Insights',
    text: 'Track electricity and water consumption with detailed monthly trends.',
  },
  {
    icon: ScanSearch,
    title: 'Manual Audits',
    text: 'Easily log meter readings and verify your utility bills for accuracy.',
  },
  {
    icon: Lightbulb,
    title: 'Smart Advice',
    text: 'Receive personalized EcoTips to reduce waste and lower your costs.',
  },
  {
    icon: Zap,
    title: 'Appliance Tracking',
    text: 'Identify high-consumption devices and optimize their usage patterns.',
  },
]

const VALUES = [
  { icon: Eye, title: 'Transparency', text: 'Making utility data clear and accessible.' },
  { icon: Gauge, title: 'Efficiency', text: 'Helping you save resources and money simultaneously.' },
  { icon: Sparkles, title: 'Innovation', text: 'Using technology to simplify environmental responsibility.' },
]

export function AboutPage() {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Overview', onClick: () => navigate('/dashboard') },
          { label: 'About' },
        ]}
        eyebrow="About EcoTrack"
        title="Empowering Sustainable Living"
        description="Advanced utility monitoring for a greener tomorrow."
        icon={Leaf}
      />

      <div className="eco-stack">
        <Card>
          <div className="eco-row" style={{ gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <BrandLogo size={56} />
            <p className="eco-soft" style={{ margin: 0, maxWidth: '72ch', lineHeight: 1.65 }}>
              <strong>EcoTrack</strong> is an intelligent utility management platform designed to help urban
              households monitor and reduce their environmental impact. By combining real-time consumption tracking
              with actionable insights, we empower users to make informed decisions that conserve resources and lower
              utility costs, fostering a more sustainable and eco-conscious lifestyle.
            </p>
          </div>
        </Card>

        <div className="eco-grid eco-grid-2">
          <Card title="Our Mission" subtitle="Why EcoTrack exists" icon={Target}>
            <p className="eco-soft" style={{ margin: 0, lineHeight: 1.65 }}>
              EcoTrack is dedicated to providing households and small businesses with the tools they need to achieve
              environmental efficiency. We believe that granular data is the first step toward meaningful
              conservation.
            </p>
          </Card>

          <Card title="Core Values" subtitle="What guides the product" icon={Heart}>
            {VALUES.map(({ icon: Icon, title, text }) => (
              <div className="eco-insight" key={title}>
                <span className="eco-insight-icon">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div>
                  <p>
                    <strong>{title}</strong>
                  </p>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <Card title="What We Do" subtitle="The tools that turn bills into savings" icon={Sparkles}>
          <div className="eco-grid eco-grid-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div className="eco-insight" key={title}>
                <span className="eco-insight-icon">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div>
                  <p>
                    <strong>{title}</strong>
                  </p>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="eco-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <p className="eco-muted" style={{ margin: 0 }}>
              © 2026 EcoTrack Systems. All rights reserved.
            </p>
            <button type="button" className="eco-btn eco-btn-primary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
