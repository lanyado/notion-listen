// Keep the webhook router up while one notion-listen launcher runs.
// The router exits once nothing is connected to it, and a session's channel
// server only connects after Claude Code starts, which can wait on a prompt
// (trusting a new folder) for as long as the user takes. This holds a
// connection from launch until the launcher exits, even if it is killed
// without running its cleanup.
//
//   node hold.mjs <router-socket> <launcher-pid>
import { connect } from 'node:net'

const [socketPath, launcher] = process.argv.slice(2)
const socket = connect(socketPath)
socket.on('error', () => process.exit(1))
socket.on('close', () => process.exit(0))
setInterval(() => {
  try { process.kill(Number(launcher), 0) } catch { process.exit(0) }
}, 2000)
