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
import { createInitialSearchState } from './src/searchHistory'
import { loadAppState, loadSearchState, resetAppState, saveApiBase, saveOnboarded, saveProfile, saveSearchState } from './src/storage'
import { colors } from './src/theme'

export default function App() {
  const [booting, setBooting] = useState(true)
  const [onboarded, setOnboarded] = useState(false)
  const [profile, setProfile] = useState(null)
  const [apiBase, setApiBase] = useState(defaultApiBase())
  const [profileFlow, setProfileFlow] = useState(false)
  const [activeTab, setActiveTab] = useState('home')
  const [selectedPolicy, setSelectedPolicy] = useState(null)
  const [searchState, setSearchState] = useState(() => createInitialSearchState())

  useEffect(() => {
    Promise.all([loadAppState(), loadSearchState()])
      .then(([state, savedSearchState]) => {
        setOnboarded(state.onboarded)
        setProfile(state.profile)
        if (state.apiBase) setApiBase(state.apiBase)
        if (savedSearchState) setSearchState(savedSearchState)
      })
      .catch(() => {})
      .finally(() => setBooting(false))
  }, [])

  useEffect(() => {
    if (booting || !onboarded) return
    saveSearchState(searchState).catch(() => {})
  }, [booting, onboarded, searchState])

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
            setProfileFlow(true)
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

  if (profileFlow) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <AIProfileScreen
          apiBase={apiBase}
          initialProfile={profile}
          onCancel={() => setProfileFlow(false)}
          onComplete={async (nextProfile) => {
            await saveProfile(nextProfile)
            setProfile(nextProfile)
            setProfileFlow(false)
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
            onEditProfile={() => setProfileFlow(true)}
          />
        )}
        {activeTab === 'calendar' && <CalendarScreen {...common} />}
        {activeTab === 'search' && (
          <SearchScreen
            {...common}
            searchState={searchState}
            onSearchStateChange={setSearchState}
          />
        )}
        {activeTab === 'my' && (
          <MyScreen
            {...common}
            onEditProfile={() => setProfileFlow(true)}
            onSaveApiBase={async (next) => {
              const saved = await saveApiBase(next)
              setApiBase(saved || defaultApiBase())
            }}
            onReset={async () => {
              await resetAppState()
              setProfile(null)
              setSearchState(createInitialSearchState())
              setOnboarded(false)
              setProfileFlow(false)
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
