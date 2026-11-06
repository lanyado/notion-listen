// Start a command fully detached from the terminal (its own session, like
// setsid, which macOS lacks), with output to a log file.
// The webhook router and its ngrok tunnel are shared by every session, so they
// must survive any one session's terminal closing or Claude exiting.
//
//   node daemon.mjs <log-file> <command> [args...]
import { spawn } from 'node:child_process'
import { openSync } from 'node:fs'

const [logFile, cmd, ...args] = process.argv.slice(2)
const fd = openSync(logFile, 'w')
const child = spawn(cmd, args, { detached: true, stdio: ['ignore', fd, fd] })
child.on('error', e => { console.error(`could not start ${cmd}: ${e.message}`); process.exit(1) })
child.on('spawn', () => { child.unref(); process.exit(0) })
