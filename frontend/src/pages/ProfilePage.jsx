import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ClipboardList, Home, Pencil, RefreshCw, Trash2, Upload, User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { LoadingButton } from '../components/LoadingButton.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { TextField } from '../components/ui/Field.jsx'
import { ageFromDob } from '../utils/date.js'

export function ProfilePage() {
  const navigate = useNavigate()
  const {
    displayPhoto,
    displayName,
    localProfile,
    profile,
    token,
    loadProfile,
    updateProfile,
    authMessage,
    authError,
    setAuthMessage,
  } = useAuth()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const { run: handleRefresh, loading: refreshing } = useAsyncAction(loadProfile)

  const email = profile?.email || localProfile?.email || 'Not set'
  const birthdate = profile?.birthdate || localProfile?.birthdate || ''
  const age = birthdate ? ageFromDob(birthdate) : localProfile?.age || ''
  const address = profile?.address || localProfile?.address || 'Not set'
  const utilityCompany = profile?.company?.name || localProfile?.utilityCompany || 'Not set'
  const fullName = profile?.fullName || localProfile?.fullName || displayName
  const role = profile?.role || localProfile?.role || 'User'

  const breadcrumbs = [
    { label: 'Overview', onClick: () => navigate('/dashboard') },
    { label: 'My profile' },
  ]

  const startEditing = () => {
    setForm({
      fullName,
      birthdate: birthdate || '',
      address: address === 'Not set' ? '' : address,
      utilityCompany: utilityCompany === 'Not set' ? '' : utilityCompany,
      photoDataUrl: displayPhoto || '',
    })
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setForm(null)
  }

  const onEditPhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, photoDataUrl: reader.result }))
    reader.readAsDataURL(file)
  }

  const onRemovePhoto = () => setForm((f) => ({ ...f, photoDataUrl: '' }))

  const { run: saveChanges, loading: saving } = useAsyncAction(async (e) => {
    e.preventDefault()
    try {
      await updateProfile(form)
      setEditing(false)
      setForm(null)
    } catch {
      // authMessage already set by updateProfile
    }
  })

  if (editing && form) {
    return (
      <div className="eco-stack">
        <PageHeader
          breadcrumbs={breadcrumbs}
          eyebrow="Account"
          title="Edit profile"
          description="Update your photo, personal details and utility information."
          icon={User}
        />

        {authMessage ? (
          <Alert variant={authError ? 'error' : 'success'} onClose={() => setAuthMessage('')}>
            {authMessage}
          </Alert>
        ) : null}

        <form onSubmit={saveChanges}>
          <div className="eco-grid eco-grid-2">
            <Card title="Profile photo" subtitle="A square image looks best." icon={Camera}>
              <label className="eco-photo-picker" htmlFor="profile-photo">
                {form.photoDataUrl ? (
                  <img src={form.photoDataUrl} alt="" className="eco-photo-preview" />
                ) : (
                  <span className="eco-photo-placeholder" aria-hidden="true">
                    <User size={24} />
                  </span>
                )}
                <span className="eco-photo-meta">
                  <strong className="eco-photo-label">Profile photo</strong>
                  <span className="eco-help">Optional — a square image looks best.</span>
                </span>
                <span className="eco-btn eco-btn-secondary eco-btn-sm">
                  <Upload size={15} /> Change photo
                </span>
                <input
                  id="profile-photo"
                  type="file"
                  accept="image/*"
                  onChange={onEditPhoto}
                  className="eco-sr-only"
                />
              </label>

              {form.photoDataUrl ? (
                <button
                  type="button"
                  className="eco-btn eco-btn-ghost eco-btn-sm"
                  onClick={onRemovePhoto}
                  disabled={saving}
                >
                  <Trash2 size={15} /> Remove photo
                </button>
              ) : null}
            </Card>

            <Card title="Your details" subtitle="Shown on your bills and reports." icon={ClipboardList}>
              <div className="eco-form-section">
                <h4 className="eco-form-section-title">
                  <User size={15} aria-hidden="true" />
                  Personal
                </h4>
                <div className="eco-field-row">
                  <TextField
                    label="Full name"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    autoComplete="name"
                    required
                  />
                  <TextField
                    label="Birthdate"
                    type="date"
                    value={form.birthdate}
                    onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
                    autoComplete="bday"
                  />
                </div>
              </div>

              <div className="eco-form-section">
                <h4 className="eco-form-section-title">
                  <Home size={15} aria-hidden="true" />
                  Home &amp; utility
                </h4>
                <div className="eco-field-row">
                  <TextField
                    label="Address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                  <TextField
                    label="Utility company"
                    value={form.utilityCompany}
                    onChange={(e) => setForm({ ...form, utilityCompany: e.target.value })}
                  />
                </div>
              </div>

              <div className="eco-between" style={{ marginTop: 18 }}>
                <button type="button" className="eco-btn eco-btn-secondary" onClick={cancelEditing} disabled={saving}>
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  className="eco-btn eco-btn-primary"
                  loading={saving}
                  loadingText="Saving…"
                >
                  Save changes
                </LoadingButton>
              </div>
            </Card>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="eco-stack">
      <PageHeader
        breadcrumbs={breadcrumbs}
        eyebrow="Account"
        title="My profile"
        description="Your account details, profile photo and utility information."
        icon={User}
        actions={
          <>
            <button type="button" className="eco-btn eco-btn-ghost" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
            {token ? (
              <LoadingButton
                className="eco-btn eco-btn-secondary"
                onClick={handleRefresh}
                loading={refreshing}
                loadingText="Refreshing…"
              >
                <RefreshCw size={16} aria-hidden="true" /> Refresh from Cloud
              </LoadingButton>
            ) : null}
            {token ? (
              <button type="button" className="eco-btn eco-btn-primary" onClick={startEditing}>
                <Pencil size={16} aria-hidden="true" /> Edit profile
              </button>
            ) : null}
          </>
        }
      />

      {authMessage ? (
        <Alert variant={authError ? 'error' : 'success'} onClose={() => setAuthMessage('')}>
          {authMessage}
        </Alert>
      ) : null}

      <div className="eco-grid eco-grid-2">
        <Card title="Profile photo" subtitle="How you appear across EcoTrack." icon={Camera}>
          <div className="eco-photo-picker">
            {displayPhoto ? (
              <img src={displayPhoto} alt="" className="eco-photo-preview" />
            ) : (
              <span className="eco-photo-placeholder" aria-hidden="true">
                <User size={24} />
              </span>
            )}
            <span className="eco-photo-meta">
              <strong className="eco-photo-label">{displayName}</strong>
              <span className="eco-help">{role}</span>
            </span>
          </div>

          <div className="eco-summary-row">
            <span>Email</span>
            <span className="eco-summary-value">{email}</span>
          </div>
          <div className="eco-summary-row">
            <span>Age</span>
            <span className="eco-summary-value">{age || 'Not set'}</span>
          </div>
        </Card>

        <Card title="Account details" subtitle="Your personal and utility information." icon={ClipboardList}>
          <div className="eco-summary-row">
            <span>Full name</span>
            <span className="eco-summary-value">{fullName}</span>
          </div>
          <div className="eco-summary-row">
            <span>Birthdate</span>
            <span className="eco-summary-value">{birthdate || 'Not set'}</span>
          </div>
          <div className="eco-summary-row">
            <span>Utility company</span>
            <span className="eco-summary-value">{utilityCompany}</span>
          </div>
          <div className="eco-summary-row">
            <span>Residential address</span>
            <span className="eco-summary-value">{address}</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
