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

const extraArgs = process.argv.slice(2)
const tunnel = extraArgs.includes('--tunnel')
const localhost = extraArgs.includes('--localhost')
const connectionSpecified = tunnel || localhost || extraArgs.includes('--lan')
const portSpecified = extraArgs.includes('--port') || extraArgs.some((arg) => arg.startsWith('--port='))

const addresses = Object.entries(networkInterfaces())
  .flatMap(([name, items]) => (items || []).map((item) => ({ ...item, name })))
  .filter((item) => item && item.family === 'IPv4' && !item.internal)
  .map((item) => ({
    ...item,
    score: addressScore(item.address)
      + (/wi-?fi|wireless|ethernet/i.test(item.name) ? 100 : 0)
      - (/vethernet|wsl|hyper-v|vmware|virtualbox|docker|vpn|tailscale/i.test(item.name) ? 200 : 0),
  }))
  .sort((left, right) => right.score - left.score)

const host = addresses[0]?.address
if (!host && !tunnel && !localhost) {
  console.error('Expo Go에서 사용할 PC의 IPv4 주소를 찾지 못했습니다.')
  console.error('Wi-Fi 또는 이더넷 연결을 확인한 뒤 다시 실행해주세요.')
  process.exit(1)
}

const expoCli = fileURLToPath(new URL('../node_modules/expo/bin/cli', import.meta.url))
const args = [
  'start',
  '--clear',
  '--go',
  ...(portSpecified ? [] : ['--port', '0']),
  ...(connectionSpecified ? [] : ['--lan']),
  ...extraArgs,
]
const env = { ...process.env }
if (!tunnel && !localhost) env.REACT_NATIVE_PACKAGER_HOSTNAME = host

if (tunnel) console.log('Expo Go 공개 터널을 시작합니다. 새 QR 코드를 다시 스캔해주세요.')
else if (localhost) console.log('Expo Go localhost 모드로 시작합니다.')
else console.log(`Expo Go LAN 접속 주소를 ${host}로 설정합니다.`)
const child = spawn(process.execPath, [expoCli, ...args], { env, stdio: 'inherit' })

child.on('exit', (code) => process.exit(code ?? 1))
child.on('error', (error) => {
  console.error(`Expo CLI를 시작하지 못했습니다: ${error.message}`)
  process.exit(1)
})
