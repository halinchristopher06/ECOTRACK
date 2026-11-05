import { Component } from 'react'

/**
 * Catches render-time errors anywhere below it so a single broken component can never leave the
 * user staring at a blank white page. Shows a friendly recovery screen with a reload action.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Log the detail for diagnosis; the UI deliberately shows a generic message.
    console.error('EcoTrack UI error:', error, info?.componentStack)
  }

  handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  handleGoHome = () => {
    this.setState({ error: null })
    window.location.assign('/dashboard')
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="app-fallback">
        <div className="app-fallback-card">
          <h1>Something went wrong</h1>
          <p>
            An unexpected error interrupted this page. Your data is safe — reloading usually fixes
            it.
          </p>
          <div className="app-fallback-actions">
            <button type="button" className="btn-primary" onClick={this.handleReload}>
              Reload page
            </button>
            <button type="button" className="btn-secondary" onClick={this.handleGoHome}>
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }
}
