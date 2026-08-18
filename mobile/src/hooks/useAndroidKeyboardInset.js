import { useEffect, useRef, useState } from 'react'
import { Dimensions, Keyboard, Platform } from 'react-native'

const DEFAULT_KEYBOARD_CLEARANCE_DP = 8

export default function useAndroidKeyboardInset(targetRef, active = false, clearanceDp = DEFAULT_KEYBOARD_CLEARANCE_DP) {
  const [inset, setInset] = useState(0)
  const restingWindowHeight = useRef(Dimensions.get('window').height)
  const keyboardHeight = useRef(0)
  const keyboardTop = useRef(0)
  const insetRef = useRef(0)

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined
    let frame = null
    let poll = null

    const commitInset = (value) => {
      const next = Math.max(0, Math.ceil(value))
      insetRef.current = next
      setInset(next)
    }

    const updateInset = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const metrics = Keyboard.metrics?.()
        const top = Number(keyboardTop.current || metrics?.screenY) || 0
        if (top > 0 && targetRef?.current?.measureInWindow) {
          targetRef.current.measureInWindow((_x, y, _width, height) => {
            const originalBottom = y + height + insetRef.current
            commitInset(Math.max(0, originalBottom - top + clearanceDp))
          })
          return
        }

        const currentWindowHeight = Dimensions.get('window').height
        const resizedBy = Math.max(0, restingWindowHeight.current - currentWindowHeight)
        const overlap = Math.max(0, keyboardHeight.current - resizedBy)
        commitInset(overlap > 0 ? overlap + clearanceDp : 0)
      })
    }

    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardHeight.current = Math.max(0, Number(event.endCoordinates?.height) || 0)
      keyboardTop.current = Math.max(0, Number(event.endCoordinates?.screenY) || 0)
      updateInset()
    })
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeight.current = 0
      keyboardTop.current = 0
      commitInset(0)
    })
    const dimensionsChanged = Dimensions.addEventListener('change', ({ window }) => {
      if (keyboardHeight.current > 0) {
        updateInset()
        return
      }
      restingWindowHeight.current = Math.max(restingWindowHeight.current, window.height)
    })

    if (active) {
      let attempts = 0
      poll = setInterval(() => {
        attempts += 1
        const metrics = Keyboard.metrics?.()
        if (metrics) {
          keyboardHeight.current = Math.max(0, Number(metrics.height) || 0)
          keyboardTop.current = Math.max(0, Number(metrics.screenY) || 0)
          updateInset()
        }
        if (attempts >= 12 && poll) {
          clearInterval(poll)
          poll = null
        }
      }, 80)
    }

    return () => {
      if (frame) cancelAnimationFrame(frame)
      if (poll) clearInterval(poll)
      shown.remove()
      hidden.remove()
      dimensionsChanged.remove()
    }
  }, [active, clearanceDp, targetRef])

  return inset
}
