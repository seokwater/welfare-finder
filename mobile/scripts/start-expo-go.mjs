import { spawn } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'

function addressScore(address) {
  if (address.startsWith('192.168.')) return 30
  if (address.startsWith('10.')) return 20

  const match = address.match(/^172\.(\d+)\./)
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return 10
  return 0
}

const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((item) => item && item.family === 'IPv4' && !item.internal)
  .map((item) => item.address)
  .sort((left, right) => addressScore(right) - addressScore(left))

const host = addresses[0]
if (!host) {
  console.error('Expo Go에서 사용할 PC의 IPv4 주소를 찾지 못했습니다.')
  console.error('Wi-Fi 또는 이더넷 연결을 확인한 뒤 다시 실행해주세요.')
  process.exit(1)
}

const expoCli = fileURLToPath(new URL('../node_modules/expo/bin/cli', import.meta.url))
const args = ['start', '--clear', '--lan', ...process.argv.slice(2)]
const env = { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: host }

console.log(`Expo Go 접속 주소를 ${host}로 설정합니다.`)
const child = spawn(process.execPath, [expoCli, ...args], { env, stdio: 'inherit' })

child.on('exit', (code) => process.exit(code ?? 1))
