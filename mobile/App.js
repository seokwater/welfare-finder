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
import SearchScreen from './src/screens/SearchScreen'
import { deleteProfile, nextProfileName, renameProfile, updateProfileAvatar, upsertProfile } from './src/profiles'
import { isFavoritePolicy, removeProfileFavorites, toggleFavoritePolicy } from './src/favorites'
import { createInitialSearchState } from './src/searchHistory'
import {
  loadAppState,
  loadFavoritePolicies,
  loadNotificationSettings,
  loadProfileSearchStates,
  resetAppState,
  saveActiveProfileId,
  saveFavoritePolicies,
  saveNotificationSettings,
  saveOnboarded,
  saveProfileSearchStates,
  saveProfiles,
} from './src/storage'
import { colors } from './src/theme'

const EMPTY_SEARCH_STATE = createInitialSearchState()

export default function App() {
  const [booting, setBooting] = useState(true)
  const [onboarded, setOnboarded] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [activeProfileId, setActiveProfileId] = useState('')
  const [apiBase, setApiBase] = useState(defaultApiBase())
  const [profileEditor, setProfileEditor] = useState(null)
  const [activeTab, setActiveTab] = useState('home')
  const [selectedPolicy, setSelectedPolicy] = useState(null)
  const [profileSearchStates, setProfileSearchStates] = useState({})
  const [favoritePoliciesByProfile, setFavoritePoliciesByProfile] = useState({})
  const [notificationSettings, setNotificationSettings] = useState({ newMatchingPolicies: true, deadlineReminders: true })

  const activeProfileEntry = profiles.find((entry) => entry.id === activeProfileId) || null
  const profile = activeProfileEntry?.data || null
  const searchProfileId = activeProfileId || 'guest'
  const searchState = profileSearchStates[searchProfileId] || EMPTY_SEARCH_STATE
  const favoritePolicies = favoritePoliciesByProfile[searchProfileId] || []

  useEffect(() => {
    Promise.all([loadAppState(), loadProfileSearchStates(), loadFavoritePolicies(), loadNotificationSettings()])
      .then(([state, savedSearchStates, savedFavorites, savedNotificationSettings]) => {
        setOnboarded(state.onboarded)
        setProfiles(state.profiles)
        setActiveProfileId(state.activeProfileId)
        if (state.apiBase) setApiBase(state.apiBase)
        if (savedSearchStates.__legacy__) {
          const { __legacy__, ...rest } = savedSearchStates
          setProfileSearchStates({ ...rest, [state.activeProfileId || 'guest']: __legacy__ })
        } else {
          setProfileSearchStates(savedSearchStates)
        }
        setFavoritePoliciesByProfile(savedFavorites)
        setNotificationSettings(savedNotificationSettings)
      })
      .catch(() => {})
      .finally(() => setBooting(false))
  }, [])

  useEffect(() => {
    if (booting || !onboarded) return
    saveProfileSearchStates(profileSearchStates).catch(() => {})
  }, [booting, onboarded, profileSearchStates])

  useEffect(() => {
    if (booting || !onboarded) return
    saveFavoritePolicies(favoritePoliciesByProfile).catch(() => {})
  }, [booting, onboarded, favoritePoliciesByProfile])

  useEffect(() => {
    if (booting || !onboarded) return
    saveNotificationSettings(notificationSettings).catch(() => {})
  }, [booting, onboarded, notificationSettings])

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
          isEditing={Boolean(editingEntry)}
          onCancel={() => setProfileEditor(null)}
          onComplete={async (nextProfile) => {
            const result = upsertProfile(profiles, editingEntry?.id || '', nextProfile, {
              name: editingEntry?.name || nextProfileName(profiles),
            })
            const saved = await saveProfiles(result.profiles, result.activeProfileId)
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
      <StatusBar barStyle={['home', 'my'].includes(activeTab) ? 'light-content' : 'dark-content'} backgroundColor={['home', 'my'].includes(activeTab) ? colors.green : colors.bg} />
      <View style={styles.body}>
        {activeTab === 'home' && (
          <HomeScreen
            {...common}
            profileName={activeProfileEntry?.name || '프로필'}
            onNavigate={setActiveTab}
            onEditProfile={() => setProfileEditor({ profileId: activeProfileId || null })}
          />
        )}
        {activeTab === 'calendar' && <CalendarScreen {...common} />}
        {activeTab === 'search' && (
          <SearchScreen
            {...common}
            searchState={searchState}
            onSearchStateChange={(update) => {
              setProfileSearchStates((current) => {
                const existing = current[searchProfileId] || EMPTY_SEARCH_STATE
                const next = typeof update === 'function' ? update(existing) : update
                return { ...current, [searchProfileId]: next }
              })
            }}
          />
        )}
        {activeTab === 'my' && (
          <MyScreen
            {...common}
            profiles={profiles}
            activeProfileId={activeProfileId}
            favoritePolicies={favoritePolicies}
            notificationSettings={notificationSettings}
            onSelectProfile={async (profileId) => {
              if (!profiles.some((entry) => entry.id === profileId)) return
              await saveActiveProfileId(profileId)
              setActiveProfileId(profileId)
            }}
            onAddProfile={() => setProfileEditor({ profileId: null })}
            onEditProfile={(profileId) => setProfileEditor({ profileId })}
            onRenameProfile={async (profileId, name) => {
              const nextProfiles = renameProfile(profiles, profileId, name)
              const saved = await saveProfiles(nextProfiles, activeProfileId)
              setProfiles(saved.profiles)
              setActiveProfileId(saved.activeProfileId)
            }}
            onChangeProfileImage={async (profileId, avatarUri) => {
              const nextProfiles = updateProfileAvatar(profiles, profileId, avatarUri)
              const saved = await saveProfiles(nextProfiles, activeProfileId)
              setProfiles(saved.profiles)
              setActiveProfileId(saved.activeProfileId)
            }}
            onNotificationSettingsChange={setNotificationSettings}
            onDeleteProfile={async (profileId) => {
              const result = deleteProfile(profiles, profileId, activeProfileId)
              const saved = await saveProfiles(result.profiles, result.activeProfileId)
              setProfiles(saved.profiles)
              setActiveProfileId(saved.activeProfileId)
              setProfileSearchStates((current) => {
                const next = { ...current }
                delete next[profileId]
                return next
              })
              setFavoritePoliciesByProfile((current) => removeProfileFavorites(current, profileId))
            }}
            onReset={async () => {
              await resetAppState()
              setProfiles([])
              setActiveProfileId('')
              setProfileSearchStates({})
              setFavoritePoliciesByProfile({})
              setNotificationSettings({ newMatchingPolicies: true, deadlineReminders: true })
              setOnboarded(false)
              setProfileEditor(null)
              setActiveTab('home')
            }}
          />
        )}
      </View>
      <BottomTabs active={activeTab} onChange={setActiveTab} />
      <PolicyDetailModal
        item={selectedPolicy}
        favorite={isFavoritePolicy(favoritePolicies, selectedPolicy)}
        onToggleFavorite={(item) => {
          if (!activeProfileId) return
          setFavoritePoliciesByProfile((current) => toggleFavoritePolicy(current, activeProfileId, item))
        }}
        onClose={() => setSelectedPolicy(null)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
})
