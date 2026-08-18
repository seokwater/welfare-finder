import React, { useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import Entypo from '@expo/vector-icons/Entypo'
import * as ImagePicker from 'expo-image-picker'
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { colors, shadow } from '../theme'

function ageLabel(value) {
  const age = String(value || '').trim()
  if (!age) return '나이 미입력'
  if (age.startsWith('만 ')) return age.replace(/살/g, '세')
  if (/^\d/.test(age)) return `만 ${age.replace(/살/g, '세')}`
  return age
}

function updateDate(value) {
  if (!value) return '업데이트 기록 없음'
  return new Date(value).toLocaleDateString('ko-KR')
}

function favoriteMeta(item) {
  const policy = item?.policy || {}
  const criteria = item?.eligibility?.criteria || []
  const passed = criteria.filter((criterion) => criterion.status === 'pass').length
  const status = item?.eligibility?.status
  return {
    title: policy['정책명'] || '정책명 없음',
    support: policy['지원내용'] || policy['정책설명'] || '정책 상세에서 지원 내용을 확인해 주세요.',
    category: policy['정책대분류'] || policy['정책중분류'] || '맞춤 정책',
    badge: criteria.length ? `조건 ${passed}/${criteria.length} 충족` : status === 'likely' ? '조건 충족 가능성 높음' : '조건 확인 필요',
    good: status === 'likely' || (criteria.length > 0 && passed === criteria.length),
  }
}

export default function MyScreen({
  profile,
  profiles = [],
  activeProfileId,
  favoritePolicies = [],
  notificationSettings = { newMatchingPolicies: true, deadlineReminders: true },
  onSelectProfile,
  onAddProfile,
  onEditProfile,
  onRenameProfile,
  onChangeProfileImage,
  onDeleteProfile,
  onNotificationSettingsChange,
  onOpenPolicy,
  onReset,
}) {
  const [profileChooserVisible, setProfileChooserVisible] = useState(false)
  const [favoritesVisible, setFavoritesVisible] = useState(false)
  const [renamingProfile, setRenamingProfile] = useState(null)
  const [profileNameInput, setProfileNameInput] = useState('')
  const [profileNameError, setProfileNameError] = useState('')
  const activeProfile = profiles.find((entry) => entry.id === activeProfileId) || null

  const confirmReset = () => {
    Alert.alert('앱 초기화', '저장한 프로필, 찜한 정책, 알림 설정과 검색 기록을 모두 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '초기화', style: 'destructive', onPress: onReset },
    ])
  }

  const confirmDelete = (entry) => {
    Alert.alert('프로필 삭제', `“${entry.name}” 프로필과 이 프로필의 찜·검색 기록을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => onDeleteProfile(entry.id) },
    ])
  }

  const openRename = (entry) => {
    setProfileChooserVisible(false)
    setRenamingProfile(entry)
    setProfileNameInput(entry.name)
    setProfileNameError('')
  }

  const closeRename = () => {
    setRenamingProfile(null)
    setProfileNameInput('')
    setProfileNameError('')
  }

  const saveProfileName = async () => {
    const nextName = profileNameInput.replace(/\s+/g, ' ').trim()
    if (!nextName) {
      setProfileNameError('프로필 이름을 입력해주세요.')
      return
    }
    if (profiles.some((entry) => entry.id !== renamingProfile?.id && entry.name === nextName)) {
      setProfileNameError('이미 사용 중인 프로필 이름입니다.')
      return
    }
    await onRenameProfile(renamingProfile.id, nextName)
    closeRename()
  }

  const changeProfileImage = async () => {
    if (!activeProfile) {
      onAddProfile()
      return
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('사진 접근 권한 필요', '프로필 이미지를 변경하려면 사진 접근을 허용해 주세요.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
      const uri = result.assets?.[0]?.uri
      if (!result.canceled && uri) await onChangeProfileImage(activeProfile.id, uri)
    } catch {
      Alert.alert('이미지 선택 실패', '프로필 이미지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  const setNotification = (key, value) => {
    onNotificationSettingsChange({ ...notificationSettings, [key]: value })
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.heroHeader}>
          <Text style={styles.pageTitle}>My</Text>
        </View>

        <View style={styles.profileCard}>
          {activeProfile ? (
            <>
              <View style={styles.profileTop}>
                <TouchableOpacity accessibilityLabel="프로필 이미지 변경" activeOpacity={0.8} onPress={changeProfileImage} style={styles.avatarButton}>
                  {activeProfile.avatarUri ? (
                    <Image source={{ uri: activeProfile.avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarFallback}><Ionicons name="person" size={44} color={colors.greenDark} /></View>
                  )}
                  <View style={styles.cameraBadge}><Ionicons name="camera" size={13} color={colors.white} /></View>
                </TouchableOpacity>

                <View style={styles.profileIdentity}>
                  <View style={styles.nameRow}>
                    <Text numberOfLines={1} style={styles.profileName}>{activeProfile.name}</Text>
                    <TouchableOpacity accessibilityLabel="프로필 이름 수정" onPress={() => openRename(activeProfile)} style={styles.nameEdit}>
                      <Ionicons name="pencil" size={14} color={colors.greenDark} />
                    </TouchableOpacity>
                  </View>
                </View>

              </View>

              <View style={styles.profileFacts}>
                <ProfileFact icon="location" value={profile?.location || '지역 미입력'} />
                <ProfileFact cake value={ageLabel(profile?.age)} />
                <ProfileFact icon="briefcase" value={profile?.employment || '직업 미입력'} />
              </View>
              <View style={styles.updateRow}>
                <Ionicons name="time-outline" size={15} color={colors.muted} />
                <Text style={styles.updateText}>내 정보가 마지막으로 업데이트 된 날짜  {updateDate(activeProfile.updatedAt)}</Text>
              </View>
            </>
          ) : (
            <TouchableOpacity style={styles.emptyProfile} onPress={onAddProfile}>
              <View style={styles.emptyProfileIcon}><Ionicons name="person-add" size={25} color={colors.greenDark} /></View>
              <Text style={styles.emptyProfileTitle}>프로필을 만들어보세요</Text>
              <Text style={styles.emptyProfileText}>프로필을 만들면 맞춤 정책과 찜 목록을 관리할 수 있어요.</Text>
            </TouchableOpacity>
          )}
        </View>

        {!!activeProfile && (
          <View style={styles.profileToolbar}>
            <TouchableOpacity style={styles.editButton} onPress={() => onEditProfile(activeProfile.id)}>
              <Ionicons name="create-outline" size={17} color={colors.greenDark} />
              <Text style={styles.editButtonText}>정보 수정</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.switchProfileButton} onPress={() => setProfileChooserVisible(true)}>
              <Ionicons name="people-outline" size={17} color={colors.text} />
              <Text style={styles.switchProfileText}>프로필 변경하기</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>찜한 정책</Text>
          <Text style={styles.sectionCount}>{favoritePolicies.length}개</Text>
        </View>
        <View style={styles.listCard}>
          {favoritePolicies.length ? favoritePolicies.slice(0, 2).map((entry, index) => (
            <FavoritePolicyRow key={entry.id || index} item={entry.item} onPress={() => onOpenPolicy(entry.item)} last={index === Math.min(favoritePolicies.length, 2) - 1} />
          )) : (
            <View style={styles.emptyFavorites}>
              <View style={styles.emptyFavoriteIcon}><Ionicons name="bookmark-outline" size={25} color={colors.greenDark} /></View>
              <Text style={styles.emptyFavoriteTitle}>아직 찜한 정책이 없어요</Text>
              <Text style={styles.emptyFavoriteText}>정책 상세 화면의 북마크를 눌러 관심 정책을 모아보세요.</Text>
            </View>
          )}
        </View>
        {!!favoritePolicies.length && (
          <TouchableOpacity style={styles.moreFavoritesButton} onPress={() => setFavoritesVisible(true)}>
            <Text style={styles.moreFavoritesText}>찜한 정책 더보기</Text>
            <Ionicons name="chevron-down" size={13} color={colors.muted} />
          </TouchableOpacity>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>정책 알림 설정</Text>
        </View>
        <View style={styles.listCard}>
          <NotificationRow
            icon="notifications"
            color={colors.greenDark}
            background={colors.greenSoft}
            title="새로운 맞춤 정책 알림"
            description="내 프로필에 맞는 새 정책이 등록되면 알려드려요."
            value={notificationSettings.newMatchingPolicies}
            onValueChange={(value) => setNotification('newMatchingPolicies', value)}
          />
          <NotificationRow
            icon="time"
            color={colors.purple}
            background="#F1EEFF"
            title="신청 마감 임박 알림"
            description="찜한 정책의 신청 마감일을 놓치지 않게 알려드려요."
            value={notificationSettings.deadlineReminders}
            onValueChange={(value) => setNotification('deadlineReminders', value)}
            last
          />
        </View>

        <TouchableOpacity style={styles.resetLink} onPress={confirmReset}>
          <Ionicons name="refresh-outline" size={14} color={colors.muted} />
          <Text style={styles.resetLinkText}>모든 프로필 및 앱 데이터 초기화</Text>
        </TouchableOpacity>
        <Text style={styles.version}>정check Mobile v2.0</Text>
      </ScrollView>

      <Modal visible={profileChooserVisible} transparent animationType="fade" onRequestClose={() => setProfileChooserVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setProfileChooserVisible(false)}>
          <Pressable style={styles.chooserCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalTitleRow}>
              <View><Text style={styles.modalTitle}>프로필 변경하기</Text><Text style={styles.modalHelp}>선택한 프로필로 추천과 찜 목록이 바뀝니다.</Text></View>
              <TouchableOpacity onPress={() => setProfileChooserVisible(false)}><Ionicons name="close" size={25} color={colors.ink} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.profileList}>
              {profiles.map((entry) => {
                const active = entry.id === activeProfileId
                return (
                  <View key={entry.id} style={[styles.profileOption, active && styles.profileOptionActive]}>
                    <TouchableOpacity style={styles.profileOptionMain} onPress={async () => { await onSelectProfile(entry.id); setProfileChooserVisible(false) }}>
                      {entry.avatarUri ? <Image source={{ uri: entry.avatarUri }} style={styles.optionAvatarImage} /> : <View style={styles.optionAvatar}><Ionicons name="person" size={20} color={colors.greenDark} /></View>}
                      <View style={{ flex: 1 }}><Text style={styles.optionName}>{entry.name}</Text><Text numberOfLines={1} style={styles.optionMeta}>{[entry.data.location, ageLabel(entry.data.age), entry.data.employment].filter(Boolean).join(' · ')}</Text></View>
                      {active && <Ionicons name="checkmark-circle" size={22} color={colors.green} />}
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityLabel={`${entry.name} 이름 수정`} style={styles.optionAction} onPress={() => openRename(entry)}><Ionicons name="pencil-outline" size={18} color={colors.greenDark} /></TouchableOpacity>
                    <TouchableOpacity accessibilityLabel={`${entry.name} 삭제`} style={styles.optionAction} onPress={() => confirmDelete(entry)}><Ionicons name="trash-outline" size={18} color={colors.danger} /></TouchableOpacity>
                  </View>
                )
              })}
            </ScrollView>
            <TouchableOpacity style={styles.addProfileButton} onPress={() => { setProfileChooserVisible(false); onAddProfile() }}>
              <Ionicons name="add" size={20} color={colors.white} /><Text style={styles.addProfileText}>새 프로필 추가</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={favoritesVisible} transparent animationType="fade" onRequestClose={() => setFavoritesVisible(false)}>
        <View style={styles.favoritesModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFavoritesVisible(false)} />
          <View style={styles.favoritesSheet}>
            <View style={styles.favoritesSheetHeader}>
              <View>
                <Text style={styles.favoritesSheetTitle}>찜한 정책 목록</Text>
                <Text style={styles.favoritesSheetCount}>현재 프로필에 저장된 정책 {favoritePolicies.length}개</Text>
              </View>
              <TouchableOpacity accessibilityLabel="찜한 정책 목록 닫기" style={styles.closeSheetButton} onPress={() => setFavoritesVisible(false)}>
                <Ionicons name="close" size={24} color={colors.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.favoritesList} contentContainerStyle={styles.favoritesListContent}>
              {favoritePolicies.map((entry, index) => (
                <FavoritePolicyRow
                  key={entry.id || index}
                  item={entry.item}
                  last={index === favoritePolicies.length - 1}
                  onPress={() => {
                    setFavoritesVisible(false)
                    setTimeout(() => onOpenPolicy(entry.item), 180)
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(renamingProfile)} transparent animationType="fade" onRequestClose={closeRename}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlay} onPress={closeRename}>
            <Pressable style={styles.renameCard} onPress={(event) => event.stopPropagation()}>
              <View style={styles.renameIcon}><Ionicons name="person-outline" size={22} color={colors.greenDark} /></View>
              <Text style={styles.renameTitle}>프로필 이름 수정</Text>
              <Text style={styles.renameHelp}>홈 인사말과 프로필 목록에 표시할 이름입니다.</Text>
              <TextInput
                autoFocus
                value={profileNameInput}
                onChangeText={(value) => { setProfileNameInput(value); setProfileNameError('') }}
                onSubmitEditing={saveProfileName}
                maxLength={20}
                selectTextOnFocus
                returnKeyType="done"
                placeholder="예: 나, 취업 준비, 가족"
                placeholderTextColor="#A0A8A3"
                style={[styles.renameInput, profileNameError && styles.renameInputError]}
              />
              {!!profileNameError && <Text style={styles.renameError}>{profileNameError}</Text>}
              <View style={styles.renameActions}>
                <TouchableOpacity style={styles.renameCancel} onPress={closeRename}><Text style={styles.renameCancelText}>취소</Text></TouchableOpacity>
                <TouchableOpacity style={styles.renameSave} onPress={saveProfileName}><Text style={styles.renameSaveText}>저장</Text></TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

function ProfileFact({ icon, cake, value }) {
  return <View style={styles.fact}>{cake ? <Entypo name="cake" size={15} color={colors.muted} /> : <Ionicons name={icon} size={15} color={colors.muted} />}<Text numberOfLines={1} style={styles.factText}>{value}</Text></View>
}

function FavoritePolicyRow({ item, onPress, last }) {
  const meta = favoriteMeta(item)
  const icon = meta.category.includes('주거') ? 'home' : meta.category.includes('취업') ? 'briefcase' : 'gift'
  return (
    <TouchableOpacity style={[styles.favoriteRow, last && styles.lastRow]} onPress={onPress}>
      <Ionicons name="bookmark" size={25} color={colors.green} />
      <View style={styles.policyIcon}><Ionicons name={icon} size={22} color={colors.greenDark} /></View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.favoriteTitle}>{meta.title}</Text>
        <Text numberOfLines={1} style={styles.favoriteSupport}>{meta.support}</Text>
        <View style={[styles.conditionBadge, !meta.good && styles.conditionBadgeCheck]}><Text style={[styles.conditionText, !meta.good && styles.conditionTextCheck]}>{meta.badge}</Text></View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9BA59F" />
    </TouchableOpacity>
  )
}

function NotificationRow({ icon, color, background, title, description, value, onValueChange, last }) {
  return (
    <View style={[styles.notificationRow, last && styles.lastRow]}>
      <View style={[styles.notificationIcon, { backgroundColor: background }]}><Ionicons name={icon} size={23} color={color} /></View>
      <View style={{ flex: 1 }}><Text style={styles.notificationTitle}>{title}</Text><Text style={styles.notificationDescription}>{description}</Text></View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#D4DAD6', true: '#74D7A8' }} thumbColor={value ? colors.green : '#F6F7F6'} ios_backgroundColor="#D4DAD6" />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 34 },
  heroHeader: { height: 150, backgroundColor: colors.green, paddingHorizontal: 22, paddingTop: 35 },
  pageTitle: { color: colors.white, fontSize: 28, fontWeight: '900' },
  profileCard: { marginHorizontal: 14, marginTop: -58, minHeight: 190, padding: 17, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, ...shadow },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatarButton: { width: 76, height: 76 },
  avatarImage: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.greenSoft },
  avatarFallback: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cameraBadge: { position: 'absolute', right: -1, bottom: 1, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.green, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  profileIdentity: { flex: 1, minWidth: 52 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  profileName: { flexShrink: 1, color: colors.ink, fontSize: 20, fontWeight: '900' },
  nameEdit: { padding: 7 },
  profileToolbar: { flexDirection: 'row', gap: 9, marginHorizontal: 14, marginTop: 12 },
  editButton: { flex: 1, height: 46, borderRadius: 13, borderWidth: 1, borderColor: '#B9E2CB', backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  editButtonText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  switchProfileButton: { flex: 1, height: 46, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  switchProfileText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  profileFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 17, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  updateRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 },
  updateText: { color: colors.muted, fontSize: 9, lineHeight: 14 },
  emptyProfile: { flex: 1, minHeight: 154, alignItems: 'center', justifyContent: 'center' },
  emptyProfileIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  emptyProfileTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 11 },
  emptyProfileText: { color: colors.muted, fontSize: 10, marginTop: 5, textAlign: 'center' },
  sectionHeader: { marginHorizontal: 20, marginTop: 28, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  sectionCount: { color: colors.greenDark, fontSize: 11, fontWeight: '800' },
  listCard: { marginHorizontal: 14, borderRadius: 20, paddingHorizontal: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadow },
  favoriteRow: { minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  lastRow: { borderBottomWidth: 0 },
  policyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  favoriteTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  favoriteSupport: { color: colors.muted, fontSize: 9, marginTop: 5 },
  conditionBadge: { alignSelf: 'flex-start', borderRadius: 99, borderWidth: 1, borderColor: '#B9E2CB', backgroundColor: colors.greenPale, paddingHorizontal: 8, paddingVertical: 4, marginTop: 7 },
  conditionBadgeCheck: { borderColor: '#F2C48D', backgroundColor: colors.warningSoft },
  conditionText: { color: colors.greenDark, fontSize: 8, fontWeight: '900' },
  conditionTextCheck: { color: '#C46B15' },
  emptyFavorites: { minHeight: 145, alignItems: 'center', justifyContent: 'center', padding: 18 },
  emptyFavoriteIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  emptyFavoriteTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 10 },
  emptyFavoriteText: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  moreFavoritesButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 12, paddingVertical: 8, marginTop: 5 },
  moreFavoritesText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  notificationRow: { minHeight: 91, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  notificationIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  notificationTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  notificationDescription: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 5 },
  resetLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 5, marginTop: 25, padding: 8 },
  resetLinkText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  version: { textAlign: 'center', color: '#A7AEA9', fontSize: 9 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16, 27, 21, 0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  favoritesModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16, 27, 21, 0.45)' },
  favoritesSheet: { maxHeight: '80%', minHeight: 280, backgroundColor: colors.white, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 16, paddingTop: 18, paddingBottom: Platform.OS === 'ios' ? 28 : 18 },
  favoritesSheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 2, paddingBottom: 12 },
  favoritesSheetTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  favoritesSheetCount: { color: colors.muted, fontSize: 10, marginTop: 5 },
  closeSheetButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  favoritesList: { borderWidth: 1, borderColor: colors.line, borderRadius: 18 },
  favoritesListContent: { paddingHorizontal: 13 },
  chooserCard: { width: '100%', maxWidth: 400, maxHeight: '75%', borderRadius: 23, backgroundColor: colors.white, padding: 18 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  modalTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  modalHelp: { color: colors.muted, fontSize: 10, marginTop: 5 },
  profileList: { marginTop: 14 },
  profileOption: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 15, marginBottom: 8, padding: 8 },
  profileOptionActive: { borderColor: colors.green, backgroundColor: colors.greenPale },
  profileOptionMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  optionAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  optionAvatarImage: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenSoft },
  optionName: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  optionMeta: { color: colors.muted, fontSize: 8, marginTop: 4 },
  optionAction: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  addProfileButton: { height: 46, borderRadius: 13, backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  addProfileText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  modalKeyboard: { flex: 1 },
  renameCard: { width: '100%', maxWidth: 380, borderRadius: 22, backgroundColor: colors.white, padding: 20 },
  renameIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  renameTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 14 },
  renameHelp: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  renameInput: { height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 13, marginTop: 16, color: colors.ink, fontSize: 14, fontWeight: '700', backgroundColor: '#FAFCFB' },
  renameInputError: { borderColor: colors.danger },
  renameError: { color: colors.danger, fontSize: 10, marginTop: 6 },
  renameActions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  renameCancel: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  renameCancelText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  renameSave: { flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  renameSaveText: { color: colors.white, fontSize: 12, fontWeight: '900' },
})
