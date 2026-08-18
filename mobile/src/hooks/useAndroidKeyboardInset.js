import { useEffect, useRef, useState } from 'react'
import { Dimensions, Keyboard, Platform } from 'react-native'

const DEFAULT_KEYBOARD_CLEARANCE_DP = 8

export default function useAndroidKeyboardInset(clearanceDp = DEFAULT_KEYBOARD_CLEARANCE_DP) {
  const [inset, setInset] = useState(0)
  const restingWindowHeight = useRef(Dimensions.get('window').height)
  const keyboardHeight = useRef(0)

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined
    let frame = null

    const updateInset = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const currentWindowHeight = Dimensions.get('window').height
        const resizedBy = Math.max(0, restingWindowHeight.current - currentWindowHeight)
        const overlap = Math.max(0, keyboardHeight.current - resizedBy)
        setInset(overlap > 0 ? Math.ceil(overlap) + clearanceDp : 0)
      })
    }

    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardHeight.current = Math.max(0, Number(event.endCoordinates?.height) || 0)
      updateInset()
    })
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeight.current = 0
      setInset(0)
    })
    const dimensionsChanged = Dimensions.addEventListener('change', ({ window }) => {
      if (keyboardHeight.current > 0) {
        updateInset()
        return
      }
      restingWindowHeight.current = Math.max(restingWindowHeight.current, window.height)
    })

    return () => {
      if (frame) cancelAnimationFrame(frame)
      shown.remove()
      hidden.remove()
      dimensionsChanged.remove()
    }
  }, [clearanceDp])

  return inset
}
