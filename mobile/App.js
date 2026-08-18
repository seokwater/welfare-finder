import React, { useEffect, useState } from 'react'
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native'
import { defaultApiBase } from './src/api'
import BottomTabs from './src/components/BottomTabs'
import PolicyDetailModal from './src/components/PolicyDetailModal'
import AIProfileScreen from './src/screens/AIProfileScreen'
import CalendarScreen from './src/screens/CalendarScreen'
import HomeScreen from './src/screens/HomeScreen'
import MyScreen from './src/screens/MyScreen'
import OnboardingScreen from './src/screens/OnboardingScreen'
import SearchScreen, { INITIAL_SEARCH_SESSION } from './src/screens/SearchScreen'
import { loadAppState, loadSearchSessions, resetAppState, saveActiveProfileId, saveApiBase, saveOnboarded, saveProfiles, saveSearchSessions } from './src/storage'
import { colors } from './src/theme'

function createProfileId() {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function nextProfileName(profiles) {
  const names = new Set(profiles.map((entry) => entry.name))
  let index = 1
  while (names.has(`프로필 ${index}`)) index += 1
  return `프로필 ${index}`
}

export default function App() {
  const [booting, setBooting] = useState(true)
  const [onboarded, setOnboarded] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [activeProfileId, setActiveProfileId] = useState('')
  const [apiBase, setApiBase] = useState(defaultApiBase())
  const [profileEditor, setProfileEditor] = useState(null)
  const [activeTab, setActiveTab] = useState('home')
  const [selectedPolicy, setSelectedPolicy] = useState(null)
  const [searchSessions, setSearchSessions] = useState({})

  const activeProfileEntry = profiles.find((entry) => entry.id === activeProfileId) || null
  const profile = activeProfileEntry?.data || null
  const searchSessionKey = activeProfileId || 'guest'
  const searchSession = searchSessions[searchSessionKey] || INITIAL_SEARCH_SESSION

  useEffect(() => {
    Promise.all([loadAppState(), loadSearchSessions()])
      .then(([state, savedSearchSessions]) => {
        setOnboarded(state.onboarded)
        setProfiles(state.profiles)
        setActiveProfileId(state.activeProfileId)
        if (state.apiBase) setApiBase(state.apiBase)
        if (savedSearchSessions.__legacy__) {
          const { __legacy__, ...rest } = savedSearchSessions
          setSearchSessions({ ...rest, [state.activeProfileId || 'guest']: __legacy__ })
        } else {
          setSearchSessions(savedSearchSessions)
        }
      })
      .catch(() => {})
      .finally(() => setBooting(false))
  }, [])

  useEffect(() => {
    if (booting || !onboarded) return
    saveSearchSessions(searchSessions).catch(() => {})
  }, [booting, onboarded, searchSessions])

  if (booting) {
    return (
      <SafeAreaView style={styles.loading}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <ActivityIndicator size="large" color={colors.green} />
      </SafeAreaView>
    )
  }

  if (!onboarded) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <OnboardingScreen
          onStart={async () => {
            await saveOnboarded(true)
            setOnboarded(true)
            setProfileEditor({ profileId: null })
          }}
          onSkip={async () => {
            await saveOnboarded(true)
            setOnboarded(true)
            setActiveTab('home')
          }}
        />
      </>
    )
  }

  if (profileEditor) {
    const editingEntry = profiles.find((entry) => entry.id === profileEditor.profileId) || null
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <AIProfileScreen
          apiBase={apiBase}
          initialProfile={editingEntry?.data || null}
          profileName={editingEntry?.name || nextProfileName(profiles)}
          isEditing={!!editingEntry}
          onCancel={() => setProfileEditor(null)}
          onComplete={async (nextProfile) => {
            const now = Date.now()
            let nextProfiles
            let nextActiveProfileId
            if (editingEntry) {
              nextProfiles = profiles.map((entry) => (
                entry.id === editingEntry.id ? { ...entry, data: nextProfile, updatedAt: now } : entry
              ))
              nextActiveProfileId = editingEntry.id
            } else {
              const nextEntry = {
                id: createProfileId(),
                name: nextProfileName(profiles),
                data: nextProfile,
                createdAt: now,
                updatedAt: now,
              }
              nextProfiles = [...profiles, nextEntry]
              nextActiveProfileId = nextEntry.id
            }
            const saved = await saveProfiles(nextProfiles, nextActiveProfileId)
            setProfiles(saved.profiles)
            setActiveProfileId(saved.activeProfileId)
            setProfileEditor(null)
            setActiveTab('home')
          }}
        />
      </>
    )
  }

  const common = { apiBase, profile, onOpenPolicy: setSelectedPolicy }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.body}>
        {activeTab === 'home' && (
          <HomeScreen
            {...common}
            onNavigate={setActiveTab}
            onEditProfile={() => setProfileEditor({ profileId: activeProfileId || null })}
          />
        )}
        {activeTab === 'calendar' && <CalendarScreen {...common} />}
        {activeTab === 'search' && (
          <SearchScreen
            {...common}
            searchSession={searchSession}
            onSearchSessionChange={(update) => {
              setSearchSessions((current) => {
                const existing = current[searchSessionKey] || INITIAL_SEARCH_SESSION
                const next = typeof update === 'function' ? update(existing) : update
                return { ...current, [searchSessionKey]: next }
              })
            }}
          />
        )}
        {activeTab === 'my' && (
          <MyScreen
            {...common}
            profiles={profiles}
            activeProfileId={activeProfileId}
            onSelectProfile={async (profileId) => {
              if (!profiles.some((entry) => entry.id === profileId)) return
              await saveActiveProfileId(profileId)
              setActiveProfileId(profileId)
            }}
            onAddProfile={() => setProfileEditor({ profileId: null })}
            onEditProfile={(profileId) => setProfileEditor({ profileId })}
            onDeleteProfile={async (profileId) => {
              const nextProfiles = profiles.filter((entry) => entry.id !== profileId)
              const nextActiveProfileId = activeProfileId === profileId
                ? (nextProfiles[0]?.id || '')
                : activeProfileId
              const saved = await saveProfiles(nextProfiles, nextActiveProfileId)
              setProfiles(saved.profiles)
              setActiveProfileId(saved.activeProfileId)
              setSearchSessions((current) => {
                const next = { ...current }
                delete next[profileId]
                return next
              })
            }}
            onSaveApiBase={async (next) => {
              const saved = await saveApiBase(next)
              setApiBase(saved || defaultApiBase())
            }}
            onReset={async () => {
              await resetAppState()
              setProfiles([])
              setActiveProfileId('')
              setSearchSessions({})
              setOnboarded(false)
              setProfileEditor(null)
              setActiveTab('home')
            }}
          />
        )}
      </View>
      <BottomTabs active={activeTab} onChange={setActiveTab} />
      <PolicyDetailModal item={selectedPolicy} onClose={() => setSelectedPolicy(null)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
})
