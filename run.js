const execa = require('execa')
const running = {}

setInterval(() => {
  // console.log({running: Object.keys(running)})
  for (const name in running) {
    if (running[name].exitCode != null) {
      delete running[name]
    }
  }
}, 100)

const run = (command, name, opts) => {
  // console.log({running})

  let r = running[name]

  if (r) {
    // console.log(running[name].killed, running[name].closed)
    if (opts.restart) r.kill()

    console.log('already runnning ' + name)
    return Promise.resolve(r)
  }

  r  = execa('bash', ['-c', command], opts)
  if (name) running[name] = r
  r.stdout.pipe(process.stdout)
  r.stderr.pipe(process.stderr)
  // console.log({running})
  return r
}

const healthcheck = (c, name) => {
 const r = running[name]
 if (r) return Promise.resolve(r)

 if (c.healthcheck)
    return run(c.healthcheck, `healthcheck ${name}`, {cwd: c.folder || '~'})

  return Promise.reject({})
}

module.exports = {run, healthcheck}
